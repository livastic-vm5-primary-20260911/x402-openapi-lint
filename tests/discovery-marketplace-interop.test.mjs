import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const ORIGIN = "https://vm5-openapi-x402.onrender.com";
const BASE = process.env.TEST_URL || "http://127.0.0.1:8736";

test("OpenAPI receipt provides truthful unrelated public settlement samples to discovery",()=>{
  const {spec}=makeDiscovery(ORIGIN);
  const op=spec.paths["/v1/base-usdc-receipt"].get;
  assert.equal(op["x-payment-info"].price.amount,"0.005");
  const params=Object.fromEntries(op.parameters.map(p=>[p.name,p]));
  assert.equal(params.tx.required,true);
  assert.match(params.tx.schema.example,/^0x[0-9a-f]{64}$/);
  assert.equal(params.recipient.required,true);
  assert.match(params.recipient.schema.example,/^0x[0-9a-f]{40}$/);
  assert.equal(params.minUsdc.schema.example,"21.300000");
  assert.match(params.tx.description,/unrelated/i);
  assert.match(params.recipient.description,/NOT the VM5/i);
});

test("OpenAPI paid template exposes safe OPTIONAL header schema but no paid URL query",()=>{
  const {spec}=makeDiscovery(ORIGIN);
  const op=spec.paths["/v1/x402-template"].get;
  const format=op.parameters.find(p=>p.name==="X-Template-Format");
  assert.ok(format);
  assert.equal(format.in,"header");
  assert.equal(format.required,false);
  assert.deepEqual(format.schema.enum,["yaml"]);
  assert.equal(format.schema.default,"yaml");
  assert.equal(format.schema.example,"yaml");
  assert.equal(op["x-payment-info"].price.amount,"0.01");
  assert.ok(op.responses["400"]);
  assert.ok(op.responses["402"]);
});

test("Headerless and optional YAML-format header GET quote the identical x402 amount",async()=>{
  const results=[];
  for(const headers of [{},{"X-Template-Format":"yaml"}]){
    const r=await fetch(BASE+"/v1/x402-template",{headers});
    assert.equal(r.status,402);
    const encoded=r.headers.get("payment-required");
    assert.ok(encoded);
    const v=JSON.parse(Buffer.from(encoded,"base64").toString("utf8"));
    assert.equal(v.x402Version,2);
    assert.equal(v.accepts.length,1);
    assert.equal(v.accepts[0].network,"eip155:8453");
    assert.equal(v.accepts[0].amount,"10000");
    results.push(v);
  }
  assert.deepEqual(results[0].accepts,results[1].accepts);
});

test("Unsupported header is refused before any payment challenge",async()=>{
  const r=await fetch(BASE+"/v1/x402-template",{headers:{"X-Template-Format":"json"}});
  assert.equal(r.status,400);
  assert.equal(r.headers.get("payment-required"),null);
  const body=await r.json();
  assert.equal(body.charged,false);
});

test("Public merchant discovery publishes actual paid JSON output schemas",()=>{
  const {spec}=makeDiscovery(ORIGIN);
  const receipt=spec.paths["/v1/base-usdc-receipt"].get.responses["200"].content["application/json"].schema;
  assert.equal(receipt.type,"object");
  assert.ok(receipt.required.includes("transactionHash"));
  assert.ok(receipt.required.includes("netIncomingUSDC"));
  assert.equal(receipt.properties.verifiedNativeUSDCReceipt.type,"boolean");
  assert.equal(receipt.properties.chargedUSDC.example,"0.005");
  const template=spec.paths["/v1/x402-template"].get.responses["200"].content["application/json"].schema;
  assert.equal(template.type,"object");
  assert.ok(template.required.includes("openapiTemplate"));
  assert.deepEqual(template.properties.templateFormat.enum,["YAML"]);
  assert.equal(template.properties.chargedUSDC.example,"0.01");
});

test("Receipt preview is free and distinct from paid settlement verifier",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.deepEqual(d.spec.paths["/v1/receipt-sample"].get.security,[]);
 assert.equal(d.spec.paths["/v1/base-usdc-receipt"].get["x-payment-info"].price.amount,"0.005");
 assert.equal(d.wellKnown.resources.length,23);
 assert.equal(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/receipt-sample"),false);
});

test("Circle-compatible agent guidance reflects actually payable Base x402 routes without misleading claims",()=>{
  const {spec}=makeDiscovery(ORIGIN);
  const guidance=spec.info["x-guidance"];
  assert.equal(typeof guidance,"string");
  assert.ok(guidance.length>300 && guidance.length<3000);
  assert.ok(guidance.split(/\s+/).length<750,"keep agent guidance comfortably under a 1000-token budget");
  for(const required of ["/v1/ping","/v1/lint","/v1/x402-template","/v1/csv-report",
    "/v1/https-cert-preflight","/v1/email-dns-preflight","/llms.txt","eip155:8453","0.001","0.005","0.01",
    "PAYMENT-REQUIRED"]){
    assert.ok(guidance.includes(required),"agent guidance must include "+required);
  }
  assert.equal(spec.info.contact.url,"https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/");
  assert.equal(spec.info.contact.email,undefined,"do not publish an unverified or private business email");
  assert.match(guidance,/not currently a dependable critical-settlement source/);
  assert.match(guidance,/not recurring customer demand/);
  assert.match(guidance,/not claim MPP, multichain settlement/i);
  assert.deepEqual(spec.paths["/v1/ping"].get["x-payment-info"].price,{mode:"fixed",currency:"USD",amount:"0.001"});
  assert.equal(spec.paths["/v1/x402-template"].get["x-payment-info"].price.amount,"0.01");
});
