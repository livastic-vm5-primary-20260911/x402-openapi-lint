import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const VM1="0x4e3106520e40af30870cafe78da1b1e7110ed98e";
const ASSET="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const SHA256="01f294ac914e7f53b51d9e22687682b802ea9cf37b735d3bac6da6c5c4a39f4b";
const PATH="/v1/echobloom-source-kit";
function decodeChallenge(r){
 const raw=r.headers.get("PAYMENT-REQUIRED");assert.ok(raw,"must include x402 payment challenge");
 return JSON.parse(Buffer.from(raw,"base64").toString("utf8"));
}
function localFixturePayment(q){return Buffer.from(JSON.stringify({
 x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
 payload:{signature:"0x"+"11".repeat(65),authorization:{from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)}}
})).toString("base64")}
test("Echobloom source kit is an actual $4.99 VM1-payee x402 route and never serves the ZIP unpaid",async()=>{
 const r=await fetch(BASE+PATH);assert.equal(r.status,402);
 const q=decodeChallenge(r);assert.equal(q.x402Version,2);assert.equal(q.accepts.length,1);
 assert.equal(q.accepts[0].network,"eip155:8453");assert.equal(q.accepts[0].asset.toLowerCase(),ASSET);
 assert.equal(q.accepts[0].amount,"4990000");assert.equal(q.accepts[0].payTo.toLowerCase(),VM1);
 assert.equal(r.headers.get("PAYMENT-RESPONSE"),null);
 const body=await r.text();assert.equal(body.includes("PK\\u0003\\u0004"),false);
});
test("successful mock x402 settlement returns a one-time 10-minute ZIP download token, then it cannot replay",async()=>{
 const quote=await fetch(BASE+PATH);assert.equal(quote.status,402);const q=decodeChallenge(quote);
 const paid=await fetch(BASE+PATH,{headers:{"PAYMENT-SIGNATURE":localFixturePayment(q)}});
 assert.equal(paid.status,200);const data=await paid.json();
 assert.equal(data.paid,true);assert.equal(data.chargedUSDC,"4.99");assert.equal(data.sourceSha256,SHA256);
 assert.match(data.downloadUrl,/\/v1\/echobloom-source-kit\/download\?token=[0-9a-f]{48}$/);
 assert.equal(data.downloadLinkExpiresInSeconds,600);
 const downloaded=await fetch(data.downloadUrl);assert.equal(downloaded.status,200);
 assert.equal(downloaded.headers.get("content-type"),"application/zip");
 const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.subarray(0,4).toString("hex"),"504b0304");
 assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),SHA256);
 const replay=await fetch(data.downloadUrl);assert.equal(replay.status,410);
});
test("malformed/expired source-kit download token never returns file bytes",async()=>{
 const malformed=await fetch(BASE+"/v1/echobloom-source-kit/download?token=nope");assert.equal(malformed.status,400);
 const expired=await fetch(BASE+"/v1/echobloom-source-kit/download?token="+"a".repeat(48));assert.equal(expired.status,410);
});
