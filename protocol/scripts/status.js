// Prints live protocol state: prices, price status, utilization and rates per market.
//   npx hardhat run scripts/status.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
const pct = (x) => (Number(ethers.formatUnits(x, 18)) * 100).toFixed(2) + "%";

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const cal = await ethers.getContractAt("MarketCalendar", dep.calendar);
  const vault = await ethers.getContractAt("EarnVault", dep.vault);
  console.log(`US market open now: ${await cal.isOpenNow()}`);
  console.log(`Earn vault: ${ethers.formatUnits(await vault.totalAssets(), 6)} USDG, available ${ethers.formatUnits(await vault.availableLiquidity(), 6)}`);
  for (const m of dep.markets) {
    const i = await (await ethers.getContractAt("LendingMarket", m.market)).marketInfo();
    console.log(
      `${m.symbol.padEnd(5)} $${Number(ethers.formatUnits(i.collateralPrice, 18)).toFixed(2).padStart(8)}  ${STATUS[Number(i.collateralStatus)].padEnd(12)}` +
        ` supplied ${ethers.formatUnits(i.supplyAssets, 6)}  util ${pct(i.utilization)}  borrow APR ${pct(i.borrowAPR)}  supply APR ${pct(i.supplyAPR)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
