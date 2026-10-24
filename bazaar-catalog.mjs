// Read-only local x402 v2 discovery for buyers; this service is NOT a facilitator.
// All facts are derived from the SAME in-process paymentMiddleware route config.
// Never accept client-supplied payment requirements or call an RPC/facilitator here.
const BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const UPDATED_AT="2026-10-23T16:45:00.000Z";
const ALLOWED_FILTERS=new Set(["limit","offset","type","payTo","network","scheme","extensions"]);

export function usdToAtomic(amount) {
  if (typeof amount!=="string") throw Error("Unsupported quoted amount");
  const m=/^\$(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/.exec(amount);
  if(!m)throw Error("Only exact six-decimal Base USDC amounts are supported");
  const integer=BigInt(m[1])*1_000_000n;
  const fractional=BigInt((m[2]||"").padEnd(6,"0"));
  const total=integer+fractional;
  if(total<=0n || total>1_000_000_000_000n)throw Error("Unsupported payment amount");
  return String(total);
}
export function makeCatalog(origin,routeConfig) {
  if(typeof origin!=="string" || !/^https:\/\/[a-z0-9.-]+$|^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin))
    throw Error("Invalid catalog origin");
  if(routeConfig===null || typeof routeConfig!=="object" || Array.isArray(routeConfig))
    throw Error("Invalid route map");
  const seen=new Set();
  const items=Object.entries(routeConfig).map(([key,config])=>{
    const match=/^(GET|POST) (\/v1\/[a-z0-9-]+)$/.exec(key);
    if(!match)throw Error("Invalid protected route key");
    const configAccepts=config?.accepts;
    if(!configAccepts || configAccepts.scheme!=="exact" || configAccepts.network!=="eip155:8453" ||
       !/^0x[0-9a-f]{40}$/i.test(configAccepts.payTo))throw Error("Unsupported payment configuration");
    const resource=origin+match[2];
    if(seen.has(resource))throw Error("Ambiguous method for the same resource");
    seen.add(resource);
    return {
      resource,
      type:"http",
      x402Version:2,
      accepts:[{
        scheme:"exact",
        network:"eip155:8453",
        amount:usdToAtomic(configAccepts.price),
        asset:BASE_USDC,
        payTo:configAccepts.payTo,
        maxTimeoutSeconds:300,
        extra:{name:"USD Coin",version:"2"}
      }],
      lastUpdated:UPDATED_AT,
      // A spec-shaped self-hosted catalog item is NOT a sponsor approval, paid
      // transaction, customer order, official marketplace listing or settlement.
    };
  }).sort((a,b)=>a.resource.localeCompare(b.resource,"en"));
  if(items.length!==16)throw Error("Unexpected number of paid routes: require 15 unchanged originals plus 1 new verified four-venue source");
  return Object.freeze({x402Version:2,items});
}
export function queryCatalog(catalog,query={}) {
  if(!catalog || !Array.isArray(catalog.items))throw Error("Invalid catalog");
  if(Object.keys(query).some(k=>!ALLOWED_FILTERS.has(k)))throw Error("Unsupported discovery filter");
  const getString=(key,max=100)=>{
    const v=query[key];
    if(v===undefined)return undefined;
    if(typeof v!=="string"||v.length>max)throw Error("Invalid discovery filter");
    return v;
  };
  const limitString=getString("limit",4);
  const offsetString=getString("offset",9);
  if(limitString!==undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limitString))
    throw Error("Invalid pagination limit");
  if(offsetString!==undefined && !/^(?:0|[1-9][0-9]{0,8})$/.test(offsetString))
    throw Error("Invalid pagination offset");
  const limit=limitString===undefined?20:Number(limitString);
  const offset=offsetString===undefined?0:Number(offsetString);
  const type=getString("type");
  const scheme=getString("scheme");
  const network=getString("network");
  const payTo=getString("payTo");
  const extensions=getString("extensions");
  let filtered=catalog.items;
  if(type)filtered=filtered.filter(row=>row.type===type);
  if(scheme)filtered=filtered.filter(row=>row.accepts.some(a=>a.scheme===scheme));
  if(network)filtered=filtered.filter(row=>row.accepts.some(a=>a.network===network));
  if(payTo)filtered=filtered.filter(row=>row.accepts.some(a=>a.payTo.toLowerCase()===payTo.toLowerCase()));
  // No catalog item asserts an extension, even though paid HTTP402 may contain one.
  if(extensions)filtered=[];
  return {x402Version:2,items:filtered.slice(offset,offset+limit),pagination:{limit,offset,total:filtered.length}};
}
