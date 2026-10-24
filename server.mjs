import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import {parseAndGuardSpec,lintSpec,REDOCLY_VERSION,LIMIT_BYTES} from "./validator.mjs";
import {makeDiscovery} from "./discovery.mjs";
import {makeCatalog,queryCatalog} from "./bazaar-catalog.mjs";
import {validateReceiptQuery,preflightBaseUSDCReceipt} from "./base-usdc-receipt.mjs";
import {parseGlbBase64, MAX_GLB_BYTES} from "./glb-analyzer.mjs";
import {generateOriginalGlb} from "./procedural-lowpoly-generator.mjs";
import {inspectCsv,validateCsvInput,DEMO_CSV,CSV_LIMITS} from "./csv-preflight.mjs";
import {inspectInvoicePair,INVOICE_DEMO,INVOICE_API_LIMITS} from "./invoice-reconcile.mjs";
import {inspectWorkflow,PUBLIC_SYNTHETIC_YAML,MAX_INPUT_BYTES as WORKFLOW_MAX_BYTES} from "./workflow-risk/preflight.mjs";
import {parsePublicQuote,evaluatePublicQuote,EXAMPLE_QUOTE,VERSION as VM3_QUOTE_VERSION} from "./quote-preflight.mjs";
import {validatePublicDomain,auditEmailDns} from "./email-dns-preflight.mjs";
import {inspectPublicTlsCertificate} from "./public-https-tls-preflight.mjs";
import {getCurrentTapeoutEvidence,TAPEOUT_PAYOUT,TAPEOUT_PRICE_USDC} from "./tapeout/paid-report.mjs";
import {getLiveTapeoutStateDiff,DIFF_PRICE_USDC,DIFF_BASELINE_BLOCK} from "./tapeout/diff-report.mjs";
import {summarizeTapeoutSettlement,TAPEOUT_RECEIPT_PATH} from "./tapeout/settlement-audit.mjs";
import {readLiveFourVenueFunding,DEMO_FUNDING,FUNDING_PRICE_USDC,FUNDING_PAYOUT_BASE} from "./funding/four-venue.mjs";

const DIR=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8736);
const BIND_HOST=process.env.HOST||"127.0.0.1";
if(!["127.0.0.1","0.0.0.0"].includes(BIND_HOST))throw Error("HOST must be 127.0.0.1 or 0.0.0.0");
const FACILITATOR_URL=process.env.FACILITATOR_URL||"https://facilitator.openx402.ai";
const PAY_TO=process.env.PAY_TO||"0x6b01efA0705E91a7aca54271510bf9e594717f34";
const PRICE="$0.01";
const NETWORK="eip155:8453";
if(!/^0x[0-9a-fA-F]{40}$/.test(PAY_TO))throw Error("PAY_TO must be a valid 20-byte Base recipient.");
if(!FACILITATOR_URL.startsWith("https://") && !(process.env.NODE_ENV==="test" && /^http:\/\/127\.0\.0\.1:\d+$/.test(FACILITATOR_URL)))throw Error("Facilitator must be HTTPS in production.");
if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535)throw Error("Invalid PORT");

const demoCsvReport=inspectCsv({csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]});
if(!demoCsvReport.ok || demoCsvReport.normalizedDuplicateRows!==1 ||
   demoCsvReport.spreadsheetFormulaRiskCells!==1 ||
   demoCsvReport.irregularRows!==1)throw Error("Original synthetic CSV business-value sample changed unexpectedly");
const sample=fs.readFileSync(path.resolve(DIR,"examples/sample.yaml"),"utf8");
const sampleReport=await lintSpec(sample);
if(sampleReport.errors!==0)throw Error("Pinned server Redocly failed on known valid example");
if(sampleReport.warnings!==2)throw Error("Pinned example lint changed unexpectedly. Revalidate published product.");
// Original local OpenAPI x402 v2 reference, offered as a paid machine-readable starter.
const paymentTemplate=fs.readFileSync(path.resolve(DIR,"examples/x402-payment-template.yaml"),"utf8");
const paymentTemplateReport=await lintSpec(paymentTemplate);
if(paymentTemplateReport.errors!==0 || paymentTemplateReport.warnings!==0)throw Error("x402 template lint baseline changed. Refuse to serve an invalid reference.");

const facilitator=new HTTPFacilitatorClient({url:FACILITATOR_URL});
const resourceServer=new x402ResourceServer(facilitator);
resourceServer.register("eip155:*",new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);
await resourceServer.initialize(); // Read facilitator /supported before accepting x402 challenges.

