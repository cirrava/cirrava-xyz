require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

// Secrets never live in this repo — they come from the shell environment:
//   DEPLOYER_KEY   private key of the deploying wallet (only for --network robinhood)
//   RPC_URL        optional RPC override
//   FORK=1         run the in-process Hardhat chain as a fork of Robinhood Chain mainnet (dry runs)
const ROBINHOOD_RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];
const FORK = process.env.FORK === "1";

module.exports = {
  solidity: {
    version: "0.8.24",
    // shanghai keeps the bytecode on opcodes every Arbitrum Nitro chain supports
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "shanghai", viaIR: true },
  },
  networks: {
    hardhat: FORK
      ? {
          chainId: 4663,
          forking: { url: ROBINHOOD_RPC },
          mining: { auto: true, interval: 5000 },
          chains: { 4663: { hardforkHistory: { cancun: 0 } } },
        }
      : // interval mining keeps block.timestamp tracking the wall clock, which market-hours logic relies on
        { chainId: 31337, mining: { auto: true, interval: 5000 } },
    localhost: { url: "http://127.0.0.1:8545", chainId: FORK ? 4663 : 31337 },
    robinhood: { url: ROBINHOOD_RPC, chainId: 4663, accounts },
  },
};
