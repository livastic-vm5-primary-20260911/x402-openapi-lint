/**
 * ORIGINAL one-human-owner VM5 paid data product: real native Circle USDC
 * allowance and balance read-only on Base mainnet. No wallet keys, signatures,
 * token approvals, asset transfers, arbitrary token/RPC input or fund spending.
 *
 * IMPORTANT: JSON-RPC records are untrusted snapshots, not proof of token
 * legitimacy, owner identity, current economic risk, spend permission, safety,
 * finality or a comprehensive DeFi audit.
 */
export const CIRCLE_NATIVE_BASE_USDC="0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID=8453;
export const SYNTHETIC_QUERY_OWNER="0x4e3106520E40af30870caFE78da1B1e7110eD98E";
export const SYNTHETIC_QUERY_SPENDER="0x000000000000000000000000000000000000dEaD";
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX32=/^0x[0-9a-fA-F]{64}$/;
const MAX_UINT256=(1n<<256n)-1n;
const SELECTOR_ALLOWANCE="0xdd62ed3e"; // allowance(address owner,address spender)
const SELECTOR_BALANCE="0x70a08231";   // balanceOf(address)
const ALLOWED_RPC_METHODS=new Set(["eth_chainId","eth_blockNumber","eth_call"]);
const rpcSources=(process.env.NODE_ENV==="test"&&process.env.BASE_RPC_URL)
  ?[process.env.BASE_RPC_URL]
  :["https://base-rpc.publicnode.com","https://mainnet.base.org"];
