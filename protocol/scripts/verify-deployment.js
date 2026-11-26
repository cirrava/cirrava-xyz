// Read-only audit of a live Cirrava deployment against deployments/<network>.json.
//   npx hardhat run scripts/verify-deployment.js --network robinhood
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { HOLIDAYS, nyDayNumber } = require("./config");

const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const p = ethers.provider;
  const owner = dep.pendingOwner ? null : dep.deployer;
  const at = (name, a) => ethers.getContractAt(name, a);

  const all = [dep.calendar, dep.irm, dep.vault, dep.usdg.oracle, ...dep.markets.flatMap((m) => [m.oracle, m.market])];
  for (const a of all) ok((await p.getCode(a)) !== "0x", `code at ${a}`);

  const cal = await at("MarketCalendar", dep.calendar);
  ok(same(await cal.owner(), owner ?? (await cal.owner())), `calendar owner ${await cal.owner()}`);
  const allHolidays = await Promise.all(HOLIDAYS.map((d) => cal.isHoliday(nyDayNumber(d))));
  ok(allHolidays.every(Boolean), `calendar has all ${HOLIDAYS.length} NYSE holidays`);
  console.log(`  US market open now: ${await cal.isOpenNow()}`);

  const vault = await at("EarnVault", dep.vault);
  ok(same(await vault.asset(), dep.usdg.address), "vault asset is USDG");
  ok(same(await vault.owner(), owner ?? (await vault.owner())), `vault owner ${await vault.owner()}`);
  ok(Number(await vault.marketCount()) === dep.markets.length, `vault has ${dep.markets.length} markets`);
  ok((await vault.symbol()) === "cvUSDG", "vault share token cvUSDG");

  const usdgOracle = await at("StockOracle", dep.usdg.oracle);
  ok(same(await usdgOracle.feed(), dep.usdg.feed) && same(await usdgOracle.calendar(), ethers.ZeroAddress), "USDG oracle → USDG/USD feed, 24/7");

  for (let i = 0; i < dep.markets.length; i++) {
    const m = dep.markets[i];
    const mk = await at("LendingMarket", m.market);
    const or = await at("StockOracle", m.oracle);
    const [vm, cap, info] = await Promise.all([vault.markets(i), vault.cap(m.market), mk.marketInfo()]);
    const checks = [
      same(vm, m.market),
      same(await mk.collateralToken(), m.token),
      same(await mk.borrowToken(), dep.usdg.address),
      same(await mk.vault(), dep.vault),
      same(await mk.collateralOracle(), m.oracle),
      same(await mk.borrowOracle(), dep.usdg.oracle),
      same(await mk.irm(), dep.irm),
      same(await mk.treasury(), dep.treasury),
      same(await or.feed(), m.feed),
      m.hours === "24/7" ? same(await or.calendar(), ethers.ZeroAddress) && (await or.maxAgeInSession()) === BigInt(m.window) : same(await or.calendar(), dep.calendar),
      info.ltv === ethers.parseUnits(String(m.ltv), 18),
      info.liquidationThreshold === ethers.parseUnits(String(m.lt), 18),
      info.liquidationBonus === ethers.parseUnits(String(m.bonus ?? 0.05), 18),
      info.borrowFee === ethers.parseUnits("0.001", 18),
      cap === ethers.parseUnits(m.cap || dep.capPerMarket, 6),
      !info.paused,
    ];
    ok(checks.every(Boolean), `${m.symbol}${m.hours ? " " + m.hours : ""} market wiring, risk params, cap ${m.cap || dep.capPerMarket} USDG${checks.every(Boolean) ? "" : "  → failed checks: " + checks.map((c, j) => (c ? null : j)).filter((x) => x !== null).join(",")}`);
    ok(same(await mk.owner(), owner ?? (await mk.owner())), `  owner ${await mk.owner()}`);
    console.log(`  ${m.symbol.padEnd(5)} $${Number(ethers.formatUnits(info.collateralPrice, 18)).toFixed(2)}  ${STATUS[Number(info.collateralStatus)]}  supplied ${ethers.formatUnits(info.supplyAssets, 6)} USDG  borrow APR ${(Number(ethers.formatUnits(info.borrowAPR, 18)) * 100).toFixed(2)}%`);
  }
  console.log(`deployer ${dep.deployer} has ${ethers.formatEther(await p.getBalance(dep.deployer))} ETH left`);
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
