# PayPerTask — Submission Draft (Celo Agents Open for Business)

Status: READY TO SUBMIT on Loops House (platform verified Sat 2026-11-21).
Register + submit at https://loops.house/agents-open-for-business
before Mon Dec 7, 2026 10:00 WAT. Winners announced Fri Dec 11, 2026.

## Project
- Name: PayPerTask
- Track: Verified Agent Payments (Self Agent ID track)
- Prize split (this track): 1st $700, 2nd $300 (paid in CELO at the USD equivalent)
- Repo (public): https://github.com/iamwesley007/celo-paypertask-agent
- Contract (Celo mainnet, chain 42220): 0x92bf7D34ea98E698461C7786f68787f8858BE3B6
- Explorer: https://celoscan.io/address/0x92bf7D34ea98E698461C7786f68787f8858BE3B6
- Demo video: PUBLIC on YouTube: https://www.youtube.com/watch?v=36F6pwGuP7c (published Nov 21, 2026, Melly Wesley channel, 1:38, no copyright issues). Local file demo-video.mp4.
- Builder: Oguinye Nelson Ifeanyichukwu (iamwesley007)

## What it does
An agent posts a job onchain with a CELO bounty locked in the contract. A worker
delivers the finished work onchain. The agent verifies the result, and the contract
releases the bounty to the worker. If the work never comes, the agent cancels and
gets the bounty back. No owner, no admin — the only privileged party is the agent
that created a job, and only for that job.

## Live proof (Celo mainnet, job #0 — untagged)
Job: "Write a one-line summary of the Celo Agents Open for Business hackathon brief."
Bounty: 0.05 CELO — delivered and PAID. Contract balance now 0.
- Deploy: https://celoscan.io/tx/0xb40deadcdfbbe7dd5cc607f417e29bd00e6cc67bf071b158ea1454c9ed5e036e
- Create job: https://celoscan.io/tx/0x532713e40a1fe6717481c5ddd79e97723e129d229a6f559f10a30a7c1f7ca1e6
- Submit result: https://celoscan.io/tx/0x31d79b46f78b07bc3d1abdffff0aba9f030a9f19803be1aaf9d058b7725fb447
- Approve + pay: https://celoscan.io/tx/0x8548244696f39f2a57600f99b31e12e513581ac8196d4054f726f67bae048c5d
- Full run record: runs/live-run-1.json in the repo
- Tests: 12/12 passing (Hardhat)

