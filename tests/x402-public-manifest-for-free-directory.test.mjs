import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
const ORIGIN=process.env.TEST_URL||"http://127.0.0.1:8736";
const MANIFEST_URL=ORIGIN+"/.well-known/x402-bazaar-manifest.json";
const VM1="0x4e3106520e40af30870cafe78da1b1e7110ed98e";
const VM5="0x6b01efa0705e91a7aca54271510bf9e594717f34";
const USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
async function manifest(){
 const r=await fetch(MANIFEST_URL);
 assert.equal(r.status,200);
 assert.equal(r.headers.get("payment-required"),null);
 assert.equal(r.headers.get("payment-response"),null);
 assert.equal(r.headers.get("content-type")?.includes("application/json"),true);
 return r.json();
}

test("Public original publisher manifest has eighteen distinct real x402 v2 priced resource objects, no purchase",async()=>{
 const d=await manifest();
 assert.equal(d.x402Version,2);
 assert.equal(d.resources.length,18);
 assert.equal(new Set(d.resources.map(x=>x.url)).size,18);
 const old=await(await fetch(ORIGIN+"/.well-known/x402.json")).json();
 assert.equal(old.resources.length,18);
 assert.deepEqual(d.resources.map(x=>x.url).sort(),old.resources.slice().sort(),
   "New manifest must neither invent nor hide a single older paid merchant route");
 for(const e of d.resources){
   assert.ok(e.url.startsWith(ORIGIN+"/v1/"),"No external untrusted origins");
   assert.equal(e.url,e.resource);
   assert.equal(e.x402Version,2);
   assert.match(e.method,/^(GET|POST)$/);
   assert.ok(typeof e.description==="string"&&e.description.length>24);
   assert.equal(e.accepts.length,1);
   const q=e.accepts[0];
   assert.equal(q.scheme,"exact");
   assert.equal(q.network,"eip155:8453");
   assert.equal(q.asset.toLowerCase(),USDC);
   assert.ok([VM1,VM5].includes(q.payTo.toLowerCase()));
   assert.match(q.amount,/^[1-9][0-9]*$/);
   assert.equal(q.extra.name,"USD Coin");
   assert.ok(!JSON.stringify(e).includes("privateKey"));
   assert.ok(!JSON.stringify(e).includes("walletSigner"));
   assert.ok(!JSON.stringify(e).includes("API_SECRET"));
 }
 assert.match(d.disclaimer,/NOT proof of marketplace indexing/);
});

test("Each source object preserves the exact recipient and token atomics of in-process middleware",async()=>{
 const d=await manifest();
 const count=(owner)=>d.resources.filter(x=>x.accepts[0].payTo.toLowerCase()===owner).length;
 assert.equal(count(VM1),5,"Two TapeOut, BTC funding, Aave Base and new ERC20 calldata facts pay the ONE original VM1 MetaMask");
 assert.equal(count(VM5),13,"Thirteen existing unrelated API SKUs keep older VM5 merchant payee");
 const f=d.resources.find(x=>new URL(x.url).pathname==="/v1/btc-funding-four-venues");
 assert.ok(f);
 assert.equal(f.method,"GET");
 assert.equal(f.accepts[0].amount,"10000");
 assert.equal(f.accepts[0].payTo.toLowerCase(),VM1);
 const oldCsv=d.resources.find(x=>new URL(x.url).pathname==="/v1/csv-report");
 assert.equal(oldCsv.accepts[0].amount,"5000");
 assert.equal(oldCsv.accepts[0].payTo.toLowerCase(),VM5);
 const op=makeDiscovery("https://vm5-openapi-x402.onrender.com").spec.paths["/.well-known/x402-bazaar-manifest.json"].get;
 assert.deepEqual(op.security,[]);
});

test("Free 18-product manifest refuses unexpected query and never asks for a buyer payment",async()=>{
 for(const extra of ["?q=foo","?payTo=0x123","?q=1&q=2"]){
   const r=await fetch(MANIFEST_URL+extra);
   assert.equal(r.status,400,extra);
   assert.equal(r.headers.get("payment-required"),null);
   assert.equal((await r.json()).charged,false);
 }
});
