import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {usdToAtomic,makeCatalog,queryCatalog} from "../bazaar-catalog.mjs";

const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const PAYTO1="0x6b01efA0705E91a7aca54271510bf9e594717f34";
const PAYTO2="0x4e3106520E40af30870caFE78da1B1e7110eD98E";
const USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

function readQuote(response){
  const header=response.headers.get("payment-required");
  assert.ok(header);
  const quote=JSON.parse(Buffer.from(header,"base64").toString("utf8"));
  assert.equal(quote.x402Version,2);
  return quote.accepts[0];
}

test("Exact USDC micro-amount parser rejects rounding, invalid values and arbitrary prices",()=>{
  for(const [price,atomic] of [
    ["$0.001","1000"],["$0.005","5000"],["$0.01","10000"],["$0.05","50000"],["$0.20","200000"],["$1.234567","1234567"]
  ]) assert.equal(usdToAtomic(price),atomic);
  for(const price of ["$0","$0.000000","$0.0000001","$1.0000001","0.01","$-1","$NaN","$01.5","$1e9","$10000000",null])
    assert.throws(()=>usdToAtomic(price));
  const q={"GET /v1/ping":{accepts:{scheme:"exact",network:"eip155:8453",price:"$0.001",payTo:PAYTO1}}};
  assert.throws(()=>makeCatalog(BASE,q),/Unexpected number/);
});

test("Public origin hosts all twenty actual configured paid APIs with CAIP2 exact USDC metadata",async()=>{
  const response=await fetch(BASE+"/discovery/resources");
  assert.equal(response.status,200);
  assert.equal(response.headers.get("payment-required"),null,"read-only discovery never charges");
  const json=await response.json();
  assert.equal(json.x402Version,2);
  assert.equal(json.pagination.total,20);
  assert.equal(json.pagination.limit,20);
  assert.equal(json.pagination.offset,0);
  assert.equal(json.items.length,20);
  const urls=json.items.map(item=>item.resource);
  assert.equal(new Set(urls).size,20);
  assert.deepEqual(urls,[...urls].sort((a,b)=>a.localeCompare(b,"en")));
  const spec=await (await fetch(BASE+"/openapi.json")).json();
  assert.ok(spec.paths["/discovery/resources"].get);
  for(const x of json.items){
    assert.ok(x.resource.startsWith(BASE+"/v1/"));
    assert.equal(x.type,"http");
    assert.equal(x.x402Version,2);
    assert.equal(x.accepts.length,1);
    const a=x.accepts[0];
    assert.equal(a.scheme,"exact");
    assert.equal(a.network,"eip155:8453");
    assert.equal(a.asset.toLowerCase(),USDC);
    assert.equal(a.maxTimeoutSeconds,300);
    assert.deepEqual(a.extra,{name:"USD Coin",version:"2"});
    assert.match(a.payTo,/^0x[0-9a-fA-F]{40}$/);
    assert.match(a.amount,/^[1-9][0-9]*$/);
    assert.ok(!JSON.stringify(x).includes("signature"));
    const pathname=new URL(x.resource).pathname;
    const ops=spec.paths[pathname];
    assert.ok(ops,"Every catalog item must appear in public OpenAPI");
    const op=ops.get||ops.post;
    assert.ok(op?.["x-payment-info"],"Every paid item has actual OpenAPI fee metadata");
    const price="$"+op["x-payment-info"].price.amount;
    assert.equal(a.amount,usdToAtomic(price),pathname+" unit price must equal API contract");
    assert.equal(a.payTo.toLowerCase(),op["x-payment-info"].payTo.toLowerCase(),pathname+" payee must equal API contract");
  }
  const vm1=json.items.filter(x=>x.accepts[0].payTo.toLowerCase()===PAYTO2.toLowerCase());
  assert.equal(vm1.length,7,"Original two TapeOut, BTC funding, Aave Base and ERC20 preflight pay original VM1; preserve 13 existing VM5-payto SKUs");
  assert.ok(vm1.some(x=>x.resource===BASE+"/v1/tapeout-cpu0-report"));
  assert.ok(vm1.some(x=>x.resource===BASE+"/v1/tapeout-cpu0-diff"));
  assert.ok(vm1.some(x=>x.resource===BASE+"/v1/btc-funding-four-venues"),"New third original VM1 recipient route must exist");
  assert.equal(vm1.find(x=>x.resource===BASE+"/v1/tapeout-cpu0-report").accepts[0].amount,"5000");
  assert.equal(vm1.find(x=>x.resource===BASE+"/v1/tapeout-cpu0-diff").accepts[0].amount,"10000");
  assert.equal(vm1.find(x=>x.resource===BASE+"/v1/btc-funding-four-venues").accepts[0].amount,"10000");
  assert.equal(json.items.filter(x=>x.accepts[0].payTo.toLowerCase()===PAYTO1.toLowerCase()).length,13);
  const old=await(await fetch(BASE+"/.well-known/x402.json")).json();
  assert.equal(old.version,1,"Old v1 origin format preserved for existing indexers");
  assert.equal(old.resources.length,20,"All old resources kept");
  assert.equal(old.discoveryApi,BASE+"/discovery/resources");
});

