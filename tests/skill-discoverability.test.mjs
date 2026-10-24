import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const OWNER="0x4e3106520E40af30870caFE78da1B1e7110eD98E";

test("public agent skill guides a zero-spend, genuine Base native Circle USDC TapeOut quote",async()=>{
  const r=await fetch(BASE+"/skill.md");
  assert.equal(r.status,200);
  assert.equal(r.headers.get("payment-required"),null);
  assert.match(r.headers.get("content-type")||"",/text\/markdown/i);
  const guide=await r.text();
  for(const value of ["/v1/tapeout-cpu0-report","/v1/tapeout-cpu0-sample","eip155:8453","0.005000 USDC","amount=5000",OWNER,"/openapi.json","/.well-known/x402","503","2026-10-23"]){
    assert.ok(guide.includes(value),value);
  }
  assert.match(guide,/No independent paid customer purchase/i);
  assert.doesNotMatch(guide,/-----BEGIN .*PRIVATE KEY-----|sk_(?:live|test)_/i);
});
test("OpenAPI declares free skill and preserves original 14 paid x402 resources plus distinct new 15th",()=>{
  const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
  const op=d.spec.paths["/skill.md"]?.get;
  assert.ok(op);
  assert.deepEqual(op.security,[]);
  assert.ok(op.responses["200"]);
  assert.equal(d.wellKnown.resources.length,16);
  assert.ok(!d.wellKnown.resources.some(s=>s.endsWith("/skill.md")));
  const report=d.spec.paths["/v1/tapeout-cpu0-report"].get;
  assert.equal(report["x-payment-info"].payTo,OWNER);
  assert.equal(report["x-payment-info"].price.amount,"0.005");
});
