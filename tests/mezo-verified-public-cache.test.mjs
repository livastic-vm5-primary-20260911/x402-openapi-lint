import test from "node:test";
import assert from "node:assert/strict";
import {createVerifiedMUSDPublicCache, MUSD_PUBLIC_CACHE_TTL_MS}
  from "../mezo/verified-public-cache.mjs";
import {MEZO_TOKEN} from "../mezo/musd-readonly.mjs";

const GOOD=Object.freeze({
  kind:"mezo_musd_pinned_erc20_readonly_facts",
  dataChain:"eip155:31612",dataBlock:"12750000",
  blockTag:"0xc28fc0",contract:MEZO_TOKEN,
  symbol:"MUSD",decimals:18,totalSupplyAtomic:"29000000000000000000000000",
  totalSupplyMUSD:"29000000",code:{runtimeBytes:6100,sha256:"aa".repeat(32)},
  balanceOwner:null,allowanceSpender:null,balanceAtomic:null,allowanceAtomic:null,
  noWalletKeysOrSigning:true,noTransactionsOrGas:true
});

test("Cache TTL for public metadata only is bounded and explicitly stated",()=>{
 assert.equal(MUSD_PUBLIC_CACHE_TTL_MS,90000);
 assert.throws(()=>createVerifiedMUSDPublicCache({load:()=>GOOD,ttlMs:0}));
 assert.throws(()=>createVerifiedMUSDPublicCache({load:()=>GOOD,ttlMs:300001}));
 assert.throws(()=>createVerifiedMUSDPublicCache({load:null}));
});
test("Cold source-verified first load retains pinned block without claiming zero-age receipt proof",async()=>{
 let count=0,t=1234567890000;
 const cache=createVerifiedMUSDPublicCache({load:async()=>{count++;return GOOD;},now:()=>t});
 const v=await cache.get();
 assert.equal(count,1);assert.equal(v.sourceAgeSeconds,0);
 assert.equal(v.sourceWasCached,false);
 assert.equal(v.sourceCacheTtlSeconds,90);
 assert.equal(v.dataBlock,GOOD.dataBlock);
 assert.equal(v.sourceSnapshotPinned,true);
 assert.equal(new Date(v.sourceObservedAtUtc).getTime(),t);
 assert(Object.isFrozen(v));
});
test("Repeated public fact checks reuse same verified block and perform NO new upstream load",async()=>{
 let n=0,t=1234567890000;
 const c=createVerifiedMUSDPublicCache({load:async()=>{n++;return GOOD;},now:()=>t});
 await c.get();
 t+=35000;
 const again=await c.get();
 assert.equal(n,1);assert.equal(again.sourceWasCached,true);
 assert.equal(again.sourceAgeSeconds,35);
 assert.equal(again.sourceCacheTtlSeconds,90);
 assert.equal(again.totalSupplyAtomic,GOOD.totalSupplyAtomic);
});
test("Two concurrent scanner probes coalesce into ONE real source operation",async()=>{
 let calls=0,resolve;
 const gateway=new Promise(done=>resolve=done);
 const c=createVerifiedMUSDPublicCache({load:async()=>{calls++;await gateway;return GOOD;},now:()=>1234567890000});
 const a=c.get(),b=c.get();
 await Promise.resolve();
 assert.equal(calls,1);
 resolve();
 const [first,second]=await Promise.all([a,b]);
 assert.equal(first.sourceWasCached,false);
 assert.equal(second.sourceWasCached,true);
 assert.equal(first.dataBlock,second.dataBlock);
});
test("Refreshes at 90s expiration, uses newer successful block",async()=>{
 let calls=0,t=1234567890000;
 const c=createVerifiedMUSDPublicCache({load:async()=>({...GOOD,dataBlock:String(12750000+(++calls))}),now:()=>t});
 assert.equal((await c.get()).dataBlock,"12750001");
 t+=89999;assert.equal((await c.get()).dataBlock,"12750001");
 t+=1;const v=await c.get();
 assert.equal(v.dataBlock,"12750002");
 assert.equal(v.sourceWasCached,false);
 assert.equal(calls,2);
});
test("Rejects private owner and allowance snapshots from the cache",async()=>{
 for(const result of [
  {...GOOD,balanceOwner:"0x"+"11".repeat(20)},
  {...GOOD,allowanceSpender:"0x"+"22".repeat(20)},
  {...GOOD,allowanceAtomic:"99"},
  {...GOOD,contract:"0x"+"33".repeat(20)},
  {...GOOD,noWalletKeysOrSigning:false},
  {...GOOD,dataChain:"eip155:8453"},
  {...GOOD,code:{sha256:"INVALID",runtimeBytes:5000}}
 ]){
  const c=createVerifiedMUSDPublicCache({load:async()=>result});
  await assert.rejects(c.get(),/Only a complete verified/);
 }
});
test("Fails closed and empties cache after expired RPC read fails, never serves stale supply",async()=>{
 let count=0,t=1234567890000;
 const c=createVerifiedMUSDPublicCache({load:async()=>{if(++count>1)throw Error("Upstream unavailable");return GOOD;},now:()=>t});
 await c.get();t+=90000;
 await assert.rejects(c.get(),/Upstream unavailable/);
 await assert.rejects(c.get(),/Upstream unavailable/);
 assert.equal(count,3);
});
test("Invalid source data never becomes a paid quote or cached successful snapshot",async()=>{
 let n=0;
 const c=createVerifiedMUSDPublicCache({load:async()=>{n++;return n===1?null:GOOD;}});
 await assert.rejects(c.get(),/Only a complete verified/);
 assert.equal((await c.get()).dataBlock,GOOD.dataBlock);
 assert.equal(n,2);
});


test("Server uses cache only for public no-address preflight, preserving uncached balance/allowance",async()=>{
  const {readFileSync}=await import("node:fs");
  const server=readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
  assert.match(server,/check\.owner===null\s*\? await mezoVerifiedPublicSummary\.get\(\)\s*:\s*await readMezoMUSDFacts\(\{owner:check\.owner,spender:check\.spender\}\)/);
  assert.match(server,/echoCanonicalMezoMUSD402,payment,/);
  assert.match(server,/Complete source-pinned Mezo MUSD contract proof unavailable; no payment requested/);
  assert.match(server,/sourceCachePolicy:/);
});
test("Official public OpenAPI accurately discloses pinned maximum source age and separate payment rail",async()=>{
  const {readFileSync}=await import("node:fs");
  const schema=readFileSync(new URL("../discovery.mjs",import.meta.url),"utf8");
  assert.match(schema,/Complete public token-only snapshots may be reused up to 90 seconds/);
  assert.match(schema,/Any optional public owner\/spender balance\/allowance is never cached/);
  assert.match(schema,/Data chain Mezo31612; payment chain Base8453/);
});
