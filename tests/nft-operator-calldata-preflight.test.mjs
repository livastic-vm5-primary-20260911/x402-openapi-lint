import test from "node:test";
import assert from "node:assert/strict";
import {
 inspectNftOperatorCalldata, SYNTHETIC_NFT_OPERATOR_APPROVAL, ORIGINAL_NFT_SYNTHETIC_OPERATOR
} from "../nft-operator-calldata-preflight.mjs";

const W = (x) => BigInt(x).toString(16).padStart(64,"0");
const A = (v) => "0".repeat(24)+v.slice(2).toLowerCase();
const ORIGINAL="0x000000000000000000000000000000000000dEaD";
const ZERO="0x"+"0".repeat(40);
const setApproval=(addr, flag) => "0xa22cb465"+A(addr)+W(flag);
const approve721=(addr, id) => "0x095ea7b3"+A(addr)+W(id);
const err=(value,standard,code)=>{
 assert.throws(()=>inspectNftOperatorCalldata(value,standard),(e)=>e.code===code);
};

test("valid deterministic synthetic original NFT collection-wide approval",()=>{
 const x=inspectNftOperatorCalldata();
 assert.equal(x.selector,"0xa22cb465");
 assert.equal(x.action,"setApprovalForAll");
 assert.equal(x.interpretedStandard,"ERC-721_OR_ERC-1155_DECLARED_BY_CALLER");
 assert.deepEqual(x.decoded,{operator:ORIGINAL.toLowerCase(),approved:true});
 assert.equal(x.warningCount,1);
 assert.equal(x.warnings[0].code,"COLLECTION_WIDE_OPERATOR_APPROVAL");
 assert.equal(x.noTransactionSent,true);
 assert.equal(x.noRpcWalletPrivateDataOrBlockchainCalls,true);
 assert.equal(x.actualTokenContractIdentified,false);
 assert.equal(x.isTxSignatureRequested,false);
 assert.equal(SYNTHETIC_NFT_OPERATOR_APPROVAL.length,138);
 assert.equal(ORIGINAL_NFT_SYNTHETIC_OPERATOR.toLowerCase(),ORIGINAL.toLowerCase());
});
test("collection-wide false removal is not confused with proof of current revocation",()=>{
 const x=inspectNftOperatorCalldata(setApproval(ORIGINAL,0),"erc1155");
 assert.equal(x.decoded.approved,false);
 assert.equal(x.warningCount,1);
 assert.equal(x.warnings[0].code,"COLLECTION_OPERATOR_APPROVAL_DISABLED");
 assert.equal(x.interpretedStandard,"ERC1155");
 assert.equal(x.isCurrentApprovalConfirmedOnchain,false);
});
test("caller declared ERC721 only, standards remain unverified",()=>{
 const x=inspectNftOperatorCalldata(setApproval(ORIGINAL,1),"erc721");
 assert.equal(x.interpretedStandard,"ERC721");
 assert.equal(x.warningCount,1);
 assert.equal(x.actualTokenContractIdentified,false);
});
test("reject noncanonical boolean, including 2 and max uint",()=>{
 err(setApproval(ORIGINAL,2),"unspecified","NON_CANONICAL_ABI_BOOL");
 err(setApproval(ORIGINAL,(1n<<256n)-1n),"unspecified","NON_CANONICAL_ABI_BOOL");
});
test("reject wrong selector, truncation, unknown types, padded garbage",()=>{
 err("0x12345678"+A(ORIGINAL)+W(1),"unspecified","UNSUPPORTED_NFT_OPERATOR_SELECTOR");
 err("0xa22cb465"+A(ORIGINAL)+W(1).slice(1),"unspecified","INVALID_OR_NONCANONICAL_NFT_CALLDATA");
 err("0xa22cb465"+A(ORIGINAL)+W(1)+"00","unspecified","INVALID_OR_NONCANONICAL_NFT_CALLDATA");
 err("0xa22cb465"+A(ORIGINAL)+W(1).replace("0","G"),"unspecified","INVALID_OR_NONCANONICAL_NFT_CALLDATA");
 err(undefined,"what-ever","INVALID_STANDARD");
 err(12,"unspecified","INVALID_OR_NONCANONICAL_NFT_CALLDATA");
 err("0xa22cb465"+"F"+"0".repeat(23)+ORIGINAL.slice(2)+W(1),"unspecified","NON_CANONICAL_ABI_ADDRESS_PADDING");
});
test("zero operator flagged without misrepresenting onchain permissions",()=>{
 const x=inspectNftOperatorCalldata(setApproval(ZERO,1));
 assert.equal(x.warningCount,2);
 assert.deepEqual(x.warnings.map(a=>a.code),["ZERO_NFT_OPERATOR","COLLECTION_WIDE_OPERATOR_APPROVAL"]);
});
test("ERC721 token-specific approve is ambiguous without explicit standard",()=>{
 const v=approve721(ORIGINAL,7);
 err(v,"unspecified","AMBIGUOUS_APPROVE_SELECTOR_REQUIRES_EXPLICIT_ERC721");
 err(v,"erc1155","AMBIGUOUS_APPROVE_SELECTOR_REQUIRES_EXPLICIT_ERC721");
 const x=inspectNftOperatorCalldata(v,"erc721");
 assert.equal(x.action,"approve");
 assert.deepEqual(x.decoded,{spender:ORIGINAL.toLowerCase(),tokenId:"7",uint256Maximum:false});
 assert.equal(x.warnings[0].code,"TOKEN_SPECIFIC_APPROVAL");
 assert.match(x.caveat,/Never infers actual token standard/);
});
test("ERC721 approve max token ID is an ID, never ERC20 allowance",()=>{
 const v=approve721(ORIGINAL,(1n<<256n)-1n);
 const x=inspectNftOperatorCalldata(v,"erc721");
 assert.equal(x.decoded.tokenId,((1n<<256n)-1n).toString());
 assert.equal(x.decoded.uint256Maximum,true);
 assert.equal(x.warnings.some(a=>a.code==="UNLIMITED_ALLOWANCE"),false);
});
test("zero token-specific approval address flagged as potentially clearing",()=>{
 const x=inspectNftOperatorCalldata(approve721(ZERO,100),"erc721");
 assert.equal(x.warningCount,2);
 assert.deepEqual(x.warnings.map(a=>a.code),["TOKEN_SPECIFIC_APPROVAL","ZERO_NFT_APPROVEE"]);
});
test("upper-case canonical calldata is recognized and normalized; no wallet or RPC",()=>{
 const hex=setApproval(ORIGINAL,1).toUpperCase().replace(/^0X/,"0x");
 const x=inspectNftOperatorCalldata(hex,"erc721");
 assert.equal(x.decoded.operator,ORIGINAL.toLowerCase());
 assert.equal(x.noTransactionSent,true);
});
