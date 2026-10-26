import test from "node:test";
import assert from "node:assert/strict";
import {DEMO_CSV} from "../csv-preflight.mjs";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const expectedPayTo="0x6b01efa0705e91a7aca54271510bf9e594717f34";
const requestPost=(doc,header={})=>fetch(BASE+"/v1/csv-preflight",{
 method:"POST",headers:{"Content-Type":"application/json",...header},body:JSON.stringify(doc)
});
function quoteFrom(r){
 const header=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(header,"Expected an actual exact x402 payment requirement");
 const quote=JSON.parse(Buffer.from(header,"base64").toString());
 assert.equal(quote.x402Version,2);
 assert.equal(quote.accepts.length,1);
 assert.equal(quote.accepts[0].network,"eip155:8453");
 assert.equal(quote.accepts[0].amount,"5000");
 assert.equal(quote.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(quote.accepts[0].payTo.toLowerCase(),expectedPayTo);
 return quote;
}
function localMarker(quote){
 const mock={
  x402Version:2,resource:quote.resource,accepted:quote.accepts[0],
  extensions:quote.extensions||{},
  payload:{signature:"0x"+"11".repeat(65),authorization:{
   from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,
   value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",
   nonce:"0x"+"44".repeat(32)
  }}
 };
 return Buffer.from(JSON.stringify(mock)).toString("base64");
}
test("Free synthetic CSV source sample is transparent, zero fake orders and no x402 charge",async()=>{
 const r=await fetch(BASE+"/v1/csv-sample");
 assert.equal(r.status,200);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const d=await r.json();
 assert.equal(d.paid,false);assert.equal(d.priceUSDC,"0.005");
 assert.equal(d.confirmedCsvPaidOrders,1);
 assert.ok(d.sampleCsv.includes("email,amount,date,note"));
 assert.ok(d.disclosure.includes("reproducible"));
 assert.equal(d.buyerOwnedCsv.method,"POST");
 assert.equal(d.buyerOwnedCsv.url,"https://vm5-openapi-x402.onrender.com/v1/csv-preflight");
 assert.equal(d.buyerOwnedCsv.contentType,"application/json");
 assert.equal(d.buyerOwnedCsv.priceUSDC,"0.005");
 assert.equal(d.buyerOwnedCsv.network,"eip155:8453");
 assert.equal(d.buyerOwnedCsv.confirmedIndependentPaidPOSTCustomers,0);
 assert.equal(d.buyerOwnedCsv.exampleBody.csvText,DEMO_CSV);
 assert.ok(d.buyerOwnedCsv.paymentGate.includes("HTTP 402"));
 assert.equal(d.buyerOwnedCsv.exampleBody.expectedColumns.length,4);
});
test("CSV paid demo request without buyer data is valid 0.005 Base USDC x402 402",async()=>{
 const r=await fetch(BASE+"/v1/csv-report");
 assert.equal(r.status,402);
 const q=quoteFrom(r);
 const bazaar=q.extensions?.bazaar;
 assert.ok(bazaar);
 assert.equal(bazaar.info?.input?.method,"GET");
 assert.equal(bazaar.info?.output?.example?.chargedUSDC,"0.005");
});
test("CSV report unexpectedly parameterized request rejects before charge",async()=>{
 const r=await fetch(BASE+"/v1/csv-report?email=private");
 assert.equal(r.status,400);assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 assert.equal((await r.json()).charged,false);
});
test("Customer CSV preflight rejects syntax/data oversize and secret extra fields before payment",async()=>{
 for(const doc of [null,{}, {csvText:""}, {csvText:"a,b\n\"unclosed,1"},{csvText:"a,b",privateKey:"secret"},{csvText:"x,".repeat(42)+"\ny"}, {csvText:"id\n"+"123\n".repeat(502)}]){
  const r=await requestPost(doc);
  assert.equal(r.status,400,JSON.stringify(doc)?.slice(0,90));
  assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
  assert.equal((await r.json()).charged,false);
 }
});
test("Valid buyer CSV with actual structural problems gets a 402 before full private report",async()=>{
 const r=await requestPost({csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]});
 assert.equal(r.status,402);
 const q=quoteFrom(r);
 assert.equal(q.extensions?.bazaar?.info?.input?.method,"POST");
 assert.equal(q.extensions?.bazaar?.info?.input?.bodyType,"json");
 assert.equal(q.extensions?.bazaar?.info?.output?.type,"json");
});
test("LOCAL MOCK ONLY, no money: exact payment challenge releases synthetic CSV full report",async()=>{
 const r=await fetch(BASE+"/v1/csv-report");
 const q=quoteFrom(r);
 const paid=await fetch(BASE+"/v1/csv-report",{headers:{"PAYMENT-SIGNATURE":localMarker(q)}});
 assert.equal(paid.status,200);
 const obj=await paid.json();
 assert.equal(obj.ok,true);assert.equal(obj.paid,true);
 assert.equal(obj.chargedUSDC,"0.005");
 assert.equal(obj.normalizedDuplicateRows,1);
 assert.equal(obj.spreadsheetFormulaRiskCells,1);
 assert.equal(obj.irregularRows,1);
 assert.equal(obj.noRawDataReturned,true);
 assert.equal(obj.nextBuyerTask.method,"POST");
 assert.equal(obj.nextBuyerTask.endpoint,"https://vm5-openapi-x402.onrender.com/v1/csv-preflight");
 assert.equal(obj.nextBuyerTask.priceUSDC,"0.005");
 assert.equal(obj.nextBuyerTask.network,"eip155:8453");
 assert.equal(obj.nextBuyerTask.exampleBody.csvText,DEMO_CSV);
 assert.equal(obj.nextBuyerTask.confirmedIndependentPaidPOSTBuyers,0);
 assert.equal(obj.nextBuyerTask.mustIndependentlyAuthorizePayment,true);
 assert.ok(obj.nextBuyerTask.privacy.includes("BEFORE payment"));
 assert.ok(paid.headers.get("PAYMENT-RESPONSE"));
});
test("LOCAL MOCK ONLY, no money: actual buyer CSV yields useful bound output no raw client cells",async()=>{
 const csv="email,amount,date,note\nqa+private@example.com,20,2026-10-19,ok\ninvalid-email,not-number,2026-13-99,=IMPORTXML(x)\n";
 const input={csvText:csv,expectedColumns:["email","amount","date","note"]};
 const first=await requestPost(input);assert.equal(first.status,402);
 const q=quoteFrom(first);
 const paid=await requestPost(input,{"PAYMENT-SIGNATURE":localMarker(q)});
 assert.equal(paid.status,200);
 const report=await paid.json();
 assert.equal(report.ok,true);assert.equal(report.paid,true);
 assert.equal(report.dataRows,2);assert.equal(report.formatWarnings,3);
 assert.equal(report.spreadsheetFormulaRiskCells,1);
 assert.equal(report.noRawDataReturned,true);
 assert.equal(JSON.stringify(report).includes("qa+private@example.com"),false);
 assert.equal(JSON.stringify(report).includes("IMPORTXML"),false);
 assert.equal(JSON.stringify(report).includes("invalid-email"),false);
});
test("Discoverable GET and POST both have 0.005 USDC, free source sample remains unpaid",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 assert.equal(d.spec.paths["/v1/csv-report"].get["x-payment-info"].price.amount,"0.005");
 assert.equal(d.spec.paths["/v1/csv-preflight"].post["x-payment-info"].price.amount,"0.005");
 assert.equal(d.spec.paths["/v1/csv-sample"].get.security.length,0);
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/csv-report"));
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/csv-preflight"));
 assert.equal(d.wellKnown.resources.length,23);
});
