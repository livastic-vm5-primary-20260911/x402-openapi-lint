import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDiscovery} from '../discovery.mjs';
import {TAPEOUT_PAYOUT,TAPEOUT_PRICE_USDC} from '../tapeout/paid-report.mjs';

const BASE=process.env.TEST_URL || 'http://127.0.0.1:8736';
const OLD_PAYTO='0x6b01efa0705e91a7aca54271510bf9e594717f34';
const CIRCLE='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

function quote(response){
 const h=response.headers.get('PAYMENT-REQUIRED');
 assert.ok(h,'Must have actual machine-readable v2 x402 PAYMENT-REQUIRED');
 const d=JSON.parse(Buffer.from(h,'base64').toString('utf8'));
 assert.equal(d.x402Version,2);
 assert.equal(d.accepts.length,1);
 assert.equal(d.accepts[0].network,'eip155:8453');
 assert.equal(d.accepts[0].asset.toLowerCase(),CIRCLE);
 return d;
}
function fakePayment(q,signature='11'){
 const data={
  x402Version:2,resource:q.resource,accepted:q.accepts[0],
  extensions:q.extensions || {},
  payload:{
   signature:'0x'+signature.repeat(65),
   authorization:{
    from:'0x'+'33'.repeat(20),
    to:q.accepts[0].payTo,
    value:q.accepts[0].amount,
    validAfter:'0',validBefore:'9999999999',
    nonce:'0x'+'44'.repeat(32)
   }
  }
 };
 return Buffer.from(JSON.stringify(data)).toString('base64');
}

test('Free TapeOut sample is honest and never asks a wallet to pay',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-sample');
 assert.equal(r.status,200);
 assert.equal(r.headers.get('PAYMENT-REQUIRED'),null);
 const j=await r.json();
 assert.equal(j.paid,false);
 assert.equal(j.chargedUSDC,'0');
 assert.equal(j.payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(j.priceNativeBaseCircleUSDC,TAPEOUT_PRICE_USDC);
 assert.equal(j.knownIndependentPaidCustomers,0);
 assert.equal(j.chainIdForPayment,8453);
 assert.equal(j.chainIdForData,196);
});

test('Valid request: complete fake X Layer pinned snapshot preflight then exact 0.005 Base USDC 402 to ORIGINAL VM1 address',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-report');
 assert.equal(r.status,402);
 const q=quote(r);
 assert.equal(q.accepts[0].amount,'5000');
 assert.equal(q.accepts[0].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.ok(q.extensions?.bazaar);
 assert.equal(q.extensions.bazaar.info?.input?.method,'GET');
 assert.equal(q.extensions.bazaar.info?.output?.example?.chainId,196);
 assert.equal(r.headers.get('PAYMENT-RESPONSE'),null);
});

test('Public 0.005 BaseUSDC report mirrors ONLY canonical original VM1 quote for firstparty discovery, no signing or settlement',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-report');
 assert.equal(r.status,402);
 const wire=r.headers.get('payment-required');
 assert.ok(wire);
 assert.equal(r.headers.get('x-payment-required'),wire);
 assert.ok(r.headers.get('access-control-expose-headers').includes('X-Payment-Required'));
 const fromHeader=JSON.parse(Buffer.from(wire,'base64').toString('utf8'));
 const fromBody=await r.json();
 assert.deepEqual(fromBody,fromHeader);
 assert.equal(fromBody.x402Version,2);
 assert.equal(new URL(fromBody.resource.url).pathname,'/v1/tapeout-cpu0-report');
 assert.equal(fromBody.accepts.length,1);
 assert.equal(fromBody.accepts[0].amount,'5000');
 assert.equal(fromBody.accepts[0].network,'eip155:8453');
 assert.equal(fromBody.accepts[0].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(fromBody.accepts[0].asset.toLowerCase(),CIRCLE);
 assert.equal(fromBody.extensions.bazaar.info.input.method,'GET');
 assert.equal(r.headers.get('payment-response'),null);
 const bad=await fetch(BASE+'/v1/tapeout-cpu0-report?unexpected=1');
 assert.equal(bad.status,400);
 assert.equal(bad.headers.get('payment-required'),null);
 assert.equal(bad.headers.get('x-payment-required'),null);
 assert.equal((await bad.json()).charged,false);
});