## Live proof (Celo mainnet, job #1 — TAGGED with own code only, NOT credited)
Job: "Write a one-line summary of how PayPerTask pays a worker for a finished job."
Bounty: 0.05 CELO — delivered and PAID, every transaction carrying the
attribution tag `celo_321f7b9760c9` (verified in each tx's onchain input).
- Create job: https://celoscan.io/tx/0xa9a5cdad867ff6ca3c259aecb669b451eebbd4d2c9a5a3a92c0536ad4aa2a4c5
- Submit result: https://celoscan.io/tx/0x94be113003674abe7370948875061f6990f953f1ce9f1552d640615960ef5ff4
- Approve + pay: https://celoscan.io/tx/0x880a20e503d82fc95b9ae8d85f038d2096e6afe6e30ddd8abdfb4aad096b8f21
- Verification: job #1 status Paid, bounty zeroed, contract balance 0, worker
  balance matches exactly +0.05 CELO (0.123221482166991539 CELO after).
  Total gas 0.087142635 CELO.
- Full run record: runs/live-run-2.json in the repo
- NOTE: job #1 carries ONLY our own repo-derived code. Only the tag Loops
  House assigned at registration is credited, so job #1 will NOT count
  toward the entry's onchain activity. Job #2 (below) is the counted run.

## Live proof (Celo mainnet, job #2 — MULTI-CODE, the counted run)
Job: "Write a one-line summary of why a worker can trust PayPerTask to pay for finished work."
Bounty: 0.05 CELO — delivered and PAID, every transaction carrying BOTH
attribution codes `celo_321f7b9760c9` (own) and `celo_06dad60c3e09`
(Loops-assigned) in one Schema 0 suffix (verified in each tx's onchain input).
- Create job: https://celoscan.io/tx/0x08f0254db3804c3ab32c8b4be962b36d73d6e993b318595dcb0c63708c2bc613
- Submit result: https://celoscan.io/tx/0x5487e9efb72e5d208b125ea3a2a65c8c092472dae3d160f27b15f5313d274128
- Approve + pay: https://celoscan.io/tx/0xd7f16e21977320ee867e77c5ecfaf03a58f53d5aa043ee0fd4d4c465d807a66c
- Verification (independent re-check, scripts/verify-run-3.mjs): job #2 status
  Paid, bounty zeroed, contract balance 0, worker balance matches exactly
  +0.05 CELO (0.130154794666991539 CELO after). Total gas 0.092000205 CELO.
- Full run record: runs/live-run-3.json in the repo

## ERC-8004 registration (required — DONE Sat 2026-11-21)
- Agent ID: 10086
- Identity Registry (Celo mainnet): 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- Registration tx: https://celoscan.io/tx/0x33b6c49a2e3572b0bdce32bec035214d8324c40e95e189c4ed3afad2037f4f4e
  (block 83377448, gas 200,892, cost 0.04068063 CELO, status 1)
- agentURI: https://raw.githubusercontent.com/iamwesley007/celo-paypertask-agent/master/agent.json
  (registration file in the repo, updated with the agent ID after registering)
- Owner / agent wallet: 0x8fD6d6FCBf95c0f4042a3B8DDC352937950D5CD3 (the deployer
  wallet — it performs all of PayPerTask's onchain actions; register() sets the
  agent wallet to the caller, and the Self agent key was never exported, so the
  Self agent address cannot sign). Verified onchain: ownerOf(10086) = deployer,
  tokenURI(10086) = agentURI above. Record: runs/erc8004-registration.json.
- Note: the deployed registry exposes no agentWallet() view; per the ERC-8004
  spec the agent wallet is initially the owner's address.

## Attribution tags (required for transactions to count — DONE, corrected)
- Own code: `celo_321f7b9760c9` — derived from the GitHub repo slug
  `iamwesley007/celo-paypertask-agent` via codeFromRepo (celo-org/attribution-tags).
- Assigned tag: `celo_06dad60c3e09` — shown on the Loops House enrollment page
  as "your attribution tag". Per the Celo attribution docs, only the assigned
  tag is credited: a registration hands you the tag instantly, and the
  leaderboard counts only transactions carrying it. Already tagging with your
  own code? Keep it and include the assigned tag as an array.
- Wiring: scripts/attribution.mjs (SDK @celo/attribution-tags) now builds one
  Schema 0 suffix from BOTH codes via
  toDataSuffix(['celo_321f7b9760c9', 'celo_06dad60c3e09']) — suffix
  0x63656c6f5f3332316637623937363063392c63656c6f5f303664616436306333653039230080218021802180218021802180218021
  (53 bytes; decodes back to both codes, verified locally). It is appended to
  the calldata of every transaction the agent sends (populate → append →
  re-estimate gas → send). The frontend is read-only and sends no transactions.
  Job #2 proves it end to end (see above); job #1 (own code only) does not count.

## Notes
- Self Agent ID: VERIFIED AND LINKED (Sat 2026-11-21 ~03:42 WAT). The user verified
  their identity in the Self app; the PayPerTask agent is registered in the Self
  Agent ID registry on Celo mainnet (0xaC3DF9ABf80d0F5c020C06B04Cced27763355944):
  Agent ID 206, agent address 0x99568C6182372FD25a3befab03E86c3dF25eA77a, mode
  linked, disclosures age 18+ and OFAC clear. Verified live onchain:
  isVerifiedAgent true, hasHumanProof(206) true, and the soulbound NFT (token
  206) is owned by the human's wallet 0xDFe6e9BC82Eb461C3E5Df94bfbe5677C68C0434B
  (kaisen.ai). Registry: https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944
  Open item: the agent's private key has NOT been exported — the Self backend's
  key-export endpoint still refuses (retried Sat ~17:15 WAT: HTTP 410 Gone,
  "Session expired"; status endpoint confirms stage "completed"). It does NOT
  block submission: the registration is proven onchain, and the deployer wallet
  (which does the agent's onchain work) holds the ERC-8004 identity.
  Session saved in .self-session.json (mode 600, never committed).
- Submission platform + prize split VERIFIED Sat 2026-11-21 on the Loops House
  page (see header). Judging for this track: integration quality 30%,
  innovation/value 30%, named user + real job done 25%, real use 15%.
- Deployer wallet 0x8fD6d6FCBf95c0f4042a3B8DDC352937950D5CD3 (private key mode 600
  at deployer.key, never printed, never committed); balance 0.1629 CELO after
  the ERC-8004 registration, the tagged job #1 run and the multi-code job #2
  run (incl. the 0.05 bounties).
