// PayPerTask agent — runs the full job loop LIVE on Celo mainnet:
//   1. agent creates a job with a CELO bounty attached
//   2. agent funds a fresh worker wallet with a little CELO for gas
//   3. worker submits the finished work onchain
//   4. agent verifies the result, then approves and pays the bounty
// Usage: node scripts/agent.mjs
// Reads the deployer key from deployer.key (never printed, never committed).
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const EXPLORER = "https://celoscan.io";

// --- The real job -----------------------------------------------------------
const JOB_DESCRIPTION =
  "Write a one-line summary of the Celo Agents Open for Business hackathon brief";
const BOUNTY = ethers.parseEther("0.05"); // 0.05 CELO for the job
const WORKER_GAS_FUND = ethers.parseEther("0.05"); // CELO so the worker can submit (Celo fees ran ~202 gwei at deploy time, so 0.01 was not enough for a ~150k-gas submit)
const RESULT =
  "Celo's Agents Open for Business hackathon asks agents to do a real job for a person or business on Celo mainnet and pay for what that job needs, by Dec 7 2026.";

const key = fs.readFileSync(path.join(ROOT, "deployer.key"), "utf8").trim();
const provider = new ethers.JsonRpcProvider(RPC);
const agent = new ethers.Wallet(key, provider);

const deployment = JSON.parse(
  fs.readFileSync(path.join(ROOT, "deployments/celo.json"), "utf8")
);
const artifact = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/contracts/PayPerTask.sol/PayPerTask.json"), "utf8")
);
const contract = new ethers.Contract(deployment.address, artifact.abi, agent);

const run = {
  network: "celo",
  chainId: 42220,
  contract: deployment.address,
  agent: agent.address,
  startedAt: new Date().toISOString(),
  steps: [],
};
let totalGasCost = 0n;

async function step(name, fn) {
  console.log(`\n== ${name} ==`);
  const out = await fn();
  run.steps.push(out);
  return out;
}

async function trackReceipt(name, tx) {
  console.log("tx:", tx.hash);
  console.log("explorer:", `${EXPLORER}/tx/${tx.hash}`);
  const receipt = await tx.wait();
  const cost = receipt.gasUsed * (tx.gasPrice ?? receipt.gasPrice ?? 0n);
  totalGasCost += cost;
  console.log("gas used:", receipt.gasUsed.toString(), "| cost:", ethers.formatEther(cost), "CELO");
  return { name, tx: tx.hash, gasUsed: receipt.gasUsed.toString(), costCelo: ethers.formatEther(cost) };
}

console.log("Agent:", agent.address);
console.log("Contract:", deployment.address);
console.log("Balance:", ethers.formatEther(await provider.getBalance(agent.address)), "CELO");

// 1. Fresh worker wallet (a real separate identity doing the work).
const worker = ethers.Wallet.createRandom().connect(provider);
console.log("Worker:", worker.address);
fs.mkdirSync(path.join(ROOT, "runs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "runs/worker.key"), worker.privateKey, { mode: 0o600 });
run.worker = worker.address;

// 2. Fund the worker's gas so it can submit onchain.
await step("Fund worker gas (0.05 CELO)", async () => {
  const tx = await agent.sendTransaction({ to: worker.address, value: WORKER_GAS_FUND });
  return trackReceipt("fund-worker", tx);
});

// 3. Agent creates the job with the bounty locked in the contract.
const jobId = await step("Agent creates job (bounty 0.05 CELO)", async () => {
  const tx = await contract.createJob(worker.address, JOB_DESCRIPTION, { value: BOUNTY });
  const rec = await trackReceipt("create-job", tx);
  const job = await contract.getJob(0);
  console.log("Job 0:", job.description, "| bounty:", ethers.formatEther(job.bounty), "CELO | status: Open");
  return { ...rec, jobId: 0, description: JOB_DESCRIPTION, bountyCelo: "0.05" };
});

// 4. Worker submits the finished work.
await step("Worker submits result", async () => {
  const workerContract = contract.connect(worker);
  const tx = await workerContract.submitResult(jobId.jobId, RESULT);
  const rec = await trackReceipt("submit-result", tx);
  const job = await contract.getJob(jobId.jobId);
  console.log("Result onchain:", job.result);
  return { ...rec, result: RESULT };
});

// 5. Agent verifies the result, then approves and pays.
await step("Agent verifies and pays", async () => {
  const job = await contract.getJob(jobId.jobId);
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
  const tx = await contract.approveAndPay(jobId.jobId);
  const rec = await trackReceipt("approve-and-pay", tx);
  const workerAfter = await provider.getBalance(worker.address);
  const paid = workerAfter - workerBefore;
  console.log("Worker received:", ethers.formatEther(paid), "CELO");
  const finalJob = await contract.getJob(jobId.jobId);
  console.log("Final status: Paid (2) | contract balance:", ethers.formatEther(await provider.getBalance(deployment.address)), "CELO");
  return { ...rec, paidCelo: ethers.formatEther(paid), finalStatus: Number(finalJob.status) };
});

run.finishedAt = new Date().toISOString();
run.totalGasCostCelo = ethers.formatEther(totalGasCost);
run.totalSpentCelo = ethers.formatEther(totalGasCost + BOUNTY + WORKER_GAS_FUND);
console.log("\n== DONE ==");
console.log("Total gas cost:", run.totalGasCostCelo, "CELO");
console.log("Total spent (gas + bounty + worker fund):", run.totalSpentCelo, "CELO");
console.log("Agent balance now:", ethers.formatEther(await provider.getBalance(agent.address)), "CELO");

fs.writeFileSync(path.join(ROOT, "runs/live-run-1.json"), JSON.stringify(run, null, 2));
console.log("Run record saved to runs/live-run-1.json");
