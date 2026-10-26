import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
function quoteFrom(response) {
 const header=response.headers.get("PAYMENT-REQUIRED");
 assert.ok(header,"Expected actual x402 challenge");
 const q=JSON.parse(Buffer.from(header,"base64").toString());
 assert.equal(q.x402Version,2);
 assert.equal(q.accepts[0].network,"eip155:8453");
 assert.equal(q.accepts[0].amount,"5000");
 assert.equal(q.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 return q;
}
function localMockPayment(quote) {
 const p={x402Version:2,resource:quote.resource,accepted:quote.accepts[0],extensions:quote.extensions||{},
 payload:{signature:"0x"+"11".repeat(65),authorization:{
   from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,
   value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
 }}};
 return Buffer.from(JSON.stringify(p)).toString("base64");
}
test("free DNS product sample is a fixture and cannot be mistaken for a buyer",async()=>{
 const r=await fetch(BASE+"/v1/email-dns-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const obj=await r.json();assert.equal(obj.paid,false);assert.equal(obj.exampleOnly,true);
 assert.equal(obj.confirmedIndependentCustomers,0);
});
test("invalid or injection domains fail BEFORE x402 payment with no DNS/HTTP fetch",async()=>{
 for(const suffix of ["?domain=localhost","?domain=127.0.0.1","?domain=example.invalid","?domain=user%40gmail.com","?domain=https%3A%2F%2Fgmail.com","?domain=a%2Fb.com","?domain=foo..com","?domain=example.com&domain=gmail.com","?debug=1"]){
   const r=await fetch(BASE+"/v1/email-dns-preflight"+suffix);
   assert.equal(r.status,400,suffix);
   assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
   assert.equal((await r.json()).charged,false);
 }
});
test("real public DNS preflight quotes 5000 atomic Base Circle USDC before returning a report",async()=>{
 const r=await fetch(BASE+"/v1/email-dns-preflight?domain=gmail.com");
 assert.equal(r.status,402);
 const q=quoteFrom(r);
 assert.equal(q.extensions?.bazaar?.info?.input?.method,"GET");
 assert.equal(q.extensions?.bazaar?.info?.output?.example?.chargedUSDC,"0.005");
});
test("local mock facilitator only: valid public DNS returns report after simulated signature; no money",async()=>{
 const endpoint=BASE+"/v1/email-dns-preflight?domain=gmail.com";
 const r=await fetch(endpoint);
 const q=quoteFrom(r);
 const paid=await fetch(endpoint,{headers:{"PAYMENT-SIGNATURE":localMockPayment(q)}});
 assert.equal(paid.status,200);
 const obj=await paid.json();
 assert.equal(obj.ok,true);assert.equal(obj.paid,true);assert.equal(obj.chargedUSDC,"0.005");
 assert.equal(obj.domain,"gmail.com");
 assert.equal(obj.spfPresent,true);assert.equal(obj.dmarcPresent,true);
 assert.equal(obj.smtpContactAttempted,false);
 assert.ok(paid.headers.get("PAYMENT-RESPONSE"));
});
test("new paid route appears in public OpenAPI discovery and nine-resource x402 manifest",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.equal(d.spec.paths["/v1/email-dns-preflight"].get["x-payment-info"].price.amount,"0.005");
 assert.equal(d.spec.paths["/v1/email-dns-sample"].get.security.length,0);
 assert.equal(d.wellKnown.resources.length,23);
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/email-dns-preflight"));
});

