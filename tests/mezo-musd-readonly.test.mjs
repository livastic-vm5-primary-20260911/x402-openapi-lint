import test from "node:test";
import assert from "node:assert/strict";
import {
  MEZO_CHAIN_ID,MEZO_TOKEN,MEZO_RPC,MEZO_NTT_MANAGER,
  parseMUSDQuery,encodeAddressWord,decodeFixedUInt,exactDecimal,decodeSymbol,
  readMezoMUSDFacts
} from "../mezo/musd-readonly.mjs";

const word=n=>"0x"+BigInt(n).toString(16).padStart(64,"0");
const dynamicSymbol="0x"+word(32).slice(2)+word(4).slice(2)+
  Buffer.from("MUSD").toString("hex").padEnd(64,"0");
const addr="0x"+"11".repeat(20),spender="0x"+"22".repeat(20);
function mockRequest({chain="0x7b7c",block="0xc26375",token=MEZO_TOKEN,
  missingCode=false,decimals=18n,symbol=dynamicSymbol,failMethod=null}={}){
  const calls=[];
  const request=async (url,opts)=>{
    assert.equal(url,MEZO_RPC);
    assert.equal(opts.method,"POST");
    assert.equal(opts.redirect,"error");
    const payload=JSON.parse(opts.body);
    calls.push(payload);
    const {method,params,id}=payload;
    let result;
    if(method==="eth_chainId")result=chain;
    else if(method==="eth_blockNumber")result=block;
    else if(method==="eth_getCode"){
      assert.equal(params[0],token);
      assert.equal(params[1],block);
      result=missingCode?"0x":"0x"+"6080604052".repeat(25);
    }
    else if(method==="eth_call"){
      assert.equal(params[0].to.toLowerCase(),token.toLowerCase());
      assert.equal(params[1],block);
      const sel=params[0].data.slice(0,10);
      if(sel==="0x95d89b41")result=symbol;
      else if(sel==="0x313ce567")result=word(decimals);
      else if(sel==="0x18160ddd")result=word(29_482_016n*10n**18n);
      else if(sel==="0x70a08231")result=word(2n*10n**18n);
      else if(sel==="0xdd62ed3e")result=word(5n*10n**18n);
      else throw Error("Unexpected ABI selector "+sel);
    }else throw Error("Unpermitted RPC method "+method);
    return new Response(JSON.stringify(failMethod===method?{jsonrpc:"2.0",id,error:{code:-1}}:{jsonrpc:"2.0",id,result}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  return {request,calls};
}
test("MUSD issuer-pinned public chain, token, no signature",()=>{
 assert.equal(MEZO_CHAIN_ID,31612);
 assert.equal(MEZO_TOKEN.toLowerCase(),"0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186");
 assert.equal(MEZO_NTT_MANAGER,"0x7efb386675d75280D39Aae42964A6776DE0ee0bD");
});
test("MUSD HTTP query allows neither or both canonical public addresses",()=>{
 assert.deepEqual(parseMUSDQuery({}),{ok:true,owner:null,spender:null});
 assert.equal(parseMUSDQuery({owner:addr}).ok,false);
 assert.equal(parseMUSDQuery({spender}).ok,false);
 assert.equal(parseMUSDQuery({owner:addr,spender,rpc:"https://evil.invalid"}).ok,false);
 assert.equal(parseMUSDQuery({owner:addr,spender}).ok,true);
 assert.equal(parseMUSDQuery({owner:addr,spender:[spender]}).ok,false);
 assert.equal(parseMUSDQuery({owner:addr,spender:"0x0"}).ok,false);
});
test("Exact big integer formatting never rounds token units",()=>{
 assert.equal(exactDecimal(10n**18n,18),"1");
 assert.equal(exactDecimal(1n,18),"0.000000000000000001");
 assert.equal(exactDecimal(1234500000000000000n,18),"1.2345");
 assert.equal(exactDecimal(0n,18),"0");
 assert.throws(()=>exactDecimal(-1n,18));
 assert.equal(decodeFixedUInt(word(8)),8n);
 assert.throws(()=>decodeFixedUInt("0x1234"));
});
test("Dynamic token ABI symbol validates exact original MUSD",()=>{
 assert.equal(decodeSymbol(dynamicSymbol),"MUSD");
 assert.throws(()=>decodeSymbol("0x"),/Malformed/);
 assert.throws(()=>decodeSymbol("0x"+"00".repeat(96)));
});
test("Rejects address payload injection",()=>{
 assert.equal(encodeAddressWord(addr).length,64);
 assert.throws(()=>encodeAddressWord(addr+"junk"));
});
test("Real response shape pinned at one Mezo block with fixed token and all expected source facts",async()=>{
 const {request,calls}=mockRequest();
 const out=await readMezoMUSDFacts({owner:null,spender:null},{request});
 assert.equal(out.kind,"mezo_musd_pinned_erc20_readonly_facts");
 assert.equal(out.dataChain,"eip155:31612");
 assert.equal(out.blockTag,"0xc26375");
 assert.equal(out.totalSupplyMUSD,"29482016");
 assert.equal(out.code.runtimeBytes,125);
 assert.equal(out.balanceOwner,null);
 assert.equal(out.noWalletKeysOrSigning,true);
 assert.equal(out.noTransactionsOrGas,true);
 assert.equal(calls.length,6);
 assert(calls.every(x=>["eth_chainId","eth_blockNumber","eth_call","eth_getCode"].includes(x.method)));
});
test("Allowance/balance optional public addresses use same pinned block",async()=>{
 const {request,calls}=mockRequest();
 const v=await readMezoMUSDFacts({owner:addr,spender},{request});
 assert.equal(v.balanceMUSD,"2");
 assert.equal(v.allowanceMUSD,"5");
 assert.equal(v.allowanceExceedsBalance,true);
 assert.equal(v.unlimitedAllowance,false);
 assert.equal(v.balanceOwner,addr.toLowerCase());
 assert.equal(v.allowanceSpender,spender.toLowerCase());
 assert.equal(calls.length,8);
});
test("Fails closed on wrong chain",async()=>{
 const {request,calls}=mockRequest({chain:"0x2105"});
 await assert.rejects(readMezoMUSDFacts({}, {request}),/Wrong chain/);
 assert.equal(calls.length,1);
});
test("Fails closed on missing contract code",async()=>{
 const {request}=mockRequest({missingCode:true});
 await assert.rejects(readMezoMUSDFacts({}, {request}),/contract code invalid/);
});
test("Fails closed on token decimals mismatch",async()=>{
 const {request}=mockRequest({decimals:6n});
 await assert.rejects(readMezoMUSDFacts({}, {request}),/contract schema changed/);
});
test("Fails closed on token ABI malformed",async()=>{
 const {request}=mockRequest({symbol:"0x1234"});
 await assert.rejects(readMezoMUSDFacts({}, {request}),/ABI/);
});
test("Fails closed on RPC source error",async()=>{
 const {request}=mockRequest({failMethod:"eth_call"});
 await assert.rejects(readMezoMUSDFacts({}, {request}),/Noncanonical Mezo RPC/);
});
test("No caller-selected RPC origin outside test localhost",async()=>{
 const {request}=mockRequest();
 await assert.rejects(readMezoMUSDFacts({}, {request,endpoint:"https://evil.invalid"}),/Unsupported fixed/);
});
