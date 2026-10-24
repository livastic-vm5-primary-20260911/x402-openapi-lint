import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
import {DEFAULT_ERC20_CALLDATA} from "../erc20-calldata-preflight.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const VM1="0x4e3106520E40af30870caFE78da1B1e7110eD98E";
const CIRCLE="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAID="/v1/erc20-calldata-preflight";
function readQuote(r){
 const b64=r.headers.get("PAYMENT-REQUIRED");assert.ok(b64);
 const quote=JSON.parse(Buffer.from(b64,"base64").toString());
 assert.equal(quote.x402Version,2);assert.equal(quote.accepts.length,1);
 const a=quote.accepts[0];
 assert.equal(a.scheme,"exact");assert.equal(a.amount,"10000");
 assert.equal(a.network,"eip155:8453");assert.equal(a.asset.toLowerCase(),CIRCLE.toLowerCase());
 assert.equal(a.payTo.toLowerCase(),VM1.toLowerCase());assert.equal(a.extra.name,"USD Coin");
 return quote;
}
function localMockPayment(q){
 return Buffer.from(JSON.stringify({
  x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
  payload:{signature:"0x"+"11".repeat(65),
  authorization:{from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,
  validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)}}
 })).toString("base64");
}
test("OpenAPI publishes one distinct VM1 wallet-paid ABI decoder with truthful JSON contract",()=>{
 const spec=makeDiscovery("https://vm5-openapi-x402.onrender.com").spec;
 const op=spec.paths[PAID].get;
 assert.equal(op["x-payment-info"].payTo.toLowerCase(),VM1.toLowerCase());
 assert.equal(op["x-payment-info"].price.amount,"0.01");
 assert.equal(op.parameters.length,1);assert.equal(op.parameters[0].name,"calldata");
 const schema=op.responses["200"].content["application/json"].schema;
 for(const field of ["method","decoded","warningCount","warnings","allowanceUnlimited","originalVM1PayoutAddress","noWalletOrBlockchainUsed"])
  assert.ok(schema.required.includes(field),field);
 assert.deepEqual(spec.paths["/v1/erc20-calldata-sample"].get.security,[]);
});
test("Original synthetic preview is fully free; no customer or payment asserted",async()=>{
 const r=await fetch(BASE+"/v1/erc20-calldata-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("payment-required"),null);
 const j=await r.json();
 assert.equal(j.exampleOnly,true);assert.equal(j.paid,false);assert.equal(j.chargedUSDC,"0");
 assert.equal(j.input,DEFAULT_ERC20_CALLDATA);assert.equal(j.warnings[0].code,"UNLIMITED_ALLOWANCE");
 assert.equal(j.payTo.toLowerCase(),VM1.toLowerCase());
});
test("Canonical quote/JSON legacy alias exactly match, still require the buyer's own payment",async()=>{
 const r=await fetch(BASE+PAID);
 assert.equal(r.status,402);const q=readQuote(r);
 assert.equal(r.headers.get("X-Payment-Required"),r.headers.get("PAYMENT-REQUIRED"));
 assert.deepEqual(await r.json(),q);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
 assert.equal(q.extensions.bazaar.info.input.method,"GET");
 assert.equal(q.extensions.bazaar.info.output.example.method,"approve");
 const entry=(await(await fetch(BASE+"/discovery/resources")).json()).items.find(x=>x.resource===BASE+PAID);
 assert.ok(entry);assert.equal(entry.accepts[0].amount,"10000");
 assert.equal(entry.accepts[0].payTo.toLowerCase(),VM1.toLowerCase());
});
test("All malformed ABI and query attempts return unpaid 400 before the x402 paywall",async()=>{
 for(const suffix of ["?calldata=xyz","?calldata=0x12345678","?calldata=0xa9059cbb","?unexpected=1",
  "?calldata=0x123&calldata=0x456","?payTo=0x1","?calldata="+"a".repeat(500)]){
  const r=await fetch(BASE+PAID+suffix);
  assert.equal(r.status,400,suffix.slice(0,35));
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  const j=await r.json();assert.equal(j.charged,false);
 }
});
test("LOCAL MOCK ONLY: signed test fixture delivers real decoded report without actual USDC or blockchain",async()=>{
 const q=readQuote(await fetch(BASE+PAID));
 const r=await fetch(BASE+PAID,{headers:{"PAYMENT-SIGNATURE":localMockPayment(q)}});
 assert.equal(r.status,200);assert.ok(r.headers.get("PAYMENT-RESPONSE"));
 const j=await r.json();
 assert.equal(j.ok,true);assert.equal(j.paid,true);
 assert.equal(j.chargedUSDC,"0.01");assert.equal(j.method,"approve");
 assert.equal(j.warnings[0].code,"UNLIMITED_ALLOWANCE");assert.equal(j.allowanceUnlimited,true);
 assert.equal(j.originalVM1PayoutAddress.toLowerCase(),VM1.toLowerCase());
 assert.equal(j.confirmedIndependentBuyersForRoute,0);
 assert.equal(j.noWalletOrBlockchainUsed,true);
});
