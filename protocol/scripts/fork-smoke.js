// End-to-end check of a Cirrava deployment on a FORK of Robinhood Chain mainnet, with the real
// USDG, real Stock Tokens and real Chainlink prices. Uses borrowed balances from the biggest
// holders (impersonation only works on a fork). Run after deploy-mainnet.js on the fork:
//   npx hardhat run scripts/fork-smoke.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
];

// Find a current holder from recent Transfer events (straight from the chain, no explorer API).
async function topHolder(token, need) {
  const c = new ethers.Contract(token, ERC20, ethers.provider);
  const topic = ethers.id("Transfer(address,address,uint256)");
  const head = await ethers.provider.getBlockNumber();
  const seen = new Set();
  for (let to = head, span = 5000; to > head - 2_000_000 && to > 0; to -= span) {
    let logs;
    try {
      logs = await ethers.provider.getLogs({ address: token, topics: [topic], fromBlock: Math.max(0, to - span + 1), toBlock: to });
    } catch {
      span = Math.max(500, Math.floor(span / 2));
      continue;
    }
    for (const l of logs.reverse()) {
      const a = ethers.getAddress("0x" + l.topics[2].slice(26));
      if (a === ethers.ZeroAddress || seen.has(a)) continue;
      seen.add(a);
      if ((await c.balanceOf(a)) >= need) return a;
    }
  }
  throw new Error(`no holder with enough of ${token} in recent transfers`);
}

async function fund(token, amount, to) {
  const holder = await topHolder(token, amount);
  await network.provider.send("hardhat_impersonateAccount", [holder]);
  await network.provider.send("hardhat_setBalance", [holder, "0x56BC75E2D63100000"]);
  const s = await ethers.getSigner(holder);
  await (await new ethers.Contract(token, ERC20, s).transfer(to, amount)).wait();
  await network.provider.send("hardhat_stopImpersonatingAccount", [holder]);
  return holder;
}

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "robinhood-fork.json"), "utf8"));
  const [, user] = await ethers.getSigners();
  const ok = (m) => console.log(`  ✓ ${m}`);
  const usdg = new ethers.Contract(dep.usdg.address, ERC20, user);
  const m0 = dep.markets[0];
  const stock = new ethers.Contract(m0.token, ERC20, user);
  const vault = await ethers.getContractAt("EarnVault", dep.vault, user);
  const market = await ethers.getContractAt("LendingMarket", m0.market, user);
  const U = (x) => ethers.parseUnits(String(x), 6);
  const S = (x) => ethers.parseUnits(String(x), 18);

  console.log(`Smoke test on fork, user ${user.address}`);
  console.log(`  USDG from ${await fund(dep.usdg.address, U(5000), user.address)}`);
  console.log(`  ${m0.symbol} from ${await fund(m0.token, S(2), user.address)}`);
  ok(`real USDG and ${m0.symbol} transferred to a fresh wallet`);

  await (await usdg.approve(dep.vault, U(5000))).wait();
  await (await vault.deposit(U(5000), user.address)).wait();
  ok(`Earn deposit 5,000 USDG → vault totalAssets ${ethers.formatUnits(await vault.totalAssets(), 6)}`);
  for (const m of dep.markets) {
    const mk = await ethers.getContractAt("LendingMarket", m.market);
    const i = await mk.marketInfo();
    console.log(`    ${m.symbol.padEnd(5)} supplied ${ethers.formatUnits(i.supplyAssets, 6).padStart(8)}  price $${Number(ethers.formatUnits(i.collateralPrice, 18)).toFixed(2)}  ${STATUS[Number(i.collateralStatus)]}  updated ${new Date(Number(i.collateralUpdatedAt) * 1000).toISOString()}`);
  }

  await (await stock.approve(m0.market, S(2))).wait();
  await (await market.depositCollateral(S(2), user.address)).wait();
  ok(`market accepts real ${m0.symbol} as collateral (2 ${m0.symbol})`);

  const info = await market.marketInfo();
  if (Number(info.collateralStatus) === 0) {
    await (await market.borrow(U(50), user.address)).wait();
    ok(`borrowed 50 USDG (market open, price Fresh)`);
    await (await usdg.approve(m0.market, U(60))).wait();
    await (await market.repay(ethers.MaxUint256, user.address)).wait();
    ok(`repaid in full, debt ${await market.debtOf(user.address)}`);
  } else {
    let reverted = false;
    try { await market.borrow.staticCall(U(50), user.address); } catch (e) { reverted = /not fresh/.test(e.message); }
    if (!reverted) throw new Error("borrow should be paused while the price is not Fresh");
    ok(`borrow correctly paused: ${m0.symbol} price is ${STATUS[Number(info.collateralStatus)]} (US market closed)`);
  }

  await (await market.withdrawCollateral(S(2), user.address)).wait();
  ok(`collateral withdrawn`);
  await (await vault.redeem(await vault.maxRedeem(user.address), user.address, user.address)).wait();
  ok(`Earn withdrawal, USDG back in wallet: ${ethers.formatUnits(await usdg.balanceOf(user.address), 6)}`);
  console.log("All smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
