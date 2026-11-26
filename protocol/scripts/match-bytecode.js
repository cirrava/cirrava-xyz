// Read-only: checks that the runtime bytecode at every live address equals this repo's compiled code
// (immutable values masked, metadata hash compared too).
//   node scripts/match-bytecode.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const dep = require("../deployments/robinhood.json");

const bi = path.join(__dirname, "..", "artifacts", "build-info");
const build = JSON.parse(fs.readFileSync(path.join(bi, fs.readdirSync(bi)[0]), "utf8"));
const out = (file, name) => build.output.contracts[file][name].evm.deployedBytecode;

function mask(hex, refs) {
  const b = Buffer.from(hex.replace(/^0x/, ""), "hex");
  for (const list of Object.values(refs || {})) for (const { start, length } of list) b.fill(0, start, start + length);
  return b.toString("hex");
}

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
    const d = out(file, name);
    const onchain = await p.getCode(addr);
    const same = mask(onchain, d.immutableReferences) === mask(d.object, d.immutableReferences);
    if (!same) bad++;
    console.log(`${same ? "✓" : "✗"} ${name.padEnd(18)} ${addr}`);
  }
  console.log(`solc ${build.solcLongVersion} | build-info ${fs.readdirSync(bi)[0]}`);
  console.log(bad ? `${bad} MISMATCH` : "all live contracts match this source exactly");
  process.exit(bad ? 1 : 0);
})();
