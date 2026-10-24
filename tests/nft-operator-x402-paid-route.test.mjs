/** Real isolated VM3 localhost merchant integration, mocked facilitator only.
 * No external network, no production signatures, no paid transaction. */
import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
import {SYNTHETIC_NFT_OPERATOR_APPROVAL} from "../nft-operator-calldata-preflight.mjs";
const BASE=process.env.TEST_URL || "http://127.0.0.1:8736";
const SELLER="0x4e3106520E40af30870caFE78da1B1e7110eD98E";
const CIRCLE="0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913";
const PAID="/v1/nft-operator-calldata-preflight";
const SAMPLE="/v1/nft-operator-calldata-sample";
const A=addr=>"0".repeat(24)+addr.slice(2).toLowerCase();
const W=num=>BigInt(num).toString(16).padStart(64,"0");
const OPC="0x000000000000000000000000000000000000dEaD";
const set=(n=1)=>"0xa22cb465"+A(OPC)+W(n);
const approved721="0x095ea7b3"+A(OPC)+W(7);
function quote(response){
 const wire=response.headers.get("PAYMENT-REQUIRED");assert.ok(wire);
 const q=JSON.parse(Buffer.from(wire,"base64").toString("utf8"));
 assert.equal(q.x402Version,2);
 assert.equal(q.accepts?.length,1);
 assert.equal(q.resource?.url,response.url,"Canonical signed resource must match exact requested URL, including public query");
 const a=q.accepts[0];
 assert.equal(a.network,"eip155:8453");
 assert.equal(a.scheme,"exact");
 assert.equal(a.amount,"10000");
 assert.equal(a.asset.toLowerCase(),CIRCLE.toLowerCase());
 assert.equal(a.payTo.toLowerCase(),SELLER.toLowerCase());
 assert.equal(a.extra.name,"USD Coin");
 return q;
}
function localMockAuthorization(q){
 return Buffer.from(JSON.stringify({
   x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
   payload:{signature:"0x"+"11".repeat(65),
     authorization:{from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,
       validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)}}
 })).toString("base64");
}
test("OpenAPI describes ORIGINAL seller payable new NFT route and entirely free synthetic example",()=>{
 const spec=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const op=spec.spec.paths[PAID].get;
 assert.equal(op.operationId,"inspectUnsignedNftOperatorAuthorizationCalldata");
 assert.equal(op["x-payment-info"].payTo.toLowerCase(),SELLER.toLowerCase());
 assert.equal(op["x-payment-info"].price.amount,"0.01");
 assert.equal(op.parameters.length,2);
 assert.equal(op.responses["402"]!==undefined,true);
 assert.ok(op.responses["200"].content["application/json"].schema.required.includes("originalVM1PayoutAddress"));
 assert.deepEqual(spec.spec.paths[SAMPLE].get.security,[]);
 assert.ok(spec.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com"+PAID));
});
test("Entirely free synthetic NFT approval preview is explicit; no wallet/payment or registry enrollment",async()=>{
 const r=await fetch(BASE+SAMPLE);
 assert.equal(r.status,200);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const j=await r.json();
 assert.equal(j.paid,false);assert.equal(j.chargedUSDC,"0");
 assert.equal(j.exampleOnly,true);
 assert.equal(j.unsignedCalldata,SYNTHETIC_NFT_OPERATOR_APPROVAL);
 assert.equal(j.action,"setApprovalForAll");
 assert.equal(j.warningCount,1);
 assert.equal(j.payTo.toLowerCase(),SELLER.toLowerCase());
 assert.equal(j.noTransactionSent,true);
});
test("Exact unpaid original x402 quote canonical header mirrored by body and CORS alias",async()=>{
 const r=await fetch(BASE+PAID);
 assert.equal(r.status,402);
 const q=quote(r);
 assert.equal(r.headers.get("X-Payment-Required"),r.headers.get("PAYMENT-REQUIRED"));
 assert.deepEqual(await r.json(),q);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
 assert.equal(q.extensions?.bazaar?.info?.input?.method,"GET");
 const d=await (await fetch(BASE+"/discovery/resources")).json();
 const match=d.items.find(x=>x.resource===BASE+PAID);
 assert.ok(match);
 assert.equal(match.accepts[0].payTo.toLowerCase(),SELLER.toLowerCase());
 assert.equal(match.accepts[0].amount,"10000");
});
test("Collection-wide NFT false approval is an unsigned, uncharged quoted item",async()=>{
 const u=BASE+PAID+"?calldata="+set(0)+"&standard=erc1155";
 const r=await fetch(u);
 assert.equal(r.status,402);
 quote(r);
});
test("Reject unknown, invalid, repeated, oversized and ambiguous NFT calldata BEFORE payment",async()=>{
 const attempts=[
   PAID+"?unexpected=1",PAID+"?standard=bitcoin",
   PAID+"?calldata=0x1",PAID+"?calldata=0x12345678",
   PAID+"?standard=erc721&standard=erc721",
   PAID+"?calldata="+set(2),
   PAID+"?calldata="+set(1)+"&standard=invalid",
   PAID+"?calldata="+approved721,
   PAID+"?calldata="+approved721+"&standard=erc1155",
   PAID+"?calldata="+set(1)+"&calldata="+set(1),
   PAID+"?calldata="+"f".repeat(500),
   SAMPLE+"?foo=bar"
 ];
 for(const path of attempts) {
   const r=await fetch(BASE+path);
   assert.equal(r.status,400,path.slice(0,125));
   assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
   const j=await r.json();
   assert.equal(j.charged,false);
 }
});
test("LOCAL MOCK ONLY: authorized fixed x402 NFT report is delivered after fake facilitator verify/settle",async()=>{
 const q=quote(await fetch(BASE+PAID+"?calldata="+set(1)+"&standard=erc1155"));
 const r=await fetch(BASE+PAID+"?calldata="+set(1)+"&standard=erc1155",{
   headers:{"PAYMENT-SIGNATURE":localMockAuthorization(q)}
 });
 assert.equal(r.status,200);
 assert.ok(r.headers.get("PAYMENT-RESPONSE"));
 const j=await r.json();
 assert.equal(j.paid,true);
 assert.equal(j.chargedUSDC,"0.01");
 assert.equal(j.action,"setApprovalForAll");
 assert.equal(j.interpretedStandard,"ERC1155");
 assert.equal(j.decoded.approved,true);
 assert.equal(j.confirmedIndependentPaidBuyers,0);
 assert.equal(j.originalVM1PayoutAddress.toLowerCase(),SELLER.toLowerCase());
 assert.equal(j.noTransactionSent,true);
 assert.equal(j.isCurrentApprovalConfirmedOnchain,false);
});
test("LOCAL MOCK ONLY: ERC721 token-ID approve must require explicit standard, never ERC20 unlimited allowance",async()=>{
 const url=BASE+PAID+"?calldata="+approved721+"&standard=erc721";
 const q=quote(await fetch(url));
 const r=await fetch(url,{headers:{"PAYMENT-SIGNATURE":localMockAuthorization(q)}});
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.action,"approve");
 assert.equal(j.decoded.tokenId,"7");
 assert.equal(j.decoded.uint256Maximum,false);
 assert.equal(j.actualTokenContractIdentified,false);
 assert.equal(j.noRpcWalletPrivateDataOrBlockchainCalls,true);
});
