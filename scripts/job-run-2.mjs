// Fresh TAGGED job run (job #1) for the PayPerTask entry.
// Same shape as proven job #0 (runs/live-run-1.json), but every transaction
// carries the ERC-8021 attribution tag (scripts/attribution.mjs), so the
// Loops House / Celo indexer can attribute the activity to this project.
// Usage: node scripts/job-run-2.mjs
// Reads deployer.key + runs/worker.key (never printed, never committed).
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ATTRIBUTION_CODE, ATTRIBUTION_SUFFIX, decodeTag, sendTagged, callTagged } from "./attribution.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const EXPLORER = "https://celoscan.io";

const JOB_DESCRIPTION = "Write a one-line summary of how PayPerTask pays a worker for a finished job.";
const BOUNTY = ethers.parseEther("0.05");
const RESULT = "PayPerTask locks a CELO bounty in the contract when the job is posted, and releases it to the worker once the agent verifies the delivered work onchain.";

const key = fs.readFileSync(path.join(ROOT, "deployer.key"), "utf8").trim();
const provider = new ethers.JsonRpcProvider(RPC);
const agent = new ethers.Wallet(key, provider);

const deployment = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/celo.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts/contracts/PayPerTask.sol/PayPerTask.json"), "utf8"));
const contract = new ethers.Contract(deployment.address, artifact.abi, agent);

const workerKey = fs.readFileSync(path.join(ROOT, "runs/worker.key"), "utf8").trim();
const worker = new ethers.Wallet(workerKey, provider);
const workerContract = new ethers.Contract(deployment.address, artifact.abi, worker);

const run = {
  network: "celo",
  chainId: 42220,
  contract: deployment.address,
  agent: agent.address,
  worker: worker.address,
  attributionCode: ATTRIBUTION_CODE,
  attributionSuffix: ATTRIBUTION_SUFFIX,
  startedAt: new Date().toISOString(),
  steps: [],
};
let totalGasCost = 0n;

function recordReceipt(name, receipt, extra = {}) {
  const cost = receipt.gasUsed * (receipt.gasPrice ?? 0n);
  totalGasCost += cost;
  console.log(`${name}: ${receipt.hash}`);
  console.log(`  explorer: ${EXPLORER}/tx/${receipt.hash}`);
  console.log(`  gas used: ${receipt.gasUsed} | cost: ${ethers.formatEther(cost)} CELO | status: ${receipt.status}`);
  if (receipt.status !== 1) throw new Error(`Step ${name} tx failed onchain: ${receipt.hash}`);
  run.steps.push({ name, tx: receipt.hash, gasUsed: receipt.gasUsed.toString(), costCelo: ethers.formatEther(cost), ...extra });
  return receipt;
}

async function sendStep(name, txPromise, extra = {}) {
  const tx = await txPromise;
  console.log(`${name} sent: ${tx.hash}`);
  const receipt = await tx.wait();
  return recordReceipt(name, receipt, extra);
}

// Verify the attribution tag is present in a mined tx's onchain input.
async function verifyTag(name, hash) {
  const tx = await provider.getTransaction(hash);
  const decoded = decodeTag(tx.data);
  const ok = !!decoded && decoded.codes.includes(ATTRIBUTION_CODE);
  console.log(`  tag on ${name}: ${ok ? "PRESENT " + decoded.codes.join(",") : "MISSING!"}`);
  if (!ok) throw new Error(`Attribution tag missing on ${name} tx ${hash}`);
  return ok;
}

const jobId = Number(await contract.jobCount());
console.log(`jobCount before: ${jobId} (new job will be #${jobId})`);
console.log(`agent: ${agent.address} | worker: ${worker.address}`);
console.log(`attribution code: ${ATTRIBUTION_CODE}`);

