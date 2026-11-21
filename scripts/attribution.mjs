// ERC-8021 attribution tags for PayPerTask (Celo).
// Two codes, per the celo-org/attribution-tags guide: keep your own code AND
// include the tag Loops House assigned at registration — only the assigned
// tag is credited by the hackathon leaderboard.
//   - own code: codeFromRepo("iamwesley007/celo-paypertask-agent")
//   - assigned tag: shown on the Loops House enrollment page ("your
//     attribution tag") for this entry.
// toDataSuffix([own, assigned]) puts BOTH codes in one Schema 0 suffix.
// The suffix is appended to the calldata of every transaction the agent
// sends. The EVM discards trailing bytes, so execution semantics are
// unchanged — the tags are only visible to off-chain readers (the Loops
// House / Celo attribution indexer).
// ethers v6 has no native dataSuffix support, so tagging is done explicitly:
// populate the call, append the suffix, re-estimate gas, send.
import { codeFromRepo, toDataSuffix, fromDataSuffix } from "@celo/attribution-tags";

export const ATTRIBUTION_CODE = codeFromRepo("iamwesley007/celo-paypertask-agent");
// Guard against a renamed repo / stale derivation: the code must match.
if (ATTRIBUTION_CODE !== "celo_321f7b9760c9") {
  throw new Error(`attribution code mismatch: ${ATTRIBUTION_CODE}`);
}
// Tag assigned by Loops House at registration (shown on the enrollment page).
export const ASSIGNED_TAG = "celo_06dad60c3e09";
export const ATTRIBUTION_CODES = [ATTRIBUTION_CODE, ASSIGNED_TAG];
export const ATTRIBUTION_SUFFIX = toDataSuffix(ATTRIBUTION_CODES);

// Append the tag to a tx's calldata ("0x" for a plain value transfer).
export function tagData(data) {
  const base = data && data !== "0x" ? data : "0x";
  return base + ATTRIBUTION_SUFFIX.slice(2);
}

// Decode the tag from onchain tx input; returns { codes, schemaId } or null.
export function decodeTag(data) {
  return fromDataSuffix(data);
}

// Send a transaction with the tag appended, gas re-estimated on the tagged data.
export async function sendTagged(signer, tx) {
  const tagged = { ...tx, data: tagData(tx.data ?? "0x") };
  delete tagged.gasLimit;
  tagged.gasLimit = await signer.estimateGas(tagged);
  return signer.sendTransaction(tagged);
}

// Populate a contract call, append the tag, send it. Returns the tx response.
// signer: the ethers Wallet sending; contract: ethers Contract (any runner);
// method: function name; args: call args; overrides: e.g. { value }.
export async function callTagged(signer, contract, method, args, overrides = {}) {
  const populated = await contract[method].populateTransaction(...args, overrides);
  return sendTagged(signer, populated);
}
