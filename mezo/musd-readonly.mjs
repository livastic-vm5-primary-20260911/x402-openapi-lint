// Original zero-signature read-only Mezo MUSD ERC-20 facts, for developer
// payment / allowance verification, never a yield recommendation or wallet API.
// Reference: https://mezo.org/docs/users/resources/contracts-reference
// No user-supplied RPC/contract, no tx, no signing, no credentials/cookies.
import {createHash} from "node:crypto";
export const MEZO_RPC="https://mezo-mainnet.boar.network";
export const MEZO_TOKEN="0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";
export const MEZO_CHAIN_ID=31612;
export const MEZO_NTT_MANAGER="0x7efb386675d75280D39Aae42964A6776DE0ee0bD";
export const MUSD_DEFINITION="https://mezo.org/docs/users/resources/contracts-reference";
const STRICT_ADDR=/^0x[0-9a-fA-F]{40}$/;
const WORD=/^0x[0-9a-fA-F]{64}$/;
const MAX_SUPPLY=2n**256n-1n;
const TIMEOUT_MS=7500;
const MAX_RESPONSE_CHARS=180000;

export function parseMUSDQuery(query){
  if(!query || typeof query!=="object"||Array.isArray(query))return {ok:false,error:"Invalid query"};
  const keys=Object.keys(query);
  if(keys.length===0)return {ok:true,owner:null,spender:null};
  if(keys.length!==2||keys.some(k=>!["owner","spender"].includes(k)))
    return {ok:false,error:"Use both public owner and spender addresses, or neither"};
  if(typeof query.owner!=="string"||typeof query.spender!=="string"||
    !STRICT_ADDR.test(query.owner)||!STRICT_ADDR.test(query.spender))
    return {ok:false,error:"Both owner and spender must be public 20-byte EVM addresses"};
  return {ok:true,owner:query.owner.toLowerCase(),spender:query.spender.toLowerCase()};
}
export function encodeAddressWord(a){
  if(!STRICT_ADDR.test(a))throw Error("Non-canonical EVM address");
  return a.slice(2).toLowerCase().padStart(64,"0");
}
export function decodeFixedUInt(input){
  if(typeof input!=="string"||!WORD.test(input))throw Error("Malformed unsigned integer ABI word");
  const n=BigInt(input);
  if(n<0n||n>MAX_SUPPLY)throw Error("ABI integer outside uint256");
  return n;
}
export function exactDecimal(raw,decimals){
  if(typeof raw!=="bigint"||raw<0n||raw>MAX_SUPPLY||!Number.isSafeInteger(decimals)||decimals<0||decimals>24)
    throw Error("Invalid exact fixed-decimal token amount");
  const scale=10n**BigInt(decimals);
  const whole=(raw/scale).toString();
  const fraction=(raw%scale).toString().padStart(decimals,"0").replace(/0+$/,"");
  return whole+(fraction?"."+fraction:"");
}
export function decodeSymbol(raw){
  // Exact ABI dynamic string from verified real Mezo MUSD contract:
  // word(offset=32) + word(strlen) + padded ASCII.
  if(typeof raw!=="string"||!/^0x(?:[0-9a-fA-F]{2})+$/.test(raw)||raw.length>514)
    throw Error("Malformed ERC20 symbol ABI");
  const hex=raw.slice(2);
  if(hex.length<192)throw Error("Truncated ABI symbol");
  const offset=BigInt("0x"+hex.slice(0,64));
  const size=BigInt("0x"+hex.slice(64,128));
  if(offset!==32n||size<1n||size>32n||hex.length<128+Number(size)*2)
    throw Error("Invalid dynamic ERC20 symbol");
  const symbol=Buffer.from(hex.slice(128,128+Number(size)*2),"hex").toString("utf8");
  if(!/^[A-Z]{2,12}$/.test(symbol))throw Error("Unexpected noncanonical MUSD symbol");
  return symbol;
}
function parseCode(raw){
  if(typeof raw!=="string"||!/^0x(?:[0-9a-fA-F]{2})*$/.test(raw)||raw.length>130000)
    throw Error("Invalid or oversized MUSD contract code");
  const code=Buffer.from(raw.slice(2),"hex");
  if(code.length<100||code.length>65000)throw Error("Mezo MUSD deployed contract code invalid");
  return {runtimeBytes:code.length,sha256:createHash("sha256").update(code).digest("hex")};
}
export async function readMezoMUSDFacts(input={owner:null,spender:null},
  {request=globalThis.fetch,endpoint=MEZO_RPC}={}){
  const parsed=parseMUSDQuery(input && input.owner===null && input.spender===null ? {} : input);
  if(!parsed.ok)throw Error(parsed.error);
  // Caller cannot override RPC: endpoint is test injectable only; never exposed
  // via HTTP query, body, configuration, forwarded header or external clients.
  if(!/^https:\/\/mezo-mainnet\.boar\.network$/.test(endpoint) &&
      !(process.env.NODE_ENV==="test" && /^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)))
    throw Error("Unsupported fixed Mezo mainnet RPC origin");
  let rpcCalls=0;
  async function rpc(method,params){
    const id=++rpcCalls;
    if(id>9)throw Error("Mezo RPC call bound exceeded");
    const response=await request(endpoint,{
      method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",
        "User-Agent":"VM5-original-readonly-Mezo-MUSD-eip155-31612/1.0"},
      body:JSON.stringify({jsonrpc:"2.0",id,method,params}),
      redirect:"error",signal:AbortSignal.timeout(TIMEOUT_MS)
    });
    if(!response||response.status!==200||!(response.headers?.get("content-type")||"").includes("json"))
      throw Error("Mezo MUSD upstream unavailable");
    const text=await response.text();
    if(text.length>MAX_RESPONSE_CHARS)throw Error("Oversized RPC response");
    const v=JSON.parse(text);
    if(!v||typeof v!=="object"||Array.isArray(v)||v.jsonrpc!=="2.0"||
       v.id!==id||Object.hasOwn(v,"error")||typeof v.result!=="string")
      throw Error("Noncanonical Mezo RPC response");
    return v.result;
  }
  const chain=await rpc("eth_chainId",[]);
  if(chain!=="0x7b7c")throw Error("Wrong chain; expected Mezo mainnet 31612");
  const block=await rpc("eth_blockNumber",[]);
  if(!/^0x[1-9a-f][0-9a-f]*$/.test(block)||BigInt(block)<1000000n||BigInt(block)>2n**62n)
    throw Error("Invalid current Mezo mainnet block");
  const call=(data)=>rpc("eth_call",[{to:MEZO_TOKEN,data},block]);
  const [sym,dec,issued,code]=await Promise.all([
    call("0x95d89b41"),call("0x313ce567"),call("0x18160ddd"),
    rpc("eth_getCode",[MEZO_TOKEN,block])
  ]);
  const symbol=decodeSymbol(sym);
  const decimalsRaw=decodeFixedUInt(dec);
  if(symbol!=="MUSD"||decimalsRaw!==18n)throw Error("MUSD contract schema changed; refuse report");
  const supply=decodeFixedUInt(issued);
  const codeInfo=parseCode(code);
  const result={
    kind:"mezo_musd_pinned_erc20_readonly_facts",
    dataChain:"eip155:31612",dataBlock:BigInt(block).toString(),
    blockTag:block,contract:MEZO_TOKEN,symbol,decimals:18,
    totalSupplyAtomic:supply.toString(),
    totalSupplyMUSD:exactDecimal(supply,18),
    code:codeInfo,nttManagerListedByIssuer:MEZO_NTT_MANAGER,
    balanceOwner:null,allowanceSpender:null,
    balanceAtomic:null,balanceMUSD:null,allowanceAtomic:null,allowanceMUSD:null,
    allowanceExceedsBalance:null,unlimitedAllowance:null,
    allowedSource:MUSD_DEFINITION,rpcHost:"mezo-mainnet.boar.network",
    noWalletKeysOrSigning:true,noTransactionsOrGas:true,
    warning:"Public snapshot only. Supply is not backing, liquidity, price, bridging, risk, yield, or real-world collateral verification."
  };
  if(parsed.owner){
    const owner=encodeAddressWord(parsed.owner),spender=encodeAddressWord(parsed.spender);
    const [balanceHex,allowanceHex]=await Promise.all([
      call("0x70a08231"+owner),
      call("0xdd62ed3e"+owner+spender)
    ]);
    const balance=decodeFixedUInt(balanceHex), allowance=decodeFixedUInt(allowanceHex);
    Object.assign(result,{
      balanceOwner:parsed.owner,allowanceSpender:parsed.spender,
      balanceAtomic:balance.toString(),balanceMUSD:exactDecimal(balance,18),
      allowanceAtomic:allowance.toString(),allowanceMUSD:exactDecimal(allowance,18),
      allowanceExceedsBalance:allowance>balance,
      unlimitedAllowance:allowance===MAX_SUPPLY
    });
  }
  return Object.freeze(result);
}
