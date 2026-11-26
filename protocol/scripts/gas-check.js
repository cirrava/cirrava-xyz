// Shows current Robinhood Chain gas prices and a deployer's ETH balance (read-only).
//   node scripts/gas-check.js 0xYourDeployerAddress
const { ethers } = require("ethers");
const A = require("./mainnet-assets");

(async () => {
  const p = new ethers.JsonRpcProvider(A.rpcUrl);
  const [fee, block] = await Promise.all([p.getFeeData(), p.getBlock("latest")]);
  console.log(`baseFee ${ethers.formatUnits(block.baseFeePerGas, "gwei")} gwei, gasPrice ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei`);
  // A full Cirrava deploy (calendar, 5 oracles, rate model, vault, 4 markets, setup txs) is ~30M gas.
  for (const g of [30e6, 45e6]) console.log(`  ${g / 1e6}M gas ≈ ${ethers.formatEther(BigInt(g) * fee.gasPrice)} ETH  (×2 safety ${ethers.formatEther(2n * BigInt(g) * fee.gasPrice)} ETH)`);
  if (process.argv[2]) console.log(`balance of ${process.argv[2]}: ${ethers.formatEther(await p.getBalance(process.argv[2]))} ETH`);
})();
