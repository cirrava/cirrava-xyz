// Submits every live contract's source to Sourcify (public, read-only for the chain: no key, no gas).
// Blockscout shows source verified through Sourcify.
//   node scripts/verify-sourcify.js
const fs = require("fs");
const path = require("path");
const dep = require("../deployments/robinhood.json");

const API = "https://sourcify.dev/server";
const bi = path.join(__dirname, "..", "artifacts", "build-info");
const build = JSON.parse(fs.readFileSync(path.join(bi, fs.readdirSync(bi)[0]), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const items = [
  ["contracts/MarketCalendar.sol:MarketCalendar", dep.calendar],
  ["contracts/InterestRateModel.sol:InterestRateModel", dep.irm],
  ["contracts/EarnVault.sol:EarnVault", dep.vault],
  ["contracts/StockOracle.sol:StockOracle", dep.usdg.oracle],
  ...dep.markets.flatMap((m) => [
    ["contracts/StockOracle.sol:StockOracle", m.oracle],
    ["contracts/LendingMarket.sol:LendingMarket", m.market],
  ]),
];

(async () => {
  for (const [id, addr] of items) {
    const have = await (await fetch(`${API}/v2/contract/${dep.chainId}/${addr}`)).json();
    if (have.match) { console.log(`= ${addr} already ${have.match}`); continue; }
    const r = await fetch(`${API}/v2/verify/${dep.chainId}/${addr}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stdJsonInput: build.input, compilerVersion: build.solcLongVersion, contractIdentifier: id }),
    });
    const j = await r.json();
    if (!j.verificationId) { console.log(`✗ ${addr} ${r.status} ${JSON.stringify(j).slice(0, 300)}`); continue; }
    let job;
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      job = await (await fetch(`${API}/v2/verify/${j.verificationId}`)).json();
      if (job.isJobCompleted) break;
    }
    const c = job.contract || {};
    console.log(`${c.match ? "✓" : "✗"} ${id.split(":")[1].padEnd(18)} ${addr} ${c.match || JSON.stringify(job.error || job).slice(0, 300)}`);
  }
})();
