import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
import {SYNTHETIC_ERC20_APPROVAL_EVENT,ERC20_TRANSFER_TOPIC0} from "../erc20-event-preflight.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const VM1="0x4e3106520e40af30870cafe78da1b1e7110ed98e";
const USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913";
const PATH="/v1/erc20-event-preflight";
const query=(words)=>PATH+"?"+new URLSearchParams(words).toString();
function readQuote(response){
 assert.equal(response.status,402);
 const header=response.headers.get("PAYMENT-REQUIRED");assert.ok(header);
 assert.equal(response.headers.get("X-Payment-Required"),header);
 const q=JSON.parse(Buffer.from(header,"base64").toString("utf8"));
 assert.equal(q.x402Version,2);assert.equal(q.accepts.length,1);
 const a=q.accepts[0];
 assert.equal(a.network,"eip155:8453");assert.equal(a.scheme,"exact");
 assert.equal(a.amount,"10000");assert.equal(a.asset.toLowerCase(),USDC.toLowerCase());
 assert.equal(a.payTo.toLowerCase(),VM1);assert.equal(a.extra.name,"USD Coin");
 return q;
}
function testOnlySignedPayload(q){
 return Buffer.from(JSON.stringify({
  x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
  payload:{signature:"0x"+"11".repeat(65),authorization:{
   from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,
   value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
  }}
 })).toString("base64");
}
test("Free sample reports fictional sample, no x402 payment, no transaction",async()=>{
 const r=await fetch(BASE+"/v1/erc20-event-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const j=await r.json();assert.equal(j.paid,false);assert.equal(j.exampleOnly,true);
 assert.equal(j.chargedUSDC,"0");assert.equal(j.eventType,"Approval");
 assert.equal(j.unlimitedApprovalEvent,true);assert.equal(j.payTo.toLowerCase(),VM1);
 assert.deepEqual(j.input,SYNTHETIC_ERC20_APPROVAL_EVENT);
});
test("Unpaid valid synthetic default has canonical Base native USDC quote and matching JSON only",async()=>{
 const r=await fetch(BASE+PATH);const q=readQuote(r);
 assert.deepEqual(await r.json(),q);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
 const catalog=(await(await fetch(BASE+"/discovery/resources")).json()).items;
 const c=catalog.find(row=>row.resource===BASE+PATH);
 assert.ok(c);assert.equal(c.accepts[0].amount,"10000");assert.equal(c.accepts[0].payTo.toLowerCase(),VM1);
 const marketplace=(await(await fetch(BASE+"/.well-known/x402-bazaar-manifest.json")).json()).resources;
 assert.ok(marketplace.some(x=>x.url===BASE+PATH&&x.accepts[0].payTo.toLowerCase()===VM1));
});
test("Valid REAL public syntactic Transfer values also quote but never sign a real transaction",async()=>{
 const input={topic0:ERC20_TRANSFER_TOPIC0,
  topic1:"0x"+"0".repeat(24)+"11".repeat(20),
  topic2:"0x"+"0".repeat(24)+"22".repeat(20),
  data:"0x"+BigInt(1000).toString(16).padStart(64,"0")};
 const r=await fetch(BASE+query(input));const q=readQuote(r);
 assert.deepEqual(await r.json(),q);
});
test("Partial, duplicate, wrong type or ERC721-shaped event rejected BEFORE charging",async()=>{
 const valid={...SYNTHETIC_ERC20_APPROVAL_EVENT};
 const samples=[
  PATH+"?topic0="+valid.topic0,
  PATH+"?unknown=abcd",
  PATH+"?topic0=x&topic1=x&topic2=x&data=x",
  PATH+"?topic0=x&topic0=x&topic1=x&topic2=x&data=x",
  query({...valid,topic0:"0x"+"00".repeat(32)}),
  query({...valid,topic1:"0x"+"12".repeat(32)}),
  query({...valid,data:"0x12"}),
  query({...valid,topic3:"0x"+"22".repeat(32)}),
  PATH+"?"+("x".repeat(420))
 ];
 for(const url of samples){
  const r=await fetch(BASE+url);
  assert.equal(r.status,400,url.slice(0,140));
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  assert.equal((await r.json()).charged,false);
 }
});
test("Test-mode mock x402 verifies paid route works; simulation is NOT an owner or buyer paid receipt",async()=>{
 const quoted=readQuote(await fetch(BASE+PATH));
 const paid=await fetch(BASE+PATH,{headers:{"PAYMENT-SIGNATURE":testOnlySignedPayload(quoted)}});
 assert.equal(paid.status,200);
 assert.ok(paid.headers.get("PAYMENT-RESPONSE"));
 const j=await paid.json();assert.equal(j.kind,"evm_erc20_unsigned_event_log_preflight");
 assert.equal(j.paid,true);assert.equal(j.chargedUSDC,"0.01");
 assert.equal(j.eventType,"Approval");assert.equal(j.unlimitedApprovalEvent,true);
 assert.equal(j.exampleOnly,true);assert.equal(j.confirmedIndependentPaidBuyers,0);
 assert.equal(j.originalVM1PayoutAddress.toLowerCase(),VM1);
 assert.equal(j.emitterContractVerified,false);assert.equal(j.logInFinalizedReceiptVerified,false);
});
test("OpenAPI accepts exactly four hex fields; free and paid paths, separate from calldata decoder",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.deepEqual(d.spec.paths["/v1/erc20-event-sample"].get.security,[]);
 const operation=d.spec.paths[PATH].get;assert.ok(operation);
 assert.equal(operation["x-payment-info"].payTo.toLowerCase(),VM1);
 assert.equal(operation["x-payment-info"].price.amount,"0.01");
 assert.deepEqual(operation.parameters.map(x=>x.name),["topic0","topic1","topic2","data"]);
 const req=operation.responses["200"].content["application/json"].schema.required;
 for(const field of ["decoded","warnings","unlimitedApprovalEvent","originalVM1PayoutAddress","noWalletOrChainCalls"])
  assert.ok(req.includes(field),field);
 assert.ok(d.spec.paths["/v1/erc20-calldata-preflight"]);
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com"+PATH));
});