// Worker already holds 0.1116 CELO from run #1; fund only if it cannot cover a submit (~0.04 CELO).
const workerBalBefore = await provider.getBalance(worker.address);
console.log(`worker balance before: ${ethers.formatEther(workerBalBefore)} CELO`);
if (workerBalBefore < ethers.parseEther("0.06")) {
  await sendStep("fund-worker", sendTagged(agent, {
    to: worker.address, value: ethers.parseEther("0.05"),
  }), { amountCelo: "0.05" });
  await verifyTag("fund-worker", run.steps[run.steps.length - 1].tx);
}

// 1. Agent creates job #N with a 0.05 CELO bounty (tagged).
const createReceipt = await sendStep("create-job",
  callTagged(agent, contract, "createJob", [worker.address, JOB_DESCRIPTION], { value: BOUNTY }),
  { jobId, description: JOB_DESCRIPTION, bountyCelo: "0.05" });
await verifyTag("create-job", createReceipt.hash);
const created = createReceipt.logs.map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
console.log("  JobCreated event jobId:", created.find((e) => e.name === "JobCreated")?.args.jobId?.toString());

let job = await contract.getJob(jobId);
console.log(`  job #${jobId} onchain: status=${job.status} (0=Open) bounty=${ethers.formatEther(job.bounty)} worker=${job.worker}`);
if (Number(job.status) !== 0 || job.bounty !== BOUNTY) throw new Error("job #1 not Open with 0.05 bounty after create");

// 2. Worker submits the result (tagged).
const submitReceipt = await sendStep("submit-result",
  callTagged(worker, workerContract, "submitResult", [jobId, RESULT]),
  { result: RESULT });
await verifyTag("submit-result", submitReceipt.hash);
job = await contract.getJob(jobId);
console.log(`  job #${jobId} onchain: status=${job.status} (1=ResultSubmitted)`);
if (Number(job.status) !== 1) throw new Error("job #1 not ResultSubmitted after submit");

// 3. Agent approves and pays (tagged).
const workerBalBeforePay = await provider.getBalance(worker.address);
const payReceipt = await sendStep("approve-and-pay",
  callTagged(agent, contract, "approveAndPay", [jobId]),
  { paidCelo: "0.05", finalStatus: 2 });
await verifyTag("approve-and-pay", payReceipt.hash);
const paid = payReceipt.logs.map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
const paidEv = paid.find((e) => e.name === "JobPaid");
console.log("  JobPaid event: jobId=" + paidEv?.args.jobId?.toString() + " worker=" + paidEv?.args.worker + " amount=" + (paidEv ? ethers.formatEther(paidEv.args.amount) : "?"));

job = await contract.getJob(jobId);
console.log(`  job #${jobId} onchain: status=${job.status} (2=Paid) bounty=${ethers.formatEther(job.bounty)}`);
if (Number(job.status) !== 2 || job.bounty !== 0n) throw new Error("job #1 not Paid with zeroed bounty after approve");
const workerBalAfter = await provider.getBalance(worker.address);
const workerDelta = workerBalAfter - workerBalBeforePay;
console.log(`  worker balance delta from payment: ${ethers.formatEther(workerDelta)} CELO (expect exactly 0.05)`);
if (workerDelta !== BOUNTY) throw new Error(`worker did not receive exactly 0.05 CELO (delta ${ethers.formatEther(workerDelta)})`);
const contractBal = await provider.getBalance(deployment.address);
console.log(`  contract balance: ${ethers.formatEther(contractBal)} CELO (expect 0)`);
if (contractBal !== 0n) throw new Error("contract balance not zero after payment");

run.finishedAt = new Date().toISOString();
run.totalGasCostCelo = ethers.formatEther(totalGasCost);
run.verification = {
  tagPresentOnAllTxs: true,
  workerPaidExactlyCelo: "0.05",
  contractBalanceCelo: "0",
  finalStatus: 2,
};
fs.writeFileSync(path.join(ROOT, "runs/live-run-2.json"), JSON.stringify(run, null, 2));
console.log(`DONE job #${jobId} fully tagged and paid. Total gas: ${run.totalGasCostCelo} CELO. Saved runs/live-run-2.json`);
