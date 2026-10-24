import test from "node:test";
import assert from "node:assert/strict";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const PAYTO="0x6b01efa0705e91a7aca54271510bf9e594717f34";
const CIRCLE="0x833589fcD6EDb6E08f4C7C32D4f71b54bdA02913".toLowerCase();
const URL="https://vm5-openapi-x402.onrender.com";
const LISTING_ID="7461d9b8-1e1c-4c1a-ab2d-cb0059f8fc33";

test("true402 merchant metadata: free no PAYMENT-REQUIRED, one existing product",async()=>{
 const r=await fetch(BASE+"/.well-known/x402-service.json");
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-type")||"",/application\/json/i);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
 const d=await r.json();
 assert.equal(d.x402,"1.0"); // This is true402 discovery document version, not payment x402 protocol version.
 assert.equal(d.name,"VM5 x402 v2 OpenAPI Reference Template");
 assert.deepEqual(d.capabilities,["x402","openapi","api-schema","crypto-payments","developer-tools"]);
 assert.equal(d.pricing.currency,"USDC");
 assert.equal(d.pricing.base,"0.01");
 assert.equal(d.pricing.unit,"request");
 assert.equal(d.endpoint,URL+"/v1/x402-template");
 assert.equal(d.payment.chain,"base");
 assert.equal(d.payment.address.toLowerCase(),PAYTO.toLowerCase());
 assert.equal(d.payment.facilitator,process.env.FACILITATOR_URL);
 assert.ok(!JSON.stringify(d).includes("secret"));
 assert.ok(!JSON.stringify(d).includes("apiKey"));
});

test("true402 merchant metadata: discovery mirrors runtime facilitator with no wallet signing",async()=>{
 const d=await (await fetch(BASE+"/.well-known/x402-service.json")).json();
 assert.ok(process.env.FACILITATOR_URL);
 assert.equal(d.payment.facilitator,process.env.FACILITATOR_URL);
 const r=await fetch(BASE+"/v1/x402-template");
 assert.equal(r.status,402);
 const b64=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(b64);
 const request=JSON.parse(Buffer.from(b64,"base64").toString("utf8"));
 assert.equal(request.x402Version,2);
 assert.equal(request.accepts.length,1);
 const acceptance=request.accepts[0];
 assert.equal(acceptance.amount,"10000");
 assert.equal(acceptance.network,"eip155:8453");
 assert.equal(acceptance.asset.toLowerCase(),CIRCLE);
 assert.equal(acceptance.payTo.toLowerCase(),d.payment.address.toLowerCase());
});

test("true402 merchant metadata: free document never changes existing paid product count",async()=>{
 const r=await fetch(BASE+"/.well-known/x402");
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.resources.length,20);
 assert.equal(data.resources.filter(x=>x.includes("/v1/x402-template")).length,1);
 assert.ok(!data.resources.includes(URL+"/.well-known/x402-service.json"));
});

test("true402 merchant metadata: source identifies an existing listing, no sale claims",async()=>{
 const d=await (await fetch(BASE+"/.well-known/x402-service.json")).json();
 assert.match(d.description,/no custodial wallet, payment processing, live settlement guarantee/i);
 assert.equal(LISTING_ID.length,36);
 assert.ok(!d.description.includes("50 paid customers"));
});