test('Bad query forbidden before quote or settlement',async()=>{
 for(const item of [
   '/v1/tapeout-cpu0-report?index=2',
   '/v1/tapeout-cpu0-report?privateKey=abc',
   '/v1/tapeout-cpu0-report?token=1&token=2'
 ]){
  const r=await fetch(BASE+item);
  assert.equal(r.status,400,item);
  assert.equal(r.headers.get('PAYMENT-REQUIRED'),null);
  assert.equal((await r.json()).charged,false);
 }
});

test('LOCAL FAKE facilitator only: one synthetic signed test marker releases pinned X Layer report after middleware; no real payment',async()=>{
 const q=quote(await fetch(BASE+'/v1/tapeout-cpu0-report'));
 const r=await fetch(BASE+'/v1/tapeout-cpu0-report',{headers:{'PAYMENT-SIGNATURE':fakePayment(q)}});
 assert.equal(r.status,200);
 assert.ok(r.headers.get('PAYMENT-RESPONSE'));
 const j=await r.json();
 assert.equal(j.ok,true);
 assert.equal(j.paid,true);
 assert.equal(j.chargedUSDC,TAPEOUT_PRICE_USDC);
 assert.equal(j.chainId,196);
 assert.equal(j.blockNumber,'2280');
 assert.equal(j.factory.cpuCount,'2');
 assert.equal(j.market.feeBps,100);
 assert.equal(j.processor.circuits,'0x'+'11'.repeat(20));
 assert.equal(j.processor.transistors,'0x'+'22'.repeat(20));
 assert.equal(j.partial,false);
 assert.equal(j.verifiedThirdPartyPaidOrdersForThisRoute,0);
 assert.ok(j.diagnostics.length>0);
 assert.ok(j.reportDisclosure.liveFreeInspector.includes('tapeout-xlayer'));
 assert.ok(j.payoutRail.includes('VM1'));
});

test('Even a correctly shaped forged signature cannot obtain the report',async()=>{
 const q=quote(await fetch(BASE+'/v1/tapeout-cpu0-report'));
 const r=await fetch(BASE+'/v1/tapeout-cpu0-report',{headers:{'PAYMENT-SIGNATURE':fakePayment(q,'12')}});
 assert.notEqual(r.status,200);
});

test('Existing x402 product prices and original VM5 merchant payee remain invariant',async()=>{
 const original=quote(await fetch(BASE+'/v1/csv-report'));
 assert.equal(original.accepts[0].amount,'5000');
 assert.equal(original.accepts[0].payTo.toLowerCase(),OLD_PAYTO);
 const ping=quote(await fetch(BASE+'/v1/ping'));
 assert.equal(ping.accepts[0].amount,'1000');
 assert.equal(ping.accepts[0].payTo.toLowerCase(),OLD_PAYTO);
});

test('OpenAPI and discovery advertise two unchanged TapeOut products plus one new funding product and 18 paid resources',()=>{
 const {spec,wellKnown}=makeDiscovery('https://vm5-openapi-x402.onrender.com');
 assert.equal(wellKnown.resources.length,18);
 assert.ok(wellKnown.resources.includes('https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-report'));
 const t=spec.paths['/v1/tapeout-cpu0-report'].get;
 assert.equal(t['x-payment-info'].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(t['x-payment-info'].price.amount,TAPEOUT_PRICE_USDC);
 assert.equal(t['x-payment-info'].asset.toLowerCase(),CIRCLE);
 assert.equal(spec.paths['/v1/csv-report'].get['x-payment-info'].payTo.toLowerCase(),OLD_PAYTO);
 assert.deepEqual(spec.paths['/v1/tapeout-cpu0-sample'].get.security,[]);
});
