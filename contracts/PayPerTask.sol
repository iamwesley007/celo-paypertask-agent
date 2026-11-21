// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title PayPerTask
/// @notice An agent hires a worker for a real job onchain and pays in CELO
///         when the work is delivered and approved. There is no owner and no
///         admin: the only privileged party is the agent that created a job,
///         and only for that job (approve payment or cancel for a refund).
/// @dev Built for the Celo "Agents Open for Business" hackathon
///      (Verified Agent Payments track). Dependency-free.
contract PayPerTask {
    enum Status {
        Open, // job created, bounty locked, waiting for the worker
        ResultSubmitted, // worker delivered, waiting for agent approval
        Paid, // agent approved, bounty released to the worker
        Cancelled // agent cancelled before delivery, bounty refunded
    }

    struct Job {
        address agent;
        address worker;
        uint256 bounty;
        string description;
        string result;
        Status status;
    }

    Job[] public jobs;

    event JobCreated(
        uint256 indexed jobId,
        address indexed agent,
        address indexed worker,
        uint256 bounty,
        string description
    );
    event ResultSubmitted(uint256 indexed jobId, address indexed worker, string result);
    event JobPaid(uint256 indexed jobId, address indexed worker, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed agent, uint256 refund);

    error ZeroWorker();
    error ZeroBounty();
    error EmptyDescription();
    error NotWorker();
    error NotAgent();
    error WrongStatus();
    error TransferFailed();

    /// @notice Create a job and lock the CELO bounty in the contract.
    /// @param worker The address that will do the work.
    /// @param description A short description of the job.
    /// @return jobId The id of the created job.
    function createJob(address worker, string calldata description)
        external
        payable
        returns (uint256 jobId)
    {
        if (worker == address(0)) revert ZeroWorker();
        if (msg.value == 0) revert ZeroBounty();
        if (bytes(description).length == 0) revert EmptyDescription();

        jobId = jobs.length;
        jobs.push(
            Job({
                agent: msg.sender,
                worker: worker,
                bounty: msg.value,
                description: description,
                result: "",
                status: Status.Open
            })
        );
        emit JobCreated(jobId, msg.sender, worker, msg.value, description);
    }

    /// @notice The worker delivers the result of the job.
    /// @param jobId The job to deliver for.
    /// @param result The delivered work (a text summary or content hash).
    function submitResult(uint256 jobId, string calldata result) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.worker) revert NotWorker();
        if (job.status != Status.Open) revert WrongStatus();

        job.result = result;
        job.status = Status.ResultSubmitted;
        emit ResultSubmitted(jobId, msg.sender, result);
    }

    /// @notice The agent approves the delivered work and releases the bounty.
    /// @param jobId The job to pay for.
    function approveAndPay(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.agent) revert NotAgent();
        if (job.status != Status.ResultSubmitted) revert WrongStatus();

        uint256 amount = job.bounty;
        job.bounty = 0;
        job.status = Status.Paid;

        (bool ok, ) = job.worker.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit JobPaid(jobId, job.worker, amount);
    }

    /// @notice The agent cancels an undelivered job and gets the bounty back.
    /// @param jobId The job to cancel.
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.agent) revert NotAgent();
        if (job.status != Status.Open) revert WrongStatus();

        uint256 refund = job.bounty;
        job.bounty = 0;
        job.status = Status.Cancelled;

        (bool ok, ) = job.agent.call{value: refund}("");
        if (!ok) revert TransferFailed();
        emit JobCancelled(jobId, msg.sender, refund);
    }

    function jobCount() external view returns (uint256) {
        return jobs.length;
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}
