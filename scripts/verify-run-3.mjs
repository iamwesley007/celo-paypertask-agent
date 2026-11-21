// Verify-only for job #2 (live-run-3). Sends NO transactions.
// Confirms the three mined txs, the Paid state, the exact 0.05 payment,
// BOTH attribution codes on each tx input, and writes runs/live-run-3.json.
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ATTRIBUTION_CODES, ATTRIBUTION_SUFFIX, decodeTag } from "./attribution.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const CONTRACT = "0x92bf7D34ea98E698461C7786f68787f8858BE3B6";
const BOUNTY = ethers.parseEther("0.05");
const TXS = {
  "create-job": "0x08f0254db3804c3ab32c8b4be962b36d73d6e993b318595dcb0c63708c2bc613",
  "submit-result": "0x5487e9efb72e5d208b125ea3a2a65c8c092472dae3d160f27b15f5313d274128",
  "approve-and-pay": "0xd7f16e21977320ee867e77c5ecfaf03a58f53d5aa043ee0fd4d4c465d807a66c",
};

const provider = new ethers.JsonRpcProvider(RPC);
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts/contracts/PayPerTask.sol/PayPerTask.json"), "utf8"));
const contract = new ethers.Contract(CONTRACT, artifact.abi, provider);

const run = {
  network: "celo", chainId: 42220, contract: CONTRACT,
  agent: "0x8fD6d6FCBf95c0f4042a3B8DDC352937950D5CD3",
  worker: "0x561022406387B6f6903B87088910d96230F012E1",
  attributionCodes: ATTRIBUTION_CODES, attributionSuffix: ATTRIBUTION_SUFFIX,
  jobId: 2, startedAt: "2026-11-21T17:27:00Z", steps: [],
};
let totalGas = 0n;
for (const [name, hash] of Object.entries(TXS)) {
  const receipt = await provider.getTransactionReceipt(hash);
  const tx = await provider.getTransaction(hash);
  const decoded = decodeTag(tx.data);
  const tagOk = !!decoded && ATTRIBUTION_CODES.every((c) => decoded.codes.includes(c));
  const cost = receipt.gasUsed * (receipt.gasPrice ?? 0n);
  totalGas += cost;
  console.log(`${name}: ${hash} status=${receipt.status} gas=${receipt.gasUsed} cost=${ethers.formatEther(cost)} tag=${tagOk ? "PRESENT " + decoded.codes.join(",") : "MISSING"}`);
  if (receipt.status !== 1 || !tagOk) throw new Error(`verification failed on ${name}`);
  run.steps.push({ name, tx: hash, gasUsed: receipt.gasUsed.toString(), costCelo: ethers.formatEther(cost) });
}

const job = await contract.getJob(2);
console.log(`job #2: status=${job.status} (2=Paid) bounty=${ethers.formatEther(job.bounty)} agent=${job.agent} worker=${job.worker}`);
if (Number(job.status) !== 2 || job.bounty !== 0n) throw new Error("job #2 not Paid with zeroed bounty");

// Worker balance: before the run it was 0.123221482166991539; it paid 0.0430666875 gas
// on submit-result, then received exactly 0.05 on approve-and-pay.
const expected = ethers.parseEther("0.123221482166991539") - ethers.parseEther("0.0430666875") + BOUNTY;
const actual = await provider.getBalance(run.worker);
console.log(`worker balance: ${ethers.formatEther(actual)} CELO (expected ${ethers.formatEther(expected)})`);
if (actual !== expected) throw new Error("worker balance does not match exact 0.05 payment");
const contractBal = await provider.getBalance(CONTRACT);
console.log(`contract balance: ${ethers.formatEther(contractBal)} CELO (expect 0)`);
if (contractBal !== 0n) throw new Error("contract balance not zero");

run.finishedAt = new Date().toISOString();
run.totalGasCostCelo = ethers.formatEther(totalGas);
run.verification = { tagPresentOnAllTxs: true, workerPaidExactlyCelo: "0.05", contractBalanceCelo: "0", finalStatus: 2 };
fs.writeFileSync(path.join(ROOT, "runs/live-run-3.json"), JSON.stringify(run, null, 2));
console.log(`DONE job #2 verified: Paid, worker +0.05 exactly, all 3 txs carry both tags. Total gas ${run.totalGasCostCelo} CELO. Saved runs/live-run-3.json`);
