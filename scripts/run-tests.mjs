import http from "node:http";
import net from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import process from "node:process";

async function freePort() {
  const server=net.createServer();
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const port=server.address().port;
  await new Promise(done=>server.close(done));
  return port;
}

const FIXTURE_TX="0x"+"aa".repeat(32);
const FIXTURE_SENDER="0x"+"33".repeat(20);
const FIXTURE_RECEIVER="0x"+"44".repeat(20);
const transferTopic="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topicAddress=x=>"0x"+x.slice(2).toLowerCase().padStart(64,"0");
const fixtureUSDCEvent=(from,to,amount)=>({
  address:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  topics:[transferTopic,topicAddress(from),topicAddress(to)],
  data:"0x"+BigInt(amount).toString(16).padStart(64,"0")
});
const receiptRpc=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method!=="POST"){res.statusCode=405;res.end(JSON.stringify({error:"GET disallowed"}));return;}
  const pieces=[];
  req.on("data",x=>pieces.push(x));
  req.on("end",()=>{
    let d;
    try { d=JSON.parse(Buffer.concat(pieces).toString()); } catch {d=null;}
    const method=d?.method;
    const allowed=["eth_chainId","eth_blockNumber","eth_getTransactionReceipt","eth_call"];
    if(!allowed.includes(method)){res.statusCode=403;res.end(JSON.stringify({error:"Unapproved RPC"}));return;}
    let result;
    if(method==="eth_chainId")result="0x2105";
    else if(method==="eth_blockNumber")result="0x111";
    else if(method==="eth_call"){
      const [call,blockTag]=d.params||[];
      const sel=call?.data?.slice(0,10);
      const contract="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      if(!call||call.to?.toLowerCase()!==contract||blockTag!=="0x111"||
         !["0xdd62ed3e","0x70a08231"].includes(sel)){
        res.end(JSON.stringify({jsonrpc:"2.0",id:d.id,error:{code:3,message:"Invalid fixed test-only token call"}}));return;
      }
      const value=sel==="0xdd62ed3e"?100000000n:1150000n;
      result="0x"+value.toString(16).padStart(64,"0");
    }
    else {
      const tx=d?.params?.[0];
      if(tx===FIXTURE_TX){
        result={transactionHash:tx,status:"0x1",blockNumber:"0x100",
          logs:[fixtureUSDCEvent(FIXTURE_SENDER,FIXTURE_RECEIVER,4_000_000)]};
      }else if(tx==="0x"+"bb".repeat(32)){result=null;}
      else if(tx==="0x"+"cc".repeat(32)){
        result={transactionHash:tx,status:"0x0",blockNumber:"0x100",logs:[]};
      }else if(tx==="0x"+"dd".repeat(32)){
        result={transactionHash:tx,status:"0x1",blockNumber:"0x100",logs:[{
          ...fixtureUSDCEvent(FIXTURE_SENDER,FIXTURE_RECEIVER,4_000_000),
          address:"0x"+"dd".repeat(20)
        }]};
      }else if(tx==="0x"+"ee".repeat(32)){
        result={transactionHash:tx,status:"0x1",blockNumber:"0x111",
          logs:[fixtureUSDCEvent(FIXTURE_SENDER,FIXTURE_RECEIVER,4_000_000)]};
      }else{result=null;}
    }
    res.end(JSON.stringify({jsonrpc:"2.0",id:d.id,result}));
  });
});
receiptRpc.listen(0,"127.0.0.1");
await once(receiptRpc,"listening");
const xlayerFactory="0x1f09daefa827f02cbb40967cc91b259763760761";
const xlayerMarket="0xd89f358c48a7B632c9845af2a02A32eB90DD75DB";
const xlayerCpu="0x"+"11".repeat(20);
const xlayerTransistor="0x"+"22".repeat(20);
const xlayerOwner="0x"+"33".repeat(20);
const xlayerWord=n=>"0x"+BigInt(n).toString(16).padStart(64,"0");
const xlayerAddr=a=>xlayerWord(BigInt(a));
const xlayerSelectors={
 cpuCount:"0xa94da8a7",deployFee:"0xeb2a5d2c",protocolFee:"0xb0e21e8a",
 isSealed:"0x631f9852",owner:"0x8da5cb5b",cpuAt:"0x4bc7cbbd",
 feeBps:"0x24a9d853",nextListingId:"0xaaccf1ec",
 nextId:"0x61b8ce8c",tapeoutFee:"0xadfb2b69",transistors:"0x6fbd1719",
 minted:"0x4f02c420",supplyCap:"0x8f770ad0",
 mintPrice:"0x6817c76c",creator:"0x02d05d3f"
};
const xlayerRpc=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method!=="POST"){res.statusCode=405;res.end("{}");return;}
  const parts=[];req.on("data",x=>parts.push(x));
  req.on("end",()=>{
    let d;try{d=JSON.parse(Buffer.concat(parts).toString());}catch{d=null;}
    if(!d||!["eth_chainId","eth_blockNumber","eth_call","eth_getStorageAt"].includes(d.method)){
      res.statusCode=403;res.end(JSON.stringify({error:"Unexpected test-only RPC"}));return;
    }
    let result="0x";
    if(d.method==="eth_chainId")result="0xc4";
    else if(d.method==="eth_blockNumber")result="0x8e8";
    else if(d.method==="eth_getStorageAt")result=xlayerWord(0xabc);
    else{
      const [call,blockTag]=d.params||[];
      const addr=(call?.to||"").toLowerCase(),sel=(call?.data||"").slice(0,10);
      if(blockTag!=="0x8e8" && blockTag!=="0x8e7"){
        res.end(JSON.stringify({jsonrpc:"2.0",id:d.id,error:{code:3,message:"Unpinned RPC block"}}));return;
      }
      if(addr===xlayerFactory.toLowerCase()){
        if(sel===xlayerSelectors.cpuCount)result=xlayerWord(2);
        else if(sel===xlayerSelectors.deployFee)result=xlayerWord(6600000000000000n);
        else if(sel===xlayerSelectors.protocolFee)result=xlayerWord(660000000000000n);
        else if(sel===xlayerSelectors.isSealed)result=xlayerWord(0);
        else if(sel===xlayerSelectors.owner)result=xlayerAddr(xlayerOwner);
        else if(sel===xlayerSelectors.cpuAt)result=xlayerAddr(xlayerCpu);
      }else if(addr===xlayerMarket.toLowerCase()){
        if(sel===xlayerSelectors.feeBps)result=xlayerWord(blockTag==="0x8e7"?95:100);
        else if(sel===xlayerSelectors.nextListingId)result=xlayerWord(4);
        else if(sel===xlayerSelectors.isSealed)result=xlayerWord(0);
        else if(sel===xlayerSelectors.owner)result=xlayerAddr(xlayerOwner);
      }else if(addr===xlayerCpu.toLowerCase()){
        if(sel===xlayerSelectors.nextId)result=xlayerWord(103);
        else if(sel===xlayerSelectors.tapeoutFee)result=xlayerWord(1300000000000000n);
        else if(sel===xlayerSelectors.transistors)result=xlayerAddr(xlayerTransistor);
      }else if(addr===xlayerTransistor.toLowerCase()){
        if(sel===xlayerSelectors.minted)result=xlayerWord(10);
        else if(sel===xlayerSelectors.supplyCap)result=xlayerWord(100);
        else if(sel===xlayerSelectors.mintPrice)result=xlayerWord(0);
        else if(sel===xlayerSelectors.protocolFee)result=xlayerWord(660000000000000n);
        else if(sel===xlayerSelectors.creator)result=xlayerAddr(xlayerOwner);
      }
    }
    res.end(JSON.stringify({jsonrpc:"2.0",id:d.id,result}));
  });
});
xlayerRpc.listen(0,"127.0.0.1");
await once(xlayerRpc,"listening");

