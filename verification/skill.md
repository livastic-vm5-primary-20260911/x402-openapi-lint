# VM5 Delivery Lab: TapeOut X Layer Read-Only Report (x402 v2)

Public agent-facing purchase instructions. All information here is public. This service does not request wallet secrets or credentials, cannot send transactions on behalf of the buyer and does not require the seller's wallet signature.

## Free steps (zero payment)

1. Check service availability: `GET https://vm5-openapi-x402.onrender.com/health` (HTTP 200 when awake). Free hosting can cold-start.
2. Inspect a truthful synthetic preview: `GET https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-sample` (HTTP 200, `exampleOnly: true`, `paid: false`).
3. Use the free interactive X Layer public inspector if sufficient: https://livastic-vm5-primary-20260911.github.io/tapeout-xlayer-integrity-lens/
4. Optional complete machine schemas: `GET /openapi.json`, `GET /.well-known/x402`, `GET /llms.txt`. These are free metadata, not evidence of a sale.

## Paid API product

- Endpoint: `GET https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-report`
- Required request: exact GET path, **no query string, no request body**. Malformed requests return HTTP 400 before payment.
- Unpaid response: HTTP **402** with Base64 JSON `PAYMENT-REQUIRED` header. No funds transfer occurs on an unsigned GET.
- Quote: protocol x402 v2, `scheme=exact`, network `eip155:8453` (Base mainnet), canonical Circle native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `amount=5000` six-decimal atomic units = **0.005000 USDC**.
- **Recipient of THIS endpoint only:** `0x4e3106520E40af30870caFE78da1B1e7110eD98E` (original sole owner's VM1 MetaMask EVM public address). Other distinct VM5 products may use other original owner payout recipients.
- Authentication: an x402-compatible client **independently signs** an exact buyer-authorized EIP-3009 payment from its own wallet. Use client wallet budget policy; never transmit private keys, seed phrases or recovery codes to the merchant. The service verifies/settles using middleware before returning the paid response.
- Output on valid settlement: HTTP 200 JSON with pinned-block, publicly sourced X Layer network 196 factory, market, CPU and token-state observations. The report is not security certification, an audit, wallet ownership, asset recovery or investment advice.
- Provider preflight: if the remote X Layer public RPC does not supply a complete snapshot, the route returns **503 and no payment challenge**. Retry only when public data source healthy, not with arbitrary broad polling.

## Auditable zero-spend check

```sh
curl -fsS --max-time 70 https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-sample
curl -sS -D - --max-time 70 -o /dev/null https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-report
```

The second command requests only an unsigned price quote; it does **not** purchase the report. Pay only if the buyer explicitly accepts the displayed network, amount, asset and payTo. Never sign a different quote because this guide exists.

## Seller provenance and commerce status

Open-source, AI-assisted implementation and free demo:
https://github.com/livastic-vm5-primary-20260911/tapeout-xlayer-integrity-lens

The seller previously verified only two separate historical paid deliveries **by the same independent automated scout** on other API routes, totalling 0.015 native Base USDC. **No independent paid customer purchase of this TapeOut report was verified as of 2026-10-23.** A catalog listing, HTTP 402 quote, code test, browser visit or sponsor prize advertisement is NOT a purchase. Refund, suitability and costs depend on actual buyer conditions.

## New: four-exchange BTC/USDT perp funding snapshot (read-only)
Free fictional preview: GET https://vm5-openapi-x402.onrender.com/v1/btc-funding-sample
Paid exact GET: https://vm5-openapi-x402.onrender.com/v1/btc-funding-four-venues, 0.01 native Circle Base8453 USDC via x402 v2 to original VM1 0x4e3106520E40af30870caFE78da1B1e7110eD98E. Real-time upstream checks use Binance/Bybit/OKX/Bitget public data; a source error/stale data returns 503 BEFORE x402 payment requirement; no partial paid data. Quotes are not yields, forecasts, advice or actual arbitrage executions. Different funding intervals disclosed. This new SKU has zero proven independent paying buyers. No credential, wallet connection, trade or principal required to inspect the free preview.

Free x402 v2 publisher object manifest for independent API catalogs: GET https://vm5-openapi-x402.onrender.com/.well-known/x402-bazaar-manifest.json. It declares exactly 20 true payment-gated endpoints, their actual 0.001–0.20 native Base Circle USDC prices and original VM1 or VM5 public payTo addresses; no credentials, wallet connection, listing fees, fake transactions or implied sales. The older /.well-known/x402.json string URL list is preserved.

New **0.01 USDC** original-VM1-paid bounded developer endpoint:
`GET https://vm5-openapi-x402.onrender.com/v1/erc20-calldata-preflight`
decodes one optional *public unsigned* ERC-20 static ABI calldata into method,
addresses and raw uint256 amount, flags maxUint256 spender allowances and
zero addresses. Free synthetic `/v1/erc20-calldata-sample`. Invalid inputs
fail before x402; no RPC, wallet signing, token metadata claims, trading or
audited security guarantees. Payment recipient is the same original VM1
public MetaMask address as our BTC funding and TapeOut services; a distinct
legacy VM5 seller receives other old products. No new paid callers proven.

Additional distinct 0.01 native Base USDC VM1-owned API:
`GET https://vm5-openapi-x402.onrender.com/v1/erc20-event-preflight`
parses public canonical ERC20 Transfer/Approval EVENT TOPICS and one 32-byte
data value, *not a call-data input*. All four `topic0,topic1,topic2,data`
query words must be present or all omitted for a synthetic fixture.
Rejects malformed/noncanonical/NFT-indexed layouts BEFORE asking for
payment, detects uint256-max Approval and zero addresses. Free public
fictional preview `/v1/erc20-event-sample`. No RPC, wallet, signing,
contract validation or audit; no verified outside paid customer yet.
PayTo original VM1 public receive-only address, existing SKU payees intact.

Distinct original live read-only Base native Circle USDC allowance SKU
`GET https://vm5-openapi-x402.onrender.com/v1/base-usdc-allowance`
costs **0.01 actual Base Circle USDC** via buyer-controlled x402 to the
existing original owner's VM1 EVM public receive-only address. Supply
`owner` AND `spender` (two public 0x40hex EVM addresses), or neither
(defaults to original VM1 public wallet and illustrative dead spender).
Reads chain8453 `allowance` plus `balanceOf` at one pinned live block
through fixed RPCs, no wallet signing or state changes; status400/503/429
are issued BEFORE the x402 paywall, no successful HTTP200 or expense implied.
Completely free fictional example `/v1/base-usdc-allowance-sample`
requires no chain RPC. Flags max(uint256) allowance and exceeds-current
USDC balance; NOT spender legitimacy, contract audit, future balance,
actual token approval, trading, or proof of a real paid buyer.

## New: Mezo MUSD mainnet public ERC20 facts, 2026-10-25

Zero-charge synthetic product preview: GET https://vm5-openapi-x402.onrender.com/v1/mezo-musd-sample
Real paid data: GET https://vm5-openapi-x402.onrender.com/v1/mezo-musd-facts
Optional caller public input: ?owner=0x(40hex)&spender=0x(40hex) in that exact order. Only public addresses; no private data.

Issuer reference https://mezo.org/docs/users/resources/contracts-reference
Data chain is Mezo eip155:31612. Fixed issuer contract 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186. Returns pinned symbol, decimals, totalSupply, code SHA256, optional owner public balance/allowance.
Distinct payment chain is Base eip155:8453, token native Circle USDC, price 0.01 (10000 atomic) sent only by an independently authorized outside buyer to the existing original VM1 MetaMask public receive-only 0x4e3106520E40af30870caFE78da1B1e7110eD98E. No bridges, no sender wallet signing by the merchant. Bad inputs, RPC outage and quota failures are unpaid.
Never enter seed, private keys, passwords, OTP or nonpublic data. This is NOT a peg/backing/solvency/bridge/yield/safety audit or investment recommendation. NO newly verified independent paying customers, cash or revenue claimed for this SKU.
Version reconciliation: the original x402 merchant now declares 22 configured paid routes, preserving original 21 routes and recipient/price pairs plus one new Mezo MUSD report. Old earlier 20/21 counts in this document are historic. Live manifest is the true current public source.
