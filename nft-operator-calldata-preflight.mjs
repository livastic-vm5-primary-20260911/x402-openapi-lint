/**
 * Public UNSIGNED NFT collection operator-permission calldata interpreter.
 *
 * Offline, read-only. ERC-721 and ERC-1155 share setApprovalForAll(address,bool)
 * selector 0xa22cb465. They also share a read-only isApprovedForAll(address,address),
 * which this paid transaction-intent preflight intentionally does NOT decode.
 *
 * ERC-721 approve(address,uint256) shares selector 0x095ea7b3 with ERC-20's
 * approve(address,uint256). Only decode the ERC-721 interpretation when an
 * explicit standard=erc721 is provided. This is NOT a contract identity check.
 */
const MAX_UINT256=(1n<<256n)-1n;
const ZERO="0x"+"0".repeat(40);
const SEP="0".repeat(24);
export const ORIGINAL_NFT_SYNTHETIC_OPERATOR="0x000000000000000000000000000000000000dEaD";
export const SYNTHETIC_NFT_OPERATOR_APPROVAL=
  "0xa22cb465"+SEP+ORIGINAL_NFT_SYNTHETIC_OPERATOR.slice(2)+"0".repeat(63)+"1";

function fail(code){
  const e=new Error(code);e.code=code;throw e;
}
function address(word) {
  if(word.length!==64 || word.slice(0,24)!==SEP)fail("NON_CANONICAL_ABI_ADDRESS_PADDING");
  return "0x"+word.slice(24);
}
function result(selector, standard, action, decoded, warnings) {
  return {
    ok:true,
    kind:"evm_nft_unsigned_operator_authorization_preflight",
    selector:"0x"+selector,
    interpretedStandard:standard,
    action,
    decoded,
    warnings,
    warningCount:warnings.length,
    isCurrentApprovalConfirmedOnchain:false,
    actualTokenContractIdentified:false,
    actualNftCollectionOwnershipVerified:false,
    isTxSignatureRequested:false,
    noRpcWalletPrivateDataOrBlockchainCalls:true,
    noTransactionSent:true,
    caveat:"Static unsigned ABI interpretation only. Never infers actual token standard, NFT operator trustworthiness, collection ownership, chain, signature validity, onchain approval state or transaction safety. Confirm genuine contract, chain and caller independently before authorizing."
  };
}
export function inspectNftOperatorCalldata(calldata=SYNTHETIC_NFT_OPERATOR_APPROVAL, standard="unspecified") {
  if(typeof calldata!=="string"||calldata.length!==138||
     !/^0x[0-9a-fA-F]{136}$/.test(calldata))fail("INVALID_OR_NONCANONICAL_NFT_CALLDATA");
  if(!["unspecified","erc721","erc1155"].includes(standard))fail("INVALID_STANDARD");
  const hex=calldata.slice(2).toLowerCase();
  const selector=hex.slice(0,8);
  const word0=hex.slice(8,72),word1=hex.slice(72,136);
  if(selector==="a22cb465"){
    const operator=address(word0);
    const flag=BigInt("0x"+word1);
    if(flag>1n)fail("NON_CANONICAL_ABI_BOOL");
    const approved=flag===1n;
    const warnings=[];
    if(operator===ZERO)warnings.push({code:"ZERO_NFT_OPERATOR",field:"operator",
      message:"A zero operator address is encoded. Confirm the intended NFT contract's behavior."});
    if(approved)warnings.push({code:"COLLECTION_WIDE_OPERATOR_APPROVAL",field:"approved",
      message:"setApprovalForAll(true) can authorize this operator to manage ALL NFTs under the called ERC-721/1155 collection, not just one token ID."});
    else warnings.push({code:"COLLECTION_OPERATOR_APPROVAL_DISABLED",field:"approved",
      message:"setApprovalForAll(false) is an intended operator-authorization removal, not proof of current revocation without an onchain transaction."});
    const label=standard==="unspecified"?"ERC-721_OR_ERC-1155_DECLARED_BY_CALLER":standard.toUpperCase();
    return result(selector,label,"setApprovalForAll",{operator,approved},warnings);
  }
  if(selector==="095ea7b3"){
    if(standard!=="erc721")fail("AMBIGUOUS_APPROVE_SELECTOR_REQUIRES_EXPLICIT_ERC721");
    const spender=address(word0);
    const tokenId=BigInt("0x"+word1);
    const warnings=[{code:"TOKEN_SPECIFIC_APPROVAL",field:"tokenId",
      message:"If this address is a genuine ERC-721 contract, approve(to, tokenId) delegates control of one token only. The same selector means ERC-20 approve on other contracts; syntax cannot distinguish."}];
    if(spender===ZERO)warnings.push({code:"ZERO_NFT_APPROVEE",field:"spender",
      message:"A zero approved address may clear a token-specific approval; no onchain state is checked."});
    return result(selector,"ERC721_UNVERIFIED_CALLER_ASSERTION","approve",
      {spender,tokenId:tokenId.toString(10),uint256Maximum:tokenId===MAX_UINT256},warnings);
  }
  fail("UNSUPPORTED_NFT_OPERATOR_SELECTOR");
}
