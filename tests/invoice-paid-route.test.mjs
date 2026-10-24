import test from 'node:test';
import assert from 'node:assert/strict';
import {INVOICE_DEMO} from '../invoice-reconcile.mjs';
import {makeDiscovery} from '../discovery.mjs';
const BASE=process.env.TEST_URL||'http://127.0.0.1:8736';
const expectedPayTo='0x6b01efa0705e91a7aca54271510bf9e594717f34';
const post=(doc,headers={})=>fetch(BASE+'/v1/invoice-reconcile',{
 method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(doc)
});
function quote(r){
 const h=r.headers.get('PAYMENT-REQUIRED');assert.ok(h,'A valid CSV pair must produce an actual x402 quote');
 const q=JSON.parse(Buffer.from(h,'base64').toString());
 assert.equal(q.x402Version,2);assert.equal(q.accepts.length,1);
 assert.equal(q.accepts[0].network,'eip155:8453');
 assert.equal(q.accepts[0].amount,'5000');
 assert.equal(q.accepts[0].asset.toLowerCase(),'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
 assert.equal(q.accepts[0].payTo.toLowerCase(),expectedPayTo);
 return q;
}
function fakeOnlyLocalhostPayment(q){
 const payment={
  x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
  payload:{signature:'0x'+'11'.repeat(65),authorization:{
   from:'0x'+'33'.repeat(20),to:q.accepts[0].payTo,
   value:q.accepts[0].amount,validAfter:'0',validBefore:'9999999999',
   nonce:'0x'+'44'.repeat(32)
  }}
 };
 return Buffer.from(JSON.stringify(payment)).toString('base64');
}
test('Free local-only invented four-invoice preview is zero USDC, no wallet or onchain proof',async()=>{
 const res=await fetch(BASE+'/v1/invoice-reconcile-sample');
 assert.equal(res.status,200);
 assert.equal(res.headers.get('PAYMENT-REQUIRED'),null);
 const data=await res.json();
 assert.equal(data.paid,false);assert.equal(data.priceUSDC,'0.005');
 assert.equal(data.network,'eip155:8453');assert.equal(data.confirmedExternalPaidInvoiceCustomers,0);
 assert.equal(data.summary.invoiceCount,4);assert.equal(data.summary.reportedPartial,1);
 assert.equal(data.blockchainFinalityVerified,false);assert.equal(data.syntheticOnly,true);
 assert.deepEqual(data.inventedRequest,{invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers});
 assert.ok(data.freePrivateAlternative.includes('/usdc-invoice-bridge/'));
});
test('Malformed or unexpected invoice CSV data fails before any 402 payment',async()=>{
 for(const doc of [null,{}, {invoicesCsv:'',transfersCsv:INVOICE_DEMO.transfers},
  {invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:'broken'},
  {invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers,secretToken:'unsafe'},
  {invoicesCsv:'y'.repeat(65537),transfersCsv:INVOICE_DEMO.transfers}]){
  const r=await post(doc);
  assert.equal(r.status,400,'Bad nonsecret input must fail before payment');
  assert.equal(r.headers.get('PAYMENT-REQUIRED'),null);
  const out=await r.json();assert.equal(out.charged,false);
  assert.doesNotMatch(JSON.stringify(out),/secretToken|y{30}|0x[a-f0-9]{64}/i);
 }
});
test('Valid synthetic invoice CSVs get exact v2 quote with machine-readable input and output',async()=>{
 const r=await post({invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers});
 assert.equal(r.status,402);
 const q=quote(r);
 assert.equal(q.extensions.bazaar.info.input.method,'POST');
 assert.equal(q.extensions.bazaar.info.input.bodyType,'json');
 assert.equal(q.extensions.bazaar.info.output.type,'json');
});
test('LOCAL MOCK ONLY: signed fake fixture releases useful report without wallet / tx hashes',async()=>{
 const req={invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers};
 const unpaid=await post(req);assert.equal(unpaid.status,402);
 const mockPaid=await post(req,{'PAYMENT-SIGNATURE':fakeOnlyLocalhostPayment(quote(unpaid))});
 assert.equal(mockPaid.status,200);
 assert.ok(mockPaid.headers.get('PAYMENT-RESPONSE'),'Only local fixture simulates this header.');
 const data=await mockPaid.json();
 assert.equal(data.paid,true);assert.equal(data.chargedUSDC,'0.005');
 assert.equal(data.network,'eip155:8453');
 assert.equal(data.summary.invoiceCount,4);
 assert.equal(data.summary.reportedExact,1);
 assert.equal(data.summary.reportedPartial,1);
 assert.equal(data.summary.pendingReported,1);
 assert.equal(data.summary.unreferencedEvents,1);
 assert.equal(data.manualReview[0].kind,'shared_address_ambiguous');
 assert.equal(data.blockchainFinalityVerified,false);
 assert.equal(data.confirmedIndependentPaidInvoiceBuyers,0);
 assert.equal(data.noRawWalletOrTxHash,true);
 assert.doesNotMatch(JSON.stringify(data),/0x[a-f0-9]{40,64}/i);
});
test('Public x402 discovery exposes new paid and free URL, no false buyers',()=>{
 const d=makeDiscovery('https://vm5-openapi-x402.onrender.com');
 const spec=d.spec;
 assert.equal(spec.paths['/v1/invoice-reconcile'].post['x-payment-info'].price.amount,'0.005');
 assert.equal(spec.paths['/v1/invoice-reconcile-sample'].get.security.length,0);
 assert.ok(d.wellKnown.resources.includes('https://vm5-openapi-x402.onrender.com/v1/invoice-reconcile'));
 assert.equal(d.wellKnown.resources.length,16);
});
