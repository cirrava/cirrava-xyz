// Local test fixture for /app/admin: deploys mock MSFT/QQQ/GOOGL/AMZN tokens and feeds on the local
// Hardhat chain and writes their addresses to deployments/admin-local-markets.json.
//   npx hardhat run scripts/deploy.js --network localhost          (base deployment first)
//   npx hardhat run scripts/admin-local-fixture.js --network localhost
//   MARKETS_JSON=deployments/admin-local-markets.json node scripts/admin-artifacts.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const A = require("./mainnet-assets");

async function main() {
  const [deployer] = await ethers.getSigners();
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const out = [];
  for (const m of A.newMarkets) {
    const t = await (await ethers.getContractFactory("MockERC20")).deploy(`${m.name} (test)`, m.symbol, 18, ethers.parseUnits("10", 18));
    const f = await (await ethers.getContractFactory("MockAggregator")).deploy(8, `${m.symbol} / USD`, deployer.address);
    await (await f.push(ethers.parseUnits("100", 8), now)).wait();
    out.push({ ...m, token: await t.getAddress(), feed: await f.getAddress() });
    console.log(`${m.symbol.padEnd(5)} token ${await t.getAddress()}  feed ${await f.getAddress()}`);
  }
  const file = path.join(__dirname, "..", "deployments", "admin-local-markets.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
