import test from 'node:test';
import assert from 'node:assert/strict';
import {DIFF_BASELINE_BLOCK,DIFF_PRICE_USDC,DIFF_FIELDS,TAPEOUT_PAYOUT,compareVerifiedTapeoutSnapshots} from '../tapeout/diff-report.mjs';
import {PublicRpc} from '../tapeout/rpc.mjs';
import {FACTORY,MARKET} from '../tapeout/core.mjs';
import {makeDiscovery} from '../discovery.mjs';

const BASE=process.env.TEST_URL||'http://127.0.0.1:8736';
const OLD='0x6b01efA0705E91a7aca54271510bf9e594717f34';
const CIRCLE='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function quote(res){
 const header=res.headers.get('payment-required');
 assert.ok(header);
 const q=JSON.parse(Buffer.from(header,'base64').toString('utf8'));
 assert.equal(q.x402Version,2);assert.equal(q.accepts.length,1);
 const a=q.accepts[0];
 assert.equal(a.scheme,'exact');
 assert.equal(a.network,'eip155:8453');
 assert.equal(a.amount,'10000');
 assert.equal(a.asset.toLowerCase(),CIRCLE.toLowerCase());
 assert.equal(a.payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 return q;
}
function fakePayment(q,mark='11'){
 return Buffer.from(JSON.stringify({
  x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
  payload:{
   signature:'0x'+mark.repeat(65),
   authorization:{from:'0x'+'33'.repeat(20),to:q.accepts[0].payTo,
     value:q.accepts[0].amount,validAfter:'0',validBefore:'9999999999',nonce:'0x'+'44'.repeat(32)}
  }
 })).toString('base64');
}

