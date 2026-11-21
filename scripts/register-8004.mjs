// Register PayPerTask on the ERC-8004 Identity Registry (Celo mainnet).
// Caller = deployer wallet (the wallet that performs all of PayPerTask's
// onchain actions); register() sets agentWallet to the caller. The Self
// agent key was never exported, so the agent address cannot sign — the
// registration file names the Self Agent ID 206 link in its description.
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RPC = "https://forno.celo.org";
const REG = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const URI = "https://raw.githubusercontent.com/iamwesley007/celo-paypertask-agent/master/agent.json";

const key = fs.readFileSync(path.join(ROOT, "deployer.key"), "utf8").trim();
const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(key, provider);
const abi = [
  "function register(string agentURI) returns (uint256 agentId)",
  "function agentWallet(uint256 agentId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];
const reg = new ethers.Contract(REG, abi, signer);

console.log("signer:", signer.address);
console.log("balance:", ethers.formatEther(await provider.getBalance(signer.address)), "CELO");
const gasEst = await reg.register.estimateGas(URI);
console.log("gas estimate:", gasEst.toString());
const tx = await reg.register(URI);
console.log("tx sent:", tx.hash);
const receipt = await tx.wait();
console.log("status:", receipt.status, "| block:", receipt.blockNumber, "| gas used:", receipt.gasUsed.toString());
const cost = receipt.gasUsed * (receipt.gasPrice ?? 0n);
console.log("cost:", ethers.formatEther(cost), "CELO");
if (receipt.status !== 1) throw new Error("register tx failed onchain");

const parsed = receipt.logs.map((l) => { try { return reg.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
const ev = parsed.find((e) => e.name === "Registered");
const agentId = ev ? ev.args.agentId.toString() : null;
console.log("Registered event agentId:", agentId, "| owner:", ev?.args.owner, "| uri:", ev?.args.agentURI);

// verify onchain reads
console.log("ownerOf:", await reg.ownerOf(agentId));
console.log("agentWallet:", await reg.agentWallet(agentId));
console.log("tokenURI:", await reg.tokenURI(agentId));

fs.writeFileSync(path.join(ROOT, "runs/erc8004-registration.json"), JSON.stringify({
  registry: REG, agentURI: URI, agentId, tx: receipt.hash,
  block: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(),
  costCelo: ethers.formatEther(cost), owner: signer.address,
  agentWallet: await reg.agentWallet(agentId),
  registeredAt: new Date().toISOString(),
}, null, 2));
console.log("saved runs/erc8004-registration.json");
