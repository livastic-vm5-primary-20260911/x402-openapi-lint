import test from "node:test";
import assert from "node:assert/strict";
import {
 decodeUnsignedERC20Event,SYNTHETIC_ERC20_APPROVAL_EVENT,
 ERC20_TRANSFER_TOPIC0,ERC20_APPROVAL_TOPIC0
} from "../erc20-event-preflight.mjs";

const address=(a)=>"0x"+"0".repeat(24)+a.toLowerCase().replace(/^0x/,"");
const scalar=(v)=>"0x"+BigInt(v).toString(16).padStart(64,"0");
const MAX=(1n<<256n)-1n;
const A="0x1111111111111111111111111111111111111111";
const B="0x2222222222222222222222222222222222222222";
const make=(topic0,first,second,value)=>({topic0,topic1:address(first),topic2:address(second),data:scalar(value)});
test("Free fixture is explicitly synthetic canonical Approval max allowance warning, no crypto activity",()=>{
 const x=decodeUnsignedERC20Event();
 assert.equal(x.eventSignature,ERC20_APPROVAL_TOPIC0);
 assert.equal(x.eventType,"Approval");assert.equal(x.unlimitedApprovalEvent,true);
 assert.equal(x.decoded.valueAtomic,MAX.toString(10));
 assert.equal(x.decoded.spender,"0x000000000000000000000000000000000000dead");
 assert.equal(x.warningCount,1);assert.equal(x.warnings[0].code,"UNLIMITED_APPROVAL_EVENT");
 assert.equal(x.emitterContractVerified,false);assert.equal(x.noWalletOrChainCalls,true);
 assert.equal(x.noSignatureOrTransaction,true);assert.equal(x.logInFinalizedReceiptVerified,false);
 assert.equal(Object.isFrozen(SYNTHETIC_ERC20_APPROVAL_EVENT),true);
});
test("Actual publicly supplied canonical Transfer/Approval words decode deterministic raw uint256",()=>{
 const a=decodeUnsignedERC20Event(make(ERC20_TRANSFER_TOPIC0,A,B,10000n));
 assert.equal(a.eventType,"Transfer");assert.deepEqual(a.decoded,{from:A,to:B,valueAtomic:"10000"});
 assert.equal(a.warningCount,0);assert.equal(a.unlimitedApprovalEvent,false);
 const b=decodeUnsignedERC20Event(make(ERC20_APPROVAL_TOPIC0,A,B,250n));
 assert.equal(b.eventType,"Approval");assert.deepEqual(b.decoded,{owner:A,spender:B,valueAtomic:"250"});
 assert.equal(b.unlimitedApprovalEvent,false);assert.equal(b.warningCount,0);
});
test("Zero participant warnings are explicit and raw 0-value approvals not claimed revoked",()=>{
 const x=decodeUnsignedERC20Event(make(ERC20_TRANSFER_TOPIC0,A,"0x"+"0".repeat(40),0));
 assert.equal(x.warningCount,1);assert.equal(x.warnings[0].code,"ZERO_ADDRESS");
 assert.equal(x.warnings[0].field,"to");
 assert.match(x.caveat,/does NOT prove/i);
});
test("Reject non-ERC20 topic signatures, ERC721 indexed tokenId and malformed ABI BEFORE payment",()=>{
 const valid=make(ERC20_TRANSFER_TOPIC0,A,B,1);
 const bad=[
  {},null,[],{...valid,topic0:"0x"+"00".repeat(32)},
  {...valid,topic1:"0x"+"10".repeat(32)},
  {...valid,topic2:"0x"+"11".repeat(32)},
  {...valid,data:"0x1"}, {...valid,data:"0x"+"gg".repeat(32)},
  {...valid,topic3:scalar(42)}, {...valid,topics:[valid.topic0,valid.topic1,valid.topic2]},
  {...valid,topic0:"0x"+ERC20_TRANSFER_TOPIC0.slice(2).slice(0,-2)}, 
  {...valid,topic1:0},{...valid,data:"0x"+"0".repeat(65)}
 ];
 for(const v of bad)assert.throws(()=>decodeUnsignedERC20Event(v),/INVALID|UNSUPPORTED|NON_CANONICAL/,JSON.stringify(v)?.slice(0,95));
});
