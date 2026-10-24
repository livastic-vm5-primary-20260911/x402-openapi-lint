// VM5 original source: read-only funding-rate quote aggregation for BTC/USDT linear perpetuals.
// Public exchange HTTPS read only. No API keys, order placement, funding, wallets or trading advice.
// A quote is NOT a realized payment, account APY or guaranteed next funding settlement.
export const VENUE_SYMBOL = "BTCUSDT";
export const FUNDING_PRICE_USDC = "0.01";
export const FUNDING_PAYOUT_BASE = "0x4e3106520E40af30870caFE78da1B1e7110eD98E";
export const FUNDING_ROUTES = Object.freeze([
  Object.freeze({venue:"Binance",url:"https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",priceUnit:"USDT",interval:"not independently verified in premiumIndex"}),
  Object.freeze({venue:"Bybit",url:"https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",priceUnit:"USDT"}),
  Object.freeze({venue:"OKX",url:"https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",priceUnit:"USDT"}),
  Object.freeze({venue:"Bitget",url:"https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=BTCUSDT&productType=USDT-FUTURES",priceUnit:"USDT"}),
]);
export const SOURCE_MAX_BYTES = 10_240;
export const FETCH_TIMEOUT_MS = 5_000;
export const SOURCE_STALENESS_MS = 180_000;
export const CACHE_MS = 20_000;