const documentation={
  name:"VM5 OpenAPI Lint",
  version:"0.1.0",
  status:"LIVE — two genuine distinct paid-and-delivered x402 calls from the SAME independent NoHumans automated scout: template 0.010000 native Base USDC, CSV report 0.005000 native Base USDC; combined 0.015000 token received. No organic repeat human buyer or fiat cashout proven.",
  paidFourVenuePerpetualFunding:{
    method:"GET",path:"/v1/btc-funding-four-venues",priceNativeBaseCircleUSDC:FUNDING_PRICE_USDC,
    network:NETWORK,asset:"0x833589fCD6eDb6E08f4c7C32d4f71b54bdA02913",payTo:FUNDING_PAYOUT_BASE,
    scope:"Four fresh public exchange funding-rate quotes for BTC/USDT linear perpetuals: Binance, Bybit, OKX, Bitget. All four fetched before x402; incomplete, stale, malformed or unavailable quotes return 503 without charge.",
    freePreview:"GET /v1/btc-funding-sample",independentPaidCustomerCount:0,
    limitations:"Raw public observations only. Venue-specific funding schedules may differ; not annualized, not profitable arbitrage, not price advice, no trading. Original VM1 receive-only Base USDC."
  },
  paidTapeoutGenesisCpu:{
    method:"GET",path:"/v1/tapeout-cpu0-report",priceUSDC:TAPEOUT_PRICE_USDC,
    payTo:TAPEOUT_PAYOUT,network:NETWORK,
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    purpose:"Live, pinned-block read-only X Layer TapeOut genesis CPU/factory/market evidence, full machine-readable onchain fee, EIP-1967 implementation and seal diagnostics.",
    request:"GET exactly this path with no query or body; free preflight computes complete RPC snapshot before x402 payment request, returns no paid report until valid settlement.",
    freePreview:"GET /v1/tapeout-cpu0-sample",knownIndependentCustomers:0,
    recipientNote:"This brand-new route pays the SAME original VM1 owner MetaMask on Base native USDC. All existing VM5 merchant product payouts are unchanged.",
    limitations:"Public X Layer RPC observation, not audited security, transaction settlement, legal identity or financial advice. No independent paid call confirmed."
  },
  paid:{
    method:"POST",
    path:"/v1/lint",
    priceUSDC:"0.01",
    network:NETWORK,
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    recipient:PAY_TO,
    schema:{
      type:"object",
      required:["spec"],
      properties:{spec:{type:"string",description:"UTF-8 OpenAPI 3.0 or 3.1 YAML/JSON string, maximum 64,000 bytes"}}
    },
    payment:"x402 v2 EIP-3009 Base USDC signature",
    facilitator:FACILITATOR_URL
  },
  paidSettlementPing:{
    method:"GET",path:"/v1/ping",priceUSDC:"0.001",network:NETWORK,
    purpose:"A tiny real x402 v2 payment handshake integration test. A successfully verified and settled request unlocks the handler; inspect PAYMENT-RESPONSE for settlement details. This is NOT independently audited on-chain finality or buyer identity evidence.",
    input:"No query, no posted payload, no secrets. Malformed queries are rejected before payment.",
    confirmedIndependentPaidBuyers:0
  },
  paidReceipt:{
    method:"GET",path:"/v1/base-usdc-receipt",
    priceUSDC:"0.005",network:NETWORK,
    query:{
      tx:"0x-prefixed 32-byte Base transaction hash",
      recipient:"0x-prefixed 20-byte Base wallet address",
      minUsdc:"positive decimal up to 6 fractional places",
      sender:"optional expected external USDC transfer-from address"
    },
    purpose:"Read-only Circle native Base USDC receipt proof with 12-block confirmation gate, net token Transfer logs, strict optional sender, exact integer decimals.",
    caveat:"Successful Transfer log is not invoice settlement, buyer intent, a security audit or proof of account ownership. Invalid/failed/unconfirmed receipts are rejected BEFORE payment."
  },
  paidCsv:{method:"POST",path:"/v1/csv-preflight",priceUSDC:"0.005",network:NETWORK,
    purpose:"RFC4180-style CSV structural preflight for real buyer CSV bytes. Returns row/column counts, duplicate rows, type mismatches, missing cells and formula injection warnings; never echoes raw row cells or persists uploaded CSV.",
    schema:{csvText:"UTF8 CSV <=32kb",expectedColumns:"optional nonempty column-name array <=40"},
    limitations:"Not full spreadsheet compliance, data truth, threat scanning or GDPR certification; do not submit secrets, infrastructure/settlement log separately."},
  paidWorkflowRisk:{method:"POST",path:"/v1/workflow-risk",priceUSDC:"0.20",network:NETWORK,
    purpose:"Analyze one caller-supplied 48KB GitHub Actions YAML source for workflow security risk heuristics: action pins, PR head checkout, token permissions, interpolation and self-hosted-runner exposure, with optional source-linked SARIF. Static rules only; no workflow execution or remote repository access.",
    schema:{workflowYaml:"A nonsecret GitHub Actions YAML string <=48000 UTF-8 bytes",filename:"optional ci.yml basename",includeSarif:"optional bool, default true"},
    sample:"GET /v1/workflow-risk-sample",confirmedIndependentPaidCustomers:0,
    source:"MIT original same-owner VM2 analyzer: https://github.com/livastic-vm2-primary-20260911/apify-workflow-guard",
    limitations:"AI-assisted static findings may contain false positives/negatives. No security certification, KYC validation, private CI data or compliance warranty. Do not submit secrets, private client workflows or sensitive environment tokens."},
  paidInvoice:{method:"POST",path:"/v1/invoice-reconcile",priceUSDC:"0.005",network:NETWORK,
    purpose:"Buyer-supplied NONCONFIDENTIAL Base native Circle USDC invoice and SELF-REPORTED transfer CSV candidate matching. Flags duplicates, reported partials, pending rows and ambiguous wallets; does NOT establish real onchain finality or a paid invoice.",
    input:{invoicesCsv:"invoice_id,recipient,amount_usdc,chain,token",transfersCsv:"invoice_id,tx_hash,log_index,recipient,amount_usdc,chain,token,status",maxBytesEach:65536,maxDataRows:500},
    freePreview:"GET /v1/invoice-reconcile-sample",
    precautions:"Only synthetic/public nonsecret CSV. The hosted API receives your CSV over HTTPS; for local-only confidential review use our separate FREE browser tool. Reject malformed data BEFORE any payment.",
    paidCustomers:0},
  paidCsvDemo:{method:"GET",path:"/v1/csv-report",priceUSDC:"0.005",network:NETWORK,
    purpose:"Deliver a full machine-readable integrity report of an original synthetic test CSV. No customer data, request inputs or special query; pays for structured ready-to-consume report, which can also be computed from disclosed public sample."},
  paidEmailDns:{method:"GET",path:"/v1/email-dns-preflight",priceUSDC:"0.005",network:NETWORK,
    purpose:"Public domain MX/SPF/DMARC DNS configuration preflight with read-only bounded lookups. No email addresses, SMTP, mailbox deliverability promise, DKIM selectors or security certification.",
    input:"Optional public domain, default gmail.com. Preflight DNS health checked before an x402 quote; failed DNS lookup is not billed.",
    freePreview:"GET /v1/email-dns-sample",confirmedIndependentCustomers:0},
  paidHttpsCert:{method:"GET",path:"/v1/https-cert-preflight",priceUSDC:"0.005",network:NETWORK,
    purpose:"Read one PUBLIC domain's current TLS X.509 certificate dates, issuer, hostname match and locally observed CA authorization via read-only port443 SNI. Only public IPv4 DNS destinations are accepted; no HTTP, SMTP, secrets, backend crawl, client tokens, private DNS resolution or domain safety certification.",
    input:"Optional domain defaults to github.com; pinned public DNS v4 only, no port/URL/email/IP literals.",
    freePreview:"GET /v1/tls-certificate-sample",confirmedIndependentCustomers:0},
  paidQuote:{method:"GET",path:"/v1/x402-preflight",priceUSDC:"0.01",network:NETWORK,
    purpose:"Offline-only public unsigned x402 v2 HTTP402 quote consistency review, adapted from original same-owner VM3 source. No live network fetch, merchant identity certification, wallet spend or settlement proof.",
    input:"One optional quote JSON or Base64 in query, max 12000 characters; omitted means a fake original public fixture",
    source:"Same-beneficial-owner original VM3, MIT author source, hosted by original VM5 native Base Circle USDC seller",freePreview:"GET /v1/x402-sample"},
  paidLowpoly:{method:"GET",path:"/v1/generate-lowpoly",priceUSDC:"0.05",network:NETWORK,
    purpose:"Deliver reproducible AI-assisted original procedural GLB 2.0 forest lantern or stone marker as Base64 binary with seed and SHA256. This is an as-is non-exclusive convenience service, not exclusive IP or a paid client commission.",
    sample:"GET /v1/lowpoly-sample is free. GET /v1/generate-lowpoly defaults to kind=lantern and seed=0; optional kind=marker and integer seed 0..999999.",
    licence:"Source generator is public; purchase is hosted generation and output delivery only. Rights are as-is, limited to those legally held and licensable by VM5."},
  paidGlb:{method:"POST",path:"/v1/analyze-glb",priceUSDC:"0.01",network:NETWORK,
    purpose:"In-memory non-executing GLB 2 model inspection, geometry/triangles/materials/local bounds, <=1.5MB. No remote fetch, files retained or source distribution.",
    caution:"This is a paid descriptive model metadata review, not a security, copyright or full glTF compliance certification. A developer may need original engine-level tests."},
  paidTemplate:{
    method:"GET",path:"/v1/x402-template",priceUSDC:"0.01",network:NETWORK,
    purpose:"Get a ready-to-adapt, independently authored x402 v2 OpenAPI 3.0.3 template and Redocly validation report; no customer spec submitted.",
    payment:"Exact x402 v2 Base USDC through the same verified payment middleware",
    caveat:"Reference design only. Replace example.invalid URLs and provide your own secure payment verification/settlement implementation."
  },
  free:{
    "/health":"Basic readiness check, no payment",
    "/v1/sample":"Full example lint result from independently verified public sample",
    "/v1/docs":"JSON API and payment terms",
    "/v1/invoice-reconcile-sample":"Free synthetic Base USDC invoice-to-self-reported-transfer anomaly report; no payment or RPC."
  },
  scope:"Redocly recommended schema/documentation lint, no external $ref, no runtime server access, not a security certification",
  privacy:"Submitted specs are held in memory/temp files only for request processing, deleted after each run; no telemetry or access logging in application code. Cloudflare and the facilitator are separate external services; avoid secrets and client data.",
  disclosure:"VM5 AI-assisted one-owner API. Two distinct paid delivered API calls 0.01 template and 0.005 CSV report by SAME independent NoHumans auto scout, not two organic buyers or recurring demand. Other route sales unverified except the explicitly proven CSV demo. No owner fiat cashout or net profit established.",
  firstVerifiedIndependentPaidSale:{endpoint:"GET /v1/x402-template",amountNativeBaseCircleUSDC:"0.01",distinctDeliveredPurchases:1,fiatCashoutUSD:"0",onchain:"https://basescan.org/tx/0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",officialIndependentProof:"https://nohumans.directory/l/7fb76f81-0b5"},
  secondVerifiedIndependentPaidSale:{endpoint:"GET /v1/csv-report",amountNativeBaseCircleUSDC:"0.005",distinctDeliveredPurchases:1,fiatCashoutUSD:"0",onchain:"https://basescan.org/tx/0xc0c69aa8709b848ab3c0d521ac6540e019738f0804565dfe19652bcb3c290838",officialIndependentProof:"https://nohumans.directory/l/816d6709-3d0"},
  allVerifiedDistinctPaidApiCalls:2,
  totalActuallyReceivedNativeBaseCircleUSDC:"0.015",
  uniqueExternalScoutBuyerWallets:1
};
const routes={
  "POST /v1/workflow-risk":{
    accepts:{scheme:"exact",price:"$0.20",network:NETWORK,payTo:PAY_TO},
    description:"Paid original GitHub Actions YAML static workflow-risk heuristic report, optional SARIF. 48KB nonsecret input, only valid workflows reach the x402 payment request; no YAML execution, private repo access, penetration testing or certified security audit. Developed by the SAME one-human-owner VM2 under MIT; VM5 is merchant.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"ci.yml",includeSarif:true},
      inputSchema:{type:"object",additionalProperties:false,required:["workflowYaml"],
        properties:{workflowYaml:{type:"string",maxLength:48000},filename:{type:"string",maxLength:94},includeSarif:{type:"boolean"}}},
      output:{example:{ok:true,paid:true,chargedUSDC:"0.20",network:NETWORK,staticOnly:true,findingsTruncated:false,
        workflowEvents:["pull_request"],counts:{high:0,medium:1,note:0},noWorkflowExecuted:true,
        confirmedIndependentPaidCustomers:0}}
    })
  },
  "GET /v1/btc-funding-four-venues":{
    accepts:{scheme:"exact",price:"$"+FUNDING_PRICE_USDC,network:NETWORK,payTo:FUNDING_PAYOUT_BASE},
    description:"BTCUSDT linear perpetual funding rate comparison of four independent public market-data APIs, each checked fresh and complete BEFORE requesting a 0.01 native Circle Base USDC x402 payment. No API keys, order/signing, leverage or trading; market data may change. Correct source interval differences disclosed. Exact GET only, zero prior paid outside buyers.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",output:{example:{
        ok:true,paid:true,chargedUSDC:FUNDING_PRICE_USDC,
        kind:"btc_usdt_perpetual_funding_quoted_four_public_venues",
        sourceCount:4,exampleOnly:true,rawSpreadBps:0.35,noTradesPerformed:true
      }}
    })
  },
  "GET /v1/tapeout-cpu0-report":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:TAPEOUT_PAYOUT},
    description:"An original, genuinely live TapeOut genesis CPU/X Layer mainnet pinned-block data snapshot, first-party code open-source; paid structured report convenience with owner original VM1 MetaMask payTo, never a certificate of safety, wallet control or settlement.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.005",network:NETWORK,
        kind:"xlayer_tapeout_genesis_cpu_onchain_snapshot",
        chainId:196,blockNumber:"73900000",cpuIndex:0,exampleOnly:true,
        dataAtPinnedBlock:true,independentPaidBuyerReceipts:0
      }}
    })
  },
  "GET /v1/tapeout-cpu0-diff":{
    accepts:{scheme:"exact",price:"$0.01",network:NETWORK,payTo:TAPEOUT_PAYOUT},
    description:"Historical change-only TapeOut X Layer state diff (fixed publicly verified October 23 block vs recent pinned live state). Exactly 20 distinct public CPU0 factory, market, token and owner fields; native Circle Base USDC 0.01 to original VM1 MetaMask. Does not sign, submit, certify or promise changes.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.01",network:"eip155:8453",
        kind:"xlayer_tapeout_cpu0_pinned_state_diff",chainId:196,
        baselineBlock:DIFF_BASELINE_BLOCK.toString(),liveBlock:"73950000",
        fieldsCompared:20,changeCount:1,unchangedCount:19,
        changes:[{field:"market.nextListingId",label:"Next market listing ID",before:"3",after:"4"}],
        exampleOnly:true,newIndependentPaidCustomersForDiff:0
      }}
    })
  },
  "GET /v1/ping":{
    accepts:{scheme:"exact",price:"$0.001",network:NETWORK,payTo:PAY_TO},
    description:"Original low-price x402 v2 integration test: pay 0.001 native Circle Base USDC using your own eligible buyer wallet, and receive a machine-readable 200 response plus the x402 PAYMENT-RESPONSE header. Never submit a wallet seed or private key. Not independent finality proof or recurring user demand.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.001",network:"eip155:8453",
        kind:"x402_paid_integration_ping",serviceResponseAfterPaymentMiddleware:true,
        thirdPartyFinalityProof:false}}
    })
  },
  "POST /v1/invoice-reconcile":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Two NONCONFIDENTIAL buyer-supplied CSV extracts, self-reported Base USDC invoice vs transfer event candidate matching. No actual RPC/onchain finality. Reports duplicates, partial receipts and unmatched/shared-wallet exceptions. Never send secrets or real customer/employee personal data to a hosted service.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers},
      inputSchema:{type:"object",additionalProperties:false,required:["invoicesCsv","transfersCsv"],properties:{
        invoicesCsv:{type:"string",description:"Synthetic or authorized public/nonconfidential invoice CSV, <=65536 UTF-8 bytes",maxLength:65536},
        transfersCsv:{type:"string",description:"Synthetic or authorized public/nonconfidential reported USDC event CSV, <=65536 UTF-8 bytes",maxLength:65536}}},
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",
        kind:"base_usdc_self_reported_invoice_transfer_csv_candidate_reconciliation",
        summary:{invoiceCount:4,reportedExact:1,reportedPartial:1,unreferencedEvents:1,pendingReported:1},
        blockchainFinalityVerified:false,noRawWalletOrTxHash:true}}
    })
  },
  "GET /v1/csv-report":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Original demonstration CSV integrity report (duplicate normalized rows, invalid email/number/date, formula injection warning, inconsistent row width). Source CSV and code are public/reproducible; purchase is hosted report convenience, not exclusive IP or customer history.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"csv_structure_quality_preflight",
        reportVersion:"1.0",headerColumns:4,dataRows:5,irregularRows:1,
        normalizedDuplicateRows:1,spreadsheetFormulaRiskCells:1,
        noRawDataReturned:true}}
    })
  },
  "POST /v1/csv-preflight":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Customer-supplied <=32KB CSV structural quality preflight; parsed before payment without storage, does not echo raw CSV cells, reports invalid values only by row/column coordinate. No safety/compliance certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]},
      inputSchema:{type:"object",additionalProperties:false,required:["csvText"],
        properties:{csvText:{type:"string",maxLength:32768},expectedColumns:{type:"array",items:{type:"string"},maxItems:40}}},
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"csv_structure_quality_preflight",dataRows:5,irregularRows:1,normalizedDuplicateRows:1,spreadsheetFormulaRiskCells:1}}
    })
  },
  "GET /v1/https-cert-preflight":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Public TLS certificate expiry, not-before, host match and CA-authorization preflight via pinned public IPv4 only. Domain optional defaults github.com. No customer endpoints, HTTP requests, source code, private IP or paid buyer order asserted; invalid public DNS/TLS fails before any x402 quote.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",output:{example:{
        ok:true,paid:true,chargedUSDC:"0.005",kind:"public_https_certificate_preflight",
        domain:"github.com",daysUntilExpiry:30,hostnameMatches:true,
        chainAuthorized:true,certificateTrustAndHostnameVerified:true,
        readOnlyPublicCertificateOnly:true,httpRequestsSent:0
      }}
    })
  },
  "GET /v1/email-dns-preflight":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"One bounded public MX/SPF/DMARC and A DNS configuration report. Optional domain query, defaults to gmail.com. No mailbox, SMTP, DKIM selector or inbox deliverability verification. Rejected invalid/unresolvable inputs not charged.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"public_email_dns_preflight",domain:"gmail.com",mxCount:5,spfPresent:true,dmarcPresent:true,rawEmailAddressesReceived:false,smtpContactAttempted:false}}
    })
  },
  "GET /v1/x402-preflight":{
    accepts:{scheme:"exact",price:"$0.01",network:NETWORK,payTo:PAY_TO},
    description:"Original VM3 protocol-only public x402 v2 402 quote syntax review hosted by VM5; optional buyer supplied unsigned public quote, or no-input fictional example. Not a merchant safety, ownership, actual settlement, or identity certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.01",
        version:VM3_QUOTE_VERSION,kind:"x402_v2_public_402_offline_quote_review",
        paymentNetwork:NETWORK,checkCount:8,failedChecks:0,unknownChecks:0,
        reviewOutcome:"basic_public_structure_consistent",noSignedPaymentDataStored:true,noSpendingAuthorized:true}}
    })
  },
  "GET /v1/generate-lowpoly":{
    accepts:{scheme:"exact",price:"$0.05",network:NETWORK,payTo:PAY_TO},
    description:"Generate original AI-assisted procedural low-poly GLB 2.0 bytes by public-source algorithm for 0.05 native Circle Base USDC. Default lantern, seed 0. Non-exclusive as-is convenience; no exclusive asset copyright or engine certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.05",network:NETWORK,
        kind:"lantern",seed:0,fileName:"lastone_lantern_0.glb",
        triangles:284,materials:8,format:"GLB 2.0"
      }}
    })
  },
  "POST /v1/analyze-glb":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Audit one original or client-provided glTF 2.0 GLB in RAM; return triangles, materials and local geometry bounds. The input must be canonical base64 JSON, 28 bytes to 1.5MB; rejects external buffers/texture URLs. This is not a full glTF parser or malware certification.",
    mimeType:"application/json"
  },
  "POST /v1/lint":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Linter checks OpenAPI YAML/JSON using Redocly recommended rules; report includes rule IDs, locations, severity and counts. External refs disabled.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{spec:'openapi: 3.0.3\ninfo:\n  title: Example\n  version: 1.0\npaths:\n  /hello:\n    get:\n      operationId: hello\n      responses:\n        "200":\n          description: OK\n'},
      inputSchema:{type:"object",properties:{spec:{type:"string",description:"OpenAPI YAML/JSON (no external $ref)" }},required:["spec"]},
      output:{example:{valid:true,errors:0,warnings:1,lintVersion:REDOCLY_VERSION,findings:[{ruleId:"operation-4xx-response",severity:"warn",message:"Operation must have at least one 4XX response."}]}}
    })
  },
  "GET /v1/base-usdc-receipt":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Validate a finalized-enough Base native Circle USDC transfer receipt with strict tx, wallet, optional sender and min threshold. A failed or unconfirmed transfer does not reach payment.",
    mimeType:"application/json"
  },
  "GET /v1/x402-template":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Machine-readable original OpenAPI 3.0.3 x402 payment starter with zero Redocly lint findings. An original as-is reference download, not an audited production payment service.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.01",network:NETWORK,
        kind:"x402_v2_openapi_starter",templateFormat:"YAML",
        openapiTemplate:"openapi: 3.0.3",
        redocly:{errors:0,warnings:0}
      }}
    })
  }
};
const payment=paymentMiddleware(routes,resourceServer,undefined,undefined,false);

