// Localhost full-server integration: zero paid calls and no Mezo RPC required.
// The executable x402 middleware is real; source-only module tests cover RPC.
import test from "node:test";
import assert from "node:assert/strict";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const OWNER="0x"+"11".repeat(20);
const SPENDER="0x"+"22".repeat(20);
const VM1="0x4e3106520E40af30870caFE78da1B1e7110eD98E";

test("Mezo MUSD free preview is synthetic, fixed issuer and original owner payee",async()=>{
 const response=await fetch(BASE+"/v1/mezo-musd-sample");
 assert.equal(response.status,200);
 assert.equal(response.headers.get("payment-required"),null);
 const d=await response.json();
 assert.equal(d.paid,false);
 assert.equal(d.exampleOnly,true);
 assert.equal(d.noLiveMezoRpcUsed,true);
 assert.equal(d.sourceDataChain,"eip155:31612");
 assert.equal(d.fixedContract.toLowerCase(),"0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186");
 assert.equal(d.illustrativeSupplyMUSD,"FICTIONAL_EXAMPLE_ONLY");
 assert.equal(d.paymentNetwork,"eip155:8453");
 assert.equal(d.priceNativeBaseCircleUSDC,"0.010000");
 assert.equal(d.payTo.toLowerCase(),VM1.toLowerCase());
});
test("Malformed public Mezo data requests fail before any x402 charge or RPC",async()=>{
 const bad=[
  "/v1/mezo-musd-facts?owner="+OWNER,
  "/v1/mezo-musd-facts?spender="+SPENDER,
  "/v1/mezo-musd-facts?address="+OWNER,
  "/v1/mezo-musd-facts?rpc=https%3A%2F%2Fevil.invalid",
  "/v1/mezo-musd-facts?owner="+OWNER+"&spender=0x123",
  "/v1/mezo-musd-facts?owner[]="+OWNER+"&spender="+SPENDER,
  "/v1/mezo-musd-facts?spender="+SPENDER+"&owner="+OWNER,
  "/v1/mezo-musd-facts?owner="+OWNER+"&spender="+SPENDER+"&rpc=evil",
  "/v1/mezo-musd-facts?foo=0"
 ];
 for(const url of bad){
  const res=await fetch(BASE+url);
  assert.equal(res.status,400,url);
  assert.equal(res.headers.get("payment-required"),null,url);
  const d=await res.json();
  assert.equal(d.charged,false,url);
 }
});
test("Paid Mezo SKU appears as 22nd original payment route with Base-only Circle USDC x402 config",async()=>{
 const data=await (await fetch(BASE+"/.well-known/x402-bazaar-manifest.json")).json();
 assert.equal(data.resources.length,22);
 const mezo=data.resources.filter(x=>x.url===BASE+"/v1/mezo-musd-facts");
 assert.equal(mezo.length,1);
 const r=mezo[0];assert.equal(r.method,"GET");assert.equal(r.accepts.length,1);
 assert.equal(r.accepts[0].scheme,"exact");
 assert.equal(r.accepts[0].network,"eip155:8453");
 assert.equal(r.accepts[0].amount,"10000");
 assert.equal(r.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(r.accepts[0].payTo.toLowerCase(),VM1.toLowerCase());
 const spec=await(await fetch(BASE+"/openapi.json")).json();
 assert.equal(spec.paths["/v1/mezo-musd-sample"].get.security.length,0);
 assert.equal(spec.paths["/v1/mezo-musd-facts"].get.security[0].x402Payment.length,0);
 assert.deepEqual(spec.paths["/v1/mezo-musd-facts"].get["x-payment-info"].protocols,[{x402:{}}]);
 const terms=await (await fetch(BASE+"/v1/docs")).json();
 assert.equal(terms.paidMezoMUSDFacts.independentlyVerifiedOutsidePaidCustomers,0);
});
