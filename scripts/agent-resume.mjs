// Resumes the PayPerTask live run after the first attempts stopped at the
// worker-submit step (worker gas fund was too small for a ~381k-gas submit).
// Picks up the existing job #0 and worker wallet and finishes the loop:
//   top up worker -> worker submits result -> agent verifies -> agent pays.
// Re-runnable: already-mined steps are re-verified from their receipts,
// never re-sent. Usage: node scripts/agent-resume.mjs
// Reads the deployer key from deployer.key (never printed, never committed).
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const EXPLORER = "https://celoscan.io";

const JOB_DESCRIPTION =
  "Write a one-line summary of the Celo Agents Open for Business hackathon brief";
const BOUNTY = ethers.parseEther("0.05");
const RESULT =
  "Celo's Agents Open for Business hackathon asks agents to do a real job for a person or business on Celo mainnet and pay for what that job needs, by Dec 7 2026.";

// Tx hashes from earlier attempts (verified onchain below, never re-sent).
const KNOWN_TXS = {
  "fund-worker": "0x444e9bdae1ec1502853e5245a911a40cb16db4a10b34769efa851ae3e19a773c",
  "create-job": "0x532713e40a1fe6717481c5ddd79e97723e129d229a6f559f10a30a7c1f7ca1e6",
  "top-up-worker": "0x31b0f450280136ef205f1edb1ab5ab54ae1e04b1d8295b71b5a4b9fc398f511f",
};

const key = fs.readFileSync(path.join(ROOT, "deployer.key"), "utf8").trim();
const provider = new ethers.JsonRpcProvider(RPC);
const agent = new ethers.Wallet(key, provider);

const deployment = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/celo.json"), "utf8"));
const artifact = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/contracts/PayPerTask.sol/PayPerTask.json"), "utf8")
);
const contract = new ethers.Contract(deployment.address, artifact.abi, agent);

const workerKey = fs.readFileSync(path.join(ROOT, "runs/worker.key"), "utf8").trim();
const worker = new ethers.Wallet(workerKey, provider);

const run = {
  network: "celo",
  chainId: 42220,
  contract: deployment.address,
  agent: agent.address,
  worker: worker.address,
  deployTx: deployment.deployTx,
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

async function recordKnownTx(name, hash, extra = {}) {
  let receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) receipt = await provider.waitForTransaction(hash, 1, 180000);
  if (!receipt) throw new Error(`Known tx never mined: ${hash}`);
  return recordReceipt(name, receipt, extra);
}

async function sendStep(name, txPromise, extra = {}) {
  const tx = await txPromise;
  console.log(`${name} sent: ${tx.hash}`);
  const receipt = await tx.wait();
  return recordReceipt(name, receipt, extra);
}

console.log("Agent:", agent.address, "| balance:", ethers.formatEther(await provider.getBalance(agent.address)), "CELO");
console.log("Worker:", worker.address, "| balance:", ethers.formatEther(await provider.getBalance(worker.address)), "CELO");
console.log("Contract:", deployment.address);

// Re-verify the earlier steps onchain (part of this run's proof).
await recordKnownTx("fund-worker", KNOWN_TXS["fund-worker"], { amountCelo: "0.05" });
await recordKnownTx("create-job", KNOWN_TXS["create-job"], { jobId: 0, description: JOB_DESCRIPTION, bountyCelo: "0.05" });
await recordKnownTx("top-up-worker", KNOWN_TXS["top-up-worker"], { amountCelo: "0.05" });

const jobBefore = await contract.getJob(0);
console.log("Job 0 status before resume:", ["Open", "ResultSubmitted", "Paid", "Cancelled"][jobBefore.status]);

// Safety net: if the worker still cannot afford the ~381k-gas submit, top up more.
const workerBal = await provider.getBalance(worker.address);
const TARGET = ethers.parseEther("0.1");
if (workerBal < TARGET) {
  const topUp = TARGET - workerBal;
  console.log(`\n== Extra top-up (${ethers.formatEther(topUp)} CELO) ==`);
  await sendStep("top-up-worker-2", agent.sendTransaction({ to: worker.address, value: topUp }), {
    amountCelo: ethers.formatEther(topUp),
  });
}

// Worker submits the finished work (only if still Open).
if (Number(jobBefore.status) === 0) {
  console.log("\n== Worker submits result ==");
  const workerContract = contract.connect(worker);
  await sendStep("submit-result", workerContract.submitResult(0, RESULT), { result: RESULT });
  const job = await contract.getJob(0);
  console.log("Result onchain:", job.result);
}

// Agent verifies the result, then approves and pays.
console.log("\n== Agent verifies and pays ==");
const job = await contract.getJob(0);
const delivered = job.result;
const checks = {
  nonEmpty: delivered.length > 0,
  mentionsCelo: delivered.includes("Celo"),
  mentionsJob: delivered.toLowerCase().includes("real job"),
  mentionsDeadline: delivered.includes("Dec 7"),
};
console.log("Verification checks:", checks);
if (!Object.values(checks).every(Boolean)) {
  throw new Error("Result failed verification — payment refused");
}
console.log("Result verified. Paying worker...");
const workerBefore = await provider.getBalance(worker.address);
await sendStep("approve-and-pay", contract.approveAndPay(0), {});
const workerAfter = await provider.getBalance(worker.address);
const paid = workerAfter - workerBefore;
console.log("Worker received:", ethers.formatEther(paid), "CELO");
const finalJob = await contract.getJob(0);
console.log("Final status:", ["Open", "ResultSubmitted", "Paid", "Cancelled"][finalJob.status]);
console.log("Contract balance:", ethers.formatEther(await provider.getBalance(deployment.address)), "CELO");
run.steps.find((s) => s.name === "approve-and-pay").paidCelo = ethers.formatEther(paid);
run.steps.find((s) => s.name === "approve-and-pay").finalStatus = Number(finalJob.status);

run.finishedAt = new Date().toISOString();
run.totalGasCostCelo = ethers.formatEther(totalGasCost);
console.log("\n== DONE ==");
console.log("Total gas cost (loop):", run.totalGasCostCelo, "CELO");
console.log("Agent balance now:", ethers.formatEther(await provider.getBalance(agent.address)), "CELO");

fs.writeFileSync(path.join(ROOT, "runs/live-run-1.json"), JSON.stringify(run, null, 2));
console.log("Run record saved to runs/live-run-1.json");