export class FundingSourceUnavailable extends Error {
  constructor(reason){super("Four-venue BTCUSDT public funding snapshot unavailable: "+reason);this.name="FundingSourceUnavailable";this.code="FUNDING_SOURCE_UNAVAILABLE";}
}
function obj(v){return v !== null && typeof v==="object" && !Array.isArray(v);}
function nonnegativeEpoch(v,label){
  if(!/^[0-9]{13}$/.test(String(v??"")))throw new FundingSourceUnavailable(label+": invalid millisecond timestamp");
  const x=Number(v);if(!Number.isSafeInteger(x))throw new FundingSourceUnavailable(label+": invalid timestamp");return x;
}
function funding(v,label){
  if(typeof v!=="string"|| !/^-?(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,18})?$/.test(v))
    throw new FundingSourceUnavailable(label+": invalid rate syntax");
  const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>0.05)
    throw new FundingSourceUnavailable(label+": out-of-bounds signed rate");
  return v;
}
function interval(raw,label){
  if(raw===undefined||raw===null||raw==="")return null;
  const n=Number(raw);if(!Number.isInteger(n)||n<1||n>24)
    throw new FundingSourceUnavailable(label+": unknown funding interval");
  return n;
}
function parseOne(venue,payload,nowMs){
  let rate,sourceMs,nextMs,intervalHours=null,upstreamSymbol;
  if(venue==="Binance"){
    if(!obj(payload)){throw new FundingSourceUnavailable("Binance: wrong response");}
    upstreamSymbol=payload.symbol;
    rate=funding(payload.lastFundingRate,"Binance");
    sourceMs=nonnegativeEpoch(payload.time,"Binance");
    nextMs=nonnegativeEpoch(payload.nextFundingTime,"Binance");
  }else if(venue==="Bybit"){
    if(!obj(payload)||payload.retCode!==0||!obj(payload.result)||!Array.isArray(payload.result.list)||payload.result.list.length!==1)
      throw new FundingSourceUnavailable("Bybit: unexpected schema");
    const p=payload.result.list[0];upstreamSymbol=p.symbol;
    rate=funding(p.fundingRate,"Bybit");
    sourceMs=nonnegativeEpoch(payload.time,"Bybit");
    nextMs=nonnegativeEpoch(p.nextFundingTime,"Bybit");
    intervalHours=interval(p.fundingIntervalHour,"Bybit");
  }else if(venue==="OKX"){
    if(!obj(payload)||payload.code!=="0"||!Array.isArray(payload.data)||payload.data.length!==1)
      throw new FundingSourceUnavailable("OKX: unexpected schema");
    const p=payload.data[0];upstreamSymbol=p.instId;
    rate=funding(p.fundingRate,"OKX");
    sourceMs=nonnegativeEpoch(p.ts,"OKX");
    // FundingTime, not nextFundingTime: the latter is the FOLLOWING settlement.
    nextMs=nonnegativeEpoch(p.fundingTime,"OKX");
    const prev=nonnegativeEpoch(p.prevFundingTime,"OKX");
    if(nextMs>prev){intervalHours=interval((nextMs-prev)/3_600_000,"OKX");}
  }else if(venue==="Bitget"){
    if(!obj(payload)||payload.code!=="00000"||!Array.isArray(payload.data)||payload.data.length!==1)
      throw new FundingSourceUnavailable("Bitget: unexpected schema");
    const p=payload.data[0];upstreamSymbol=p.symbol;
    rate=funding(p.fundingRate,"Bitget");
    sourceMs=nonnegativeEpoch(payload.requestTime,"Bitget");
    nextMs=nonnegativeEpoch(p.nextUpdate,"Bitget");
    intervalHours=interval(p.fundingRateInterval,"Bitget");
  }else{
    throw new FundingSourceUnavailable("unknown venue");
  }
  if((venue==="OKX"?upstreamSymbol!=="BTC-USDT-SWAP":upstreamSymbol!=="BTCUSDT"))
    throw new FundingSourceUnavailable(venue+": unexpected symbol");
  // A stale or future-dated quote must not be sold as current: reject BEFORE the payment challenge.
  if(Math.abs(nowMs-sourceMs)>SOURCE_STALENESS_MS)
    throw new FundingSourceUnavailable(venue+": stale data");
  if(nextMs < nowMs-90_000 || nextMs > nowMs+86_400_000)
    throw new FundingSourceUnavailable(venue+": next funding outside expected range");
  const n=Number(rate);
  return {
    venue,symbol:upstreamSymbol,contractType:"linear perpetual",
    quotedFundingRate:rate,
    quotedFundingRatePercent:Number((n*100).toFixed(10)),
    quotedFundingRateBps:Number((n*10_000).toFixed(7)),
    intervalHours,
    nextFundingUtc:new Date(nextMs).toISOString(),
    providerTimestampUtc:new Date(sourceMs).toISOString(),
    dataQuality:"fresh public venue quote, not a finalized funding settlement",
  };
}
async function getJSON(route,fetchImpl,timeoutMs){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(route.url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal,redirect:"error"});
    if(response.status!==200)throw new FundingSourceUnavailable(route.venue+": HTTP "+String(response.status));
    const size=Number(response.headers?.get?.("content-length")||0);
    if(size> SOURCE_MAX_BYTES)throw new FundingSourceUnavailable(route.venue+": excessive response length");
    const text=await response.text();
    if(Buffer.byteLength(text,"utf8")>SOURCE_MAX_BYTES)throw new FundingSourceUnavailable(route.venue+": oversized body");
    let json;try{json=JSON.parse(text);}catch{throw new FundingSourceUnavailable(route.venue+": non-JSON response");}
    if(!obj(json))throw new FundingSourceUnavailable(route.venue+": invalid JSON shape");
    return json;
  }catch(err){
    // Public status and source name only. Do not surface a network stack,
    // vendor response body, endpoint query string or internal credentials.
    if(err instanceof FundingSourceUnavailable)throw err;
    throw new FundingSourceUnavailable(route.venue+": public HTTPS fetch failed or timed out");
  }finally{clearTimeout(timeout);}
}
export function createFourVenueReader({fetchImpl=fetch,clock=Date.now,cacheMs=CACHE_MS,timeoutMs=FETCH_TIMEOUT_MS}={}){
  if(typeof fetchImpl!=="function"||typeof clock!=="function")
    throw new TypeError("fetchImpl and clock must be functions");
  if(!Number.isSafeInteger(cacheMs)||cacheMs<0||cacheMs>60_000)throw new TypeError("cacheMs outside allowed range");
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<500||timeoutMs>10_000)throw new TypeError("timeoutMs outside allowed range");
  let previous=null,expire=0,pending=null;
  return async function readFourVenueFunding(){
    const n=clock();
    if(previous && n<expire)return previous;
    if(pending)return pending;
    pending=(async()=>{
      try{
        const sampledAtMs=clock();
        const data=await Promise.all(FUNDING_ROUTES.map(async route=>parseOne(route.venue,await getJSON(route,fetchImpl,timeoutMs),sampledAtMs)));
        // Deterministic selection: four unique upstream venues; preserve original provider order for diff-able responses.
        if(new Set(data.map(x=>x.venue)).size!==4)throw new FundingSourceUnavailable("duplicate venue");
        const bps=data.map(x=>x.quotedFundingRateBps);
        const out=Object.freeze({
          kind:"btc_usdt_perpetual_funding_quoted_four_public_venues",
          asOfUtc:new Date(sampledAtMs).toISOString(),
          underlying:"BTC", quoteAsset:"USDT", sourceCount:4,
          venues:data,
          comparison:{
            maxQuotedFundingBps:Math.max(...bps),
            minQuotedFundingBps:Math.min(...bps),
            rawSpreadBps:Number((Math.max(...bps)-Math.min(...bps)).toFixed(7)),
            warning:"Different funding schedules and rate conventions; this is a raw quote difference, not an arbitrage trade or profit."
          },
          caveats:[
            "Quotes can change before next settlement and may differ by account, exchange rule, position size or market conditions.",
            "No trading, order submission, account balances, personal data, API keys, signing, leverage, lending or investment recommendation.",
            "Binance source does not independently provide a current funding interval, so its intervalHours is null.",
            "All 4 fresh public sources are required before this service quotes x402; partial output is never sold."
          ],
          independentConfirmedPayingBuyersForThisProduct:0,
        });
        previous=out;expire=sampledAtMs+cacheMs;return out;
      }catch(e){
        // Do not cache failures or accidentally issue a 402 when any source is down.
        throw e instanceof FundingSourceUnavailable?e:new FundingSourceUnavailable("upstream read failed or timed out");
      }finally{pending=null;}
    })();
    return pending;
  };
}
export const readLiveFourVenueFunding=createFourVenueReader();
export const DEMO_FUNDING={
  ok:true,paid:false,exampleOnly:true,kind:"btc_usdt_funding_four_venues",
  paidPath:"/v1/btc-funding-four-venues",
  displaySample:{venue:"EXAMPLE",quotedFundingRate:"0.00005000",quotedFundingRateBps:0.5,nextFundingUtc:"2026-01-01T08:00:00.000Z"},
  noRealMarketQuoteInThisSample:true,noCapitalOrWalletSigningRequired:true,
};
