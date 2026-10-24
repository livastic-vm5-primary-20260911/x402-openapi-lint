import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourVenueReader,FUNDING_PAYOUT_BASE,FUNDING_PRICE_USDC,FUNDING_ROUTES,FUNDING_FALLBACK_ROUTES,DEMO_FUNDING} from '../funding/four-venue.mjs';
import {makeDiscovery} from '../discovery.mjs';

const t=Date.parse('2026-10-24T03:33:22.000Z');
const next=t+4*3_600_000;
const prev=next-8*3_600_000;
const jsons=[
 {symbol:'BTCUSDT',markPrice:'80000',lastFundingRate:'0.00007130',time:t,nextFundingTime:next},
 {retCode:0,retMsg:'OK',time:t,result:{list:[{symbol:'BTCUSDT',fundingRate:'-0.00004000',nextFundingTime:String(next),fundingIntervalHour:'8'}]}},
 {code:'0',data:[{instId:'BTC-USDT-SWAP',fundingRate:'0.000030',ts:String(t),fundingTime:String(next),prevFundingTime:String(prev),nextFundingTime:String(next+8*3_600_000)}]},
 {code:'00000',requestTime:t,data:[{symbol:'BTCUSDT',fundingRate:'0.000075',fundingRateInterval:'8',nextUpdate:String(next)}]}
];
const response=(status,body,headers=new Map())=>({status,headers:{get:(k)=>headers.get(k.toLowerCase())||null},text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const mk=(modify=()=>{},opt={})=>{
 const bodies=structuredClone(jsons);
 modify(bodies);
 let calls=0,now=t;
 const fetchImpl=async u=>{
  const i=FUNDING_ROUTES.findIndex(x=>x.url===u);
  assert.ok(i>=0,'The reader must never contact unpinned external domains');
  calls++;
  return response(200,bodies[i]);
 };
 const reader=createFourVenueReader({fetchImpl,clock:()=>now,...opt});
 return {reader,get calls(){return calls},setNow(v){now=v}};
};
test('All four verified sources are read in parallel and differ by interval, without assuming arbitrage yield',async()=>{
 const x=mk();const got=await x.reader();
 assert.equal(x.calls,4);assert.equal(got.sourceCount,4);assert.equal(got.venues.length,4);
 assert.deepEqual(got.venues.map(v=>v.venue),['Binance','Bybit','OKX','Bitget']);
 assert.deepEqual(got.venues.map(v=>v.quotedFundingRate),['0.00007130','-0.00004000','0.000030','0.000075']);
 assert.deepEqual(got.venues.map(v=>v.intervalHours),[null,8,8,8]);
 assert.equal(got.venues[1].quotedFundingRateBps,-0.4);
 assert.equal(got.comparison.rawSpreadBps,1.15);
 assert.match(got.comparison.warning,/not an arbitrage trade or profit/);
 assert.equal(got.independentConfirmedPayingBuyersForThisProduct,0);
 assert.deepEqual(await x.reader(),got);
 assert.equal(x.calls,4,'successful fresh result cache must avoid 402-quote API hammering');
});
test('Concurrent buyers share one complete pre-payment refresh',async()=>{
 const x=mk();const [a,b,c]=await Promise.all([x.reader(),x.reader(),x.reader()]);
 assert.equal(x.calls,4);assert.deepEqual(a,b);assert.deepEqual(b,c);
});
test('Stale/incorrect/malformed exchange data fail closed instead of selling a misleading partial report',async()=>{
 for(const [which,edit] of [
  ['binance stale',x=>{x[0].time=t-500000}],
  ['binance wrong symbol',x=>{x[0].symbol='ETHUSDT'}],
  ['bybit wrong code',x=>{x[1].retCode=10001}],
  ['bybit wrong funding',x=>{x[1].result.list[0].fundingRate='NaN'}],
  ['okx wrong array',x=>{x[2].data=[]}],
  ['okx signed overflow',x=>{x[2].data[0].fundingRate='0.1'}],
  ['okx wrong symbol',x=>{x[2].data[0].instId='ETH-USDT-SWAP'}],
  ['bitget negative invalid time',x=>{x[3].requestTime=-1}],
  ['bitget interval unknown',x=>{x[3].data[0].fundingRateInterval='0'}],
  ['after scheduled window',x=>{x[3].data[0].nextUpdate=String(t-200000)}]
 ]){
  await assert.rejects(mk(edit).reader(),{code:'FUNDING_SOURCE_UNAVAILABLE'},which);
 }
});
test('Upstream errors and oversized HTTP bodies fail closed; no successful cache of failures',async()=>{
 let calls=0;let bad=true;
 const fetchImpl=async url=>{
  calls++;
  const idx=FUNDING_ROUTES.findIndex(r=>r.url===url);assert.ok(idx>=0);
  return bad&&idx===2?response(503,{code:'500'}):response(200,jsons[idx]);
 };
 const r=createFourVenueReader({fetchImpl,clock:()=>t});
 await assert.rejects(r(),{code:'FUNDING_SOURCE_UNAVAILABLE'});
 bad=false;
 const okay=await r();
 assert.equal(okay.sourceCount,4);
 assert.equal(calls,10, 'four originally scheduled plus two backup probes on failure and four on successful retry');
 const h=createFourVenueReader({fetchImpl:async()=>response(200,'x'.repeat(10241)),clock:()=>t});
 await assert.rejects(h(),{code:'FUNDING_SOURCE_UNAVAILABLE'});
});
test('New SKU payout and machine-discoverable contract point only to original VM1 native Circle Base USDC',()=>{
 assert.equal(FUNDING_PRICE_USDC,'0.01');
 assert.equal(FUNDING_PAYOUT_BASE.toLowerCase(),'0x4e3106520e40af30870cafe78da1b1e7110ed98e');
 const {spec,wellKnown}=makeDiscovery('https://vm5-openapi-x402.onrender.com');
 const o=spec.paths['/v1/btc-funding-four-venues'].get;
 assert.equal(o['x-payment-info'].network,'eip155:8453');
 assert.equal(o['x-payment-info'].price.amount,'0.01');
 assert.equal(o['x-payment-info'].payTo,FUNDING_PAYOUT_BASE);
 assert.deepEqual(o.security,[{x402Payment:[]}]);
 assert.equal(spec.paths['/v1/btc-funding-sample'].get.security.length,0);
 assert.ok(wellKnown.resources.includes('https://vm5-openapi-x402.onrender.com/v1/btc-funding-four-venues'));
 assert.ok(DEMO_FUNDING.exampleOnly && DEMO_FUNDING.noRealMarketQuoteInThisSample);
});

test('Source-specific free 503 diagnostics disclose only public exchange name/status, never HTTP body, API key, or wallet',async()=>{
 const inputJson=[{symbol:'BTCUSDT',lastFundingRate:'0.00007',time:t,nextFundingTime:next},
   jsons[1],jsons[2],jsons[3]];
 const bad=async url=>{
   const id=FUNDING_ROUTES.findIndex(x=>x.url===url);
   assert.ok(id>=0);
   return id===1 ? response(451,'PROHIBITED_PRIVATE_TOKEN_Q9') : response(200,inputJson[id]);
 };
 const r=createFourVenueReader({fetchImpl:bad,clock:()=>t});
 await assert.rejects(r(),err=>{
   assert.equal(err.code,'FUNDING_SOURCE_UNAVAILABLE');
   assert.match(err.message,/Bybit: HTTP 451/);
   assert.ok(!err.message.includes('PROHIBITED_PRIVATE_TOKEN'));
   assert.ok(!err.message.includes('futures'));
   return true;
 });
 const offline=createFourVenueReader({fetchImpl:async url=>{
   if(url.includes('bitget.com')) throw Error('https://private-service/token/abcd failed!!');
   const id=FUNDING_ROUTES.findIndex(x=>x.url===url);
   return response(200,inputJson[id]);
 },clock:()=>t});
 await assert.rejects(offline(),err=>{
   assert.match(err.message,/Bitget: public HTTPS fetch failed or timed out/);
   assert.ok(!err.message.includes('private-service'));
   assert.ok(!err.message.includes('abcd'));
   return true;
 });
});


test('Render regional Bybit HTTP403 is replaced only by a REAL independent MEXC BTCUSDT quote',async()=>{
 const mexc={success:true,code:0,data:{symbol:'BTC_USDT',fundingRate:0.000068,collectCycle:8,
   timestamp:t,nextSettleTime:next}};
 const data=structuredClone(jsons);let seen=[];
 const fetchImpl=async url=>{
   seen.push(url);
   if(url===FUNDING_ROUTES[1].url)return response(403,{error:'region blocked'});
   if(url===FUNDING_FALLBACK_ROUTES[0].url)return response(200,mexc);
   const idx=FUNDING_ROUTES.findIndex(v=>v.url===url);assert.ok(idx>=0);return response(200,data[idx]);
 };
 const r=await createFourVenueReader({fetchImpl,clock:()=>t})();
 assert.equal(r.venues.length,4);
 assert.deepEqual(r.venues.map(x=>x.venue),['Binance','OKX','Bitget','MEXC']);
 assert.ok(r.attemptedPrimaryVenues.includes('Bybit'));
 assert.equal(r.venues.find(x=>x.venue==='MEXC').quotedFundingRate,'0.000068');
 assert.equal(r.venues.find(x=>x.venue==='MEXC').intervalHours,8);
 assert.equal(seen.length,5, 'Only needed MEXC backup is contacted; no unnecessary Gate request');
 assert.ok(!seen.includes(FUNDING_FALLBACK_ROUTES[1].url));
 assert.equal(r.sourceCount,4);
 assert.equal(r.independentConfirmedPayingBuyersForThisProduct,0);
});

test('Two region-restricted sources can be replaced by MEXC plus explicitly timestamp-limited Gate.io',async()=>{
 const mexc={success:true,code:0,data:{symbol:'BTC_USDT',fundingRate:0.000068,collectCycle:8,
   timestamp:t,nextSettleTime:next}};
 const gate={name:'BTC_USDT',funding_rate:'0.000057',funding_next_apply:Math.round(next/1000),funding_interval:28800};
 const seen=[];
 const fetchImpl=async url=>{
   seen.push(url);
   if([FUNDING_ROUTES[1].url,FUNDING_ROUTES[3].url].includes(url))return response(403,'denied');
   if(url===FUNDING_FALLBACK_ROUTES[0].url)return response(200,mexc);
   if(url===FUNDING_FALLBACK_ROUTES[1].url)return response(200,gate);
   const ix=FUNDING_ROUTES.findIndex(v=>v.url===url);assert.ok(ix>=0);return response(200,jsons[ix]);
 };
 const v=await createFourVenueReader({fetchImpl,clock:()=>t})();
 assert.deepEqual(v.venues.map(x=>x.venue),['Binance','OKX','MEXC','Gate.io']);
 assert.equal(new Set(v.venues.map(x=>x.venue)).size,4);
 assert.equal(seen.length,6);
 assert.equal(v.venues.at(-1).providerTimestampUtc,null);
 assert.equal(v.venues.at(-1).sourceTimestampBasis,'observed_at_https_response_not_provider_published');
 assert.equal(v.venues.at(-1).intervalHours,8);
 assert.match(v.caveats.join(' '),/Gate.io does not publish/);
});

test('Three blocked primary providers with only two backup slots fail before payment, never return a two/three-source misleading quote',async()=>{
 const fetchImpl=async url=>{
   const idx=FUNDING_ROUTES.findIndex(x=>x.url===url);
   if(idx===0)return response(200,jsons[0]);
   if(idx>0)return response(403,'no data');
   if(url===FUNDING_FALLBACK_ROUTES[0].url)return response(200,{success:true,code:0,data:{symbol:'BTC_USDT',fundingRate:0.000068,collectCycle:8,timestamp:t,nextSettleTime:next}});
   if(url===FUNDING_FALLBACK_ROUTES[1].url)return response(200,{name:'BTC_USDT',funding_rate:'0.000057',funding_next_apply:Math.round(next/1000),funding_interval:28800});
   assert.fail('Unexpected URL');
 };
 const rd=createFourVenueReader({fetchImpl,clock:()=>t});
 await assert.rejects(rd(),e=>{assert.equal(e.code,'FUNDING_SOURCE_UNAVAILABLE');assert.match(e.message,/Only 3 of four independent venue quotes verified/);return true});
});
