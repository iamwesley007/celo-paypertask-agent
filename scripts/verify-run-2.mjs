// Verify-only for job #1 (live-run-2). Sends NO transactions.
// Confirms the three mined txs, the Paid state, the exact 0.05 payment,
// the attribution tag on each tx input, and writes runs/live-run-2.json.
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ATTRIBUTION_CODE, ATTRIBUTION_SUFFIX, decodeTag } from "./attribution.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const CONTRACT = "0x92bf7D34ea98E698461C7786f68787f8858BE3B6";
const BOUNTY = ethers.parseEther("0.05");
const TXS = {
  "create-job": "0xa9a5cdad867ff6ca3c259aecb669b451eebbd4d2c9a5a3a92c0536ad4aa2a4c5",
  "submit-result": "0x94be113003674abe7370948875061f6990f953f1ce9f1552d640615960ef5ff4",
  "approve-and-pay": "0x880a20e503d82fc95b9ae8d85f038d2096e6afe6e30ddd8abdfb4aad096b8f21",
};

const provider = new ethers.JsonRpcProvider(RPC);
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts/contracts/PayPerTask.sol/PayPerTask.json"), "utf8"));
const contract = new ethers.Contract(CONTRACT, artifact.abi, provider);

const run = {
  network: "celo", chainId: 42220, contract: CONTRACT,
  agent: "0x8fD6d6FCBf95c0f4042a3B8DDC352937950D5CD3",
  worker: "0x561022406387B6f6903B87088910d96230F012E1",
  attributionCode: ATTRIBUTION_CODE, attributionSuffix: ATTRIBUTION_SUFFIX,
  jobId: 1, startedAt: "2026-11-21T16:20:00Z", steps: [],
};
let totalGas = 0n;
for (const [name, hash] of Object.entries(TXS)) {
  const receipt = await provider.getTransactionReceipt(hash);
  const tx = await provider.getTransaction(hash);
  const decoded = decodeTag(tx.data);
  const tagOk = !!decoded && decoded.codes.includes(ATTRIBUTION_CODE);
  const cost = receipt.gasUsed * (receipt.gasPrice ?? 0n);
  totalGas += cost;
  console.log(`${name}: ${hash} status=${receipt.status} gas=${receipt.gasUsed} cost=${ethers.formatEther(cost)} tag=${tagOk ? "PRESENT " + decoded.codes.join(",") : "MISSING"}`);
  if (receipt.status !== 1 || !tagOk) throw new Error(`verification failed on ${name}`);
  run.steps.push({ name, tx: hash, gasUsed: receipt.gasUsed.toString(), costCelo: ethers.formatEther(cost) });
}

const job = await contract.getJob(1);
console.log(`job #1: status=${job.status} (2=Paid) bounty=${ethers.formatEther(job.bounty)} agent=${job.agent} worker=${job.worker}`);
if (Number(job.status) !== 2 || job.bounty !== 0n) throw new Error("job #1 not Paid with zeroed bounty");

// Worker balance: before the run it was 0.111573969666991539; it paid 0.0383524875 gas
// on submit-result, then received exactly 0.05 on approve-and-pay.
const expected = ethers.parseEther("0.111573969666991539") - ethers.parseEther("0.0383524875") + BOUNTY;
const actual = await provider.getBalance(run.worker);
console.log(`worker balance: ${ethers.formatEther(actual)} CELO (expected ${ethers.formatEther(expected)})`);
if (actual !== expected) throw new Error("worker balance does not match exact 0.05 payment");
const contractBal = await provider.getBalance(CONTRACT);
console.log(`contract balance: ${ethers.formatEther(contractBal)} CELO (expect 0)`);
if (contractBal !== 0n) throw new Error("contract balance not zero");

run.finishedAt = new Date().toISOString();
run.totalGasCostCelo = ethers.formatEther(totalGas);
run.verification = { tagPresentOnAllTxs: true, workerPaidExactlyCelo: "0.05", contractBalanceCelo: "0", finalStatus: 2 };
fs.writeFileSync(path.join(ROOT, "runs/live-run-2.json"), JSON.stringify(run, null, 2));
console.log(`DONE job #1 verified: Paid, worker +0.05 exactly, all 3 txs tagged. Total gas ${run.totalGasCostCelo} CELO. Saved runs/live-run-2.json`);
