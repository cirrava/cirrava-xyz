// Read-only: asks Robinhood Chain mainnet to estimate the gas of each contract creation
// (Arbitrum Nitro's estimate includes the L1 data fee, which a local fork cannot simulate).
//   npx hardhat run scripts/estimate-mainnet.js --network robinhood   (no key needed)
//   DEPLOYER=0x... to estimate from a specific address
const { ethers } = require("hardhat");
const A = require("./mainnet-assets");

const WAD = (x) => ethers.parseUnits(String(x), 18);
// gas measured on the fork for the setup transactions (no bytecode, so L1 data is negligible)
const SETUP_TXS_GAS = 1_200_000n;

async function main() {
  const from = process.env.DEPLOYER || "0xa319B076571a93C345Eb61Ec5131364dE81D0BA1";
  const p = ethers.provider;
  const est = async (name, ...args) => {
    const tx = await (await ethers.getContractFactory(name)).getDeployTransaction(...args);
    return p.estimateGas({ ...tx, from });
  };
  const dummy = "0x000000000000000000000000000000000000dEaD";
  const calendar = await est("MarketCalendar", from);
  const oracle = await est("StockOracle", from, A.markets[0].feed, dummy, 26 * 3600, 97 * 3600, A.markets[0].token);
  const irm = await est("InterestRateModel", WAD(0.02), WAD(0.08), WAD(1), WAD(0.8));
  const vault = await est("EarnVault", A.usdg.token, from);
  const market = await est("LendingMarket", {
    owner: from, vault: dummy, treasury: from, collateralToken: A.markets[0].token, borrowToken: A.usdg.token,
    collateralOracle: dummy, borrowOracle: dummy, irm: dummy, ltv: WAD(0.6), liquidationThreshold: WAD(0.65),
    liquidationBonus: WAD(0.05), reserveFactor: WAD(0.1), borrowFee: WAD(0.001),
  });
  const n = BigInt(A.markets.length);
  const total = calendar + oracle * (n + 1n) + irm + vault + market * n + SETUP_TXS_GAS;
  const { gasPrice } = await p.getFeeData();
  console.log(`per creation: calendar ${calendar}, oracle ${oracle}, irm ${irm}, vault ${vault}, market ${market}`);
  console.log(`total ≈ ${total} gas × ${ethers.formatUnits(gasPrice, "gwei")} gwei = ${ethers.formatEther(total * gasPrice)} ETH`);
  console.log(`with 1.5× headroom: ${ethers.formatEther((total * gasPrice * 3n) / 2n)} ETH`);
  console.log(`balance of ${from}: ${ethers.formatEther(await p.getBalance(from))} ETH`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
