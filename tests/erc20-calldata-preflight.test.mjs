import test from "node:test";
import assert from "node:assert/strict";
import {inspectErc20Calldata,DEFAULT_ERC20_CALLDATA} from "../erc20-calldata-preflight.mjs";

const address=(addr)=>"0".repeat(24)+addr.toLowerCase().replace(/^0x/,"");
const amount=(v)=>BigInt(v).toString(16).padStart(64,"0");
const a="0x1111111111111111111111111111111111111111";
const b="0x2222222222222222222222222222222222222222";
const wordMax=(1n<<256n)-1n;
const enc=(selector,...words)=>"0x"+selector+words.join("");

test("The free example decodes approve(maxUint256) and warns about an unlimited spender allowance",()=>{
 const x=inspectErc20Calldata(DEFAULT_ERC20_CALLDATA);
 assert.equal(x.ok,true);assert.equal(x.method,"approve");
 assert.equal(x.selector,"0x095ea7b3");
 assert.equal(x.decoded.spender,"0x000000000000000000000000000000000000dead");
 assert.equal(x.decoded.amountAtomic,wordMax.toString(10));
 assert.equal(x.warningCount,1);
 assert.equal(x.warnings[0].code,"UNLIMITED_ALLOWANCE");
 assert.equal(x.allowanceUnlimited,true);
 assert.equal(x.noWalletOrBlockchainUsed,true);assert.equal(x.noTransactionSent,true);
 assert.equal(x.tokenContractKnown,false);assert.equal(x.tokenDecimalsKnown,false);
});
test("Normal transfer and transferFrom decode only canonical static address and integer slots",()=>{
 const transfer=inspectErc20Calldata(enc("a9059cbb",address(a),amount(250)));
 assert.equal(transfer.method,"transfer");assert.deepEqual(transfer.decoded,{recipient:a,amountAtomic:"250"});
 assert.equal(transfer.warningCount,0);assert.equal(transfer.allowanceUnlimited,false);
 const from=inspectErc20Calldata(enc("23b872dd",address(a),address(b),amount("123456789098765432100")));
 assert.equal(from.method,"transferFrom");assert.deepEqual(from.decoded,{sender:a,recipient:b,amountAtomic:"123456789098765432100"});
});
test("Small, zero and max approvals are decoded accurately without token-decimal guesses",()=>{
 const small=inspectErc20Calldata(enc("095ea7b3",address(a),amount(55)));
 assert.equal(small.warningCount,0);assert.equal(small.allowanceUnlimited,false);
 const zero=inspectErc20Calldata(enc("095ea7b3",address(a),amount(0)));
 assert.equal(zero.warnings[0].code,"ZERO_ALLOWANCE");
 const inc=inspectErc20Calldata(enc("39509351",address(a),amount(20)));
 assert.equal(inc.method,"increaseAllowance");assert.equal(inc.allowanceUnlimited,false);
 const dec=inspectErc20Calldata(enc("a457c2d7",address(a),amount(20)));
 assert.equal(dec.method,"decreaseAllowance");assert.equal(dec.decoded.amountAtomic,"20");
});
test("Zero-address transfer is highlighted but not represented as proven onchain effect",()=>{
 const d=inspectErc20Calldata(enc("a9059cbb",address("0x"+"0".repeat(40)),amount(1)));
 assert.equal(d.warningCount,1);assert.equal(d.warnings[0].code,"ZERO_ADDRESS");
 assert.match(d.caveat,/not contract identification/i);
});
test("Reject malformed, giant, unknown and noncanonical encodings before billing",()=>{
 const malformed=[
  null,undefined,"","garbage","0x","0xa9059cbb","0xabcdeFGH",
  enc("deadbeef",address(a),amount(1)),
  enc("a9059cbb",address(a),amount(1),"0".repeat(64)),
  enc("a9059cbb",address(a),amount(1)).slice(0,-2),
  enc("a9059cbb","1".repeat(64),amount(1)),
  enc("23b872dd",address(a),address(b),amount(1))+"0".repeat(64),
  "0x"+"00".repeat(500)
 ];
 for(const invalid of malformed){
  if(invalid===undefined)continue; // undefined intentionally selects explicit synthetic default
  assert.throws(()=>inspectErc20Calldata(invalid),/INVALID|UNSUPPORTED|NON_CANONICAL/,String(invalid)?.slice(0,22));
 }
});
