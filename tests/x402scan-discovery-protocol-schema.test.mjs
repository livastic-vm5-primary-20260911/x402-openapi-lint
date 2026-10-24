import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeDiscovery } from "../discovery.mjs";

const ORIGIN = "https://vm5-openapi-x402.onrender.com";
const USDC = "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913";

test("x402scan payable OpenAPI discovery advertises canonical structured protocol for all routes", () => {
  const {spec}=makeDiscovery(ORIGIN);
  const paid=Object.entries(spec.paths).flatMap(([route,verbs])=>
    Object.entries(verbs).filter(([,op])=>op?.["x-payment-info"])
      .map(([method,op])=>({route,method,op})));
  assert.equal(paid.length,22);
  for (const {route,method,op} of paid) {
    const meta=op["x-payment-info"];
    assert.deepEqual(meta.protocols,[{x402:{}}],method.toUpperCase()+" "+route+" must be x402scan structured");
    assert.equal(meta.network,"eip155:8453");
    assert.equal(meta.asset.toLowerCase(),USDC.toLowerCase());
    assert.match(meta.payTo,/^0x[0-9a-fA-F]{40}$/);
    assert.equal(meta.price.mode,"fixed");
    assert.equal(meta.price.currency,"USD");
    assert.match(meta.price.amount,/^0\.\d+$/);
    assert.ok(op.responses["402"],"Paid operation needs a declared 402 response");
  }
});

test("structured discovery changes NO actual quoted USD amount, public payees, routes or response status",()=>{
  const spec=makeDiscovery(ORIGIN).spec;
  const after=Object.entries(spec.paths).flatMap(([route,verbs])=>
    Object.entries(verbs).filter(([,op])=>op?.["x-payment-info"])
      .map(([method,op])=>({route,method,priceAmount:op["x-payment-info"].price.amount,
        payTo:op["x-payment-info"].payTo,network:op["x-payment-info"].network,
        asset:op["x-payment-info"].asset,keys:Object.keys(op.responses??{})})));
  const original=JSON.parse(fs.readFileSync(new URL("./fixtures/x402scan-original-merchant-payment-terms-20261024.json",import.meta.url),"utf8"));
  assert.equal(after.length,original.length+1);
  const originalLookup=new Map(original.map(row=>[row.method+" "+row.route,row]));
  for (const row of after){
    const source=originalLookup.get(row.method+" "+row.route);
    if(!source){
      assert.equal(row.route,"/v1/mezo-musd-facts");
      assert.equal(row.method,"get");
      assert.equal(row.priceAmount,"0.01");
      assert.equal(row.payTo.toLowerCase(),"0x4e3106520e40af30870cafe78da1b1e7110ed98e");
      assert.equal(row.network,"eip155:8453");
      assert.equal(row.asset.toLowerCase(),USDC.toLowerCase());
      continue;
    }
    assert.equal(row.priceAmount,source.priceAmount);
    assert.equal(row.payTo,source.payTo);
    assert.equal(row.network,source.network);
    assert.deepEqual(row.keys,source.keys);
    if(source.asset)assert.equal(row.asset,source.asset);
    else assert.equal(row.asset.toLowerCase(),USDC.toLowerCase(),
      "Previously omitted native Circle USDC must now be explicit");
  }
  assert.equal(originalLookup.size,original.length);
});

test("OpenAPI exposes public contact URL and input guidance without revealing owner Gmail",()=>{
  const {spec}=makeDiscovery(ORIGIN);
  assert.ok(spec.info.contact?.url?.startsWith("https://"));
  assert.equal(spec.info.contact.email,undefined);
  assert.match(spec.info["x-guidance"],/PAYMENT-REQUIRED/);
  assert.equal(spec.servers?.[0]?.url,ORIGIN);
});
