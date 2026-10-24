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

Free x402 v2 publisher object manifest for independent API catalogs: GET https://vm5-openapi-x402.onrender.com/.well-known/x402-bazaar-manifest.json. It declares exactly 16 true payment-gated endpoints, their actual 0.001–0.20 native Base Circle USDC prices and original VM1 or VM5 public payTo addresses; no credentials, wallet connection, listing fees, fake transactions or implied sales. The older /.well-known/x402.json string URL list is preserved.
