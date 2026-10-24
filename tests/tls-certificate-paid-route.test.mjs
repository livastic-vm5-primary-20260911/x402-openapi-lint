import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const BASE=process.env.TEST_URL;
if(!BASE)throw new Error("Only use the original isolated local mocked x402 test server");

function quoteFrom(res){
  const header=res.headers.get("PAYMENT-REQUIRED");
  assert.ok(header,"valid public HTTPS certificate should receive standard x402 quote");
  const q=JSON.parse(Buffer.from(header,"base64").toString("utf8"));
  assert.equal(q.x402Version,2);
  assert.equal(q.accepts.length,1);
  assert.equal(q.accepts[0].amount,"5000");
  assert.equal(q.accepts[0].network,"eip155:8453");
  assert.equal(q.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
  return q;
}
function mockPayment(quote){
  return Buffer.from(JSON.stringify({
    x402Version:2,resource:quote.resource,accepted:quote.accepts[0],
    extensions:quote.extensions||{},
    payload:{
      signature:"0x"+"11".repeat(65),
      authorization:{from:"0x"+"33".repeat(20),
        to:quote.accepts[0].payTo,value:quote.accepts[0].amount,
        validAfter:"0",validBefore:"9999999999",
        nonce:"0x"+"44".repeat(32)}
    }
  })).toString("base64");
}

test("tls preview fixture is FREE, fictional and has zero prior paid orders",async()=>{
  const r=await fetch(BASE+"/v1/tls-certificate-sample");
  assert.equal(r.status,200);
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  const j=await r.json();
  assert.equal(j.exampleOnly,true);
  assert.equal(j.paid,false);
  assert.equal(j.confirmedIndependentPaidOrders,0);
});

test("invalid domains, private addresses and all extra inputs fail BEFORE payment",async()=>{
  for(const suffix of ["?domain=localhost","?domain=169.254.169.254",
    "?domain=127.0.0.1","?domain=a.invalid","?domain=example.local",
    "?domain=https%3A%2F%2Fgithub.com","?domain=test%40github.com",
    "?domain=example.com%3A1234","?domain=a%2Fb.com",
    "?domain=github.com&domain=example.org","?inspect=1"]){
    const r=await fetch(BASE+"/v1/https-cert-preflight"+suffix);
    assert.equal(r.status,400,suffix);
    assert.equal(r.headers.get("PAYMENT-REQUIRED"),null,suffix);
    assert.equal((await r.json()).charged,false,suffix);
  }
});

test("real PUBLIC github.com certificate preflight produces quoted exact 5000 atomic USDC",async()=>{
  const r=await fetch(BASE+"/v1/https-cert-preflight?domain=github.com");
  assert.equal(r.status,402,await r.text());
  const q=quoteFrom(r);
  assert.equal(q.extensions.bazaar.info.input.method,"GET");
  assert.equal(q.extensions.bazaar.info.output.example.kind,"public_https_certificate_preflight");
});

test("mock facilitator only: after dummy signed test payment returns actual read-only certificate report",async()=>{
  const url=BASE+"/v1/https-cert-preflight?domain=github.com";
  const r=await fetch(url);
  const q=quoteFrom(r);
  const paid=await fetch(url,{headers:{"PAYMENT-SIGNATURE":mockPayment(q)}});
  assert.equal(paid.status,200,await paid.clone().text());
  const report=await paid.json();
  assert.equal(report.ok,true);
  assert.equal(report.paid,true);
  assert.equal(report.chargedUSDC,"0.005");
  assert.equal(report.domain,"github.com");
  assert.equal(report.certificateTrustAndHostnameVerified,true);
  assert.equal(report.httpRequestsSent,0);
  assert.ok(Number.isInteger(report.daysUntilExpiry));
  assert.ok(paid.headers.get("PAYMENT-RESPONSE"));
});

test("paid certificate path indexed alongside nine existing x402 APIs, and preview remains free",()=>{
  const manifest=makeDiscovery("https://vm5-openapi-x402.onrender.com");
  assert.equal(manifest.wellKnown.resources.length,16);
  assert.ok(manifest.wellKnown.resources.some(x=>x.endsWith("/v1/https-cert-preflight")));
  const spec=manifest.spec.paths["/v1/https-cert-preflight"].get;
  assert.equal(spec["x-payment-info"].price.amount,"0.005");
  assert.equal(manifest.spec.paths["/v1/tls-certificate-sample"].get.security.length,0);
  assert.ok(spec.responses["402"]);
});
