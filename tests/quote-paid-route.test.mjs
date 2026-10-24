import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const expectedPayTo="0x6b01efa0705e91a7aca54271510bf9e594717f34";
function requirements(r){
 const h=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(h,"no expected genuine 402 quote");
 const q=JSON.parse(Buffer.from(h,"base64").toString());
 assert.equal(q.x402Version,2);
 assert.equal(q.accepts.length,1);
 assert.equal(q.accepts[0].amount,"10000");
 assert.equal(q.accepts[0].network,"eip155:8453");
 assert.equal(q.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(q.accepts[0].payTo.toLowerCase(),expectedPayTo);
 return q;
}
function localMarker(q){
 return Buffer.from(JSON.stringify({
  x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
  payload:{signature:"0x"+"11".repeat(65),authorization:{
   from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,
   value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",
   nonce:"0x"+"44".repeat(32)
  }}
 })).toString("base64");
}
test("free original VM3 example on VM5 is explicitly fictional and not chargeable",async()=>{
 const r=await fetch(BASE+"/v1/x402-sample");
 assert.equal(r.status,200);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const o=await r.json();
 assert.equal(o.paid,false);
 assert.equal(o.sampleOnly,true);
 assert.equal(o.analysis.paid,false);
 assert.equal(o.analysis.reviewOutcome,"basic_public_structure_consistent");
 assert.equal(o.exampleQuote.accepts[0].payTo,"0x1111111111111111111111111111111111111111");
 assert.match(o.caveat,/NOT a real merchant/);
});
test("valid no-input paid GET quotes real VM5 payTo and 0.01 native Circle Base USDC",async()=>{
 const r=await fetch(BASE+"/v1/x402-preflight");
 assert.equal(r.status,402);
 const q=requirements(r);
 assert.equal(q.extensions?.bazaar?.info?.input?.method,"GET");
 assert.equal(q.extensions?.bazaar?.info?.output?.type,"json");
 assert.equal(q.extensions?.bazaar?.info?.output?.example?.chargedUSDC,"0.01");
});
test("malformed or prohibited public quote requests fail unpaid",async()=>{
 const cases=[
  "/v1/x402-preflight?junk=x",
  "/v1/x402-preflight?quote=a&quote=b",
  "/v1/x402-preflight?quote="+encodeURIComponent(JSON.stringify({accepts:[],x402Version:2})),
  "/v1/x402-preflight?quote="+encodeURIComponent(JSON.stringify({accepts:[{scheme:"exact",asset:4}],x402Version:2})),
  "/v1/x402-preflight?quote="+encodeURIComponent(JSON.stringify({accepts:[{scheme:"exact"}],"payment-signature":"SECRET"})),
  "/v1/x402-preflight?quote="+encodeURIComponent("a".repeat(13000))
 ];
 for(const path of cases){
  const r=await fetch(BASE+path);
  assert.ok([400,413].includes(r.status),path.slice(0,80)+" got "+r.status);
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  const j=await r.json();assert.equal(j.charged,false);
 }
});
test("local mock only, genuine quote challenge unlocks report without chain spend in tests",async()=>{
 const uri=BASE+"/v1/x402-preflight?quote="+encodeURIComponent(JSON.stringify({
  x402Version:2,resource:{url:"https://example.invalid/demo"},
  accepts:[{scheme:"exact",network:"eip155:8453",amount:"10000",
  asset:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  payTo:"0x1111111111111111111111111111111111111111"}]
 }));
 const r=await fetch(uri);assert.equal(r.status,402);
 const q=requirements(r);
 const paid=await fetch(uri,{headers:{"PAYMENT-SIGNATURE":localMarker(q)}});
 assert.equal(paid.status,200);
 const result=await paid.json();
 assert.equal(result.ok,true);
 assert.equal(result.chargedUSDC,"0.01");
 assert.equal(result.paid,true);
 assert.equal(result.reviewOutcome,"basic_public_structure_consistent");
 assert.equal(result.noSpendingAuthorized,true);
 assert.equal(result.noSignedPaymentDataStored,true);
 assert.match(result.disclaimer,/NOT seller identity/);
 assert.ok(paid.headers.get("PAYMENT-RESPONSE"));
});
test("existing six paid routes preserved, quote is eighth and sample free",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.equal(d.wellKnown.resources.length,16);
 assert.ok(d.wellKnown.resources.some(x=>x.endsWith("/v1/x402-preflight")));
 assert.equal(d.spec.paths["/v1/x402-sample"].get.security.length,0);
 assert.equal(d.spec.paths["/v1/x402-preflight"].get["x-payment-info"].price.amount,"0.01");
});

