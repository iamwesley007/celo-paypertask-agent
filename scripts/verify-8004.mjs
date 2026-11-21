// Verify-only: reads the ERC-8004 registration from step 2. Sends NO tx.
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const REG = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const TX = "0x33b6c49a2e3572b0bdce32bec035214d8324c40e95e189c4ed3afad2037f4f4e";
const AGENT_ID = 10086n;

const provider = new ethers.JsonRpcProvider(RPC);
const abi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];
const reg = new ethers.Contract(REG, abi, provider);

const receipt = await provider.getTransactionReceipt(TX);
console.log("receipt status:", receipt.status, "| block:", receipt.blockNumber, "| gas:", receipt.gasUsed.toString());
const parsed = receipt.logs.map((l) => { try { return reg.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
for (const e of parsed) console.log("event:", e.name, "agentId:", e.args.agentId?.toString(), "owner:", e.args.owner, "uri:", e.args.agentURI);
console.log("ownerOf:", await reg.ownerOf(AGENT_ID));
console.log("tokenURI:", await reg.tokenURI(AGENT_ID));
try {
  const mw = await reg.getMetadata(AGENT_ID, "agentWallet");
  console.log("getMetadata(agentWallet):", mw, "->", mw.length > 2 ? ethers.AbiCoder.defaultAbiCoder().decode(["address"], mw)[0] : "(empty)");
} catch (e) { console.log("getMetadata(agentWallet) failed:", e.shortMessage || e.message); }

fs.writeFileSync(path.join(ROOT, "runs/erc8004-registration.json"), JSON.stringify({
  registry: REG, agentURI: "https://raw.githubusercontent.com/iamwesley007/celo-paypertask-agent/master/agent.json",
  agentId: 10086, tx: TX, block: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(),
  costCelo: ethers.formatEther(receipt.gasUsed * (receipt.gasPrice ?? 0n)),
  owner: "0x8fD6d6FCBf95c0f4042a3B8DDC352937950D5CD3",
  agentWalletNote: "deployed registry has no agentWallet() view; agentWallet is metadata keyed 'agentWallet', initially the owner address per the ERC-8004 spec",
  registeredAt: new Date().toISOString(),
}, null, 2));
console.log("saved runs/erc8004-registration.json");
