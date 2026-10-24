# BTC/USDT four-venue perpetual funding quote — original VM5 x402 product

Buyer-facing endpoint: `GET https://vm5-openapi-x402.onrender.com/v1/btc-funding-four-venues`

Free illustrative preview: `GET https://vm5-openapi-x402.onrender.com/v1/btc-funding-sample`.

This original AI-assisted product reads **four public exchange funding rates** in parallel for the BTC/USDT linear perpetual: Binance USD-M, Bybit linear, OKX BTC-USDT-SWAP, and Bitget USDT Futures.

Every paid request is validated **before** the x402 v2 payment challenge: all four sources must return HTTP 200, JSON under 10,240 bytes, the exact requested market symbol, parseable signed fractional rate, a 3-minute fresh publication timestamp, and a near-future scheduled funding time. If any one source is down, invalid or stale, the server rejects with HTTP 503 **without** asking for USDC. Only a complete snapshot is offered. Successful snapshots are briefly cached 20 seconds to avoid hammering third-party exchanges for each unpaid quote.

**Price:** exactly 0.01 native Circle USDC on Base8453, x402 v2. **Payee:** the original VM1 user's public receive-only EVM address `0x4e3106520E40af30870caFE78da1B1e7110eD98E`. The buyer, not the seller, must independently decide whether to authorize the merchant payment. The code never asks for a wallet connection, signing key, exchange API key, order, deposit, borrowed assets, leverage or treasury access; all upstream requests are public read-only HTTPS GETs.

Four response entries include `venue`, quoted signed `quotedFundingRate`, percent, basis points, publication and next funding time, and where supported `intervalHours`. Source metadata and original raw decimals are preserved. **Important:** Different exchanges may define funding schedules and rates differently; Binance premiumIndex does **not** return the current funding interval, so it is intentionally `null`. Raw maximum-minus-minimum rate spread is not a risk-free arbitrage trade, annualized APR, realized income, market recommendation or an opportunity to trade. Transaction costs, exchange eligibility, liquidation risk, borrow/lend fees, funding changes and basis risks are deliberately **not modeled**. No claims of actual independent paid customer orders.

The free preview uses a clearly **fictional 2026-01-01 example**, not a current exchange quote. This repo includes unit tests with injected synthetic first-party response fixtures and independently runs a read-only real four-exchange API smoke test. Existing legacy merchant SKUs retain their own original x402 payTo and prices unchanged.

### Manual smoke without spending

```sh
curl -i https://vm5-openapi-x402.onrender.com/v1/btc-funding-sample
curl -i https://vm5-openapi-x402.onrender.com/v1/btc-funding-four-venues
```

The first MUST be HTTP200 fictional/uncharged; the second should be HTTP402 carrying a canonical x402 v2 `PAYMENT-REQUIRED` Base8453 10,000 atomic native Circle USDC quote to the original VM1 address **only when** all four upstream sources are healthy. It may return a **free HTTP503 with no payment requirement** when any exchange API is unreliable. Never send a fake payment or test-purchase from the same owner to inflate purported sales.
