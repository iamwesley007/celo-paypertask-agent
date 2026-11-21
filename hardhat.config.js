require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

// Deployer key is read from deployer.key (mode 600, never committed).
// If the file is missing (e.g. a fresh clone), the celo network is skipped.
let celoAccounts = [];
try {
  const key = fs.readFileSync(path.join(__dirname, "deployer.key"), "utf8").trim();
  if (key) celoAccounts = [key];
} catch (e) {
  celoAccounts = [];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    celo: {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: celoAccounts,
    },
  },
};
