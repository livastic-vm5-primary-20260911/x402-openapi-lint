/**
 * Original narrow offline parser for CANONICAL PUBLIC ERC-20 receipt-event data.
 * No chain access, wallet access, signing, token metadata, or actual receipt proof.
 * Specifically excludes ERC-721 Transfer(topic3 tokenId) and ERC-1155 formats.
 */
export const ERC20_TRANSFER_TOPIC0="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ERC20_APPROVAL_TOPIC0="0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const ZERO="0x"+"0".repeat(40);
const MAX_UINT=(1n<<256n)-1n;
const topicAddress=address=>"0x"+address.replace(/^0x/,"").toLowerCase().padStart(64,"0");
export const SYNTHETIC_ERC20_APPROVAL_EVENT=Object.freeze({
  topic0:ERC20_APPROVAL_TOPIC0,
  topic1:topicAddress("0x"+"11".repeat(20)),
  topic2:topicAddress("0x000000000000000000000000000000000000dEaD"),
  data:"0x"+"ff".repeat(32)
});
const problem=code=>{const error=new Error(code);error.code=code;throw error;};
export function decodeUnsignedERC20Event(input=SYNTHETIC_ERC20_APPROVAL_EVENT){
 if(input===null||typeof input!=="object"||Array.isArray(input))problem("INVALID_EVENT_INPUT");
 const allowed=["topic0","topic1","topic2","data"];
 const keys=Object.keys(input);
 if(keys.length!==4 || keys.some(k=>!allowed.includes(k)))problem("NON_CANONICAL_EVENT_FIELDS");
 for(const key of allowed){
  if(typeof input[key]!=="string"||!/^0x[0-9a-fA-F]{64}$/.test(input[key]))
   problem("INVALID_TOPIC_OR_DATA_"+key.toUpperCase());
 }
 const t0=input.topic0.toLowerCase();
 const method=t0===ERC20_TRANSFER_TOPIC0?"Transfer":t0===ERC20_APPROVAL_TOPIC0?"Approval":null;
 if(!method)problem("UNSUPPORTED_ERC20_EVENT_SIGNATURE");
 const getAddress=(topic,field)=>{
  const text=topic.slice(2).toLowerCase();
  if(text.slice(0,24)!=="0".repeat(24))problem("NON_CANONICAL_"+field.toUpperCase()+"_PADDING");
  return "0x"+text.slice(24);
 };
 const firstName=method==="Transfer"?"from":"owner",secondName=method==="Transfer"?"to":"spender";
 const decoded={[firstName]:getAddress(input.topic1,firstName),[secondName]:getAddress(input.topic2,secondName),
   valueAtomic:BigInt(input.data).toString(10)};
 const warnings=[];
 for(const key of [firstName,secondName]){
  if(decoded[key]===ZERO)warnings.push({code:"ZERO_ADDRESS",field:key,
    message:"The encoded address is zero; do not assume a valid sender, recipient or operator."});
 }
 const maxApproval=method==="Approval" && decoded.valueAtomic===MAX_UINT.toString();
 if(maxApproval)warnings.push({code:"UNLIMITED_APPROVAL_EVENT",field:"valueAtomic",
   message:"The encoded Approval value is uint256.max. Verify issuer, spender, token contract and actual allowance independently."});
 return {
  ok:true,kind:"evm_erc20_unsigned_event_log_preflight",
  eventSignature:t0,eventType:method,
  decoded,warningCount:warnings.length,warnings,unlimitedApprovalEvent:maxApproval,
  noWalletOrChainCalls:true,noSignatureOrTransaction:true,
  emitterContractVerified:false,logInFinalizedReceiptVerified:false,tokenDecimalsVerified:false,
  caveat:"Strict ABI syntax only. Does NOT prove the emitting contract implements ERC-20, the data was emitted on a real chain, finality, true spender allowance, token decimals, buyer identity, or safety. ERC-721 and ERC-1155 formats are outside scope."
 };
}
