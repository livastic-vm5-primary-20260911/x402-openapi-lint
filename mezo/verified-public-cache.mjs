// Cache ONLY fully source-verified, fixed Mezo MUSD contract supply metadata.
// One pinned block and explicit cache age per response; never cache optional
// owner/spender state, credentials, transactions, signed quotes or settlement.
// Singleflight prevents 6 duplicate RPC calls during simultaneous vendor probes.
// On upstream or invariant failure, no cache is created and NO x402 charge occurs.
import {MEZO_TOKEN} from "./musd-readonly.mjs";

export const MUSD_PUBLIC_CACHE_TTL_MS=90000;
const CODE_DIGEST=/^[0-9a-f]{64}$/;
const ATOMIC=/^(0|[1-9][0-9]*)$/;

function assertVerifiedBaseline(d){
  if(!d||typeof d!=="object"||Array.isArray(d) ||
    d.kind!=="mezo_musd_pinned_erc20_readonly_facts" ||
    d.dataChain!=="eip155:31612"||
    d.contract?.toLowerCase()!==MEZO_TOKEN.toLowerCase()||
    d.symbol!=="MUSD"||d.decimals!==18||
    !ATOMIC.test(d.dataBlock)||
    !ATOMIC.test(d.totalSupplyAtomic)||
    typeof d.totalSupplyMUSD!=="string"||
    !/^[0-9]+(?:\.[0-9]+)?$/.test(d.totalSupplyMUSD)||
    !d.code||!CODE_DIGEST.test(d.code.sha256)||
    !Number.isSafeInteger(d.code.runtimeBytes)||d.code.runtimeBytes<100||
    d.balanceOwner!==null||d.allowanceSpender!==null||
    d.balanceAtomic!==null||d.allowanceAtomic!==null||
    d.noWalletKeysOrSigning!==true||d.noTransactionsOrGas!==true)
    throw Error("Only a complete verified, ownerless pinned Mezo MUSD public ERC20 snapshot can be cached");
  return d;
}

export function createVerifiedMUSDPublicCache({
  load,
  now=Date.now,
  ttlMs=MUSD_PUBLIC_CACHE_TTL_MS
}={}){
  if(typeof load!=="function"||typeof now!=="function"||
    !Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>300000)
    throw Error("Invalid bounded public-only verified Mezo cache configuration");
  let saved=null;
  let pending=null;
  function present(value,at,clock,usedCache){
    const ageMs=Math.max(0,Math.min(ttlMs,clock-at));
    return Object.freeze({...value,
      sourceObservedAtUtc:new Date(at).toISOString(),
      sourceAgeSeconds:Number((ageMs/1000).toFixed(3)),
      sourceCacheTtlSeconds:ttlMs/1000,
      sourceWasCached:usedCache,
      sourceSnapshotPinned:true
    });
  }
  return Object.freeze({
    async get(){
      const tick=now();
      if(!Number.isFinite(tick)||tick<0)throw Error("Invalid public cache clock");
      if(saved&&tick-saved.at>=0&&tick-saved.at<ttlMs)
        return present(saved.value,saved.at,tick,true);
      if(pending){
        const live=await pending;
        return present(live.value,live.at,now(),true);
      }
      pending=(async()=>{
        const result=assertVerifiedBaseline(await load());
        const at=now();
        if(!Number.isFinite(at)||at<0)throw Error("Invalid public cache clock after source read");
        // Do not reuse values from a prior successful load if a later refresh fails.
        const fresh={value:Object.freeze({...result,code:Object.freeze({...result.code})}),at};
        saved=fresh;
        return fresh;
      })();
      try{
        const value=await pending;
        return present(value.value,value.at,now(),false);
      }catch(e){
        saved=null;
        throw e;
      }finally{
        pending=null;
      }
    }
  });
}
