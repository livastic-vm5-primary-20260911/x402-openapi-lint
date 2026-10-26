import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const REAL_HOST="https://vm5-openapi-x402.onrender.com";
const WORKFLOW="/v1/workflow-risk";
const PRICE="0.10";
const BASE="eip155:8453";
const CIRCLE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OFFER=makeDiscovery(REAL_HOST);
const POST=OFFER.spec.paths[WORKFLOW].post;
const MEDIA=POST.requestBody.content["application/json"];
const EXAMPLE=MEDIA.example;

test("machine seller genuinely publishes a required anonymous testable JSON body",()=>{
  assert.ok(EXAMPLE);
  assert.equal(POST.requestBody.required,true);
  assert.equal(POST.operationId,"analyzeGitHubActionsWorkflowRisk");
  assert.equal(POST.requestBody.content["application/json"],MEDIA);
  assert.equal(MEDIA.schema.additionalProperties,false);
  assert.deepEqual(MEDIA.schema.required,["workflowYaml"]);
});
test("public example is schema-compatible, without invented mandatory side fields",()=>{
  assert.deepEqual(Object.keys(EXAMPLE).sort(),["filename","includeSarif","workflowYaml"]);
  assert.ok(Object.keys(EXAMPLE).every(k=>k in MEDIA.schema.properties));
  assert.equal(typeof EXAMPLE.workflowYaml,"string");
  assert.ok(EXAMPLE.workflowYaml.length>20);
  assert.ok(Buffer.byteLength(EXAMPLE.workflowYaml,"utf8") < MEDIA.schema.properties.workflowYaml.maxLength);
  assert.ok(EXAMPLE.filename.length < MEDIA.schema.properties.filename.maxLength);
  assert.match(EXAMPLE.filename,/^(?!\.)[a-zA-Z0-9_.-]+\.ya?ml$/);
  assert.equal(typeof EXAMPLE.includeSarif,"boolean");
});
test("real YAML is purposefully synthetic, parseable and contains no secrets",()=>{
  assert.match(EXAMPLE.workflowYaml,/^name: Synthetic workflow-risk API discovery\n/);
  assert.match(EXAMPLE.workflowYaml,/\non:\n  workflow_dispatch:/);
  assert.match(EXAMPLE.workflowYaml,/\njobs:\n  test:/);
  assert.match(EXAMPLE.workflowYaml,/\n        run: echo synthetic-only\n$/);
  for(const needle of ["secret:", "password:", "api-key", "api_key", "token:", "${{ secrets.", "curl ", "wget ", "0x"+"a".repeat(64)]){
    assert.ok(!JSON.stringify(EXAMPLE).includes(needle),"Secret/execution template must not be suggested");
  }
});
test("original 0.20 native Base Circle USDC quote and recipient are UNTOUCHED",()=>{
  assert.equal(POST["x-payment-info"].price.amount,PRICE);
  assert.equal(POST["x-payment-info"].network,BASE);
  assert.equal(POST["x-payment-info"].asset.toLowerCase(),CIRCLE_USDC.toLowerCase());
  assert.match(POST["x-payment-info"].payTo,/^0x[a-fA-F0-9]{40}$/);
  assert.equal(POST.responses["402"].headers["PAYMENT-REQUIRED"].schema.type,"string");
  assert.equal(POST.responses["400"].description.includes("BEFORE payment"),true);
  assert.ok(POST.security.some(x=>"x402Payment" in x));
});
test("one missing-example change leaves original CSV preflight machine example intact",()=>{
  const csv=OFFER.spec.paths["/v1/csv-preflight"].post;
  assert.ok(csv.requestBody.content["application/json"].example);
  assert.ok(OFFER.spec.paths["/v1/email-dns-preflight"].get);
  assert.ok(OFFER.spec.paths["/v1/https-cert-preflight"].get);
  assert.ok(OFFER.spec.paths["/v1/x402-template"].get);
});
test("source output does not claim onchain cash or a real outside workflow buyer",()=>{
  assert.match(POST.description,/no verified paid workflow-risk buyers/i);
  assert.match(POST.responses["200"].description,/not a thirdparty security certification/);
  assert.ok(!("PAYMENT-SIGNATURE" in MEDIA.example));
  assert.ok(!("from" in MEDIA.example));
  assert.ok(!("wallet" in MEDIA.example));
});
test("original allowed sandbox localhost rendering works equally for documentation",()=>{
  const dev=makeDiscovery("http://127.0.0.1:8736");
  assert.deepEqual(dev.spec.paths[WORKFLOW].post.requestBody.content["application/json"].example,EXAMPLE);
});
test("unapproved dynamic origins are still rejected",()=>{
  assert.throws(()=>makeDiscovery("https://evil.example"),/Unexpected public origin/);
  assert.throws(()=>makeDiscovery("https://example.org"),/Unexpected public origin/);
});
