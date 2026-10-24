import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const expectedAddress="0x6b01efa0705e91a7aca54271510bf9e594717f34";
const asset="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

function requirements(r){
  const str=r.headers.get("PAYMENT-REQUIRED");
  assert.ok(str,"Must issue real x402 v2 PAYMENT-REQUIRED header");
  const d=JSON.parse(Buffer.from(str,"base64").toString());
  assert.equal(d.x402Version,2);
  assert.equal(d.accepts.length,1);
  assert.equal(d.accepts[0].amount,"1000","exactly one tenth of a US cent in Base USDC");
  assert.equal(d.accepts[0].network,"eip155:8453");
  assert.equal(d.accepts[0].asset.toLowerCase(),asset);
  assert.equal(d.accepts[0].payTo.toLowerCase(),expectedAddress);
  return d;
}
function syntheticLocalOnlySignerMarker(q,good=true){
  return Buffer.from(JSON.stringify({
    x402Version:2,resource:q.resource,accepted:q.accepts[0],
    extensions:q.extensions||{},
    payload:{signature:"0x"+(good?"11":"12").repeat(65),
      authorization:{
        from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,
        validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
      }}
  })).toString("base64");
}
test("Real local quote is exact native Base Circle USDC 0.001 and has useful machine-readable metadata",async()=>{
 const r=await fetch(BASE+"/v1/ping");
 assert.equal(r.status,402);
 const q=requirements(r);
 assert.equal(q.resource.url.endsWith("/v1/ping"),true);
 assert.equal(q.extensions.bazaar.info.input.method,"GET");
 assert.equal(q.extensions.bazaar.info.output.example.chargedUSDC,"0.001");
 assert.equal(q.extensions.bazaar.info.output.example.thirdPartyFinalityProof,false);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
});
test("Free health is not a fake paid ping order and public docs disclose no customers",async()=>{
 const r=await fetch(BASE+"/health");
 assert.equal(r.status,200);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const d=await (await fetch(BASE+"/v1/docs")).json();
 assert.equal(d.paidSettlementPing.priceUSDC,"0.001");
 assert.equal(d.paidSettlementPing.confirmedIndependentPaidBuyers,0);
 assert.equal(d.totalActuallyReceivedNativeBaseCircleUSDC,"0.015");
 const guide=await (await fetch(BASE+"/llms.txt")).text();
 assert.ok(guide.includes("GET /v1/ping"));
 assert.ok(guide.includes("0.001000 USDC"));
});
test("Query or body is refused BEFORE payment and reveals no private content",async()=>{
 const urls=[
  "/v1/ping?nonce=secret",
  "/v1/ping?from=0x123",
  "/v1/ping?x=1&x=2",
 ];
 for(const path of urls){
  const r=await fetch(BASE+path);
  assert.equal(r.status,400,path);
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  const d=await r.json();
  assert.equal(d.charged,false);
 }
 const r=await fetch(BASE+"/v1/ping",{method:"GET",headers:{"Content-Length":"3"},body:"yes",duplex:"half"}).catch(e=>({status:0,error:e}));
 if(r.status!==0){
  assert.equal(r.status,400);
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 }
});
test("Only synthetic LOCAL mock facilitator: accepted marker returns gated paid 200 and payment response (NOT real money)",async()=>{
 const q=requirements(await fetch(BASE+"/v1/ping"));
 const r=await fetch(BASE+"/v1/ping",{headers:{"PAYMENT-SIGNATURE":syntheticLocalOnlySignerMarker(q)}});
 assert.equal(r.status,200);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 assert.ok(r.headers.get("PAYMENT-RESPONSE"));
 const d=await r.json();
 assert.equal(d.ok,true);assert.equal(d.paid,true);
 assert.equal(d.chargedUSDC,"0.001");
 assert.equal(d.kind,"x402_paid_integration_ping");
 assert.equal(d.thirdPartyFinalityProof,false);
 assert.match(d.respondedAtUTC,/^\d{4}-\d{2}-\d{2}T/);
 assert.match(d.limitations,/not a standalone on-chain finality audit/i);
});
test("Synthetic invalid test signature cannot unlock handler or claim payment",async()=>{
 const q=requirements(await fetch(BASE+"/v1/ping"));
 const r=await fetch(BASE+"/v1/ping",{headers:{"PAYMENT-SIGNATURE":syntheticLocalOnlySignerMarker(q,false)}});
 assert.notEqual(r.status,200);
});
test("Exactly ONE new paid resource in public discovery, does not change older prices or free sample",()=>{
 const {spec,wellKnown}=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.equal(wellKnown.resources.length,16);
 assert.ok(wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/ping"));
 const op=spec.paths["/v1/ping"].get;
 assert.equal(op["x-payment-info"].price.amount,"0.001");
 assert.equal(op.operationId,"buyActualX402PaidPing");
 assert.ok(op.responses["402"]);
 assert.ok(op.responses["200"].headers["PAYMENT-RESPONSE"]);
 assert.equal(spec.paths["/v1/csv-report"].get["x-payment-info"].price.amount,"0.005");
 assert.equal(spec.paths["/v1/x402-template"].get["x-payment-info"].price.amount,"0.01");
 assert.equal(wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/health"),false);
});
