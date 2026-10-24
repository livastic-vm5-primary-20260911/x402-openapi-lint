import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";

test("public /llms.txt is a free and useful x402 seller guide, not a phantom payment",async()=>{
 const r=await fetch(BASE+"/llms.txt");
 assert.equal(r.status,200);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const contentType=r.headers.get("content-type")||"";
 assert.match(contentType,/text\/plain/i);
 const body=await r.text();
 assert.ok(body.length>2500&&body.length<15000);
 assert.match(body,/ONE independent external NoHumans/i);
 assert.match(body,/NOT recurring human customers/i);
 for(const required of [
  "/v1/x402-template",
  "/v1/csv-report",
  "/v1/csv-preflight",
  "/v1/email-dns-preflight",
  "/v1/x402-preflight",
  "/v1/base-usdc-receipt",
  "/v1/generate-lowpoly",
  "/v1/analyze-glb",
  "/v1/lint",
  "/v1/sales-proof",
  "/v1/email-dns-sample",
  "/v1/receipt-sample",
  "native Circle USDC",
  "0.015000",
 ])assert.ok(body.includes(required),required);
 assert.ok(!/-----BEGIN .*PRIVATE KEY-----/.test(body));
 assert.ok(!/sk_(live|test)_/.test(body));
 assert.ok(!/\bOTP\s*:\s*[0-9]/i.test(body));
});
test("OpenAPI discovery declares free machine-readable seller guide",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const row=d.spec.paths["/llms.txt"]?.get;
 assert.ok(row);
 assert.deepEqual(row.security,[]);
 assert.ok(row.responses["200"]);
 // Offering free text must not create a new paid resource or URL in .well-known/x402.
 assert.equal(d.wellKnown.resources.length,19);
});