const app=express();
// Cloudflare Quick Tunnel connects from local loopback and forwards the public
// HTTPS scheme. Trust only that local reverse proxy so x402 resource URLs use
// https:// instead of the internal tunnel http:// origin.
app.set("trust proxy", BIND_HOST==="0.0.0.0" ? 1 : "loopback"); // Render HTTPS reverse proxy, or VM5 loopback tunnel
app.disable("x-powered-by");
const traffic=new Map();
const MAX_REQUESTS_PER_MINUTE=process.env.NODE_ENV==="test"?1000:90;
let pendingChecks=0;
app.use((req,res,next)=>{
  const raw=req.headers["cf-connecting-ip"];
  const who=typeof raw==="string" && /^[0-9a-fA-F:.]{2,45}$/.test(raw)?raw:req.ip;
  const now=Date.now();
  const state=traffic.get(who);
  const item=!state||now-state.started>60000?{started:now,count:0}:state;
  item.count++;
  traffic.set(who,item);
  if(traffic.size>10000)for(const [id,s] of traffic)if(now-s.started>60000)traffic.delete(id);
  if(item.count>MAX_REQUESTS_PER_MINUTE){
    res.setHeader("Retry-After","60");
    return res.status(429).json({ok:false,charged:false,error:"Too many requests, retry later."});
  }
  next();
});
app.use((_req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE");
  res.setHeader("Access-Control-Expose-Headers","PAYMENT-REQUIRED,PAYMENT-RESPONSE");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","no-referrer");
  next();
});
// Separate entirely FREE original HTML5 game for independent publisher review.
// It is NOT a metered x402/API request and has no personal/account state.
// Do not modify the paid API routes, facilitator or settlement configuration.
const LUMEN_STATIC=path.resolve(DIR,"public/lumen-garden");
for (const name of ["index.html","game.js","style.css","favicon.svg"])
  if(!fs.existsSync(path.join(LUMEN_STATIC,name)))throw Error("Publisher demo files missing");
