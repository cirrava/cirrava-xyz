// Local test fixture for /app/admin: mock tokens and feeds on the local Hardhat chain for every entry of
// mainnet-assets.js `newMarkets` and `markets247`, written to deployments/admin-local-markets.json.
// A 24/7 entry reuses the token of the regular market with the same symbol (as on mainnet) with its own feed.
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
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "localhost.json"), "utf8"));
  const tokens = Object.fromEntries(base.markets.map((m) => [m.symbol, m.token]));
  const out = [];
  for (const m of [...A.newMarkets, ...(A.markets247 || [])]) {
    if (!tokens[m.symbol]) {
      const t = await (await ethers.getContractFactory("MockERC20")).deploy(`${m.name} (test)`, m.symbol, 18, ethers.parseUnits("10", 18));
      tokens[m.symbol] = await t.getAddress();
    }
    const desc = m.hours ? `Robinhood ${m.symbol} (24/7)` : `${m.symbol} / USD`;
    const f = await (await ethers.getContractFactory("MockAggregator")).deploy(8, desc, deployer.address);
    await (await f.push(ethers.parseUnits("100", 8), now)).wait();
    out.push({ ...m, token: tokens[m.symbol], feed: await f.getAddress() });
    console.log(`${(m.symbol + (m.hours ? " " + m.hours : "")).padEnd(11)} token ${tokens[m.symbol]}  feed ${await f.getAddress()} "${desc}"`);
  }
  const file = path.join(__dirname, "..", "deployments", "admin-local-markets.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
