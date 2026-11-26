// Local check (Hardhat node + /app/admin test markets): a 24/7 market lends while the US market is closed,
// the regular market for the same token does not, and the 24/7 market pauses once its feed goes quiet.
//   M247=<NVDA 24/7 market address> npx hardhat run scripts/local-247-check.js --network localhost
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const MARKET247 = process.env.M247;
async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployments", "localhost.json"), "utf8"));
  const [owner, user] = await ethers.getSigners();
  const regular = dep.markets.find((m) => m.symbol === "NVDA");
  // a new market only gets USDG on later deposits or when the owner moves liquidity into it
  const vault = await ethers.getContractAt("EarnVault", dep.vault);
  await (await vault.connect(owner).reallocate(regular.market, MARKET247, ethers.parseUnits("1000", 6))).wait();
  console.log("owner moved 1,000 USDG from NVDA to NVDA 24/7");
  // fresh 24/7 price now (the mock feed's keeper is the owner)
  const m247 = await ethers.getContractAt("LendingMarket", MARKET247);
  const feed = await ethers.getContractAt("MockAggregator", await (await ethers.getContractAt("StockOracle", await m247.collateralOracle())).feed());
  await (await feed.connect(owner).push(ethers.parseUnits("100", 8), (await ethers.provider.getBlock("latest")).timestamp)).wait();
  const tok = await ethers.getContractAt("MockERC20", regular.token);
  await (await tok.connect(user).faucet()).wait();
  const bal = await tok.balanceOf(user.address);
  console.log("user NVDA", ethers.formatUnits(bal, 18));
  const cal = await ethers.getContractAt("MarketCalendar", dep.calendar);
  console.log("US market open now:", await cal.isOpenNow());

  for (const [label, addr] of [["regular NVDA", regular.market], ["NVDA 24/7", MARKET247]]) {
    const mk = await ethers.getContractAt("LendingMarket", addr);
    const o = await ethers.getContractAt("StockOracle", await mk.collateralOracle());
    const [p, st] = await o.latest();
    await (await tok.connect(user).approve(addr, ethers.parseUnits("5", 18))).wait();
    await (await mk.connect(user).depositCollateral(ethers.parseUnits("5", 18), user.address)).wait();
    try {
      await (await mk.connect(user).borrow(ethers.parseUnits("100", 6), user.address)).wait();
      console.log(`${label}: oracle status ${st} price ${ethers.formatUnits(p, 18)} -> BORROW OK`);
    } catch (e) {
      console.log(`${label}: oracle status ${st} -> borrow reverted: ${e.shortMessage || e.message}`);
    }
  }
  // let the 24/7 feed go quiet for 4h (window is 3h)
  await network.provider.send("evm_increaseTime", [4 * 3600]);
  await network.provider.send("evm_mine");
  const mk = await ethers.getContractAt("LendingMarket", MARKET247);
  const o = await ethers.getContractAt("StockOracle", await mk.collateralOracle());
  const [, st] = await o.latest();
  try {
    await (await mk.connect(user).borrow(ethers.parseUnits("10", 6), user.address)).wait();
    console.log(`NVDA 24/7 after 4h quiet: status ${st} -> BORROW OK (unexpected)`);
  } catch (e) {
    console.log(`NVDA 24/7 after 4h quiet: status ${st} -> borrow reverted: ${e.shortMessage || e.message}`);
  }
  const usdg = await ethers.getContractAt("MockERC20", dep.usdg.address);
  await (await usdg.connect(user).approve(MARKET247, ethers.MaxUint256)).wait();
  await (await usdg.connect(user).faucet()).wait();
  await (await mk.connect(user).repay(ethers.parseUnits("50", 6), user.address)).wait();
  console.log("NVDA 24/7 repay while quiet: OK");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