app.use("/games/lumen-garden",(req,res,next)=>{
  // The public sandboxed, zero-payment game needs to load inside a publisher's iframe.
  // Header relaxation is confined to this path; the actual x402 service stays DENY.
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "+
    "connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; "+
    "form-action 'none'; frame-ancestors *");
  res.setHeader("Cache-Control","public, max-age=900");
  next();
},express.static(LUMEN_STATIC,{index:"index.html",dotfiles:"deny",fallthrough:false,redirect:true}));
app.get("/",(_req,res)=>res.redirect(302,"/v1/docs"));
app.get("/.well-known/402index-verify.txt",(_req,res)=>{
  const hash=fs.readFileSync(path.resolve(DIR,"verification/402index-verify.txt"),"utf8").trim();
  if(!/^[0-9a-f]{64}$/.test(hash))return res.status(503).type("text/plain").send("verification file invalid");
  return res.type("text/plain").send(hash);
});
// FREE true402 original seller metadata. Advertises the SAME already-existing
// 0.010000 native Base Circle USDC template route and original payTo.
// Use runtime facilitator rather than stale 2026-10-17 registration fallback.
// No buyer data, wallet signature, checkout, funds movement or paid-route change.
app.get("/.well-known/x402-service.json",(_req,res)=>res.status(200).json({
  x402:"1.0",name:"VM5 x402 v2 OpenAPI Reference Template",
  description:"Original, Redocly-validated x402 v2 OpenAPI 3.0.3 YAML reference. Base USDC 402 payment header examples for developers. Starter template only; no custodial wallet, payment processing, live settlement guarantee or security audit.",
  capabilities:["x402","openapi","api-schema","crypto-payments","developer-tools"],
  pricing:{currency:"USDC",base:"0.01",unit:"request"},
  payment:{address:PAY_TO,chain:"base",facilitator:FACILITATOR_URL},
  endpoint:"https://vm5-openapi-x402.onrender.com/v1/x402-template"
}));
app.get("/skill.md",(_req,res)=>res.status(200).type("text/markdown; charset=utf-8").send(fs.readFileSync(path.resolve(DIR,"verification/skill.md"),"utf8")));
app.get("/llms.txt",(_req,res)=>res.status(200).type("text/plain; charset=utf-8").send(fs.readFileSync(path.resolve(DIR,"verification/llms.txt"),"utf8")));
app.get("/health",(_req,res)=>res.json({ok:true,service:"vm5-openapi-x402",network:NETWORK,paidRoute:"POST /v1/lint",sampleRedoclyErrors:sampleReport.errors}));
app.get("/v1/docs",(_req,res)=>res.json(documentation));
app.get("/v1/workflow-risk-sample",(_req,res)=>{
  const sample=inspectWorkflow({workflowYaml:PUBLIC_SYNTHETIC_YAML,filename:"ci.yml",includeSarif:false});
  if(!sample.ok)return res.status(503).json({ok:false,error:"Synthetic workflow fixture unavailable."});
  return res.status(200).json({exampleOnly:true,paid:false,chargedUSDC:"0",
    sampleWorkflow:PUBLIC_SYNTHETIC_YAML,sampleReport:sample,
    paidEndpoint:"POST /v1/workflow-risk",priceUSDC:"0.20",network:NETWORK,confirmedIndependentPaidCustomers:0,
    source:"https://github.com/livastic-vm2-primary-20260911/apify-workflow-guard",
    warning:"This is a publicly reproducible synthetic example. Purchase pays for hosted preflight on your own NONSECRET workflow, not security certification, runtime testing, unique IP or any prior external client order."});
});
app.get("/v1/email-dns-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  sample:{kind:"public_email_dns_preflight",domain:"example.org",mxCount:1,spfPresent:true,dmarcPresent:true,dmarcPolicy:"reject",warnings:[],inspectedAtUTC:"FIXTURE_ONLY_NOT_LIVE_DNS"},
  paidEndpoint:"GET /v1/email-dns-preflight?domain=gmail.com",priceUSDC:"0.005",confirmedIndependentCustomers:0,
  caveat:"A synthetic fixture, not an actual DNS inspection or paid buyer order. Paid endpoint queries live public DNS MX, SPF and DMARC but cannot verify email deliverability, mailbox existence, DKIM selectors or security."
}));
app.get("/v1/tls-certificate-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  kind:"SYNTHETIC_TLS_CERTIFICATE_PREVIEW_NOT_A_REAL_CERTIFICATE_CHECK",
  sample:{domain:"example.org",inspectedAtUTC:"FIXTURE_ONLY",certificateExpiresAtUTC:"2099-01-01T00:00:00.000Z",daysUntilExpiry:30,
    hostnameMatches:true,chainAuthorized:true,certificateTrustAndHostnameVerified:true},
  paidEndpoint:"GET /v1/https-cert-preflight?domain=github.com",priceNativeBaseCircleUSDC:"0.005",
  confirmedIndependentPaidOrders:0,
  disclaimer:"The fixture is NOT real public TLS data, a paid order, HTTP website audit, ownership, revocation or certificate-transparency proof. Real service only contacts pinned public IPv4 port443 to read the presented certificate."
}));
app.get("/v1/receipt-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  kind:"SYNTHETIC_BASE_CIRCLE_USDC_RECEIPT_FIXTURE_NOT_REAL_CHAIN_DATA",
  paymentScheme:"x402 v2 Base (chainId 8453) native Circle USDC only",
  exampleInput:{
    tx:"0x"+"a".repeat(64),
    recipient:"0x"+"4".repeat(40),
    minUsdc:"3.000000",
    sender:"0x"+"3".repeat(40)
  },
  illustrativeOutput:{
    verifiedNativeUSDCReceipt:true,
    chainId:8453,
    transactionHash:"0x"+"a".repeat(64),
    expectedRecipient:"0x"+"4".repeat(40),
    expectedSender:"0x"+"3".repeat(40),
    netIncomingUSDC:"4.000000",
    minimumUSDC:"3.000000",
    confirmations:"18",
    chargedUSDC:"0.005",
    payment:"EXAMPLE ONLY — not a settled buyer authorization"
  },
  paidEndpoint:"GET /v1/base-usdc-receipt",priceNativeBaseCircleUSDC:"0.005",
  confirmedIndependentPaidOrdersForThisEndpoint:0,
  limitations:"These addresses, block confirmations and transaction hash are invented placeholders, NOT an observed chain receipt, a verified customer, actual settlement, domain identity, buyer intent or paid result. Replace every sample input with your own PUBLIC real Base native Circle USDC transaction and expected wallet. Real API rejects missing, forged, bridged, unconfirmed, failed and insufficient payments BEFORE requesting any x402 charge."
}));
app.get("/v1/sales-proof",(_req,res)=>res.status(200).json({
  kind:"original_x402_first_actual_independent_paid_sale",
  source:"NoHumans firstparty paid_verified/paid_verification_latest and independent Base8453 USDC receipt; evidence frozen at 2026-10-19, not live sales analytics.",
  externalBuyer:"NoHumans independent paid-verification scout",
  externalSellerListing:"https://nohumans.directory/l/7fb76f81-0b5",
  exactPaidProduct:"GET /v1/x402-template",
  nativeCircleBaseUSDCReceived:"0.01", verifiedUniquePaidCalls:1,
  allVerifiedDistinctPaidApiCalls:2,
  totalActuallyReceivedNativeBaseCircleUSDC:"0.015",
  secondCsvPaidReceipt:{
    endpoint:"GET /v1/csv-report",listing:"https://nohumans.directory/l/816d6709-3d0",
    paidNativeCircleBaseUSDC:"0.005",paidVerified:true,delivered:true,schemaValidated:true,
    txHash:"0xc0c69aa8709b848ab3c0d521ac6540e019738f0804565dfe19652bcb3c290838",
    logIndex:1201,chainId:8453,token:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    from:"0x54e163e9b8edda194d83f46add921bfa5fc5f4e0",to:PAY_TO,
    dateUTC:"2026-10-19T13:38:49Z",
    sameIndependentAutomatedScoutBuyerAsFirst:true
  },
  paidVerified:true,officialProductDelivered:true,responseSchemaValidated:true,
  dateUTC:"2026-10-19T11:34:15Z",chainId:8453,
  USDCAsset:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  recipientPublicAddress:PAY_TO,
  independentBuyerPublicScout:"0x54E163e9B8eDDa194D83F46AdD921bfA5fc5f4E0",
  txHash:"0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",
  logIndex:239,
  transactionExplorer:"https://basescan.org/tx/0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",
  officialBuyerPolicy:"https://nohumans.directory/state/paid-verification",
  noOwnerWalletGasOrSignedSelfPurchase:true,
  generatedLowPolyPaidCustomers:0,
  paidGlbAuditorPaidCustomers:0,
  otherPaidEndpointCustomersNotProven:true,
  fiatCashoutUSD:"0",trueNetUSD:"UNKNOWN",
  disclaimer:"Two small independently purchased/delivered API calls by ONE external automated NoHumans scout (0.01 template + 0.005 CSV); not an enterprise software contract, two organic buyer testimonials, sustained demand, exclusive IP transfer, USD bank cashout or guaranteed future revenue. Legacy top-level transaction fields refer only to the original first call; separate total fields include both unique transactions."
}));
app.get("/v1/sample",(_req,res)=>res.json({kind:"public_sample",sampleTitle:"Independently authored JSONPlaceholder OpenAPI 3.0 spec",...sampleReport,paid:false,source:"https://github.com/livastic-vm5-primary-20260911/vm5-delivery-lab/tree/main/examples"}));
app.get("/v1/csv-sample",(_req,res)=>res.json({
  ok:true,paid:false,kind:"original_synthetic_csv_structural_qa_offer",
  sampleCsv:DEMO_CSV,requestedExpectedHeaders:["email","amount","date","note"],
  paidGET:"GET /v1/csv-report",paidPOST:"POST /v1/csv-preflight",
  buyerOwnedCsv:{
    method:"POST",url:"https://vm5-openapi-x402.onrender.com/v1/csv-preflight",
    contentType:"application/json",
    exampleBody:{csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]},
    priceUSDC:"0.005",network:NETWORK,
    whatYouBuy:"Structural quality report on YOUR submitted CSV, not the static demo. Invalid CSV is rejected before payment.",
    paymentGate:"Valid unpaid JSON input first receives HTTP 402 PAYMENT-REQUIRED. Buyer must independently authorize an x402 v2 payment before any charge or report delivery.",
    privacy:"No application-side persistence or raw row value echo; do not submit secrets, private identities or production account data.",
    confirmedIndependentPaidPOSTCustomers:0,
    sourceGuide:"https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md"
  },
  priceUSDC:"0.005",network:NETWORK,
  sourceDataset:"Synthetic original public demo only, no personal/customer data",
  issuesPresent:["one duplicate data row","one irregular column count",
    "invalid email/amount/date", "one formula-risk cell","one blank amount"],
  disclosure:"GET paid sample is reproducible from this synthetic data using public code; POST is for buyer-supplied CSV. Charges buy hosted structured report convenience, not exclusive IP or safety certification.",
  confirmedCsvPaidOrders:1,
  limits:CSV_LIMITS
}));
app.get("/v1/lowpoly-sample",(_req,res)=>res.json({
  ok:true,paid:false,kind:"reproducible_original_lowpoly_glb_generator_preview",
  kinds:["lantern","marker"],defaultKind:"lantern",seedRange:[0,999999],
  bytesPerGeneratedModel:"about 17-28KB GLB 2.0",
  format:"GLB 2.0, Y-up; model-local metre-scale positions; solid-color materials; no external mesh or textures",
  paidEndpoint:"GET /v1/generate-lowpoly",priceUSDC:"0.05",network:NETWORK,
  product:"An as-is procedurally generated GLB model byte array returned as base64 after real independent native Base Circle USDC x402 payment.",
  licensing:"Non-exclusive as-is commercial use only of rights VM5 actually owns and can license; AI-assisted and generator source is public; no exclusivity/Unity runtime certification/seller prior paid orders.",
  independentPaidBuyers:0,confirmedSettledSalesUSDC:"0",
  demo:"https://livastic-vm5-primary-20260911.github.io/last-one-3d-survival-demo/props.html"
}));
app.get("/v1/glb-sample",(_req,res)=>res.json({ok:true,paid:false,kind:"original_portfolio_metadata_example",
  sampleSource:"Original VM5 portfolio at https://livastic-vm5-primary-20260911.github.io/last-one-3d-survival-demo/props.html",
  examples:[{name:"forest_lantern",triangleCount:380,materialCount:8,localHeightMetres:1.82},
    {name:"moss_marker",triangleCount:228,materialCount:4,localHeightMetres:1.9}],
  disclosure:"These are synthetic self-authored geometry samples; not customer orders, not independent paid tests, not renderer or security certification."}));
