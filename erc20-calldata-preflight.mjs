/**
 * Strict offline ABI decoding of a small set of canonical ERC-20 calldata.
 * NO JSON-RPC, signatures, private keys, calls to addresses or execution.
 * This is a developer convenience / review aid, not a smart-contract audit.
 */
const METHODS=Object.freeze({
  "a9059cbb":{method:"transfer",args:["recipient","amountAtomic"]},
  "095ea7b3":{method:"approve",args:["spender","amountAtomic"]},
  "23b872dd":{method:"transferFrom",args:["sender","recipient","amountAtomic"]},
  "39509351":{method:"increaseAllowance",args:["spender","amountAtomic"]},
  "a457c2d7":{method:"decreaseAllowance",args:["spender","amountAtomic"]}
});
const MAX_UINT256=(1n<<256n)-1n;
const ZERO="0x"+"0".repeat(40);
export const DEFAULT_ERC20_CALLDATA=
  "0x095ea7b3"+"0".repeat(24)+"000000000000000000000000000000000000dEaD"+MAX_UINT256.toString(16).padStart(64,"0");

function problem(code){const e=new Error(code);e.code=code;throw e;}
export function inspectErc20Calldata(input=DEFAULT_ERC20_CALLDATA){
  if(typeof input!=="string" || input.length>202 || input.length<10 || !/^0x[0-9a-fA-F]+$/.test(input))
    problem("INVALID_HEX_CALLDATA");
  const hex=input.slice(2).toLowerCase();
  const selector=hex.slice(0,8);
  const method=METHODS[selector];
  if(!method)problem("UNSUPPORTED_ERC20_SELECTOR");
  if(hex.length!==8+method.args.length*64)problem("NON_CANONICAL_ABI_LENGTH");
  const decoded={},warnings=[];
  for(let i=0;i<method.args.length;i++){
    const kind=method.args[i],word=hex.slice(8+i*64,72+i*64);
    if(kind==="amountAtomic"){decoded.amountAtomic=BigInt("0x"+word).toString(10);continue;}
    if(word.slice(0,24)!=="0".repeat(24))problem("NON_CANONICAL_ABI_ADDRESS_PADDING");
    decoded[kind]="0x"+word.slice(24);
    if(decoded[kind]===ZERO)warnings.push({code:"ZERO_ADDRESS",field:kind,
      message:"A zero address is encoded; check the caller intent before signing."});
  }
  const allowanceOperation=["approve","increaseAllowance","decreaseAllowance"].includes(method.method);
  const isUnlimited=allowanceOperation && decoded.amountAtomic===MAX_UINT256.toString();
  if(isUnlimited)warnings.push({code:"UNLIMITED_ALLOWANCE",field:"amountAtomic",
    message:"Maximum uint256 allowance: a spender can potentially transfer all approved tokens if the token contract honours this approval."});
  if(method.method==="approve" && decoded.amountAtomic==="0")
    warnings.push({code:"ZERO_ALLOWANCE",field:"amountAtomic",message:"Approving zero may revoke an allowance; verify intent."});
  return {
    ok:true,kind:"evm_erc20_unsigned_calldata_preflight",abiStandard:"ERC-20 canonical static ABI",
    selector:"0x"+selector,method:method.method,decoded,
    warningCount:warnings.length,warnings,
    allowanceUnlimited:isUnlimited,
    noWalletOrBlockchainUsed:true,noTransactionSent:true,
    tokenContractKnown:false,chainIdKnown:false,tokenDecimalsKnown:false,
    caveat:"Syntax-only ABI decoding, not contract identification, transaction simulation, allowance state, spend authorization, phishing detection, onchain settlement or security audit. Verify chain, token contract and recipient independently before signing."
  };
}
