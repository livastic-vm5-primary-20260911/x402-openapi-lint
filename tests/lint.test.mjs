import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseAndGuardSpec,lintSpec,LIMIT_BYTES} from "../validator.mjs";

const example=fs.readFileSync(new URL("../examples/sample.yaml",import.meta.url),"utf8");
const base=process.env.TEST_URL || "http://127.0.0.1:8736";

test("known reference YAML accepted",()=>{
 const r=parseAndGuardSpec(example);
 assert.equal(r.ok,true);
 assert.ok(r.stats.bytes>1000);
});
test("JSON OpenAPI format accepted",()=>{
 assert.equal(parseAndGuardSpec('{"openapi":"3.0.3","info":{"title":"Test","version":"1"},"paths":{}}').ok,true);
});
test("invalid, empty and scalar documents rejected",()=>{
 for(const s of ["","  ","[1,2]","{not JSON : !!!","x: [broken"]){
   assert.equal(parseAndGuardSpec(s).ok,false);
 }
});
test("nonnumeric spec input rejected",()=>{
 for(const x of [null,123,{data:1},[],true])assert.equal(parseAndGuardSpec(x).ok,false);
});
test("nonlocal references are rejected",()=>{
 for(const ref of ["https://example.com/a.yaml","file:///etc/passwd","../internal.yaml","ipfs://bafyasdf"]){
   const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","components:","  schemas:","    A: {$ref: '"+ref+"'}","paths: {}"].join("\n");
   assert.equal(parseAndGuardSpec(s).ok,false,ref);
 }
});
test("local refs are permitted",()=>{
 const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","components:","  schemas:","    A: {$ref: '#/components/schemas/B'}","    B: {type: string}","paths: {}"].join("\n");
 assert.equal(parseAndGuardSpec(s).ok,true);
});
test("input byte cap applies",()=>assert.equal(parseAndGuardSpec("x".repeat(LIMIT_BYTES+1)).ok,false));
test("deeply nested document refused",()=>{
 const s=Array.from({length:95},(_,i)=>"  ".repeat(i)+"a:").join("\n")+"\n"+"  ".repeat(95)+"leaf: 1\n";
 assert.equal(parseAndGuardSpec(s).ok,false);
});
test("Redocly recommended lint reports known sample",async()=>{
 const d=await lintSpec(example);
 assert.equal(d.errors,0);
 assert.equal(d.warnings,2);
 assert.equal(d.lintVersion,"2.64.1");
 assert.ok(d.findings.every(x=>x.ruleId==="operation-4xx-response"));
});
test("Redocly lint finds an incomplete response definition",async()=>{
 const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","paths:","  /ok:","    get:","      responses:","        '200': {}"].join("\n");
 const d=await lintSpec(s);
 assert.ok(d.errors>=1);
 assert.equal(d.valid,false);
});
test("public sample preview needs no payment",async()=>{
 const r=await fetch(base+"/v1/sample");
 assert.equal(r.status,200);
 const o=await r.json();
 assert.equal(o.paid,false);
 assert.equal(o.warnings,2);
});
test("Original x402 OpenAPI payment starter validates without private APIs or external references",async()=>{
 const template=fs.readFileSync(new URL("../examples/x402-payment-template.yaml",import.meta.url),"utf8");
 assert.equal(parseAndGuardSpec(template).ok,true);
 const result=await lintSpec(template);
 assert.equal(result.valid,true);
 assert.equal(result.errors,0);
 assert.equal(result.warnings,0);
 assert.match(template,/PAYMENT-REQUIRED/);
 assert.match(template,/PAYMENT-RESPONSE/);
 assert.match(template,/PAYMENT-SIGNATURE/);
 assert.match(template,/payments\.example\.invalid/);
});