let inFlightUSDCReads=0;
const pendingUSDCByIp=new Map();
app.get("/v1/base-usdc-receipt",async(req,res,next)=>{
  // Free RPC preflight is deliberately bounded so unauthenticated users
  // cannot turn the x402 seller into a public Base RPC amplification proxy.
  const now=Date.now();
  const who=req.ip;
  const prev=pendingUSDCByIp.get(who);
  const item=(!prev||now-prev.started>60000)?{started:now,count:0}:prev;
  item.count++;
  pendingUSDCByIp.set(who,item);
  if(pendingUSDCByIp.size>10000)
    for(const [ip,entry] of pendingUSDCByIp)
      if(now-entry.started>60000)pendingUSDCByIp.delete(ip);
  if(item.count>12)
    return res.status(429).json({ok:false,charged:false,error:"Base receipt read rate limit; retry later."});
  if(inFlightUSDCReads>=2)
    return res.status(503).json({ok:false,charged:false,error:"Base receipt reader busy; no payment accepted."});

  const parsed=validateReceiptQuery(req.query);
  if(!parsed.ok)return res.status(400).json({ok:false,charged:false,error:parsed.error});
  inFlightUSDCReads++;
  try{
    const result=await preflightBaseUSDCReceipt(parsed.value);
    if(!result.ok)return res.status(result.httpStatus).json({ok:false,charged:false,error:result.error});
    res.locals.usdcReceiptProof=result.proof;
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Base receipt verifier or read-only chain source temporarily unavailable. No payment requested."});
  }finally{
    inFlightUSDCReads=Math.max(0,inFlightUSDCReads-1);
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.usdcReceiptProof,
  chargedUSDC:"0.005",
  payment:"x402 v2 exact Base Circle native USDC. Real independent payment settlement NOT yet demonstrated on production."
}));
// Compatibility for legacy marketplace probes: x402 v2's canonical PaymentRequired
// stays in PAYMENT-REQUIRED; mirror that identical public quote in a JSON 402 body
// only for the already-paid GET template route. Do not change any payment/settlement.
function echoCanonicalX402ChallengeOnTemplate(_req,res,next) {
  const send=res.send;
  res.send=function(body) {
    const wire=res.getHeader("PAYMENT-REQUIRED");
    if (res.statusCode===402 && typeof wire==="string" && wire.length<20000) {
      try {
        const quote=JSON.parse(Buffer.from(wire,"base64").toString("utf8"));
        const a=quote?.accepts;
        if (quote?.x402Version===2 && Array.isArray(a) && a.length===1 &&
            a[0]?.scheme==="exact" && a[0]?.network===NETWORK &&
            a[0]?.payTo?.toLowerCase()===PAY_TO.toLowerCase() &&
            a[0]?.asset?.toLowerCase()==="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
            a[0]?.amount==="10000") {
          res.setHeader("X-Payment-Required",wire); // legacy discovery alias, same bytes
          res.setHeader("Access-Control-Expose-Headers",
                        "PAYMENT-REQUIRED,X-Payment-Required,PAYMENT-RESPONSE");
          res.type("json");
          return send.call(res,JSON.stringify(quote));
        }
      }catch { /* Fail closed to the standard x402 middleware response */ }
    }
    return send.call(res,body);
  };
  next();
}

// Public-only compatibility for legacy free x402 directories probing this
// EXACT original-VM1-paid TapeOut diff SKU. Never accept a fabricated quote:
// the body and alias must mirror the canonical middleware challenge exactly.
// This code cannot authorize, verify, settle, charge, or sign a payment.
function echoCanonicalX402ChallengeOnTapeoutDiff(_req,res,next){
  const send=res.send;
  res.send=function(body){
    const wire=res.getHeader("PAYMENT-REQUIRED");
    if(res.statusCode===402 && typeof wire==="string" && wire.length<20000){
      try{
        const quote=JSON.parse(Buffer.from(wire,"base64").toString("utf8"));
        const a=quote?.accepts;
        const resource=new URL(quote?.resource?.url);
        if(quote?.x402Version===2 &&
           resource.pathname==="/v1/tapeout-cpu0-diff" &&
           !resource.search && !resource.hash &&
           Array.isArray(a) && a.length===1 &&
           a[0]?.scheme==="exact" && a[0]?.network===NETWORK &&
           a[0]?.payTo?.toLowerCase()===TAPEOUT_PAYOUT.toLowerCase() &&
           a[0]?.asset?.toLowerCase()==="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
           a[0]?.amount==="10000"){
          res.setHeader("X-Payment-Required",wire);
          res.setHeader("Access-Control-Expose-Headers",
                        "PAYMENT-REQUIRED,X-Payment-Required,PAYMENT-RESPONSE");
          res.type("json");
          return send.call(res,JSON.stringify(quote));
        }
      }catch { /* Fail closed; leave the standard unpaid x402 body intact. */ }
    }
    return send.call(res,body);
  };
  next();
}

