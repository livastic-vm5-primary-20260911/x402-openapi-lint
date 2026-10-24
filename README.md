# VM5 x402 OpenAPI Lint — paid API pilot


## Agent marketplace discovery — registered 25 October 2026

**[Open VM5's registered Poncho / x402scan merchant page](https://tryponcho.com/m/vm5-openapi-x402.onrender.com)**

This is an **existing**, AI-assisted, one-owner merchant selling Base native
Circle USDC x402 services, not a wallet custodian or exchange. The publisher's
registration UI confirmed the current origin with **39 resource registration
records**, 7 publicly unprotected endpoints skipped, and 1 legacy listing
deprecated. The on-origin OpenAPI separately describes **21 paid operations**
and 25 ungated routes. A registration count is not the number of paying buyers.

The official @agentcash/discovery v1.7.5 CLI now recognizes the original
paid **ERC-20 event decoder** route with GET, 0.01 USD, x402 payment.
The older L3_NOT_FOUND result disappeared after the original, no-fee
merchant-origin registration. This validates discoverability, **not** a
settled purchase or a sponsor payment:

- **Free (fictional-only) preview:** [ERC-20 event example](https://vm5-openapi-x402.onrender.com/v1/erc20-event-sample).
- **Paid API (unpaid HTTP 402 returns terms):** [ERC-20 event decoder](https://vm5-openapi-x402.onrender.com/v1/erc20-event-preflight).
- **Public machine-readable catalogue:** [OpenAPI 3.1](https://vm5-openapi-x402.onrender.com/openapi.json).

No secret, checkout-card credential or third-party account is needed to read
the 402 quote. The **exact 0.010000 Base native Circle USDC** transfer is
authorized only by a willing buyer through the x402 v2 protocol on chain
eip155:8453; the original owner receiver and route's PAYMENT-REQUIRED
header must be checked *before* signing. Invalid input may be
rejected **without charging**. The application does not broadcast wallet
transactions or hold private keys.

**Commercial status:** directory listing and free preview work; this
registration by itself establishes **zero new outside purchases, zero
new buyer-attributed earned USDC and zero fiat payout**. Prior historic,
separate outside scout purchases are disclosed below and are not
recategorized as this release's sales.


## Live TapeOut x402 API — free preview, optional 0.005 USDC request

**Buyer quickstart (verified live 2026-10-23):** [Free sample JSON](https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-sample) (`GET`, HTTP 200), [free read-only X Layer explorer](https://livastic-vm5-primary-20260911.github.io/tapeout-xlayer-integrity-lens/), and [optional paid machine-readable CPU0 report](https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-report) (`GET`, unsigned HTTP 402). The live advertised quote is **0.005000 native Circle USDC per paid call on Base mainnet (eip155:8453)**, payable only with a separate buyer-signed x402 authorization to the merchant's existing public VM1 EVM recipient. Inspect the current `PAYMENT-REQUIRED` header before authorizing; do not paste wallet secrets or payment signatures into issues.

```sh
curl -i https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-sample
curl -i https://vm5-openapi-x402.onrender.com/v1/tapeout-cpu0-report
```

**Verified marketplace listing (one platform test purchase):** [TapeOut CPU0 on PayAPI Market](https://payapi.market/api/tapeout-x-layer-cpu0-on-chain-integrity-report) is **live** at **0.005000 native Circle USDC on Base (eip155:8453)** with **1 settlement-verified route** as of 23 October 2026. The marketplace operator reported one real paid and successfully delivered HTTP 200 canary at 07:01 UTC, referenced by transaction hash 0xd0b5256095716d295ce6e7eaee6b5ad2ba47a096422bd3949c718f9d42c0024b. Buyer agents can find the route through the [PayAPI MCP catalogue](https://payapi.market/mcp). This third-party seller-verification canary is **not evidence of repeat organic customers, realized fiat, or independently finalized beneficiary token receipt**.

**Commercial and verification disclosure:** This seller-operated product can financially benefit the same beneficial owner as the public article and explorer. Free examples require no wallet. An HTTP 402 quote, catalog listing, facilitator-reported payment or local mock payment is **not** independent evidence of customer demand or finalized funds received. PayAI reported **2 settled requests within 24 hours** for this exact TapeOut route as of 2026-10-23 07:46 UTC; one has the above marketplace-operator verification reference. A narrowly targeted public Base RPC receipt read returned HTTP 403, so **neither payment has been independently reconciled to a unique finalized native Circle USDC Transfer to the original VM1 beneficiary** in this review; no separately attributable recurring external customer is asserted. The API gives public-chain observations and limitations, **not** a security audit or investment recommendation.


**NEW source-only candidate — NOT YET DEPLOYED TO RENDER (verified HTTP 404 on 2026-10-20 UTC).** USDC invoice/transfer CSV exceptions. [Exact original machine-buyer quickstart](docs/BASE_USDC_INVOICE_RECON_X402_BUYER_QUICKSTART_20261020.md) documents FREE invented `GET /v1/invoice-reconcile-sample` and independently buyer-signed x402 **0.005 native Base Circle USDC** `POST /v1/invoice-reconcile` on two expressly authorized NONCONFIDENTIAL CSVs. It identifies reported duplicate transactions, partial and pending rows, shared wallet ambiguity, and orphan transfers. Hosted means buyer input is transmitted; users with confidential data should prefer the existing separate FREE offline browser product. This does NOT independently verify real blockchain finality, invoice payment, user account ownership or tax. **No external buyer payment of this new product has yet been confirmed; do not attempt payment until live deployed route, quote and recipient are independently verified.** Public original source derives from the same-owner MIT local CSV code, 190 test suite checks including locally simulated x402 paid HTTP200 without USDC movement.



**NEW candidate paid tool:** [GitHub Actions workflow-risk static analyzer](docs/WORKFLOW_RISK_PAID_BUYER_QUICKSTART_20261020.md) — free fully synthetic `GET /v1/workflow-risk-sample` and independently paid `POST /v1/workflow-risk`, **0.20 native Circle Base USDC** per valid x402 v2 call. This reuses the original SAME beneficial owner VM2 [MIT `apify-workflow-guard` analyzer](https://github.com/livastic-vm2-primary-20260911/apify-workflow-guard) with full copyright notice. **No real external buyer or revenue has been verified for this newly created route.** Do not confuse the localhost mocked facilitator tests with finalized external USDC funds or transfer private workflow secrets.


**Use your OWN CSV:** The original live [0.005 USDC customer-input CSV structural preflight](docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md) accepts an actual 32 KB-or-smaller JSON CSV at **POST /v1/csv-preflight**. [Inspect a free synthetic request example](https://vm5-openapi-x402.onrender.com/v1/csv-sample) before paying. Invalid input is rejected without charge; a valid unpaid request receives an authentic Base-USDC HTTP 402 quote. The paid static GET report is different from processing a customer's dataset. No real paid POST customer is verified.

**New, live 2026-10-19: [0.005 Base USDC public-domain MX/SPF/DMARC configuration preflight](docs/EMAIL_DNS_PAID_PUBLIC_SERVICE_20261019.md)** — optional domain input, HTTP 402 on valid paid requests and HTTP 400/404/503 on invalid/unavailable DNS before payment. [Free synthetic preview](https://vm5-openapi-x402.onrender.com/v1/email-dns-sample). This new route has **zero independently proven paid orders**; do not confuse it with the two earlier NoHumans scout purchases.

AI-agent-callable OpenAPI documentation lint: **0.01 USDC per valid lint invocation** on Base (chain 8453), using x402 v2. Runs Redocly 2.64.1 recommended rules against YAML/JSON and returns structured severities, rule IDs, JSON pointers, messages, error/warning counts and an overall lint validity flag.

**Launch status 2026-10-19: TWO separate genuine paid x402 API deliveries totaling 0.015 native Base Circle USDC.** ONE independent NoHumans automated paid verification scout paid 0.010000 for the original OpenAPI template and a separate 0.005000 for the synthetic CSV quality report. They are TWO on-chain USDC transfers, NOT two organic paying human customers or recurring subscriptions. Fiat USD bank cashout remains 0, true post-cost profit unknown. [First template receipt](docs/FIRST_ACTUAL_PAID_SALE_20261019.md) and [second CSV receipt](docs/SECOND_ACTUAL_PAID_CSV_SALE_20261019.md) include source and Base transaction proof. All other routes have no proven paying buyers. Mock test payments never count.\n
**true402 third-party catalog correction (not a new customer):** The free first-party [seller manifest](https://vm5-openapi-x402.onrender.com/.well-known/x402-service.json) reflects the live runtime payment facilitator for the existing 0.010000 USDC OpenAPI-template product, instead of its stale 17 Oct discovery fallback. Existing registry ID [7461d9b8-1e1c-4c1a-ab2d-cb0059f8fc33](https://true402.dev/api/v1/services/7461d9b8-1e1c-4c1a-ab2d-cb0059f8fc33). The manifest is free and contains only public payment metadata; it does not change the existing paywall, customer charge, payout recipient, wallet, or verified original past paid transactions. Third-party directory ranking cannot recognize our direct-wallet settlement history and should remain trustScore 0. New cash from publishing a manifest is 0.

**Additional on-chain receipt (20 Oct):** A NEW distinct external transfer of **0.005 native Base Circle USDC** reached the original VM5 merchant wallet after the two independently verified delivered calls above. This is real token receipt, but the specific paid API URL and HTTP 200 delivery were **not proven** by public PayAI aggregate counters. VM5 total received native Base USDC is now **0.020000** across three distinct transfers, ONE-OWNER fleet total with VM1 HashN is **1.020000** across four. [Auditable third transfer and delivery caveat](docs/THIRD_NATIVE_BASE_USDC_RECEIPT_DELIVERY_UNATTRIBUTED_20261020.md). No bank cashout or post-expense profit confirmed.

**Original technical build log and disclosure:** [How I tested the x402 payment lifecycle without faking revenue](https://dev.to/livasticvm5primary20260911/a-002-x402-api-for-openapi-linting-what-i-actually-tested-47jf).

## Free sample and paid call

- GET /health — public readiness, no charge
- GET /v1/docs — API contract, recipient, external facilitator, limits and privacy
- GET /v1/sample — full public sample report, 0 errors and 2 transparently disclosed advisory warnings, free
- POST /v1/lint — paid x402 0.01 USDC per request. JSON envelope contains a spec string (64,000 UTF-8 bytes max) with an OpenAPI 3.x YAML/JSON document.
- POST /v1/analyze-glb — **new paid x402 0.01 USDC original GLB 2.0 geometry audit**, for machine clients. JSON request is \`{"glbBase64":"<canonical base64 encoded GLB binary>"}\`, max 1.5MB original GLB. Returns mesh/primitive/triangle/vertex/material/image counts, declared model-local bounds, transparent warnings and explicit limitations after actual valid x402 payment. Invalid, malformed, oversize or external-resource-based GLB is rejected before any 402 charge. No submitted binary, customer texture/model or private source is written to disk by the application. Not a full glTF compliance check, malware scan, copyright guarantee or render benchmark. **Paid settlement has NOT been proven with an independent buyer**.
- GET /v1/glb-sample — free metadata example from two original unsold procedural portfolio meshes (380 and 228 triangles), not an indication of customer demand or a paid receipt.
- GET /v1/x402-template — **new paid x402 0.01 USDC reference artifact**, no input required: returns an independently authored OpenAPI 3.0.3 x402 v2 Base-USDC payment API template together with the pinned Redocly 2.64.1 recommended-rule validation report (0 errors, 0 warnings). This is a DESIGN template, not an operational API or security certification. A client may use this paid machine-readable starter to implement its own honest 402 challenge.

**Permanent primary API:** https://vm5-openapi-x402.onrender.com — deployed on Render free compute, which may sleep between requests (wake-up can take 50 seconds or more). Cloudflare Quick Tunnel backup: https://livastic-vm5-primary-20260911.github.io/x402-openapi-lint/live.json . Use an x402 v2 client to POST {"spec":"openapi: 3.0.3\ninfo: {title: Example, version: '1'}\npaths: {}"} with Content-Type application/json. The first request gets HTTP 402 with Base USDC address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, amount 10000 atomic units, and payTo receiver 0x6b01efA0705E91a7aca54271510bf9e594717f34.

**Legacy directory compatibility:** the paid GET `/v1/x402-template` returns its exact public x402 v2 payment requirements in both the canonical base64 `PAYMENT-REQUIRED` header and a matching JSON body. An `X-Payment-Required` alias carries exactly the same base64 bytes for legacy catalog probes. The canonical header remains authoritative for wallet clients, and the extra unauthenticated quote never substitutes for an actual signed, settled USDC payment. This mirror does not alter POST `/v1/lint`, onchain proof routes, or the facilitator.

A buyer who accepts the amount signs an EIP-3009 authorization in its **own** wallet and resends the request with PAYMENT-SIGNATURE. The service delegates verification and settlement to https://facilitator.openx402.ai; VM5 does not receive or use the buyer's private key.

Successful paid invocation returns a Redocly findings report. Bad YAML, external references, oversized input and invalid JSON envelope get 400 or 413 **before** reaching the paywall. A syntactically valid but low-quality OpenAPI specification may yield Redocly lint errors; documenting those defects is the service being sold. No secret specs or confidential data should be submitted.

**Additional zero-fee discovery:** Registered with Agent402 (seller is listed, routable with one paid route) and [402 Index](https://402index.io/api/v1/services/2f13b34e-d85b-43d9-b2d4-d3b4047641fc) (HTTP 201 registration and verified domain claim, public listing active/healthy). x402scan remains the original index at https://www.x402scan.com/server/7674c5b5-4645-4f5a-9b08-d7b8af61fd21. Being indexed does **not** prove a sale or real settlement.

## Aave V3 Base Pool implementation facts — new original DeFi read-only product (AI-assisted)

`GET /v1/aave-base-proxy-sample` is a clearly fictional, **FREE** example (never a live security result or paid receipt). The original VM1-funded merchant offers `GET /v1/aave-base-proxy-facts` (default Pool) and `GET /v1/aave-base-proxy-facts?component=configurator` (only one of TWO fixed legitimate Aave Base addresses), for **0.010000 native Circle Base USDC per successful x402 v2 request** to the same original VM1 receiving address `0x4e3106520E40af30870caFE78da1B1e7110eD98E`, network Base8453. Anyone can inspect the free preview and unsigned 402 quote; a purchase requires an independent client wallet authorization and is **not made by reading this documentation or free preview**.

It reports exactly one pinned Base chain state for published [Aave official V3 Base addresses](https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol), standard [ERC-1967](https://eips.ethereum.org/EIPS/eip-1967) `implementation`, `admin`, `beacon` storage slots, the code size and **SHA-256 (not `EXTCODEHASH`)** of the proxy/implementation bytecode, and whether the implementation matches the address last published in the primary-source Aave address book. Fixed Base JSON-RPC destination, no arbitrary external URLs or customer-supplied contract addresses, bounded 3 public RPC batch calls, source-read concurrency <=2, per-client3/min. Source/network/code preflight must succeed before any x402 402; failure is free HTTP400/429/503. No wallet keys, private customer data, mainnet transactions, signing, custody, upgrade calls, safety/permission certification, monitoring subscription or trade advice.

IMPORTANT: A `null` EIP-1967 admin slot **does not mean no governance or no upgrade authority**. Contracts can implement other patterns. A first-party address-book mismatch can mean an update is pending or has occurred; it is not evidence of exploitation. The purchase is for convenient machine-readable public facts that users can independently fetch from RPC for free. **No independent paid buyer or positive net income is claimed for this newly introduced route** until separately proved.

## Run and test

Requires Node 22+. From this directory:

    npm ci --no-audit --no-fund
    PORT=8736 npm start

Test unauthenticated quote (no money sent):

    curl http://127.0.0.1:8736/v1/sample
    curl -i -X POST http://127.0.0.1:8736/v1/lint -H 'Content-Type: application/json' -d '{"spec":"openapi: 3.0.3\ninfo: {title: Demo, version: \"1\"}\npaths: {}"}'

Full offline test with mock facilitator, no keys or USDC spent:

    npm test

Latest VM5 local tests include the dedicated GET template, isolated mock x402 payment verification, and the original POST lint parity tests; results must be re-verified after each deployment. This includes a **test-only localhost fake facilitator** that simulates success and rejects an invalid marker, exercising the complete middleware/Redocly/response path **without real payment**. The fake facilitator is not bundled into the production server and is never a public endpoint. npm audit --omit=dev reported zero vulnerabilities at the same time; this is not a guarantee against future advisories.

## New native Base Circle USDC receipt verification — priced in USDC

**Free buyer preview:** https://vm5-openapi-x402.onrender.com/v1/receipt-sample — a completely invented but clearly labeled JSON fixture showing expected query inputs, proof fields, network/token and limitations. No buyer wallet payment or RPC, customer receipt, claim of an actual transaction, or hidden charge. The associated paid GET /v1/base-usdc-receipt still costs 0.005 native Base Circle USDC only after a successful genuine public receipt preflight. This receipt verifier has **zero independently verified paid customers** as of publication. The other two routes' historic 0.015 external-scout receipts do not apply here.

- Paid GET /v1/base-usdc-receipt: **0.005 USDC**, i.e. 5,000 atomic Circle native Base USDC (six decimals).
- Parameters: tx (0x-prefixed 32-byte transaction hash), recipient (0x-prefixed EVM wallet), minUsdc (positive decimal with up to six places), optional sender (expected token transfer-from address).
- Only correct chain 8453, correct native USDC (not bridged USDbC), successful transaction, at least 12 observed blocks, exact token logs, positive net USDC transfer and optional sender minimum qualify for the 402 challenge.
- Public reads to the single configured RPC https://1rpc.io/base are strictly eth_chainId, eth_getTransactionReceipt and eth_blockNumber. User cannot supply an RPC hostname, contract, chain or callback.
- Missing transactions return HTTP404, failed 409, wrong token or insufficient net amounts 422, unconfirmed 425, and provider outages 503 **before payment**. A bad query is unpaid 400. IPs have 12 receipt preflights/minute and at most 2 are processed in parallel. No arbitrary RPC retries or private user data.
- Example (the placeholders are not real public transactions):

      curl -i 'https://vm5-openapi-x402.onrender.com/v1/base-usdc-receipt?tx=0x<64-hex>&recipient=0x<40-hex>&minUsdc=1.000000'

- Only a real independent x402 client payment can unlock the JSON proof. The service never signs a user wallet, spends funds, charges gas, assumes custody, or accesses seed/private keys.
- A valid token Transfer event is NOT proof of invoice intent, buyer legal identity, non-reversibility or full payment finality. The 12-block confirmation window is heuristic. Public chain transaction and wallet data sent to the public RPC may be visible to that upstream provider.
- Original local test suite for the now-expanded service **87/87 PASS** with a mock facilitator and local mock Base JSON-RPC, 0 real test USDC. A separate **read-only historical third-party Base USDC transaction** passed the same proof logic with 48 confirmations, but its money went to an unrelated public wallet, NOT to VM5. That was an earlier historical local-test-only snapshot before the later two real buyer-funded transactions shown at the top of this README.

## Safe operations

- Binds localhost 127.0.0.1 only; a separate Cloudflare Quick Tunnel makes it accessible, without an availability SLA.
- No remote references, file paths, third-party API calls or runtime scans are attempted with the customer's specification.
- Validates payload before requesting payment; 64k byte limit, 18k node bound, nesting depth 90, two in-flight checks, temporary private files removed in finally.
- No telemetry or app-level storage of submitted specs, payment headers or IP addresses beyond temporary in-memory throttling. The tunnel and facilitator are separate providers with their own operational logging.
- Free sample is original JSONPlaceholder QA with 2 disclosed warnings.
- Exactly one original x402 template GET paid 0.01 native Base Circle USDC and delivered to an independently funded NoHumans scout. Other endpoint settlement remains unverified; a quoted 402 alone never proves revenue or delivery.
- x402 List's catalog does not permit temporary trycloudflare or static github.io API URLs. Do not bypass listing rules or pay a registration fee.
- Do not provide passwords, sensitive specs, user data, seeds or money for testing. No fabricated customers or revenue.

The receiving address is VM5's original authorized Base native Circle USDC payout wallet, different from the original VM1 MetaMask. One 0.01 USDC independent paid template GET was credited on-chain on 2026-10-19; this is an observed token receipt, not a current full wallet balance, USD bank cashout or final operating profit.

This original service is distinct from the [free local-only OpenAPI checker](https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/api-preflight/) and from VM2's separate workflow risk check. MIT-licensed code, disclosed AI assistance.
\n## Machine-to-machine 3D asset audit (0.01 native Base USDC)

An agent that legally owns the GLB file can send its **own canonical Base64** GLB 2 file (up to 1.5MB) to the new \`POST /v1/analyze-glb\`. Successful **independently funded** x402 authorization and actual facilitator settlement are required before returning the analysis report. The free \`/v1/glb-sample\` shows the report value proposition using self-created original 3D models with no private original asset download. No customer-uploaded GLB is forwarded or saved by the application; your HTTP provider / reverse proxy / facilitator have separate data practices. In particular, do not send confidential game assets unless you accept those infrastructure risks.

Use a legitimate x402 v2 client; an unsigned request for a valid GLB returns HTTP402 with \`PAYMENT-REQUIRED\`. A compliant payer's wallet authorizes one exact 0.01 **native Circle Base USDC** transfer to the published VM5 recipient and resends the same request with \`PAYMENT-SIGNATURE\`. VM5 holds no buyer key and never pays gas on their behalf. Test-fixture payments in the repository are **NOT real transactions**; there are no verified independent customer purchases until an actual on-chain settlement receipt is recorded. No identity/KYC is represented by a wallet alone.

Security bounds: canonical Base64 only, version2 GLB header, exactly one embedded buffer, up to two JSON/BIN chunks, hard file cap, bounded mesh/accessor/material counts, byte-range checks. Reject remote buffer/image URIs and sparse accessors. Check application status and limitations, not merely HTTP200, before buying. Model geometry metadata/declared local bounds do not prove the model can be safely animated, rendered on every mobile GPU or used commercially.


## Original seed-based low-poly GLB generation (0.05 USDC)

A small deterministic GET product for x402 agents buying original, non-exclusive
game-asset utility on the original VM5 Base USDC seller (no new infrastructure cost).

* Free offer metadata:
  GET https://vm5-openapi-x402.onrender.com/v1/lowpoly-sample
* Buyer-payable generated GLB:
  GET https://vm5-openapi-x402.onrender.com/v1/generate-lowpoly
* Optional parameters: kind=lantern or kind=marker; seed=0..999999 (default
  lantern/0). For example:
  GET /v1/generate-lowpoly?kind=marker&seed=91
* Correct request first gets HTTP 402 with canonical PAYMENT-REQUIRED for
  50000 native Circle Base USDC atomic units = 0.05 USDC. Buyer must sign
  with their own wallet; only successful real facilitator settlement delivers.
* Paid JSON includes fileName and glbBase64 plus SHA256, geometry/material
  details, licensing disclosure and code-generation provenance. Decode base64
  into a binary .glb to use it. 6 representative generated files successfully
  parsed with actual Three.js GLTFLoader, including correct triangle counts.
* Generated meshes are simple original AI-assisted procedural vertices and
  flat colours, no downloaded copyrighted game art, remote assets or private
  customer data.
* CRITICAL: The generator code is public source in this repository. Buyers
  pay for the convenient hosted binary generation and delivery service, NOT
  exclusive or proprietary source code, guaranteed uniqueness, buyer reviews,
  exclusive copyright or market traction. Any nonexclusive commercial right
  granted is strictly limited to rights legally held and licensable by the owner.
  Unity or Blender import performance has NOT been verified. No client-paid
  games or standalone game assets have been delivered yet.
* A passing test-mode fake facilitator and valid HTTP402 quote DO NOT verify
  any actual on-chain purchase or final owner payout. Only an independently
  confirmed customer settlement is new revenue, with no self-funded testing.

Unlike POST /v1/analyze-glb, this GET route needs no buyer-provided GLB bytes
and is compatible with free x402 crawler discovery that performs unpaid GETs.


## CDP Bazaar discovery compatibility (pre-indexing, not revenue)

Our original x402 resource server registers the official Bazaar server extension
from pinned @x402/extensions. Existing GET /v1/x402-template ($0.01 Base native
Circle USDC, no request inputs) and GET /v1/generate-lowpoly ($0.05, optional
query but valid without inputs) expose extensions.bazaar in the HTTP402
PAYMENT-REQUIRED response, with an accurate machine-readable JSON output example.
This improves discovery without changing the payee, token, chain, accepted
amount or actual settlement.

Coinbase CDP publishes a free, read-only seller preflight:

POST https://api.cdp.coinbase.com/platform/v2/x402/validate
Content-Type: application/json
{"resource":"https://vm5-openapi-x402.onrender.com/v1/x402-template","method":"GET"}

Technical validation must return valid:true and simulation.outcome:accepted.
That is not a buyer purchase, Base USDC receipt, or Bazaar indexing.
Coinbase requires a separate genuinely independent real customer payment
successfully settled through the CDP Facilitator to index a resource.
Another directory's listing, HTTP402 price challenge, local simulator and
unsigned payment request do NOT satisfy the CDP indexing requirement.

The merchant still uses its original facilitator. Switching to CDP requires
legitimate developer API credentials and compliant authorized configuration,
plus independently verified real settlement. Never fabricate identity/KYC,
print bearer/private keys, sign the owner's MetaMask, fund own test purchases,
or represent metadata/probes as real revenue. Preserve existing working
native Base USDC payment routes while that blocker is unresolved.


## Demand-backed CSV data quality preflight — 0.005 native Base USDC

The NoHumans public search demand report at
https://api.nohumans.directory/v1/demand shows independent search requests
for "csv preflight" and related CSV quality checks. Public search queries
are not a guaranteed or already paid customer order.

Free synthetic test data / offer: GET /v1/csv-sample
Paid complete structured synthetic CSV report: GET /v1/csv-report
Paid actual caller CSV quality preflight: POST /v1/csv-preflight

Both paid routes cost **0.005 native Circle Base USDC per valid x402 call**.
The GET demo uses a harmless, openly disclosed synthetic dataset with
duplicate rows, a malformed width, missing values, invalid email/amount/date
and one formula-risk cell; source data and generator code are public.
Purchase pays for convenient machine-readable hosted structured output,
not exclusive intellectual property or prior customer work.

The POST accepts JSON containing "csvText" (UTF-8 CSV up to 32KB), and
optional "expectedColumns" (list of up to 40 expected headings).
Example JSON: {"csvText":"email,amount,date
qa@example.com,5,2026-10-19",
"expectedColumns":["email","amount","date"]}.
Limits: max 500 data rows, 40 columns, 4096 characters per cell. Malformed
quoting, illegal extra input keys and oversize requests are rejected before
any 402 payment requirement. A correctly encoded CSV containing defects is
a valid *paid report*, rather than a rejection; clients should not be
charged for syntactically malformed data.

Results report duplicate normalized rows, missing values, mismatched
column counts, leading/trailing whitespace, spreadsheet formula-risk
prefixes and heuristic email/numeric/ISO-date format issues. Potentially
dangerous spreadsheet cell prefixes include equals, plus, at-sign and
non-numeric minus. The application does NOT execute input formulas.
No original data row cell values are emitted in the paid report; sanitized
column header labels and anomaly row/column indices may be returned.

**Privacy and scope limitations:** CSV text is processed in-memory without
application-level persistent CSV storage. Reverse proxies, hosting vendors
and payment facilitators are independent processors with their own logs.
NEVER submit passwords, confidential commercial data, regulated personal
information or wallet seeds. Structural preflight does NOT validate data
truth, full Excel compliance, financial audit, malware or legal/GDPR
compliance. The server only returns a bounded, explicitly heuristic report.

These are new products, not proof of new paid buyers. The already verified
first 0.01 Base Circle USDC NoHumans purchase paid for a different original
GET x402 template API and remains booked exactly ONCE across all VMs.


## Original VM3-authored x402 unsigned quote QA hosted by VM5 — new paid 0.01 USDC product

An original source archive was provided by the same economic owner operating VM3 and VM5. Its public MIT source is at https://github.com/livastic-vm3-primary-tmp-260920/vm3-x402-quote-preflight ; VM5 reviewed the copied original analyzer and preserved its first 12 unit tests. Public original archive SHA256 24d6750dd5c14c66fbd11cade5f387a8df2c4ed43f6d2b295c821a73ca413015 . The deliberately fictional demo wallet is 0x1111111111111111111111111111111111111111, which is NOT the real recipient.

- GET /v1/x402-sample is completely FREE: harmless fictional Base x402 v2 402 quote and structural analysis. No actual seller, wallet signature, or payment.
- GET /v1/x402-preflight charges 0.01 NATIVE Circle Base USDC to the SAME original VM5 receiving merchant wallet through existing x402 v2 facilitator. With no query, returns hosted structured report on a fictional default. An optional public unsigned query parameter quote accepts JSON or Base64 up to 12,000 characters. Duplicate, malformed, secret-bearing or excessively long inputs are rejected BEFORE any 402 payment challenge. Never send private or signed payment data.
- Original code checks version, acceptance count, exact scheme, Base chain8453, native USDC asset, atomic amount, public payTo ADDRESS FORMAT, and public HTTPS resource URL FORMAT. It does not contact the resource URL, check merchant trust, independently attest payTo ownership, verify actual payment or delivery, or provide security/compliance certification.

This is one human-owned AI-assisted x402 report-product hosted by VM5, not server/CPU/GPU/VPS resource rental. NO independently paid buyer has purchased this new quote QA endpoint as of release; pre-existing two NoHumans scout purchases totaled 0.015 native Circle Base USDC for OTHER template and CSV products and are not sales of this product. No buyer funds, seller signing key, fees or private credentials were accessed during development.


## Free machine-readable service discovery

[Public /llms.txt](https://vm5-openapi-x402.onrender.com/llms.txt) enumerates each current original x402 paid API with canonical Base Circle USDC price, input preflight restrictions, no-charge sample, public paid-delivery proof and conservative no-recurring-customer disclaimer. This text and every free sample are publicly readable, **not charged** and not new paid buyers. Providing it may improve ForgeMesh discoverability after the scheduled independent probe but does not guarantee a score, listing, purchase, or cashout.


## New original 0.001 Base Circle USDC x402 payment handshake

**Paid GET https://vm5-openapi-x402.onrender.com/v1/ping** provides a minimal genuine x402 v2 exact payment integration test for legitimate independently funded thirdparty clients. The unpaid request gets HTTP402 with the canonical PAYMENT-REQUIRED header and 1000 atomic native Base Circle USDC units. A client that signs a payment using its own wallet, settles through the existing unchanged facilitator, and retries may receive a concise 200 JSON response and PAYMENT-RESPONSE. The response only asserts successful service access after its payment middleware; it does not independently audit blockchain finality, identify a buyer, or certify a separate invoice. No secret keys or query input. Unwanted query/body rejected with HTTP400 before a charge. The service has ZERO new independently verified paying users at publication. Historical VM5 other-endpoint 0.015USDC came from ONE unrelated NoHumans automated scout on two calls, not users or income of this new ping route. No user cash or wallet gas is spent on tests or promotion.

## Base native USDC receipt RPC availability (October 2026)

Original 0.005 native Circle Base USDC receipt validation uses only the documented public mainnet read-only RPC https://public.1rpc.io/base. For transient transport errors or HTTP 429/5xx, one independent fixed Base public endpoint https://mainnet.base.org may serve as a bounded read-only backup. Both services are public and rate-limited, so uninterrupted production uptime is not guaranteed. HTTP 403 access denials, malformed RPC responses, failed or unfunded transactions, incorrect network and invalid inputs fail before payment; the fallback never changes to arbitrary hosts or sends/signs transactions.

Existing price, seller wallet, Base8453 native Circle USDC token, x402 exact payment middleware and original API routes are unchanged. All 7 deterministic offline failover and access-denial tests run as part of npm test. A healthier external directory status or successful HTTP402 is not real revenue; only new unique finalized external native Circle Base USDC receipts, with evidence of actual independently paid successful API delivery, qualify as attributable paid sales.


NEW 2026-10-23 — independent read-only X Layer TapeOut genesis CPU on-chain snapshot (no buyer yet): FREE GET /v1/tapeout-cpu0-sample; paid GET /v1/tapeout-cpu0-report quotes exactly 0.005 native Circle USDC on Base8453 to the **original owner VM1 MetaMask** 0x4e3106520E40af30870caFE78da1B1e7110eD98E. Existing x402 products still use separate former VM5 merchant payTo, unchanged. Complete pinned public X Layer state is computed before quote; errors yield no payment request. Paid response after genuine buyer authorization is structured JSON, not a security audit or guarantee of custody/settlement. Free full self-serve explorer: https://livastic-vm5-primary-20260911.github.io/tapeout-xlayer-integrity-lens/ . No independent paid customers verified for this new route.


### Settlement receipt observability for the original VM1-paid TapeOut route

The original seller's single GET /v1/tapeout-cpu0-report includes a
**merchant-private, read-only** receipt observer in tapeout/settlement-audit.mjs.
After a response finishes, an HTTP 200 with a canonical x402 PAYMENT-RESPONSE
indicating success:true, Base eip155:8453 and a well-formed public transaction
hash generates a short [tapeout-facilitator-receipt] line in the owner's
authenticated Render application logs. It includes only product path,
public transaction hash, network, advertised nominal price, and explicit
unverified finality/buyer flags. It never logs signatures, buyer IP/identity,
payment nonce, full headers, or request bodies. It is disabled in NODE_ENV=test,
so fake local facilitator hashes cannot enter real income logs. It creates no
public customer or receipt-query endpoint.

**A facilitator-reported successful payment is not independently verified
beneficiary finality or a new unique external customer.** Any financial ledger
must match the public hash plus a unique token Transfer log index, the native
Circle Base USDC contract, the original VM1 payTo, exact amount, chain, finality,
and payer independence using a permitted reconciliation path; never double-book
the same receipt or older already-counted customer funds.

This is prospective only. Earlier on 23 October the PayAI public resource
stats reported one settlement in the past 24 hours at around 09:19 KST for
this route, but did not expose a unique tx hash. Adding this observer later
cannot reconstruct that past transfer or prove beneficiary receipt. The
payment middleware, facilitator, 0.005 USDC price, 14 existing paid resources
and all original wallet recipients remain unchanged.

## New read-only public BTC/USDT perpetual funding compare (x402; original VM1 beneficiary)

The merchant also offers an original, four-venue **public market-data quote comparison** from four actual BTC/USDT perp exchanges (Binance/Bybit/OKX/Bitget with named MEXC/Gate.io regional failover). Free fictional schema: [GET /v1/btc-funding-sample](https://vm5-openapi-x402.onrender.com/v1/btc-funding-sample). Paid fresh snapshot: [GET /v1/btc-funding-four-venues](https://vm5-openapi-x402.onrender.com/v1/btc-funding-four-venues), priced **0.01 native Base8453 Circle USDC** to the original VM1 public payee via standard x402 v2. Four complete upstream reads are required **before** issuing a payment challenge; any failed/stale feed returns HTTP503 and requests **no** buyer payment. Upstream rates are quotes with different schedules, not guaranteed yields or risk-free arbitrage. This offer has **zero independently verified buyer purchases** on publication. Source, validation and safety details: [funding/README.md](funding/README.md). Existing paid API prices and pre-existing payout wallets are unchanged.

## Free read-only manifest for genuine x402 directories

Public `GET /.well-known/x402-bazaar-manifest.json` returns an x402Version 2 document with **21 actual paid resource objects** (`url`, `resource`, `method`, `description`, `accepts[]`), assembled from the same middleware as the live APIs. This is usable as a manifest URL in no-fee x402 directories (such as the independent [Agent Bazaar publishing guide](https://bazaar.saylorinnovations.com/publish/)). It does not touch user wallet keys, paid middleware or existing catalog `/.well-known/x402.json` legacy string URLs. Directory acceptance and real buyer purchases require separate evidence; neither is implied by this file.

## ERC-20 unsigned calldata preflight (new VM1-payee 0.01 USDC product)

Original, strictly offline decode of **public unsigned** ERC-20 ABI calldata. Unlike our
live receipt checker, this product requires **no RPC** and makes **no network or wallet calls**.
It accepts `transfer`, `approve`, `transferFrom` and the common
`increaseAllowance` / `decreaseAllowance` ABI selectors, converts raw uint256
amounts without guessing token decimals, and flags a zero address or
`approve(spender, type(uint256).max)`. It does **not** confirm that a target
contract supports that method, holds real balances, or is safe. It never
requests a seed, token approval, MetaMask connection, or private signing key.

A completely free fictional preview (no payment, no wallet, no claims of buyers):

```bash
curl -sS https://vm5-openapi-x402.onrender.com/v1/erc20-calldata-sample
```

Paid independent buyer use: `GET /v1/erc20-calldata-preflight?calldata=0x...`
with an optional URL-encoded, **nonsecret and unsigned** canonical ABI hex string
(max 202 characters). Omitting `calldata` decodes the same expressly synthetic
sample after the buyer's payment. Invalid input, unknown method selectors,
noncanonical address padding and unrecognised query/body fields return HTTP
400 **before** issuing an x402 payment requirement.

An unpaid request to the exact paid route produces the canonical x402 v2
`PAYMENT-REQUIRED` challenge (also mirrored verbatim in a JSON 402 body for
older agent directories). A genuinely authorized buyer obtains a structured
JSON report after x402 middleware settlement. The fixed price is **0.010000
native Circle USDC on Base mainnet 8453 per paid GET**; the recipient is
the original **VM1** user MetaMask public address
`0x4e3106520E40af30870caFE78da1B1e7110eD98E`. Existing independent
VM5 merchant SKUs and their existing payment recipients were not changed.

This service is a convenience preflight for developers, not blockchain
simulation, an ERC20 allowance query, identity verification, financial
advice, or a security audit. No organic buyers, paid calls, or cash for
this new route have been proven at publication. Local test fixtures
mock the facilitator and do **not** spend real tokens.

## New independent ERC-20 **event log** preflight (0.01 Base native Circle USDC)

Use the completely free and **fictional** example:

```bash
curl -sS 'https://vm5-openapi-x402.onrender.com/v1/erc20-event-sample'
```

The new distinct paid endpoint `GET /v1/erc20-event-preflight` evaluates
four optional, *public and unsigned* canonical event log words `topic0`,
`topic1`, `topic2`, and `data`, all together or all omitted. An
omitted query yields the same clearly fictional sample under the standard
x402 paywall. It recognizes `Transfer(address indexed,address indexed,
uint256)` and `Approval(address indexed,address indexed,uint256)` and
reports raw uint256 values, decoded addresses, maximum uint256 approvals
and zero-address warnings. **This reads log data, NOT call input** and is
therefore a separate product from `/v1/erc20-calldata-preflight`.

Strict wrong-length words, noncanonical address padding, NFT
indexed-topic formats, non-ERC20 signatures, duplicate/unknown/incomplete
query parameters and any request body return HTTP **400 before** an x402
payment quote. A correct unsigned query returns a true x402 v2 HTTP **402**
before settlement; genuine client-authorized paid HTTP200 reports require
actual server middleware settlement. Price **0.01 native Circle USDC on
Base 8453** to the same original VM1 owner MetaMask public address
`0x4e3106520E40af30870caFE78da1B1e7110eD98E`. No signed
transactions, approvals, wallet connection, RPC queries, seed keys, or
outgoing user funds are needed to explore the free example.

The parser does **not** prove a log was actually emitted, the claimed
token is ERC-20, token decimals, current spender allowance, contract
identity, transaction finality, customer intent or any security property.
NFT Transfer/Approval indexed tokenID layouts are expressly outside
scope. Do not treat a clean report as a security endorsement. **No
independent organic customer payments or net profit verified** for
this new SKU. All other current VM1/VM5 route payouts remain unchanged.

## Original NFT operator authority calldata preflight — distinct 0.01 Base Circle USDC API

An original AI-assisted, walletless static NFT permissions tool, developed in the VM3 workspace as a proposed contribution to the existing VM5 x402 seller. **A source commit or PR does not establish that the production seller has deployed it or that a customer has purchased it.**

- **Free synthetic preview after deployment:** GET /v1/nft-operator-calldata-sample. No chain access, wallet, signature or charge; every example is fictional.
- **Optional paid review after deployment:** GET /v1/nft-operator-calldata-preflight, requiring buyer-authorized exact **0.010000 native Circle USDC on Base chain 8453**, payable directly to the original one-owner VM1 public MetaMask payee **0x4e3106520E40af30870caFE78da1B1e7110eD98E** via standard existing x402 v2 middleware. An unpaid HTTP 402 quote is not a purchase.
- A public, **unsigned** calldata query is exactly 138 hexadecimal characters including 0x, representing 4-byte selector and two ABI words. The default omitted calldata is an explicitly synthetic example. The optional standard is unspecified, erc721 or erc1155, default unspecified.
- Decode **setApprovalForAll(address,bool)** (0xa22cb465) under ERC-721 or ERC-1155 and warn when one operator may receive **collection-wide** permissions. Refuse noncanonical ABI bool values, address padding, unsupported selectors and malformed/partial query **before payment**.
- Decode **approve(address,uint256)** (0x095ea7b3) only when the caller explicitly declares standard erc721. This selector also denotes ERC-20 approve; the parser cannot authenticate token standards. A token ID is never incorrectly described as an unlimited ERC-20 allowance.
- **Limitations:** No live RPC, smart-contract identity verification, NFT ownership lookup, simulated transaction, operator-trust score, chain signing, permission grant/revocation, wallet custody or security certification. Static bytes alone cannot establish current approvals or safe transaction intent.
- Source module: nft-operator-calldata-preflight.mjs. Dedicated offline test and mocked middleware tests: tests/nft-operator-calldata-preflight.test.mjs and tests/nft-operator-x402-paid-route.test.mjs. Locally simulated payments are fake fixtures, **not** independent sales, wallet transfers or earned USDC.

The default public synthetic setApprovalForAll example decodes operator **0x000000000000000000000000000000000000dEaD** with approved=true. Start with the free sample; do not supply recovery phrases, private keys, credentials or signed payment data as the calldata query.

## Read actual native Circle USDC allowance on Base — distinct live read-only x402 API

Our **original fixed-contract on-chain approval allowance API** is a
different kind of data product from the offline unsigned ERC-20 calldata and
event-log parsers. It fetches live Base mainnet chain 8453 JSON-RPC
`eth_chainId`, `eth_blockNumber` and **read-only** `eth_call`
`allowance(owner,spender)` + `balanceOf(owner)` from the official Circle
native Base USD Coin contract
`0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913`. It reads both values
at the same pinned public block and returns decimal-safe raw atomic values,
USDC in exactly six decimal places, an explicit max-uint256 allowance flag,
and a flag for allowance exceeding the current balance. No private key,
client secret, token approve, wallet login, swap, bridge, gas or transaction
submission.

The fully fictional, **zero-charge/no-RPC** math preview:

```bash
curl -sS https://vm5-openapi-x402.onrender.com/v1/base-usdc-allowance-sample
```

The **actual LIVE chain-state** endpoint, charge 0.01 native Circle Base USDC
only after buyer-approved x402 v2 settlement:

```bash
curl -i 'https://vm5-openapi-x402.onrender.com/v1/base-usdc-allowance?owner=0x1111111111111111111111111111111111111111&spender=0x2222222222222222222222222222222222222222'
```

Both `owner` and `spender` query parameters (strict public EVM addresses)
are mandatory as a pair, or both omitted for one known public original
VM1 example wallet vs `0x…dEaD` spender (a **real** RPC observation, not
the free fictional fixture). No user-supplied token contracts, networks,
RPC hosts or client-provided secrets are accepted. Fixed Base RPC primary
and fallback are source-controlled, with an uncharged HTTP 503 on
incomplete/rejected data; invalid input is HTTP 400 before payment; free
sampling is max 3/min/IP and two in-flight.

A genuine paid response includes chain ID, sampled block, actual public
allowance and current owner balance and risk **flags**, not a security
certification. Neither an empty allowance nor a large allowance proves
legitimacy or wrongdoing by a named spender; amounts can change the next
block and the public RPC source is not a light-client validity proof.
No verified independent customers exist for this newly launched SKU until
real distinct settlement receipts prove otherwise.

Buyer settlement is exactly **0.010000 native Circle Base USDC** to the
same original VM1 MetaMask public receive address
`0x4e3106520E40af30870caFE78da1B1e7110eD98E`, with the same existing
production x402 facilitator/middleware and without changing any other
SKU's source code, price or payee. Mock-facilitator tests cost **zero** real
user funds and are not actual consumer orders.
