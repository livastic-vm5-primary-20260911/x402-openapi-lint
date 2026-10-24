import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const VM1="0x4e3106520e40af30870cafe78da1b1e7110ed98e";
const USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const PATH="/v1/base-usdc-allowance";
const O="0x1111111111111111111111111111111111111111";
const S="0x2222222222222222222222222222222222222222";
const query="?owner="+O+"&spender="+S;
function q402(r){
 assert.equal(r.status,402);const h=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(h);assert.equal(r.headers.get("X-Payment-Required"),h);
 const q=JSON.parse(Buffer.from(h,"base64").toString());
 assert.equal(q.x402Version,2);assert.equal(q.accepts.length,1);
 const a=q.accepts[0];assert.equal(a.amount,"10000");assert.equal(a.network,"eip155:8453");
 assert.equal(a.scheme,"exact");assert.equal(a.asset.toLowerCase(),USDC.toLowerCase());
 assert.equal(a.payTo.toLowerCase(),VM1);assert.equal(a.extra.name,"USD Coin");
 return q;
}
function mockPayment(q){
 return Buffer.from(JSON.stringify({
   x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
   payload:{signature:"0x"+"11".repeat(65),authorization:{
     from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,
     validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)}}})).toString("base64");
}
test("Free fixture explicitly NOT live public RPC and no payment whatsoever",async()=>{
 const r=await fetch(BASE+"/v1/base-usdc-allowance-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const j=await r.json();
 assert.equal(j.exampleOnly,true);assert.equal(j.paid,false);assert.equal(j.chargedUSDC,"0");
 assert.equal(j.illustrationNotAnOnchainObservation,true);
 assert.equal(j.publicRpcSource,"FICTIONAL_NO_RPC_USED");
 assert.equal(j.allowanceUSDC,"100.000000");assert.equal(j.ownerBalanceUSDC,"1.150000");
});
test("Genuinely fresh pinned block from test-only RPC before quote, even on the default public owner pair",async()=>{
 const r=await fetch(BASE+PATH);const quote=q402(r);
 assert.deepEqual(await r.json(),quote);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
});
test("Malformed, partial, duplicate, unexpected token/RPC/chain query all fail HTTP400 BEFORE payment",async()=>{
 const cases=[
  "?owner="+O,
  "?spender="+S,
  "?owner="+O+"&spender=0x3",
  "?owner="+O+"&spender="+S+"&token="+USDC,
  "?owner="+O+"&spender="+S+"&rpc=https://evil.test",
  "?owner="+O+"&owner="+S+"&spender="+S,
  "?owner="+O+"&spender="+S+"&chainId=1",
  "?owner="+O+"&spender="+S+"&data=0x",
  "?token="+USDC,
  "?owner="+O+"&spender="+S+"&extra="+("x".repeat(240))
 ];
 for(const suffix of cases){
  const r=await fetch(BASE+PATH+suffix);
  assert.equal(r.status,400,suffix.slice(0,90));
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  assert.equal((await r.json()).charged,false);
 }
});
test("One genuine buyer-side mock payment yields a complete read-only Base USDC snapshot",async()=>{
 const r=await fetch(BASE+PATH+query);const q=q402(r);
 assert.deepEqual(await r.json(),q);
 const settled=await fetch(BASE+PATH+query,{headers:{"PAYMENT-SIGNATURE":mockPayment(q)}});
 assert.equal(settled.status,200);assert.ok(settled.headers.get("PAYMENT-RESPONSE"));
 const j=await settled.json();
 assert.equal(j.ok,true);assert.equal(j.paid,true);assert.equal(j.chargedUSDC,"0.01");
 assert.equal(j.chainId,8453);assert.equal(j.dataNetwork,"eip155:8453");
 assert.equal(j.ownerAddress,O);assert.equal(j.spenderAddress,S);
 assert.equal(j.allowanceAtomic,"100000000");assert.equal(j.allowanceUSDC,"100.000000");
 assert.equal(j.ownerBalanceUSDC,"1.150000");assert.equal(j.observedBlockNumber,273);
 assert.equal(j.isUnlimitedMaxUint256,false);assert.equal(j.allowanceExceedsCurrentBalance,true);
 assert.equal(j.riskFlags[0].code,"ALLOWANCE_EXCEEDS_CURRENT_BALANCE");
 assert.equal(j.originalVM1PayoutAddress.toLowerCase(),VM1);
 assert.equal(j.independentBuyerPurchasesProvenForThisRoute,0);
 assert.equal(j.noWalletKeysOrOnchainTransactions,true);
});
test("First-party public x402 catalog and JSON schema advertise the real function and correct VM1 payee",async()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const op=d.spec.paths[PATH].get;
 assert.equal(op["x-payment-info"].payTo.toLowerCase(),VM1);
 assert.equal(op["x-payment-info"].price.amount,"0.01");
 assert.deepEqual(op.parameters.map(x=>x.name),["owner","spender"]);
 assert.deepEqual(d.spec.paths["/v1/base-usdc-allowance-sample"].get.security,[]);
 const fields=op.responses["200"].content["application/json"].schema.required;
 for(const f of ["allowanceAtomic","allowanceUSDC","observedBlockNumber","ownerBalanceUSDC","originalVM1PayoutAddress"])
  assert.ok(fields.includes(f),f);
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com"+PATH));
 const items=(await(await fetch(BASE+"/discovery/resources")).json()).items;
 assert.equal(items.length,22);
 const record=items.find(x=>x.resource===BASE+PATH);
 assert.ok(record);assert.equal(record.accepts[0].amount,"10000");
 assert.equal(record.accepts[0].payTo.toLowerCase(),VM1);
});
