// Read-only: checks that the runtime bytecode at every live address equals this repo's compiled code
// (immutable values masked, metadata hash compared too).
//   node scripts/match-bytecode.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const dep = require("../deployments/robinhood.json");

const { builds, findBuild } = require("./lib/builds");

(async () => {
  const p = new ethers.JsonRpcProvider(process.env.RPC_URL || dep.rpcUrl);
  const items = [
    ["contracts/MarketCalendar.sol", "MarketCalendar", dep.calendar],
    ["contracts/InterestRateModel.sol", "InterestRateModel", dep.irm],
    ["contracts/EarnVault.sol", "EarnVault", dep.vault],
    ["contracts/StockOracle.sol", "StockOracle", dep.usdg.oracle],
    ...dep.markets.flatMap((m) => [
      ["contracts/StockOracle.sol", "StockOracle", m.oracle],
      ["contracts/LendingMarket.sol", "LendingMarket", m.market],
    ]),
  ];
  let bad = 0;
  for (const [file, name, addr] of items) {
    const b = findBuild(file, name, await p.getCode(addr));
    if (!b) bad++;
    console.log(`${b ? "✓" : "✗"} ${name.padEnd(18)} ${addr}  ${b ? "build " + b.id.slice(0, 8) : "no matching build"}`);
  }
  console.log(`solc ${builds[0]?.solcLongVersion} | ${builds.length} build-info file(s) checked`);
  console.log(bad ? `${bad} MISMATCH` : "all live contracts match this source exactly");
  process.exit(bad ? 1 : 0);
})();
