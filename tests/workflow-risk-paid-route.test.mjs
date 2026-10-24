import test from "node:test";
import assert from "node:assert/strict";
import {scan} from "../workflow-risk/report.mjs";
import {inspectWorkflow,PUBLIC_SYNTHETIC_YAML} from "../workflow-risk/preflight.mjs";
import {makeDiscovery} from "../discovery.mjs";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const CHECKSUM_PAYTO="0x6b01efa0705e91a7aca54271510bf9e594717f34";
const USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const request=(body,headers={})=>fetch(BASE+"/v1/workflow-risk",{
 method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)
});
const quote=(r)=>{
 const header=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(header,"A VALID workflow should challenge, not free-dump its audit");
 const d=JSON.parse(Buffer.from(header,"base64").toString("utf8"));
 assert.equal(d.x402Version,2);
 assert.equal(d.accepts.length,1);
 assert.equal(d.accepts[0].scheme,"exact");
 assert.equal(d.accepts[0].amount,"200000");
 assert.equal(d.accepts[0].network,"eip155:8453");
 assert.equal(d.accepts[0].asset.toLowerCase(),USDC);
 assert.equal(d.accepts[0].payTo.toLowerCase(),CHECKSUM_PAYTO);
 return d;
};
const fakeMockSigner=(q,valid=true)=>Buffer.from(JSON.stringify({
 x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
 payload:{signature:"0x"+(valid?"11":"12").repeat(65),authorization:{
  from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,
  validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
 }}
})).toString("base64");

test("MIT upstream original VM2 core has clear heuristic result and no input raw source",()=>{
 const p=scan({workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"ci.yml",includeSarif:true});
 assert.equal(p.ok,true);
 assert.equal(p.staticOnly,true);
 assert.ok(p.findings.some(f=>f.id==="ACTION_UNPINNED"));
 assert.ok(p.sarif?.runs[0].results.length>0);
 assert.doesNotMatch(JSON.stringify(p),/name: test\non: pull_request/);
});
test("FREE public sample is valid, unmetered, synthetic and cites same-owner MIT origin",async()=>{
 const r=await fetch(BASE+"/v1/workflow-risk-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("payment-required"),null);
 const d=await r.json();
 assert.equal(d.paid,false);assert.equal(d.priceUSDC,"0.20");
 assert.equal(d.confirmedIndependentPaidCustomers,0);
 assert.equal(d.sampleReport.ok,true);
 assert.ok(d.sampleWorkflow.includes("on: pull_request"));
 assert.ok(d.source.endsWith("/apify-workflow-guard"));
});
test("Invalid structured request and malformed YAML fail BEFORE x402 middleware, no raw source leaked",async()=>{
 const inputs=[
  null,{},[],{workflowYaml:""},{workflowYaml:"jobs: ["},
  {workflowYaml:"only: value"}, {workflowYaml:PUBLIC_SYNTHETIC_YAML,secretAccessKey:"NEVERRETURN"},
  {workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"../secrets.yml"},
  {workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"/etc/file.yaml"},
  {workflowYaml:PUBLIC_SYNTHETIC_YAML,includeSarif:"yes"},
  {workflowYaml:PUBLIC_SYNTHETIC_YAML+" ".repeat(49000)},
 ];
 for(const i of inputs){
  const r=await request(i);
  assert.equal(r.status,400,JSON.stringify(i)?.slice(0,50));
  assert.equal(r.headers.get("payment-required"),null);
  const d=await r.json();
  assert.equal(d.charged,false);
  assert.equal(d.ok,false);
  assert.doesNotMatch(JSON.stringify(d),/NEVERRETURN|secrets\.yml/);
 }
});
test("No workflow source ingestion with missing/wrong content-type; CORS options free",async()=>{
 const bad=await fetch(BASE+"/v1/workflow-risk",{method:"POST",headers:{"Content-Type":"text/plain"},body:PUBLIC_SYNTHETIC_YAML});
 assert.equal(bad.status,415);
 assert.equal(bad.headers.get("payment-required"),null);
 const options=await fetch(BASE+"/v1/workflow-risk",{method:"OPTIONS"});
 assert.equal(options.status,204);
 assert.equal(options.headers.get("payment-required"),null);
});
test("Actual challenge for valid NONSECRET user workflow is exact 0.20 native Base Circle USDC, POST Bazaar input",async()=>{
 const r=await request({workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"ci.yml",includeSarif:true});
 assert.equal(r.status,402);
 const q=quote(r);
 assert.equal(q.extensions?.bazaar?.info?.input?.method,"POST");
 assert.equal(q.extensions?.bazaar?.info?.input?.bodyType,"json");
 assert.equal(q.extensions?.bazaar?.info?.output?.example?.chargedUSDC,"0.20");
 assert.equal(q.extensions?.bazaar?.info?.output?.example?.confirmedIndependentPaidCustomers,0);
});
test("FAKE localhost facilitator marker ONLY: valid workflow produces paid static SARIF report",async()=>{
 const input={workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"ci.yml",includeSarif:true};
 const q=quote(await request(input));
 const r=await request(input,{"PAYMENT-SIGNATURE":fakeMockSigner(q)});
 assert.equal(r.status,200);
 assert.ok(r.headers.get("PAYMENT-RESPONSE"));
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.paid,true);
 assert.equal(d.chargedUSDC,"0.20");
 assert.equal(d.network,"eip155:8453");
 assert.equal(d.noWorkflowExecuted,true);
 assert.equal(d.confirmedIndependentPaidCustomers,0);
 assert.equal(d.staticOnly,true);
 assert.ok(d.findings.some(f=>f.id==="ACTION_UNPINNED"));
 assert.ok(d.sarif?.runs?.[0]?.results?.length>0);
 assert.doesNotMatch(JSON.stringify(d),/\$\{\{.*SECRET/);
});
test("Invalid mock signature never releases report as paid, no fallback",async()=>{
 const input={workflowYaml:PUBLIC_SYNTHETIC_YAML};
 const q=quote(await request(input));
 const r=await request(input,{"PAYMENT-SIGNATURE":fakeMockSigner(q,false)});
 assert.notEqual(r.status,200);
});
test("OpenAPI, public x402 discovery, old signed prices and user wallet remain accurate",()=>{
 const {spec,wellKnown}=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const op=spec.paths["/v1/workflow-risk"].post;
 assert.equal(op["x-payment-info"].price.amount,"0.20");
 assert.equal(op.requestBody.content["application/json"].schema.required[0],"workflowYaml");
 assert.equal(op.security[0].x402Payment.length,0);
 assert.ok(op.responses["400"]);assert.ok(op.responses["402"]);
 assert.ok(wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/workflow-risk"));
 assert.equal(wellKnown.resources.length,16);
 assert.deepEqual(spec.paths["/v1/workflow-risk-sample"].get.security,[]);
 assert.equal(spec.paths["/v1/csv-report"].get["x-payment-info"].price.amount,"0.005");
 assert.equal(spec.paths["/v1/x402-template"].get["x-payment-info"].price.amount,"0.01");
 assert.equal(spec.paths["/v1/ping"].get["x-payment-info"].price.amount,"0.001");
});