const facilitator=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method==="GET" && req.url==="/supported"){
    res.end(JSON.stringify({
      kinds:[{x402Version:2,scheme:"exact",network:"eip155:8453",extra:{name:"USD Coin",version:"2",asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",assetTransferMethod:"eip3009"}}],
      extensions:["discovery"],signers:{"eip155:*":["0x0000000000000000000000000000000000000000"]}
    }));
  }else if(req.method==="POST" && (req.url==="/verify"||req.url==="/settle")){
    // TEST FIXTURE ONLY. Strict fake test marker, localhost, no on-chain transaction.
    const chunks=[];
    req.on("data",chunk=>chunks.push(chunk));
    req.on("end",()=>{
      let data;
      try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{data=null;}
      const payload=data?.paymentPayload;
      const requirements=data?.paymentRequirements;
      const marker=payload?.payload?.signature;
      const valid=data?.x402Version===2 &&
        requirements?.network==="eip155:8453" &&
        (requirements?.amount==="1000" || requirements?.amount==="10000" || requirements?.amount==="5000" || requirements?.amount==="50000" || requirements?.amount==="200000" || requirements?.amount==="4990000") &&
        (
          requirements?.payTo?.toLowerCase()==="0x6b01efa0705e91a7aca54271510bf9e594717f34" ||
          ((requirements?.amount==="5000" || requirements?.amount==="10000" || requirements?.amount==="4990000") && requirements?.payTo?.toLowerCase()==="0x4e3106520e40af30870cafe78da1b1e7110ed98e")
        ) &&
        marker==="0x"+"11".repeat(65);
      if(req.url==="/verify"){
        res.end(JSON.stringify({isValid:Boolean(valid),invalidReason:valid?undefined:"fixture_invalid_marker",payer:"0x"+"33".repeat(20)}));
      }else{
        res.end(JSON.stringify({
          success:Boolean(valid),
          transaction:"0x"+"22".repeat(32),network:"eip155:8453",amount:valid?requirements.amount:"0",
          payer:"0x"+"33".repeat(20),
          errorReason:valid?undefined:"fixture_invalid_marker"
        }));
      }
    });
  }else {res.statusCode=503;res.end(JSON.stringify({error:"Unsupported test fixture route."}));}
});
facilitator.listen(0,"127.0.0.1");
await once(facilitator,"listening");
const port=await freePort();
const mockUrl="http://127.0.0.1:"+facilitator.address().port;
const url="http://127.0.0.1:"+port;
const env={...process.env,PORT:String(port),FACILITATOR_URL:mockUrl,NODE_ENV:"test",TEST_URL:url,BASE_RPC_URL:"http://127.0.0.1:"+receiptRpc.address().port,TAPEOUT_XLAYER_RPC_TEST_ONLY:"http://127.0.0.1:"+xlayerRpc.address().port};
const backend=spawn(process.execPath,["server.mjs"],{cwd:new URL("../",import.meta.url),env,stdio:["ignore","pipe","pipe"]});
let backendLog="";
backend.stdout.on("data",x=>backendLog+=x.toString());
backend.stderr.on("data",x=>backendLog+=x.toString());
async function ready() {
  for(let i=0;i<65;i++){
    if(backend.exitCode!==null)throw Error("Server exited during startup: "+backendLog.slice(-900));
    try{
      const r=await fetch(url+"/health",{signal:AbortSignal.timeout(1800)});
      if(r.ok)return;
    } catch(_){}
    await new Promise(done=>setTimeout(done,250));
  }
  throw Error("Local test server failed startup: "+backendLog.slice(-1000));
}
let code=1;
try{
  await ready();
  const tests=spawn(process.execPath,["--test","tests/x402-public-manifest-for-free-directory.test.mjs","tests/erc20-calldata-preflight.test.mjs","tests/erc20-calldata-paid-route.test.mjs","tests/nft-operator-calldata-preflight.test.mjs","tests/nft-operator-x402-paid-route.test.mjs","tests/erc20-event-preflight.test.mjs","tests/erc20-event-paid-route.test.mjs","tests/base-native-usdc-allowance.test.mjs","tests/base-native-usdc-allowance-paid-route.test.mjs","tests/funding-four-venue.test.mjs","tests/funding-x402-challenge-body-compat.test.mjs","tests/aave-proxy1967.test.mjs","tests/aave-base-x402-route.test.mjs","tests/mezo-musd-readonly.test.mjs","tests/mezo-verified-public-cache.test.mjs","tests/mezo-musd-x402-route.test.mjs","tests/echobloom-source-kit-paid.test.mjs","tests/tapeout-diff-paid-route.test.mjs","tests/catalog-readonly.test.mjs","tests/lint.test.mjs","tests/base-usdc-receipt.test.mjs","tests/base-rpc-fallback.test.mjs","tests/discovery-marketplace-interop.test.mjs","tests/glb-analyzer.test.mjs","tests/glb-paid-route.test.mjs","tests/procedural-lowpoly-generator.test.mjs","tests/lowpoly-paid-route.test.mjs","tests/bazaar-cdp-validations.test.mjs","tests/first-actual-independent-sale.test.mjs","tests/csv-preflight.test.mjs","tests/csv-paid-route.test.mjs","tests/invoice-reconcile.test.mjs","tests/invoice-paid-route.test.mjs","tests/quote-preflight.test.mjs","tests/quote-paid-route.test.mjs","tests/email-dns-preflight.test.mjs","tests/email-dns-paid-route.test.mjs","tests/public-https-tls-preflight.test.mjs","tests/tls-certificate-paid-route.test.mjs","tests/llms-discoverability.test.mjs","tests/lumen-free-game-route.test.mjs","tests/x402-paid-ping001.test.mjs","tests/true402-merchant-manifest.test.mjs","tests/workflow-risk-paid-route.test.mjs","tests/tapeout-xlayer-paid-route.test.mjs","tests/tapeout-settlement-audit.test.mjs","tests/tapeout-core.test.mjs","tests/tapeout-rpc.test.mjs"],{cwd:new URL("../",import.meta.url),env,stdio:"inherit"});
  const [exit]=await once(tests,"close");
  code=exit??1;
} catch(e){console.error(e.stack||e);code=1;}
finally{
  backend.kill("SIGTERM");
  facilitator.close();
  receiptRpc.close();
  xlayerRpc.close();
}
process.exitCode=code;