test("New GET x402 template is gated by 0.01 Base USDC without requiring a request body",async()=>{
 const response=await fetch(base+"/v1/x402-template");
 assert.equal(response.status,402);
 const encoded=response.headers.get("payment-required");
 assert.ok(encoded);
 const quote=JSON.parse(Buffer.from(encoded,"base64").toString());
 assert.equal(quote.x402Version,2);
 assert.equal(quote.accepts[0].network,"eip155:8453");
 assert.equal(quote.accepts[0].amount,"10000");
 assert.equal(quote.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.ok(quote.resource.url.includes("/v1/x402-template"));
});

test("Exact public 402 challenge is also self-consistently mirrored for legacy catalog discovery",async()=>{
 const response=await fetch(base+"/v1/x402-template");
 assert.equal(response.status,402);
 const canonical=response.headers.get("payment-required");
 assert.ok(canonical);
 assert.equal(response.headers.get("x-payment-required"),canonical);
 const original=JSON.parse(Buffer.from(canonical,"base64").toString("utf8"));
 const body=await response.json();
 assert.deepEqual(body,original);
 assert.equal(body.x402Version,2);
 assert.equal(body.accepts.length,1);
 assert.equal(body.accepts[0].network,"eip155:8453");
 assert.equal(body.accepts[0].amount,"10000");
 assert.equal(body.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.equal(body.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.ok(response.headers.get("access-control-expose-headers")?.includes("X-Payment-Required"));
});
test("Legacy challenge body is isolated to GET template; paid lint POST preserves normal x402 v2 middleware",async()=>{
 const r=await fetch(base+"/v1/lint",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({spec:example})
 });
 assert.equal(r.status,402);
 assert.ok(r.headers.get("payment-required"));
 assert.equal(r.headers.get("x-payment-required"),null);
});

test("LOCAL MOCK ONLY: signed GET template challenge yields reusable payment header and verified 0-warning YAML",async()=>{
 const unpaid=await fetch(base+"/v1/x402-template");
 assert.equal(unpaid.status,402);
 const quote=JSON.parse(Buffer.from(unpaid.headers.get("payment-required"),"base64").toString());
 const marker="0x"+"11".repeat(65);
 const authorization={
   from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,
   value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",
   nonce:"0x"+"44".repeat(32)
 };
 const mock=Buffer.from(JSON.stringify({
   x402Version:2,resource:quote.resource,accepted:quote.accepts[0],
   payload:{signature:marker,authorization},extensions:quote.extensions||{}
 })).toString("base64");
 const paid=await fetch(base+"/v1/x402-template",{headers:{"PAYMENT-SIGNATURE":mock}});
 assert.equal(paid.status,200);
 const result=await paid.json();
 assert.equal(result.ok,true);
 assert.equal(result.paid,true);
 assert.equal(result.kind,"x402_v2_openapi_starter");
 assert.equal(result.redocly.errors,0);
 assert.equal(result.redocly.warnings,0);
 assert.ok(result.openapiTemplate.includes("PAYMENT-REQUIRED"));
 const receipt=paid.headers.get("payment-response");
 assert.ok(receipt);
 const decoded=JSON.parse(Buffer.from(receipt,"base64").toString());
 assert.equal(decoded.transaction,"0x"+"22".repeat(32));
 // Strictly local fake facilitator, not an observed real on-chain payout.
});

test("valid paid request without signature returns Base x402 v2 challenge",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:example})});
 assert.equal(r.status,402);
 const h=r.headers.get("payment-required");
 assert.ok(h);
 const o=JSON.parse(Buffer.from(h,"base64").toString());
 assert.equal(o.x402Version,2);
 assert.equal(o.accepts[0].network,"eip155:8453");
 assert.equal(o.accepts[0].amount,"10000");
 assert.equal(o.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.equal(o.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
});
test("malformed spec never reaches payment wall",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:"openapi: [bad"})});
 assert.equal(r.status,400);
 assert.equal(r.headers.get("payment-required"),null);
 assert.equal((await r.json()).charged,false);
});
test("external reference never reaches payment wall",async()=>{
 const s=["openapi: '3.0.3'","components: {schemas: {A: {$ref: '../private.txt'}}}"].join("\n");
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:s})});
 assert.equal(r.status,400);
 assert.equal((await r.json()).charged,false);
});
test("invalid JSON envelope is unpaid 400",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:"{invalid"});
 assert.equal(r.status,400);
 assert.equal(r.headers.get("payment-required"),null);
});

test("Machine-discoverable OpenAPI metadata exposes one paid POST and accurate 402 schema",async()=>{
 const r=await fetch(base+"/openapi.json");
 assert.equal(r.status,200);
 const spec=await r.json();
 assert.equal(spec.openapi,"3.1.0");
 const op=spec.paths["/v1/lint"].post;
 assert.ok(op);
 assert.equal(op["x-payment-info"].protocols[0],"x402");
 assert.equal(op["x-payment-info"].price.amount,"0.01");
 assert.ok(op.responses["402"]);
 assert.ok(op.requestBody.content["application/json"].example.spec);
 assert.equal(spec.paths["/v1/sample"].get.security.length,0);
 assert.ok(spec.paths["/v1/x402-template"].get);
 assert.equal(spec.paths["/v1/x402-template"].get["x-payment-info"].price.amount,"0.01");
 assert.ok(spec.paths["/v1/base-usdc-receipt"].get);
 assert.equal(spec.paths["/v1/base-usdc-receipt"].get["x-payment-info"].price.amount,"0.005");
 assert.ok(spec.components.securitySchemes.x402Payment);
 assert.ok(!JSON.stringify(spec).includes("onecursora1@gmail.com"));
});
test("Well-known x402 document points at current lint POST route",async()=>{
 for(const path of ["/.well-known/x402","/.well-known/x402.json"]){
  const r=await fetch(base+path);
  assert.equal(r.status,200);
  const manifest=await r.json();
  assert.equal(manifest.version,1);
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/lint")));
  assert.equal(manifest.resources.length,16);
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/generate-lowpoly")));
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/analyze-glb")));
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/base-usdc-receipt")));
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/x402-template")));
 }
});