test('The new separate paid product declares a useful complete original machine-readable JSON delivery schema before any buyer spends',()=>{
 const operation=makeDiscovery('https://vm5-openapi-x402.onrender.com').spec.paths['/v1/tapeout-cpu0-diff'].get;
 const json=operation.responses['200'].content['application/json'].schema;
 assert.equal(json.type,'object');
 for(const required of ['kind','schema','chainId','baselineBlock','liveBlock','fieldsCompared','changeCount','unchangedCount','changes','warning','originalVM1PayoutAddress','paid'])
   assert.ok(json.required.includes(required),'Missing public required contract '+required);
 const change=json.properties.changes;
 assert.equal(change.type,'array');
 assert.deepEqual(change.items.required,['field','label','before','after']);
 assert.equal(json.properties.fieldsCompared.const,20);
 assert.equal(json.properties.chargedUSDC.const,'0.01');
 assert.equal(json.properties.network.const,'eip155:196');
 assert.equal(operation['x-payment-info'].network,'eip155:8453');
 assert.equal(operation['x-payment-info'].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(operation['x-payment-info'].price.amount,DIFF_PRICE_USDC);
 assert.ok(!JSON.stringify(json).includes('privateKey'));
 assert.ok(!JSON.stringify(json).includes('walletSigner'));
});

test('Zero-cost public sample clearly distinguishes two-block historical SKU',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-diff-sample');
 assert.equal(r.status,200);
 assert.equal(r.headers.get('payment-required'),null);
 const d=await r.json();
 assert.equal(d.paid,false);assert.equal(d.exampleOnly,true);assert.equal(d.chargedUSDC,'0');
 assert.equal(d.payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(d.baselineBlock,DIFF_BASELINE_BLOCK.toString());
 assert.equal(d.fieldsCompared,20);
 assert.equal(d.priceNativeBaseCircleUSDC,DIFF_PRICE_USDC);
 assert.equal(d.exampleChange.fictional,true);
 assert.ok(d.freeAlternative.includes('tapeout-xlayer-integrity-lens'));
});

test('Legacy directory can read only the canonical public VM1 diff quote, without payment or altered settlement',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-diff');
 assert.equal(r.status,402);
 const encoded=r.headers.get('payment-required');
 assert.ok(encoded);
 assert.equal(r.headers.get('x-payment-required'),encoded);
 assert.ok(r.headers.get('access-control-expose-headers').includes('X-Payment-Required'));
 const fromHeader=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
 const fromBody=await r.json();
 assert.deepEqual(fromBody,fromHeader);
 assert.equal(fromBody.accepts[0].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(fromBody.accepts[0].amount,'10000');
 assert.equal(fromBody.accepts[0].network,'eip155:8453');
 assert.equal(r.headers.get('payment-response'),null);
 const bad=await fetch(BASE+'/v1/tapeout-cpu0-diff?unexpected=1');
 assert.equal(bad.status,400);
 assert.equal(bad.headers.get('x-payment-required'),null);
 assert.equal(bad.headers.get('payment-required'),null);
});

test('Preflight complete two local X Layer pinned snapshots THEN an unsigned 0.01 BaseUSDC x402 quote to VM1',async()=>{
 const r=await fetch(BASE+'/v1/tapeout-cpu0-diff');
 assert.equal(r.status,402);
 assert.equal(r.headers.get('payment-response'),null);
 const q=quote(r);
 assert.equal(q.extensions.bazaar?.info?.input?.method,'GET');
 assert.equal(q.extensions.bazaar?.info?.output?.example?.kind,'xlayer_tapeout_cpu0_pinned_state_diff');
 assert.equal(q.extensions.bazaar?.info?.output?.example?.baselineBlock,DIFF_BASELINE_BLOCK.toString());
});
test('Reject query, body-like GET, or parameter spoofing before any payment',async()=>{
 for(const param of ['?fromBlock=1','?secret=privatekey','?cpuIndex=1','?baselineBlock=0x1','?payTo='+OLD,'?fromBlock=1&fromBlock=2']){
  const r=await fetch(BASE+'/v1/tapeout-cpu0-diff'+param);
  assert.equal(r.status,400,param);
  assert.equal(r.headers.get('payment-required'),null);
  assert.equal((await r.json()).charged,false);
 }
});

test('LOCAL MOCK ONLY: real middleware x402 v2 fixture unlocks 20-field changed-only pinned comparison',async()=>{
 const q=quote(await fetch(BASE+'/v1/tapeout-cpu0-diff'));
 const r=await fetch(BASE+'/v1/tapeout-cpu0-diff',{headers:{'PAYMENT-SIGNATURE':fakePayment(q)}});
 assert.equal(r.status,200);
 assert.ok(r.headers.get('PAYMENT-RESPONSE'));
 const d=await r.json();
 assert.equal(d.ok,true);assert.equal(d.paid,true);
 assert.equal(d.kind,'xlayer_tapeout_cpu0_pinned_state_diff');
 assert.equal(d.chainId,196);assert.equal(d.cpuIndex,0);
 assert.equal(d.baselineBlock,'2279');assert.equal(d.liveBlock,'2280');
 assert.equal(d.fieldsCompared,20);assert.equal(d.changedCount,undefined);
 assert.equal(d.changeCount,1);assert.equal(d.unchangedCount,19);
 assert.equal(d.changes.length,1);
 assert.deepEqual(d.changes[0],{
  field:'market.feeBps',label:'Marketplace fee (basis points)',before:'95',after:'100'
 });
 assert.equal(d.cpuIdentityChanged,false);
 assert.equal(d.chargedUSDC,DIFF_PRICE_USDC);
 assert.equal(d.originalVM1PayoutAddress.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(d.independentOutsideBuyersForThisNewSKU,0);
 assert.equal(d.noTransactionSent,true);
 assert.ok(d.warning.includes('Not a formal audit'));
});

test('LOCAL MOCK: forged payment signature does NOT unlock the historical diff',async()=>{
 const q=quote(await fetch(BASE+'/v1/tapeout-cpu0-diff'));
 const res=await fetch(BASE+'/v1/tapeout-cpu0-diff',{headers:{'PAYMENT-SIGNATURE':fakePayment(q,'12')}});
 assert.notEqual(res.status,200);
});
test('Both distinct TapeOut SKUs pay VM1, all thirteen pre-existing VM5 SKUs remain unchanged',async()=>{
 const old=JSON.parse(Buffer.from((await fetch(BASE+'/v1/csv-report')).headers.get('payment-required'),'base64'));
 assert.equal(old.accepts[0].amount,'5000');
 assert.equal(old.accepts[0].payTo.toLowerCase(),OLD.toLowerCase());
 const state=JSON.parse(Buffer.from((await fetch(BASE+'/v1/tapeout-cpu0-report')).headers.get('payment-required'),'base64'));
 assert.equal(state.accepts[0].amount,'5000');
 assert.equal(state.accepts[0].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 const catalog=await(await fetch(BASE+'/discovery/resources')).json();
 assert.equal(catalog.pagination.total,22);
 const onlyVM1=catalog.items.filter(x=>x.accepts[0].payTo.toLowerCase()===TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(onlyVM1.length,9);
 assert.deepEqual(new Set(onlyVM1.map(x=>x.accepts[0].amount)),new Set(['5000','10000']));
 assert.ok(onlyVM1.some(x=>new URL(x.resource).pathname==='/v1/btc-funding-four-venues'),
   'The new original owner VM1 0.01-USDC four-venue funding route must be discoverable separately');
 assert.equal(catalog.items.filter(x=>x.accepts[0].payTo.toLowerCase()===OLD.toLowerCase()).length,13);
 const d=makeDiscovery('https://vm5-openapi-x402.onrender.com');
 assert.equal(d.wellKnown.resources.length,22);
 assert.ok(d.wellKnown.resources.includes('https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-diff'));
 const paid=d.spec.paths['/v1/tapeout-cpu0-diff'].get;
 assert.equal(paid['x-payment-info'].payTo.toLowerCase(),TAPEOUT_PAYOUT.toLowerCase());
 assert.equal(paid['x-payment-info'].price.amount,DIFF_PRICE_USDC);
 assert.equal(paid.security.length,1);
 assert.deepEqual(d.spec.paths['/v1/tapeout-cpu0-diff-sample'].get.security,[]);
});

function full(block,fee){
 const a=x=>'0x'+x.repeat(40);
 return {
  schema:'TapeOutXLayerRiskLens/v1',
  chainId:196,blockNumber:String(block),partial:false,errors:[],
  factory:{address:FACTORY,cpuCount:2n,deployFee:100n,protocolFee:50n,isSealed:false,owner:a('1'),implementation:a('2')},
  market:{address:MARKET,feeBps:fee,isSealed:false,owner:a('3'),implementation:a('4'),nextListingId:5n},
  processor:{index:'0',circuits:a('5'),transistors:a('6'),creator:a('7'),nextId:2n,tapeoutFee:10n,mintPrice:100n,minted:40n,supplyCap:1000n,protocolFee:20n}
 };
}
test('Pure diff normalizes bigint/number/address and refuses incomplete, wrong-network, wrong processor or reversed history',()=>{
 assert.equal(DIFF_FIELDS.length,20);
 const a=full(100,95),b=full(101,100);
 const result=compareVerifiedTapeoutSnapshots(a,b);
 assert.equal(result.changeCount,1);assert.equal(result.changes[0].field,'market.feeBps');
 assert.equal(result.changes[0].before,'95');assert.equal(result.changes[0].after,'100');
 assert.throws(()=>compareVerifiedTapeoutSnapshots(b,a),/increasing/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,partial:true}),/complete/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,errors:['RPC timeout']}),/complete/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,chainId:1}),/complete/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,processor:{...b.processor,index:'1'}}),/complete/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,market:{...b.market,owner:null}}),/Malformed address/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,market:{...b.market,nextListingId:-1n}}),/Invalid unsigned/);
 assert.throws(()=>compareVerifiedTapeoutSnapshots(a,{...b,market:{...b.market,nextListingId:1.01}}),/Invalid numeric/);
});
test('Pinned RPC block selector allows only explicit safe positive bigint, rejects transaction sends',async()=>{
 const method=[];
 const rpc=new PublicRpc(['http://127.0.0.1:9999'],async(_,req)=>{
   const q=JSON.parse(req.body);method.push([q.method,q.params]);
   if(q.method==='eth_chainId')return{ok:true,json:async()=>({result:'0xc4'})};
   if(q.method==='eth_call')return{ok:true,json:async()=>({result:'0x'+'00'.repeat(32)})};
   return{ok:true,json:async()=>({result:'0x'+'00'.repeat(32)})};
 });
 await assert.rejects(()=>rpc.snapshot(0,0n),/Pinned historical block/);
 await assert.rejects(()=>rpc.snapshot(0,-1n),/Pinned historical block/);
 await assert.rejects(()=>rpc.snapshot(0,'0x1'),/Pinned historical block/);
 await assert.rejects(()=>rpc.snapshot(0,(1n<<64n)),/Pinned historical block/);
 assert.equal(method.some(([m])=>m==='eth_sendTransaction'||m==='personal_sign'),false);
 await assert.rejects(()=>rpc.request('eth_sendRawTransaction',[]),/Read-only methods only/);
});