test("The original four unsigned x402 challenges match their prices and payees in the new 20-resource catalog",async()=>{
  const catalog=await(await fetch(BASE+"/discovery/resources")).json();
  for(const path of ["/v1/ping","/v1/x402-template","/v1/tapeout-cpu0-report","/v1/tapeout-cpu0-diff"]){
    const r=await fetch(BASE+path);
    assert.equal(r.status,402,"Must not make unsigned catalog request a paid delivery");
    const real=readQuote(r);
    const listed=catalog.items.find(x=>x.resource===BASE+path)?.accepts?.[0];
    assert.ok(listed);
    for(const key of ["scheme","network","amount","asset","payTo","maxTimeoutSeconds"])
      assert.equal(String(listed[key]).toLowerCase(),String(real[key]).toLowerCase(),key+" / "+path);
    assert.deepEqual(listed.extra,real.extra);
  }
});

test("Read-only price and payee filters are explicit, bounded and never expose a payer",async()=>{
  async function fetchPage(query) {
    const r=await fetch(BASE+"/discovery/resources"+query);
    const j=await r.json();return {code:r.status,json:j,header:r.headers.get("payment-required")};
  }
  const page=await fetchPage("?limit=3&offset=2");
  assert.equal(page.code,200);assert.equal(page.json.pagination.limit,3);
  assert.equal(page.json.pagination.total,20);assert.equal(page.json.items.length,3);
  assert.equal(page.header,null);
  const vm1=await fetchPage("?payTo="+PAYTO2.toLowerCase());
  assert.equal(vm1.code,200);assert.equal(vm1.json.items.length,7,"VM1 owns both TapeOut, BTC funding, Aave V3 Base and new ERC20 calldata SKU");
  const mainnet=await fetchPage("?network=eip155%3A8453&scheme=exact&type=http");
  assert.equal(mainnet.code,200);assert.equal(mainnet.json.items.length,20);
  const wrong=await fetchPage("?network=eip155%3A1");
  assert.equal(wrong.code,200);assert.equal(wrong.json.items.length,0);
  const unsupported=await fetchPage("?extensions=bazaar");
  assert.equal(unsupported.code,200);assert.equal(unsupported.json.items.length,0,"Do not misrepresent Bazaar catalog registration");
  for(const query of ["?limit=0","?limit=1000","?offset=-1","?offset=1e3","?unknown=key","?limit=1&limit=2","?payTo=x".repeat(120)]){
    const result=await fetchPage(query);
    assert.equal(result.code,400,query);
    assert.equal(result.header,null);
  }
  // Node fetch/Undici normalizes forbidden Host overrides. Use a real
  // one-shot TCP HTTP request to exercise the raw incoming Host header.
  const forged=await new Promise((resolve,reject)=>{
    const dest=new URL(BASE);
    const req=http.request({
      hostname:dest.hostname,port:Number(dest.port),path:"/discovery/resources",
      method:"GET",headers:{Host:"evil.example.com"}
    },response=>{
      response.resume();response.on("end",()=>resolve(response.statusCode));
    });
    req.on("error",reject);req.end();
  });
  assert.equal(forged,400,"Real incoming Host header must never control public payment/resource URL");
});

test("Pure queryCatalog is nonmutating and rejects unknown filter keys",()=>{
  const item={resource:BASE+"/v1/ping",type:"http",accepts:[{scheme:"exact",network:"eip155:8453",payTo:PAYTO1}]};
  const catalog={x402Version:2,items:[item]};
  const view=queryCatalog(catalog,{payTo:PAYTO1.toLowerCase(),limit:"1"});
  assert.equal(view.items.length,1);
  assert.equal(catalog.items.length,1);
  assert.throws(()=>queryCatalog(catalog,{__proto__:null,hijack:"yes"}));
});