// Read-only discovery compatibility for ONE previously genuinely paid VM1
// TapeOut report SKU. The canonical x402 v2 PAYMENT-REQUIRED header remains
// the sole source of truth. Never modify verify/settle, price, or recipient.
function echoCanonicalX402ChallengeOnTapeoutReport(_req,res,next){
  const send=res.send;
  res.send=function(body){
    const wire=res.getHeader("PAYMENT-REQUIRED");
    if(res.statusCode===402 && typeof wire==="string" && wire.length<20000){
      try{
        const quote=JSON.parse(Buffer.from(wire,"base64").toString("utf8"));
        const a=quote?.accepts;
        const resource=new URL(quote?.resource?.url);
        if(quote?.x402Version===2 &&
           resource.pathname==="/v1/tapeout-cpu0-report" &&
           !resource.search && !resource.hash &&
           Array.isArray(a) && a.length===1 &&
           a[0]?.scheme==="exact" && a[0]?.network===NETWORK &&
           a[0]?.payTo?.toLowerCase()===TAPEOUT_PAYOUT.toLowerCase() &&
           a[0]?.asset?.toLowerCase()==="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
           a[0]?.amount==="5000"){
          res.setHeader("X-Payment-Required",wire);
          res.setHeader("Access-Control-Expose-Headers",
                        "PAYMENT-REQUIRED,X-Payment-Required,PAYMENT-RESPONSE");
          res.type("json");
          return send.call(res,JSON.stringify(quote));
        }
      }catch { /* Fail closed: ordinary unpaid x402 response remains. */ }
    }
    return send.call(res,body);
  };
  next();
}

function validateOptionalTemplateFormat(req,res,next){
  const format=req.get("X-Template-Format");
  if(Object.keys(req.query).length ||
     (format!==undefined && format!=="yaml")){
    return res.status(400).json({ok:false,charged:false,error:"Only the optional X-Template-Format: yaml header is supported; this paid URL takes no query string."});
  }
  next();
}
// Small paid x402 v2 integration test. Existing exact payment middleware executes
// before serving the success object. Test mocks do not count as real receipts.
app.get("/v1/ping",(req,res,next)=>{
  if(req.originalUrl!=="/v1/ping" || Object.keys(req.query).length || req.get("Content-Length") || req.get("Transfer-Encoding")){
    return res.status(400).json({ok:false,charged:false,error:"GET /v1/ping accepts no query parameters or request body."});
  }
  next();
},payment,(_req,res)=>res.status(200).json({
  ok:true,paid:true,chargedUSDC:"0.001",network:NETWORK,kind:"x402_paid_integration_ping",
  serviceResponseAfterPaymentMiddleware:true,
  respondedAtUTC:new Date().toISOString(),
  paymentResponseHeader:"Inspect PAYMENT-RESPONSE after a valid x402 payment for the middleware's settlement response.",
  thirdPartyFinalityProof:false,
  limitations:"The merchant's payment-gated response is not a standalone on-chain finality audit, verified legal buyer identity, paid-invoice agreement, or guaranteed continuous service. No new independent customer is claimed until genuine outside final transfers are proven."
}));
// Free summary intentionally never embeds the current paid JSON report.
app.get("/v1/tapeout-cpu0-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  kind:"tapeout_genesis_onchain_structured_report_offer",
  networkRead:"X Layer mainnet chainId196 pinned RPC, only public eth_call/storage reads",
  paidGET:"/v1/tapeout-cpu0-report",
  priceNativeBaseCircleUSDC:TAPEOUT_PRICE_USDC,
  payTo:TAPEOUT_PAYOUT,chainIdForPayment:8453,chainIdForData:196,
  knownIndependentPaidCustomers:0,
  freeSelfService:"https://livastic-vm5-primary-20260911.github.io/tapeout-xlayer-integrity-lens/",
  product:"Hosted machine-readable full factory, market, EIP-1967 control and genesis CPU token-supply snapshot, plus read-only warnings.",
  legalCaveat:"No audit, oracle, wallet connection, gas, stable future price, buyer intent or purchase is implied. Do not pay if the free self-service meets your needs."
}));
// Merchant-only non-sensitive receipt observation for FUTURE paid TapeOut calls.
// Executes AFTER a request finishes and NEVER writes headers, changes checkout,
// reads chain logs, or trusts mock/test-only transactions as real receipts.
// Keep this strictly limited to the original VM1-paid TapeOut SKU.
app.use(TAPEOUT_RECEIPT_PATH,(req,res,next)=>{
  if(process.env.NODE_ENV!=="test"){
    res.once("finish",()=>{
      const receipt=summarizeTapeoutSettlement({
        method:req.method,
        path:req.originalUrl,
        statusCode:res.statusCode,
        paymentResponse:res.getHeader("PAYMENT-RESPONSE")
      });
      if(receipt)console.info("[tapeout-facilitator-receipt]",JSON.stringify(receipt));
    });
  }
  next();
});
app.get("/v1/tapeout-cpu0-report",async(req,res,next)=>{
  if(req.originalUrl!=="/v1/tapeout-cpu0-report" ||
     Object.keys(req.query).length || req.get("Content-Length") || req.get("Transfer-Encoding")){
    return res.status(400).json({ok:false,charged:false,error:"Only the exact GET without query/body is accepted. No payment requested."});
  }
  try{
    // Preflight ALL public RPC data before asking for any x402 payment.
    // A failed/malformed/partial chain read results in 503 *without* a 402.
    res.locals.tapeoutEvidence=await getCurrentTapeoutEvidence();
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"X Layer TapeOut pinned-block evidence temporarily unavailable. No payment requested."});
  }
},echoCanonicalX402ChallengeOnTapeoutReport,payment,(_req,res)=>res.status(200).json({
  ...res.locals.tapeoutEvidence,
  ok:true,paid:true,chargedUSDC:TAPEOUT_PRICE_USDC,
  payoutRail:"Direct native Circle Base8453 USDC to the original VM1 owner MetaMask public receiving address",
  verifiedThirdPartyPaidOrdersForThisRoute:0,
  disclosure:"Buyer has expressly authorized the x402 middleware payment; this JSON reports public X Layer state, not the identity/independence of any buyer nor independent settlement finality."
}));
// Distinct paid historical change-set SKU. No buyer parameters, no payment if
// one of the two pinned RPC snapshots is incomplete or the chain is unavailable.
// New original read-only multi-venue futures funding-rate SKU. The sample is
// deliberately fictional; the paid data requires four complete fresh HTTPS
// quotes BEFORE the existing Base native Circle USDC x402 middleware.
app.get("/v1/btc-funding-sample",(req,res)=>{
  if(req.originalUrl!=="/v1/btc-funding-sample"||Object.keys(req.query).length||req.get("Content-Length")||req.get("Transfer-Encoding"))
    return res.status(400).json({ok:false,charged:false,error:"Only exact free sample GET with no parameters is supported"});
  return res.status(200).json({...DEMO_FUNDING,priceNativeBaseCircleUSDC:FUNDING_PRICE_USDC,
    nextStep:"GET /v1/btc-funding-four-venues",network:NETWORK,payTo:FUNDING_PAYOUT_BASE});
});
app.get("/v1/btc-funding-four-venues",async(req,res,next)=>{
  if(req.originalUrl!=="/v1/btc-funding-four-venues"||
     Object.keys(req.query).length||req.get("Content-Length")||req.get("Transfer-Encoding")){
    return res.status(400).json({ok:false,charged:false,error:"Only exact GET without query or body is accepted. No payment requested."});
  }
  try{
    res.locals.fundingSnapshot=await readLiveFourVenueFunding();
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Four current independent BTCUSDT funding quotes unavailable. No payment requested."});
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.fundingSnapshot,ok:true,paid:true,chargedUSDC:FUNDING_PRICE_USDC,
  originalVM1ReceiveOnlyBaseUSDC:FUNDING_PAYOUT_BASE,
  productPaymentNetwork:NETWORK,independentOrganicBuyersForThisNewSKU:0,
  disclosure:"The four live public funding estimates are not trade execution, net profitability or guaranteed payments. Quoted only after all four sources passed a freshness/shape check."
}));
app.get("/v1/tapeout-cpu0-diff-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  kind:"tapeout_cpu0_two_pinned_blocks_change_only_offer",
  paidGET:"/v1/tapeout-cpu0-diff",priceNativeBaseCircleUSDC:DIFF_PRICE_USDC,
  chainIdForData:196,chainIdForPayment:8453,payTo:TAPEOUT_PAYOUT,
  baselineBlock:DIFF_BASELINE_BLOCK.toString(),fieldsCompared:20,
  noWalletOrSignatureRequiredToInspectOffer:true,
  exampleChange:{field:"market.nextListingId",before:"3",after:"4",fictional:true},
  scope:"Only compare X Layer TapeOut CPU0 factory, market, proxy, owner, and token fields at a fixed historical and a pinned recent block; no intervening-block completeness claims.",
  freeAlternative:"https://livastic-vm5-primary-20260911.github.io/tapeout-xlayer-integrity-lens/",
  caveat:"Not an audit, oracle, wallet verification, change-alert subscription, genuine customer receipt or guaranteed availability. Pay only for convenience if free explorer does not suffice."
}));
app.get("/v1/tapeout-cpu0-diff",async(req,res,next)=>{
  if(req.originalUrl!=="/v1/tapeout-cpu0-diff" ||
    Object.keys(req.query).length || req.get("Content-Length") || req.get("Transfer-Encoding"))
    return res.status(400).json({ok:false,charged:false,error:"Only the exact GET without a query or body is supported. No payment requested."});
  try{
    // Complete and validate both historical & current X Layer RPC blocks
    // BEFORE middleware can return the 0.01-USDC x402 payment requirement.
    res.locals.tapeoutDiffEvidence=await getLiveTapeoutStateDiff();
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Two complete pinned X Layer snapshots unavailable. No payment requested."});
  }
},echoCanonicalX402ChallengeOnTapeoutDiff,payment,(_req,res)=>res.status(200).json({
  ...res.locals.tapeoutDiffEvidence,
  ok:true,paid:true,chargedUSDC:DIFF_PRICE_USDC,
  originalVM1PayoutAddress:TAPEOUT_PAYOUT,
  independentOutsideBuyersForThisNewSKU:0,
  disclosure:"The payment-gated response contains public RPC differences, not independent chain finality, independent buyer identity, a certified audit or an investment signal."
}));
app.get("/v1/x402-template",validateOptionalTemplateFormat,echoCanonicalX402ChallengeOnTemplate,payment,(_req,res)=>res.status(200).json({
  ok:true,paid:true,chargedUSDC:"0.01",network:NETWORK,
  kind:"x402_v2_openapi_starter",templateFormat:"YAML",openapiTemplate:paymentTemplate,
  redocly:paymentTemplateReport,
  disclosure:"Original reference template and lint evidence only; not an operating payment API or a guarantee that your server settles USDC. Replace all placeholder hosts and implement secure verification."
}));
app.get("/openapi.json",(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).spec);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});
app.get(["/.well-known/x402","/.well-known/x402.json"],(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).wellKnown);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});

