# PayPerTask — an agent that hires a worker and pays in CELO

Built for the Celo **Agents Open for Business** hackathon (Nov 20 – Dec 7, 2026),
**Verified Agent Payments** track. The brief: *"ship an agent that does a real job
for a person or business on Celo mainnet, and pays for what that job needs."*

## The real job

A hiring agent posts a job onchain with a CELO bounty locked in the contract.
A worker delivers the finished work onchain. The agent verifies the result,
then the contract releases the bounty to the worker. If the work never comes,
the agent cancels and gets the bounty back. No owner, no admin — the only
privileged party is the agent that created a job, and only for that job.

The first live job: *"Write a one-line summary of the Celo Agents Open for
Business hackathon brief"* — bounty 0.05 CELO, delivered and paid on Celo
mainnet. See `runs/live-run-1.json` for the full proof.

## Live deployment (Celo mainnet, chain ID 42220)

- Contract: `PayPerTask` — **0x92bf7D34ea98E698461C7786f68787f8858BE3B6**
- Explorer: https://celoscan.io/address/0x92bf7D34ea98E698461C7786f68787f8858BE3B6
- Deploy tx: https://celoscan.io/tx/0xb40deadcdfbbe7dd5cc607f417e29bd00e6cc67bf071b158ea1454c9ed5e036e (gas 0.3030062175 CELO)
- Demo job #0, all transactions and gas costs: `runs/live-run-1.json`

Live run (job #0 — summary of the hackathon brief, bounty 0.05 CELO, **Paid**):

| Step | Tx |
| --- | --- |
| Fund worker gas (0.05 CELO) | https://celoscan.io/tx/0x444e9bdae1ec1502853e5245a911a40cb16db4a10b34769efa851ae3e19a773c |
| Agent creates job (bounty 0.05 CELO) | https://celoscan.io/tx/0x532713e40a1fe6717481c5ddd79e97723e129d229a6f559f10a30a7c1f7ca1e6 |
| Top up worker gas (0.05 CELO) | https://celoscan.io/tx/0x31b0f450280136ef205f1edb1ab5ab54ae1e04b1d8295b71b5a4b9fc398f511f |
| Worker submits result | https://celoscan.io/tx/0x31d79b46f78b07bc3d1abdffff0aba9f030a9f19803be1aaf9d058b7725fb447 |
| Agent verifies and pays 0.05 CELO | https://celoscan.io/tx/0x8548244696f39f2a57600f99b31e12e513581ac8196d4054f726f67bae048c5d |

Total loop gas: 0.0989866689 CELO. Worker received exactly 0.05 CELO; contract balance after payment: 0.

## How to run it

```bash
npm install
npx hardhat test            # 12/12 local tests
node scripts/deploy.mjs     # deploy to Celo mainnet (needs deployer.key)
node scripts/agent.mjs      # run the full job loop live: create → deliver → verify → pay
```

`deployer.key` holds the deployer private key (mode 600, never committed).
The agent script creates a fresh worker wallet, funds it with 0.1 CELO for gas (0.05 + a 0.05 top-up — the node's fee estimate is inflated, so 0.05 alone was not enough),
posts the job, the worker submits the result, the agent verifies it and pays.
Total spend for the whole live run was ~0.51 CELO (0.402 gas + 0.05 bounty + 0.1 worker funding, of which ~0.06 remains in the worker wallet).

## Project layout

```
contracts/PayPerTask.sol   — the job + payment contract (Solidity 0.8.24, dependency-free)
scripts/deploy.mjs         — deploys to Celo mainnet, writes deployments/celo.json
scripts/agent.mjs          — the agent: hires, verifies, pays (live on mainnet)
test/PayPerTask.test.js    — 12 Hardhat tests (create / submit / pay / cancel)
frontend/                  — static page showing the live job from Celo mainnet
deployments/celo.json      — deployed address + deploy tx
runs/live-run-1.json       — every mainnet tx hash from the live run
```

## License

MIT — Oguinye Nelson Ifeanyichukwu.
