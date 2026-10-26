// Native full-suite localhost end-to-end for the original new Aave V3 Base SKU.
// Does not request paid data, cause chain writes, use wallet keys or incur gas.
import test from 'node:test';
import assert from 'node:assert/strict';
const BASE=process.env.TEST_URL || 'http://127.0.0.1:8736';

// All these routes MUST reply before any paid middleware or public RPC.
test('Free Aave v3 Base ERC1967 paid-product preview is genuinely free and synthetic',async()=>{
 const response=await fetch(BASE+'/v1/aave-base-proxy-sample');
 assert.equal(response.status,200);
 assert.equal(response.headers.get('payment-required'),null);
 const doc=await response.json();
 assert.equal(doc.paid,false);
 assert.equal(doc.exampleOnly,true);
 assert.equal(doc.illustrativeBlock,'SYNTHETIC_NOT_AN_ACTUAL_OBSERVATION');
 assert.equal(doc.priceNativeBaseCircleUSDC,'0.010000');
 assert.equal(doc.payTo.toLowerCase(),'0x4e3106520e40af30870cafe78da1b1e7110ed98e');
 assert.match(doc.precautions,/not prove.*governance|governance or upgrades/i);
});

test('Aave contract address injection, arbitrary RPC and malformed component fail BEFORE any payment',async()=>{
 const invalid=[
   '/v1/aave-base-proxy-facts?contract=0x1111111111111111111111111111111111111111',
   '/v1/aave-base-proxy-facts?rpc=https%3A%2F%2Fevil.invalid',
   '/v1/aave-base-proxy-facts?component=proxy',
   '/v1/aave-base-proxy-facts?component=pool&component=configurator',
   '/v1/aave-base-proxy-facts?component[]=pool',
   '/v1/aave-base-proxy-facts?component=pool&address=0x0',
   '/v1/aave-base-proxy-facts?component=configurator&random=1',
   '/v1/aave-base-proxy-facts?component=POOL',
   '/v1/aave-base-proxy-facts?component=',
 ];
 for(const path of invalid){
  const response=await fetch(BASE+path);
  assert.equal(response.status,400,path);
  assert.equal(response.headers.get('payment-required'),null,path);
  const body=await response.json();
  assert.equal(body.charged,false,path);
  assert.equal(body.ok,false,path);
 }
});

test('Only the single new paid GET is advertised at exact genuine Circle Base USDC0.01 and original VM1, still zero paid buyers',async()=>{
 const response=await fetch(BASE+'/.well-known/x402-bazaar-manifest.json');
 assert.equal(response.status,200);
 const manifest=await response.json();
 assert.equal(manifest.resources.length,23);
 const matches=manifest.resources.filter(x=>x.url===BASE+'/v1/aave-base-proxy-facts');
 assert.equal(matches.length,1);
 const a=matches[0];
 assert.equal(a.method,'GET');
 assert.equal(a.x402Version,2);
 assert.equal(a.accepts.length,1);
 assert.equal(a.accepts[0].network,'eip155:8453');
 assert.equal(a.accepts[0].amount,'10000');
 assert.equal(a.accepts[0].asset.toLowerCase(),'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
 assert.equal(a.accepts[0].payTo.toLowerCase(),'0x4e3106520e40af30870cafe78da1b1e7110ed98e');
 const v=await (await fetch(BASE+'/v1/docs')).json();
 assert.equal(v.paidAaveBaseERC1967.independentlyVerifiedOutsideBuyerPurchasesForThisNewSKU,0);
 const contract=await (await fetch(BASE+'/openapi.json')).json();
 assert.equal(contract.paths['/v1/aave-base-proxy-sample'].get.security.length,0);
 assert.equal(contract.paths['/v1/aave-base-proxy-facts'].get.security[0].x402Payment.length,0);
});