// FREE self-hosted schema-shaped x402 v2 catalog. This is not a
// third-party Bazaar approval or a facilitator; all quotes come directly
// from our actual configured paid routes. No wallet, RPC, payer or POST.
app.get("/discovery/resources",(req,res)=>{
  try{
    const origin=req.protocol+"://"+req.get("host");
    makeDiscovery(origin); // existing exact allowlist blocks Host-header spoofing
    const catalog=makeCatalog(origin,routes);
    res.setHeader("Cache-Control","public, max-age=600");
    return res.status(200).json(queryCatalog(catalog,req.query));
  }catch{
    return res.status(400).json({error:"Invalid discovery request or public origin."});
  }
});

app.options(["/v1/lint","/v1/analyze-glb","/v1/csv-preflight","/v1/workflow-risk"],(_req,res)=>res.status(204).end());

const emailDnsRates=new Map();
app.get("/v1/email-dns-preflight",async(req,res,next)=>{
  const now=Date.now(),ip=req.ip,previous=emailDnsRates.get(ip);
  const item=(!previous||now-previous.at>60000)?{at:now,count:0}:previous;
  item.count++;emailDnsRates.set(ip,item);
  if(emailDnsRates.size>3000)for(const [key,state] of emailDnsRates)if(now-state.at>60000)emailDnsRates.delete(key);
  if(item.count>12)return res.status(429).json({ok:false,charged:false,error:"Public DNS lookup limited to twelve attempts/minute/IP."});
  const keys=Object.keys(req.query);
  if(keys.length>1||keys.some(key=>key!=="domain")||keys.some(key=>typeof req.query[key]!=="string"))
    return res.status(400).json({ok:false,charged:false,error:"Only an optional single public domain query is permitted."});
  const input=validatePublicDomain(req.query.domain===undefined?"gmail.com":req.query.domain);
  if(!input.ok)return res.status(400).json({ok:false,charged:false,error:input.error});
  try{
    const report=await auditEmailDns(input.domain);
    if(!report.ok)return res.status(404).json({ok:false,charged:false,error:report.error});
    res.locals.emailDnsReport=report;
    return next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Public DNS resolver is unavailable. No payment requested."});
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.emailDnsReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  disclaimer:"Read-only public DNS configuration preflight, not domain ownership, SMTP deliverability, DKIM, authorization or security certification. DNS results may change."
}));
const tlsCertByIP=new Map();
let tlsCertPending=0;
app.get("/v1/https-cert-preflight",async(req,res,next)=>{
  const now=Date.now(),client=req.ip,previous=tlsCertByIP.get(client);
  const item=(!previous||now-previous.at>60000)?{at:now,count:0}:previous;
  item.count++;tlsCertByIP.set(client,item);
  if(tlsCertByIP.size>3000)for(const [key,row] of tlsCertByIP)if(now-row.at>60000)tlsCertByIP.delete(key);
  if(item.count>(process.env.NODE_ENV==="test"?1000:8))return res.status(429).json({ok:false,charged:false,error:"Public certificate preflight limited to eight per minute."});
  if(tlsCertPending>=2)return res.status(503).json({ok:false,charged:false,error:"Certificate checker busy; no payment requested."});
  const names=Object.keys(req.query);
  if(names.length>1||names.some(key=>key!=="domain"||typeof req.query[key]!=="string"))
    return res.status(400).json({ok:false,charged:false,error:"Only one optional domain query is permitted."});
  const domain=req.query.domain===undefined?"github.com":req.query.domain;
  tlsCertPending++;
  try{
    const report=await inspectPublicTlsCertificate(domain);
    if(!report.ok){
      const status=report.error.startsWith("INVALID")||report.error.startsWith("NO_")?400:503;
      return res.status(status).json({ok:false,charged:false,error:report.error});
    }
    res.locals.tlsCertReport=report;
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Public TLS certificate source unavailable; no payment requested."});
  }finally{tlsCertPending=Math.max(0,tlsCertPending-1);}
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.tlsCertReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  disclaimer:"Read-only SNI TLS certificate observation on a pinned public IPv4 at time of request; no HTTP, domain ownership, CT/revocation, legal safety, all-clients acceptance, or future uptime guarantee. No independent buyer purchase yet proven."
}));
app.get("/v1/x402-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",sampleOnly:true,
  version:VM3_QUOTE_VERSION,
  kind:"vm3_original_vm5_hosted_public_x402_quote_sample",
  exampleQuote:EXAMPLE_QUOTE,
  analysis:{...evaluatePublicQuote(EXAMPLE_QUOTE),paid:false,chargedUSDC:"0"},
  paidEndpoint:"GET /v1/x402-preflight",priceNativeBaseCircleUSDC:"0.01",
  originalAdaptedSource:"VM3 original same-owner MIT x402 quote preflight, VM5 bounded hosted version",
  caveat:"EXAMPLE.INVALID and syntactic fake payTo 0x111... are NOT a real merchant or original VM5 customer; VM5 actual payable x402 challenge uses configured VM5 public recipient."
}));
const quotePreflightRates=new Map();
app.get("/v1/x402-preflight",(req,res,next)=>{
  const id=req.ip,now=Date.now(),old=quotePreflightRates.get(id);
  const state=(!old||now-old.at>60000)?{at:now,count:0}:old;
  state.count++;quotePreflightRates.set(id,state);
  if(quotePreflightRates.size>3000)for(const [key,item] of quotePreflightRates)if(now-item.at>60000)quotePreflightRates.delete(key);
  if(state.count>12)return res.status(429).json({ok:false,charged:false,error:"Public x402 quote preflight limited to twelve attempts per minute."});
  if(req.originalUrl.length>17500)return res.status(413).json({ok:false,charged:false,error:"Quote query exceeds 17500 characters."});
  const keys=Object.keys(req.query);
  if(keys.length>1||keys.some(key=>key!=="quote"))
    return res.status(400).json({ok:false,charged:false,error:"Only one optional quote query string accepted."});
  try{
    const report=evaluatePublicQuote(parsePublicQuote(req.query.quote));
    if(report.checkCount!==8 || !Array.isArray(report.checks))
      return res.status(400).json({ok:false,charged:false,error:"Unexpected quote evaluator result."});
    res.locals.quotePreflightReport=report;
    return next();
  }catch(error){
    return res.status(400).json({ok:false,charged:false,error:typeof error.code==="string"?error.code:"INVALID_UNSIGNED_PUBLIC_QUOTE"});
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.quotePreflightReport,paid:true,chargedUSDC:"0.01",network:NETWORK,
  originalSource:"VM3 authored public-source x402 402 quote syntax QA; VM5 existing hosted service and public recipient",
  disclaimer:"No merchant visited; public quote syntax is NOT seller identity, actual payment settlement, customer delivery or safe merchant verification."
}));

app.get("/v1/csv-report",(req,res,next)=>{
  if(Object.keys(req.query).length)return res.status(400).json({ok:false,charged:false,error:"CSV demo report takes no query. POST /v1/csv-preflight for buyer-owned data."});
  next();
},payment,(_req,res)=>res.status(200).json({
  ...demoCsvReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  purpose:"Reproducible original demonstration CSV anomaly report; source and analyser publicly available; this is NOT prior paid customer work.",
  nextBuyerTask:{
    purpose:"Validate YOUR OWN synthetic/nonsecret CSV before import instead of repeating a static demonstration GET.",
    method:"POST",endpoint:"https://vm5-openapi-x402.onrender.com/v1/csv-preflight",
    contentType:"application/json",
    exampleBody:{csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]},
    priceUSDC:"0.005",network:NETWORK,
    freePreview:"https://vm5-openapi-x402.onrender.com/v1/csv-sample",
    buyerGuide:"https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md",
    mustIndependentlyAuthorizePayment:true,
    confirmedIndependentPaidPOSTBuyers:0,
    privacy:"Only nonsecret CSV, no private identifiers. Invalid input is rejected BEFORE payment. This is structural heuristics, not compliance or data authenticity."
  }
}));

