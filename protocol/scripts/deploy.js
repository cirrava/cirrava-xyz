// Deploys the full Cirrava protocol with test tokens and keeper-driven feeds seeded with REAL prices.
//   Local:   npx hardhat node            (terminal 1)
//            npx hardhat run scripts/deploy.js --network localhost
//   Testnet: set RPC_URL and DEPLOYER_KEY in your shell, then --network testnet
// Set DEMO_24_7=1 to ignore US market hours (lets you try borrowing at the weekend on a local chain).
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { MARKETS, HOLIDAYS, EARLY_CLOSES, nyDayNumber } = require("./config");
const { quotes } = require("./lib/prices");

const WAD = (x) => ethers.parseUnits(String(x), 18);
const P8 = (x) => ethers.parseUnits(Number(x).toFixed(8), 8);

async function main() {
  const [deployer] = await ethers.getSigners();
  const demo247 = process.env.DEMO_24_7 === "1";
  console.log(`Deploying to ${network.name} as ${deployer.address}${demo247 ? " (DEMO_24_7: market hours ignored)" : ""}`);

  const live = await quotes(MARKETS.map((m) => m.yahoo));
  for (const m of MARKETS) {
    const q = live[m.yahoo];
    console.log(`  ${m.symbol.padEnd(5)} $${q.price}  (trade time ${new Date(q.time * 1000).toISOString()})`);
  }

  const deploy = async (name, ...args) => {
    const c = await (await ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    return c;
  };
  const block = await ethers.provider.getBlock("latest");
  const nowChain = block.timestamp;

  // ---- tokens & feeds
  const usdg = await deploy("MockERC20", "Global Dollar (test)", "USDG", 6, ethers.parseUnits("10000", 6));
  const usdgFeed = await deploy("MockAggregator", 8, "USDG / USD", deployer.address);
  await (await usdgFeed.push(P8(1), nowChain)).wait();

  const calendar = await deploy("MarketCalendar", deployer.address);
  await (await calendar.setHolidays(HOLIDAYS.map(nyDayNumber), true)).wait();
  for (const d of EARLY_CLOSES) await (await calendar.setEarlyClose(nyDayNumber(d), 13 * 3600)).wait();

  const usdgOracle = await deploy("StockOracle", deployer.address, usdgFeed, ethers.ZeroAddress, 26 * 3600, 26 * 3600);
  const irm = await deploy("InterestRateModel", WAD(0.02), WAD(0.08), WAD(1), WAD(0.8));
  const vault = await deploy("EarnVault", usdg, deployer.address);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    rpcUrl: network.config.url || "http://127.0.0.1:8545",
    deployedAt: new Date().toISOString(),
    demo247,
    usdg: { address: await usdg.getAddress(), feed: await usdgFeed.getAddress(), oracle: await usdgOracle.getAddress(), decimals: 6 },
    calendar: await calendar.getAddress(),
    irm: await irm.getAddress(),
    vault: await vault.getAddress(),
    markets: [],
  };

  for (const m of MARKETS) {
    const q = live[m.yahoo];
    const token = await deploy("MockERC20", `${m.name} Stock Token (test)`, m.symbol, 18, WAD(10));
    const feed = await deploy("MockAggregator", 8, `${m.symbol} / USD`, deployer.address);
    await (await feed.push(P8(q.price), Math.min(q.time, nowChain))).wait();
    const oracle = await deploy(
      "StockOracle", deployer.address, feed, demo247 ? ethers.ZeroAddress : await calendar.getAddress(),
      demo247 ? 3600 : 26 * 3600, demo247 ? 3600 : 97 * 3600
    );
    const market = await deploy("LendingMarket", {
      owner: deployer.address,
      vault: await vault.getAddress(),
      treasury: deployer.address,
      collateralToken: await token.getAddress(),
      borrowToken: await usdg.getAddress(),
      collateralOracle: await oracle.getAddress(),
      borrowOracle: await usdgOracle.getAddress(),
      irm: await irm.getAddress(),
      ltv: WAD(m.ltv),
      liquidationThreshold: WAD(m.lt),
      liquidationBonus: WAD(0.05),
      reserveFactor: WAD(0.1),
      borrowFee: WAD(0.001),
    });
    await (await vault.addMarket(market, ethers.parseUnits("250000", 6))).wait();
    out.markets.push({
      symbol: m.symbol, name: m.name, yahoo: m.yahoo, decimals: 18,
      token: await token.getAddress(), feed: await feed.getAddress(), oracle: await oracle.getAddress(),
      market: await market.getAddress(), ltv: m.ltv, lt: m.lt,
    });
    console.log(`  market ${m.symbol} → ${await market.getAddress()}`);
  }

  // ---- seed liquidity so the markets can lend (deployer is the first Earn depositor)
  const seed = ethers.parseUnits("500000", 6);
  await (await usdg.mint(deployer.address, seed)).wait();
  await (await usdg.approve(vault, seed)).wait();
  await (await vault.deposit(seed, deployer.address)).wait();
  console.log(`  seeded Earn vault with 500,000 USDG`);

  // ---- write deployment for scripts and the web app
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  const appDir = path.join(__dirname, "..", "..", "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, "deployment.js"),
    `// Generated by protocol/scripts/deploy.js — do not edit by hand.\nwindow.CIRRAVA_DEPLOYMENT = ${JSON.stringify(out, null, 2)};\n`
  );
  console.log(`Wrote deployments/${network.name}.json and app/deployment.js`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
