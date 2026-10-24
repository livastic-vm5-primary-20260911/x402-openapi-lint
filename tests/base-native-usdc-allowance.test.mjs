import test from "node:test";
import assert from "node:assert/strict";
import {readBaseNativeUsdcAllowance,asAllowanceReport,validateAllowanceQuery,
 CIRCLE_NATIVE_BASE_USDC,formatNativeUsdc,SYNTHETIC_QUERY_OWNER,
 SYNTHETIC_QUERY_SPENDER,uint256Word} from "../base-usdc-allowance.mjs";
const A="0x1111111111111111111111111111111111111111";
const B="0x2222222222222222222222222222222222222222";
const UINT_MAX=(1n<<256n)-1n;
const withWords=(a,b)=>({owner:A,spender:B,block:100,allowanceWord:uint256Word(a),
 balanceWord:uint256Word(b),rpcSource:"localhost"});
test("Strict query validation requires public owner+spender together, no arbitrary contract or network",()=>{
 const demo=validateAllowanceQuery({});
 assert.equal(demo.ok,true);assert.equal(demo.owner,SYNTHETIC_QUERY_OWNER);
 assert.equal(demo.spender,SYNTHETIC_QUERY_SPENDER);assert.equal(demo.demoParameters,true);
 assert.deepEqual(validateAllowanceQuery({owner:A,spender:B}),{ok:true,owner:A,spender:B,demoParameters:false});
 for(const x of [null,[],{owner:A},{spender:B},{token:CIRCLE_NATIVE_BASE_USDC},
  {owner:A,spender:B,chainId:"1"},{owner:A,spender:B,rpc:"https://evil.example"},
  {owner:[A],spender:B},{owner:A,spender:B,extra:0},{owner:"0x0",spender:B},
  {owner:A,spender:42},{owner:10,spender:B}])
  assert.equal(validateAllowanceQuery(x).ok,false,JSON.stringify(x));
});
test("Convert canonical Base USDC raw 6-decimal units WITHOUT JS floating point arithmetic",()=>{
 assert.equal(formatNativeUsdc(0n),"0.000000");
 assert.equal(formatNativeUsdc(1n),"0.000001");
 assert.equal(formatNativeUsdc(1000000n),"1.000000");
 assert.equal(formatNativeUsdc(123456789123456n),"123456789.123456");
 assert.equal(formatNativeUsdc(UINT_MAX),UINT_MAX.toString().slice(0,-6)+"."+UINT_MAX.toString().slice(-6));
 for(const x of [-1n,UINT_MAX+1n])assert.throws(()=>formatNativeUsdc(x),/OUT_OF_RANGE/);
});
test("Treat approval above current balance and exact maxuint approval as warnings, not a smart-contract audit",()=>{
 const d=asAllowanceReport(withWords(UINT_MAX,1_500_000n));
 assert.equal(d.kind,"base_native_circle_usdc_readonly_allowance_snapshot");
 assert.equal(d.chainId,8453);assert.equal(d.tokenContract,CIRCLE_NATIVE_BASE_USDC);
 assert.equal(d.isUnlimitedMaxUint256,true);assert.equal(d.allowanceExceedsCurrentBalance,true);
 assert.deepEqual(d.riskFlags.map(x=>x.code),
  ["MAX_UINT256_APPROVAL","ALLOWANCE_EXCEEDS_CURRENT_BALANCE"]);
 assert.equal(d.noWalletKeysOrOnchainTransactions,true);
 assert.equal(d.verifiedOwnerIdentity,false);assert.equal(d.verifiedFutureBalance,false);
 const zero=asAllowanceReport(withWords(0n,0n));
 assert.equal(zero.allowanceUSDC,"0.000000");assert.equal(zero.riskFlags.length,0);
});
test("Fail closed on malformed/undersized ABI uint256 data and arbitrary zero block",()=>{
 const good=withWords(42n,10n);
 for(const bad of [
  {...good,allowanceWord:"0x42"},
  {...good,balanceWord:"0x"},
  {...good,allowanceWord:"0x"+"zz".repeat(32)},
  {...good,block:0},{...good,owner:"foo"},
  {...good,allowanceWord:"0x"+"00".repeat(33)}
 ])assert.throws(()=>asAllowanceReport(bad),/INVALID|NON_CANONICAL/);
});
test("Only eth_chainId, eth_blockNumber and pinned read-only eth_call, with fixed token address",async()=>{
 const rpcURL=process.env.BASE_RPC_URL||"https://base-rpc.publicnode.com";
 assert.ok(rpcURL.startsWith("http://127.0.0.1:")||rpcURL==="https://base-rpc.publicnode.com");
 const seen=[];
 const request=async(url,opts)=>{
  assert.equal(url,rpcURL);
  const q=JSON.parse(opts.body);seen.push(q);
  assert.ok(!["eth_sendTransaction","eth_sign","eth_estimateGas"].includes(q.method));
  assert.equal(opts.method,"POST");
  if(q.method==="eth_call"){
   assert.equal(q.params[1],"0x111");
   assert.equal(q.params[0].to.toLowerCase(),CIRCLE_NATIVE_BASE_USDC.toLowerCase());
  }
  const result=q.method==="eth_chainId"?"0x2105":q.method==="eth_blockNumber"?"0x111":
   q.params[0].data.startsWith("0xdd62ed3e")?uint256Word(20000000n):uint256Word(1150000n);
  return {status:200,headers:{get:()=>"application/json"},text:async()=>JSON.stringify({jsonrpc:"2.0",id:q.id,result})};
 };
 const a=await readBaseNativeUsdcAllowance(A,B,{request});
 assert.equal(a.ownerAddress,A);assert.equal(a.spenderAddress,B);
 assert.equal(a.observedBlockNumber,273);assert.equal(a.allowanceUSDC,"20.000000");
 assert.equal(a.ownerBalanceUSDC,"1.150000");assert.equal(a.riskFlags[0].code,"ALLOWANCE_EXCEEDS_CURRENT_BALANCE");
 assert.equal(seen.length,4);assert.equal(seen.filter(x=>x.method==="eth_call").length,2);
});
test("Cannot claim a chain other than Base; code returns error without a data report",async()=>{
 const request=async(_url,opts)=>{
  const q=JSON.parse(opts.body);
  return {status:200,headers:{get:()=>"application/json"},text:async()=>JSON.stringify({jsonrpc:"2.0",id:q.id,result:"0x1"})};
 };
 await assert.rejects(()=>readBaseNativeUsdcAllowance(A,B,{request}),/PINNED_BASE_USDC_PROOF_UNAVAILABLE/);
});