const milliTimeout=6200;
const force=(code)=>{const e=new Error(code);e.code=code;throw e;};
export const uint256Word=value=>"0x"+value.toString(16).padStart(64,"0");
export function validateAllowanceQuery(query){
 if(!query||typeof query!=="object"||Array.isArray(query))return {ok:false,error:"INVALID_QUERY"};
 const keys=Object.keys(query);
 if(keys.length===0)return {ok:true,owner:SYNTHETIC_QUERY_OWNER,spender:SYNTHETIC_QUERY_SPENDER,demoParameters:true};
 if(keys.length!==2||!keys.includes("owner")||!keys.includes("spender"))return {ok:false,error:"MUST_SUPPLY_OWNER_AND_SPENDER_TOGETHER"};
 const {owner,spender}=query;
 if(typeof owner!=="string"||typeof spender!=="string"||!ADDRESS.test(owner)||!ADDRESS.test(spender))return {ok:false,error:"INVALID_EVM_ADDRESS"};
 return {ok:true,owner,spender,demoParameters:false};
}
export function formatNativeUsdc(atomic){
 const n=BigInt(atomic);
 if(n<0n||n>MAX_UINT256)force("OUT_OF_RANGE_UINT256");
 return (n/1000000n).toString()+"."+(n%1000000n).toString().padStart(6,"0");
}
const wordOfAddress=address=>address.slice(2).toLowerCase().padStart(64,"0");
function validateCanonicalBigInt(word){
 if(typeof word!=="string"||!HEX32.test(word))force("NON_CANONICAL_UINT256_WORD");
 return BigInt(word);
}
export function asAllowanceReport({owner,spender,block,allowanceWord,balanceWord,rpcSource}){
 if(!ADDRESS.test(owner)||!ADDRESS.test(spender)||!Number.isSafeInteger(block)||block<1)force("INVALID_SNAPSHOT_ARGS");
 const allowance=validateCanonicalBigInt(allowanceWord);
 const balance=validateCanonicalBigInt(balanceWord);
 const isUnlimitedMaxUint256=allowance===MAX_UINT256;
 const allowancesExceedBalance=allowance>balance;
 const riskFlags=[];
 if(isUnlimitedMaxUint256)riskFlags.push({
  code:"MAX_UINT256_APPROVAL",message:"Public allowance equals uint256.max. A spender may transfer more than the current account balance over time, subject to the real token and chain behavior."
 });
 if(allowancesExceedBalance)riskFlags.push({
  code:"ALLOWANCE_EXCEEDS_CURRENT_BALANCE",message:"Currently approved raw USDC units exceed the public balance at the same sampled block. Not a prediction of future balance or actual debits."
 });
 return Object.freeze({
  ok:true,kind:"base_native_circle_usdc_readonly_allowance_snapshot",
  chainId:BASE_CHAIN_ID,dataNetwork:"eip155:8453",
  tokenContract:CIRCLE_NATIVE_BASE_USDC,tokenSymbol:"USDC",tokenDecimals:6,
  ownerAddress:owner,spenderAddress:spender,
  observedBlockNumber:block,
  observedAtUTC:new Date().toISOString(),
  allowanceAtomic:allowance.toString(),allowanceUSDC:formatNativeUsdc(allowance),
  ownerBalanceAtomic:balance.toString(),ownerBalanceUSDC:formatNativeUsdc(balance),
  isUnlimitedMaxUint256,allowanceExceedsCurrentBalance:allowancesExceedBalance,
  riskFlags,
  publicRpcSource:rpcSource,
  calledOnlyReadMethods:true,noWalletKeysOrOnchainTransactions:true,
  tokenApprovalActuallyExecutedByService:false,
  verifiedOwnerIdentity:false,verifiedFutureBalance:false,
  limitations:"Live read-only Ethereum JSON-RPC snapshot of the fixed Circle native Base USDC contract's allowance(owner,spender) and balanceOf(owner) at one block. Not an allowance change, wallet binding, issuer compliance attestation, owner authorization, spender legitimacy or security audit. State can change in subsequent blocks; any public RPC can be unavailable/mistaken."
 });
}
async function rpc(url,method,params,request,nonce){
 if(!ALLOWED_RPC_METHODS.has(method))force("DISALLOWED_RPC_METHOD");
 const r=await request(url,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json",
  "User-Agent":"VM5-original-human-owner-x402-public-usdc-allowance-read-only"},
  body:JSON.stringify({jsonrpc:"2.0",id:nonce,method,params}),
  signal:AbortSignal.timeout(milliTimeout),redirect:"error"});
 if(r?.status!==200||!(r.headers?.get("content-type")||"").toLowerCase().includes("json"))force("RPC_BAD_HTTP");
 const response=await r.text();
 if(response.length>32000)force("RPC_OVERSIZED");
 const j=JSON.parse(response);
 if(j?.jsonrpc!=="2.0"||j.id!==nonce||j.error||typeof j.result!=="string")force("RPC_INVALID_RESPONSE");
 return j.result;
}
export async function readBaseNativeUsdcAllowance(owner,spender,{request=globalThis.fetch}={}){
 if(!ADDRESS.test(owner)||!ADDRESS.test(spender))force("INVALID_OWNER_OR_SPENDER");
 const allowanceCall=SELECTOR_ALLOWANCE+wordOfAddress(owner)+wordOfAddress(spender);
 const balanceCall=SELECTOR_BALANCE+wordOfAddress(owner);
 for(const base of rpcSources){
  try{
   let nonce=11;
   const chain=await rpc(base,"eth_chainId",[],request,nonce++);
   if(chain!=="0x2105")force("RPC_NOT_BASE_8453");
   const blockHex=await rpc(base,"eth_blockNumber",[],request,nonce++);
   if(!/^0x[1-9a-f][a-f0-9]*$/i.test(blockHex))force("INVALID_BLOCK");
   const block=Number(BigInt(blockHex));
   if(!Number.isSafeInteger(block)||block<1)force("IMPLAUSIBLE_BLOCK");
   const calls=[{to:CIRCLE_NATIVE_BASE_USDC,data:allowanceCall},{to:CIRCLE_NATIVE_BASE_USDC,data:balanceCall}];
   const [allowanceWord,balanceWord]=await Promise.all(calls.map((params,i)=>
    rpc(base,"eth_call",[params,blockHex],request,nonce+i)));
   return asAllowanceReport({owner,spender,block,allowanceWord,balanceWord,rpcSource:new URL(base).hostname});
  }catch(e){
   // Fall through only to the ORIGINAL fixed, source-controlled backup.
   // Do not leak RPC body/user data or return partial paid results.
   if(base===rpcSources[rpcSources.length-1])force("PINNED_BASE_USDC_PROOF_UNAVAILABLE");
  }
 }
 force("NO_FIXED_RPC_SOURCES");
}
