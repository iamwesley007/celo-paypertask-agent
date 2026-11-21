const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PayPerTask", function () {
  let payPerTask, agent, worker, stranger;
  const BOUNTY = ethers.parseEther("0.05");
  const DESCRIPTION = "Write a one-line summary of the Celo Agents Open for Business brief";

  beforeEach(async function () {
    [agent, worker, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PayPerTask");
    payPerTask = await Factory.deploy();
    await payPerTask.waitForDeployment();
  });

  async function createJob() {
    const tx = await payPerTask
      .connect(agent)
      .createJob(worker.address, DESCRIPTION, { value: BOUNTY });
    await tx.wait();
    return 0;
  }

  it("creates a job with the bounty locked", async function () {
    const tx = await payPerTask
      .connect(agent)
      .createJob(worker.address, DESCRIPTION, { value: BOUNTY });
    await expect(tx)
      .to.emit(payPerTask, "JobCreated")
      .withArgs(0, agent.address, worker.address, BOUNTY, DESCRIPTION);

    const job = await payPerTask.getJob(0);
    expect(job.agent).to.equal(agent.address);
    expect(job.worker).to.equal(worker.address);
    expect(job.bounty).to.equal(BOUNTY);
    expect(job.description).to.equal(DESCRIPTION);
    expect(job.status).to.equal(0); // Open
    expect(await ethers.provider.getBalance(await payPerTask.getAddress())).to.equal(BOUNTY);
    expect(await payPerTask.jobCount()).to.equal(1);
  });

  it("rejects a zero worker address", async function () {
    await expect(
      payPerTask.connect(agent).createJob(ethers.ZeroAddress, DESCRIPTION, { value: BOUNTY })
    ).to.be.revertedWithCustomError(payPerTask, "ZeroWorker");
  });

  it("rejects a zero bounty", async function () {
    await expect(
      payPerTask.connect(agent).createJob(worker.address, DESCRIPTION, { value: 0 })
    ).to.be.revertedWithCustomError(payPerTask, "ZeroBounty");
  });

  it("rejects an empty description", async function () {
    await expect(
      payPerTask.connect(agent).createJob(worker.address, "", { value: BOUNTY })
    ).to.be.revertedWithCustomError(payPerTask, "EmptyDescription");
  });

  it("only the assigned worker can submit a result", async function () {
    await createJob();
    await expect(
      payPerTask.connect(stranger).submitResult(0, "done")
    ).to.be.revertedWithCustomError(payPerTask, "NotWorker");
    await expect(
      payPerTask.connect(agent).submitResult(0, "done")
    ).to.be.revertedWithCustomError(payPerTask, "NotWorker");

    const tx = await payPerTask.connect(worker).submitResult(0, "Celo wants agents that do real jobs and pay for them onchain.");
    await expect(tx).to.emit(payPerTask, "ResultSubmitted");
    const job = await payPerTask.getJob(0);
    expect(job.status).to.equal(1); // ResultSubmitted
    expect(job.result).to.include("Celo wants agents");
  });

  it("rejects a second result after one was submitted", async function () {
    await createJob();
    await payPerTask.connect(worker).submitResult(0, "first");
    await expect(
      payPerTask.connect(worker).submitResult(0, "second")
    ).to.be.revertedWithCustomError(payPerTask, "WrongStatus");
  });

  it("pays the worker in full when the agent approves", async function () {
    await createJob();
    await payPerTask.connect(worker).submitResult(0, "done: summary delivered");

    const before = await ethers.provider.getBalance(worker.address);
    const tx = await payPerTask.connect(agent).approveAndPay(0);
    await expect(tx).to.emit(payPerTask, "JobPaid").withArgs(0, worker.address, BOUNTY);
    const after = await ethers.provider.getBalance(worker.address);
    expect(after - before).to.equal(BOUNTY);

    const job = await payPerTask.getJob(0);
    expect(job.status).to.equal(2); // Paid
    expect(job.bounty).to.equal(0);
    expect(await ethers.provider.getBalance(await payPerTask.getAddress())).to.equal(0);
  });

  it("only the agent can approve payment", async function () {
    await createJob();
    await payPerTask.connect(worker).submitResult(0, "done");
    await expect(
      payPerTask.connect(worker).approveAndPay(0)
    ).to.be.revertedWithCustomError(payPerTask, "NotAgent");
    await expect(
      payPerTask.connect(stranger).approveAndPay(0)
    ).to.be.revertedWithCustomError(payPerTask, "NotAgent");
  });

  it("refuses payment before any result is submitted", async function () {
    await createJob();
    await expect(
      payPerTask.connect(agent).approveAndPay(0)
    ).to.be.revertedWithCustomError(payPerTask, "WrongStatus");
  });

  it("refunds the agent on cancel and blocks later delivery", async function () {
    await createJob();
    const before = await ethers.provider.getBalance(await payPerTask.getAddress());
    expect(before).to.equal(BOUNTY);

    const tx = await payPerTask.connect(agent).cancelJob(0);
    await expect(tx).to.emit(payPerTask, "JobCancelled").withArgs(0, agent.address, BOUNTY);

    const job = await payPerTask.getJob(0);
    expect(job.status).to.equal(3); // Cancelled
    expect(await ethers.provider.getBalance(await payPerTask.getAddress())).to.equal(0);

    await expect(
      payPerTask.connect(worker).submitResult(0, "too late")
    ).to.be.revertedWithCustomError(payPerTask, "WrongStatus");
  });

  it("only the agent can cancel, and only while the job is open", async function () {
    await createJob();
    await expect(
      payPerTask.connect(worker).cancelJob(0)
    ).to.be.revertedWithCustomError(payPerTask, "NotAgent");

    await payPerTask.connect(worker).submitResult(0, "done");
    await expect(
      payPerTask.connect(agent).cancelJob(0)
    ).to.be.revertedWithCustomError(payPerTask, "WrongStatus");
  });

  it("supports several independent jobs", async function () {
    await createJob();
    await payPerTask
      .connect(agent)
      .createJob(stranger.address, "Second job", { value: BOUNTY });
    expect(await payPerTask.jobCount()).to.equal(2);
    const second = await payPerTask.getJob(1);
    expect(second.worker).to.equal(stranger.address);
    expect(second.status).to.equal(0);
  });
});