test("Stable Render public origin produces a valid discovery document",async()=>{
 const {makeDiscovery}=await import("../discovery.mjs");
 const manifest=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.equal(manifest.spec.servers[0].url,"https://vm5-openapi-x402.onrender.com");
 assert.equal(manifest.wellKnown.resources[0],"https://vm5-openapi-x402.onrender.com/v1/lint");
});
test("Arbitrary Host is rejected from payment discovery",async()=>{
 const {makeDiscovery}=await import("../discovery.mjs");
 assert.throws(()=>makeDiscovery("https://evil.example.com"));
});

test("LOCAL MOCK ONLY: simulated facilitator verifies and settles valid marker, then returns lint content",async()=>{
  const challenge=await fetch(base+"/v1/lint",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:example})
  });
  assert.equal(challenge.status,402);
  const quote=JSON.parse(Buffer.from(challenge.headers.get("payment-required"),"base64").toString());
  const marker="0x"+"11".repeat(65);
  const fakeSignature=Buffer.from(JSON.stringify({
    x402Version:2,
    resource:quote.resource,
    accepted:quote.accepts[0],
    payload:{
      signature:marker,
      authorization:{
        from:"0x"+"33".repeat(20),
        to:quote.accepts[0].payTo,
        value:quote.accepts[0].amount,
        validAfter:"0",
        validBefore:"9999999999",
        nonce:"0x"+"44".repeat(32)
      }
    },
    extensions:quote.extensions||{}
  })).toString("base64");
  const result=await fetch(base+"/v1/lint",{
    method:"POST",headers:{"Content-Type":"application/json","PAYMENT-SIGNATURE":fakeSignature},
    body:JSON.stringify({spec:example})
  });
  const raw=await result.text();
  assert.equal(result.status,200,"Mock payment simulated. HTTP "+result.status+" "+raw.slice(0,170));
  const data=JSON.parse(raw);
  assert.equal(data.ok,true);
  assert.equal(data.redocly.errors,0);
  assert.equal(data.redocly.warnings,2);
  const payment=responseHeader(result);
  assert.ok(payment);
  assert.equal(payment.transaction,"0x"+"22".repeat(32));
  // The fake tx hash must *never* be treated as a real on-chain settlement.
  assert.ok(payment.success);
});
function responseHeader(r) {
  const h=r.headers.get("payment-response");
  return h?JSON.parse(Buffer.from(h,"base64").toString()):null;
}

test("LOCAL MOCK ONLY: wrong marker is rejected and no lint report is returned",async()=>{
  const unpaid=await fetch(base+"/v1/lint",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:example})
  });
  assert.equal(unpaid.status,402);
  const quote=JSON.parse(Buffer.from(unpaid.headers.get("payment-required"),"base64").toString());
  const forged=Buffer.from(JSON.stringify({
    x402Version:2,
    resource:quote.resource,
    accepted:quote.accepts[0],
    payload:{
      signature:"0x"+"55".repeat(65),
      authorization:{from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)}
    },
    extensions:quote.extensions||{}
  })).toString("base64");
  const result=await fetch(base+"/v1/lint",{
    method:"POST",headers:{"Content-Type":"application/json","PAYMENT-SIGNATURE":forged},body:JSON.stringify({spec:example})
  });
  assert.equal(result.status,402);
  assert.equal(result.headers.get("payment-response"),null);
});

test("402 Index public domain proof serves only the stored SHA-256 hash, never the secret token",async()=>{
  const r=await fetch(base+"/.well-known/402index-verify.txt");
  assert.equal(r.status,200);
  const text=(await r.text()).trim();
  assert.match(text,/^[0-9a-f]{64}$/);
  const expected=fs.readFileSync(new URL("../verification/402index-verify.txt",import.meta.url),"utf8").trim();
  assert.equal(text,expected);
});