// Zero-payment synthetic preview; explicitly cannot prove any real transfer.
app.get("/v1/invoice-reconcile-sample",(_req,res)=>{
 const synthetic=inspectInvoicePair({invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers});
 if(!synthetic.ok)return res.status(503).json({ok:false,paid:false,error:"Free synthetic fixture unavailable."});
 res.status(200).json({
  ...synthetic,paid:false,chargedUSDC:"0",network:NETWORK,
  syntheticOnly:true,
  inventedRequest:{invoicesCsv:INVOICE_DEMO.invoices,transfersCsv:INVOICE_DEMO.transfers},
  paidBuyerEndpoint:"POST https://vm5-openapi-x402.onrender.com/v1/invoice-reconcile",
  priceUSDC:"0.005",maxBytesPerCsv:INVOICE_API_LIMITS.maxBytesPerCsv,
  confirmedExternalPaidInvoiceCustomers:0,
  freePrivateAlternative:"https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/usdc-invoice-bridge/",
  requiredConsent:"Only submit invented or nonconfidential authorized CSV; the hosted endpoint receives these data. Buyer must independently sign Base native Circle USDC payment AFTER 402."
 });
});
const csvRate=new Map();
const invoiceRate=new Map();
app.post("/v1/invoice-reconcile",
 express.json({limit:"144kb",type:["application/json","application/*+json"]}),
 (req,res,next)=>{
  const now=Date.now(),ip=req.ip,old=invoiceRate.get(ip);
  const current=(!old||now-old.at>60000)?{at:now,count:0}:old;
  current.count++;invoiceRate.set(ip,current);
  if(invoiceRate.size>3000)for(const [key,v] of invoiceRate)if(now-v.at>60000)invoiceRate.delete(key);
  if(current.count>12)return res.status(429).json({ok:false,charged:false,error:"Invoice CSV preflight limited to 12 attempts per minute per IP."});
  if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Use JSON only; no uploaded files, wallet keys or private customer data."});
  const report=inspectInvoicePair(req.body);
  if(!report.ok)return res.status(400).json({ok:false,charged:false,error:report.error,reason:report.reason,limits:INVOICE_API_LIMITS});
  res.locals.invoiceReport=report;
  next();
 },payment,(_req,res)=>res.status(200).json({
  ...res.locals.invoiceReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  confirmedIndependentPaidInvoiceBuyers:0,
  serviceScope:"Hosted convenience for an original, free, MIT-licensed, browser-local CSV candidate reconciliation algorithm. NO blockchain RPC, tax audit, legal settlement determination or wallet signing."
 }));

const workflowRate=new Map();
app.post("/v1/workflow-risk",
 express.json({limit:"65kb",type:["application/json","application/*+json"]}),(req,res,next)=>{
   const now=Date.now(),ip=req.ip,old=workflowRate.get(ip);
   const state=(!old||now-old.at>60000)?{at:now,count:0}:old;
   state.count++;workflowRate.set(ip,state);
   if(workflowRate.size>3000)for(const [key,v] of workflowRate)if(now-v.at>60000)workflowRate.delete(key);
   if(state.count>(process.env.NODE_ENV==="test"?1000:12))return res.status(429).json({ok:false,charged:false,error:"Workflow preflight limited to 12 attempts/minute per IP."});
   if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Provide an application/json workflow object."});
   const report=inspectWorkflow(req.body);
   if(!report.ok)return res.status(400).json({ok:false,charged:false,error:report.reason});
   res.locals.workflowReport=report;
   next();
 },payment,(_req,res)=>res.status(200).json({
   ...res.locals.workflowReport,paid:true,chargedUSDC:"0.20",network:NETWORK,
   product:"static_gha_yaml_risk_preflight",noWorkflowExecuted:true,confirmedIndependentPaidCustomers:0,
   limitations:"MIT same-owner VM2 static heuristic analysis; NOT penetration testing, a security audit, legal certification, runtime CI check, factual code risk guarantee or exclusive source IP transfer."
 }));
app.post("/v1/csv-preflight",express.json({limit:"40kb",type:["application/json","application/*+json"]}),(req,res,next)=>{
  const now=Date.now(),ip=req.ip,previous=csvRate.get(ip);
  const count=(!previous||now-previous.at>60000)?{at:now,count:0}:previous;
  count.count++;csvRate.set(ip,count);
  if(csvRate.size>3000)for(const [key,v] of csvRate)if(now-v.at>60000)csvRate.delete(key);
  if(count.count>12)return res.status(429).json({ok:false,charged:false,error:"CSV preflight limited to twelve attempts/minute/IP."});
  if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Use JSON application body."});
  const checked=inspectCsv(req.body);
  if(!checked.ok)return res.status(400).json({ok:false,charged:false,error:checked.reason,limits:CSV_LIMITS});
  res.locals.csvReport=checked;
  next();
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.csvReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  buyerDisclosure:"This is heuristic structural preflight, not a compliance/certification report, source-data proof, or guarantee of customer business results."
}));

app.get("/v1/generate-lowpoly",(req,res,next)=>{
  const allowed=Object.keys(req.query);
  if(allowed.some(k=>!["kind","seed"].includes(k)) || allowed.length>2 ||
     allowed.some(k=>typeof req.query[k]!=="string")){
    return res.status(400).json({ok:false,charged:false,error:"Only one kind and one integer seed query parameter are accepted."});
  }
  const kind=req.query.kind===undefined?"lantern":req.query.kind;
  const seedString=req.query.seed===undefined?"0":req.query.seed;
  if(!["lantern","marker"].includes(kind) || !/^(0|[1-9][0-9]{0,5})$/.test(seedString)){
    return res.status(400).json({ok:false,charged:false,error:"kind=lantern|marker; seed must be integer in [0,999999]."});
  }
  try{
    res.locals.lowpolyResult=generateOriginalGlb(kind,Number(seedString));
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"The deterministic model generator did not complete. No payment required."});
  }
  next();
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.lowpolyResult,ok:true,paid:true,chargedUSDC:"0.05",network:NETWORK,
  product:"AI-assisted original low-poly GLB generator with public source; as-is nonexclusive delivery. No proprietary exclusive code, guarantees, prior customer sales or renderer certification."
}));

const glbRequestByIp=new Map();
app.post("/v1/analyze-glb",
  express.json({limit:"2050kb",type:["application/json","application/*+json"]}),
  (req,res,next)=>{
    // Bound free preflight before x402; never hold a bad or oversized payload behind a charge.
    const now=Date.now(),ip=req.ip,prev=glbRequestByIp.get(ip);
    const current=(!prev||now-prev.started>60000)?{started:now,count:0}:prev;
    current.count++;glbRequestByIp.set(ip,current);
    if(glbRequestByIp.size>3000)for(const [key,v] of glbRequestByIp)if(now-v.started>60000)glbRequestByIp.delete(key);
    if(current.count>12)return res.status(429).json({ok:false,charged:false,error:"GLB analysis preflight limited to twelve attempts/minute per IP."});
    if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Use JSON body with glbBase64 only."});
    if(!req.body || typeof req.body!=="object" || Array.isArray(req.body) ||
        Object.keys(req.body).length!==1 || !Object.prototype.hasOwnProperty.call(req.body,"glbBase64")){
      return res.status(400).json({ok:false,charged:false,error:"Provide only {glbBase64: base64 of a glTF 2.0 binary GLB}.",maxGLBBytes:MAX_GLB_BYTES});
    }
    const report=parseGlbBase64(req.body.glbBase64);
    if(!report.ok)return res.status(400).json({ok:false,charged:false,error:report.error,maxGLBBytes:MAX_GLB_BYTES});
    res.locals.glbReport=report;
    next();
  },
  payment,
  (_req,res)=>res.status(200).json({...res.locals.glbReport,kind:"glb_v2_geometry_audit",
    paid:true,chargedUSDC:"0.01",network:NETWORK,
    disclosure:"x402 requires an independent signed buyer authorization and actual settlement. This GLB metadata endpoint itself has ZERO verified paid calls as of first-sale proof; a DIFFERENT template GET endpoint sold once externally for 0.01 native Base USDC in Oct 2026. No GLB upload customer sale is claimed."})
);

app.post("/v1/lint",express.json({limit:"85kb",type:["application/json","application/*+json"]}),(req,res,next)=>{
  if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({error:"Use application/json with {spec: OpenAPI YAML/JSON string}."});
  if(req.body===null||typeof req.body!=="object"||Array.isArray(req.body))return res.status(400).json({error:"Provide a JSON object with a spec field."});
  if(!Object.prototype.hasOwnProperty.call(req.body,"spec"))return res.status(400).json({error:"Missing required spec field."});
  const input=parseAndGuardSpec(req.body.spec);
  if(!input.ok)return res.status(400).json({error:input.error,charged:false});
  if(pendingChecks>=2)return res.status(503).json({ok:false,charged:false,error:"Server busy. Retry later, no payment accepted."});
  pendingChecks++;
  res.on("finish",()=>{pendingChecks=Math.max(0,pendingChecks-1);});
  res.locals.safeSpec=input.spec;
  res.locals.stats=input.stats;
  next();
},payment,async(req,res)=>{
  try{
    const lint=await lintSpec(res.locals.safeSpec);
    return res.status(200).json({ok:true,chargedUSDC:"0.01",network:NETWORK,redocly:lint,limits:res.locals.stats,guarantee:"Findings based on Redocly 2.64.1 recommended lint. This is not runtime API testing or security assessment."});
  }catch{
    // Avoid returning secrets, internal filesystem paths or misleading success.
    return res.status(503).json({ok:false,error:"Validator temporarily unavailable. No customer specification or secret material was logged."});
  }
});
app.use((err,_req,res,_next)=>{
  if(res.headersSent)return;
  const body={ok:false,charged:false,error:err?.type==="entity.too.large"?"Request exceeds 85kb JSON body limit.":"Invalid JSON envelope."};
  res.status(err?.type==="entity.too.large"?413:400).json(body);
});
const server=app.listen(PORT,BIND_HOST,()=>console.log("VM5 x402 OpenAPI lint service listening on "+BIND_HOST+":"+PORT+" for Base USDC; actual payment untested."));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
