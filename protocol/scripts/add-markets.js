// Adds new markets to the LIVE Cirrava deployment on Robinhood Chain: every entry of mainnet-assets.js
// `newMarkets` and `markets247` that is not yet in deployments/robinhood.json.
// For each: deploys a StockOracle (with the NYSE calendar, or none for 24/7 markets) and a LendingMarket
// wired to the existing IRM, USDG oracle and Earn vault, then calls vault.addMarket(market, cap).
// Must be run by the vault owner.
//
//   Dry run on a fork (free):  FORK=1 npx hardhat run scripts/add-markets.js
//   Real (costs gas, final):   bash scripts/run-add-markets.sh add
// Optional env: ONLY=MSFT,"NVDA 24/7"  (subset, by symbol or key)   CAP_USDG=10000 (default cap)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const A = require("./mainnet-assets");

const WAD = (x) => ethers.parseUnits(String(x), 18);
const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
const FEED = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
];
const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
const DEP = path.join(__dirname, "..", "deployments", "robinhood.json");
// Measured on a mainnet fork (see the dry-run output); 1.5x headroom so a run never stops half-way.
const GAS_PER_MARKET = 4_800_000n;

async function main() {
  const dep = JSON.parse(fs.readFileSync(DEP, "utf8"));
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== dep.chainId) throw new Error(`Connected to chain ${chainId}, expected ${dep.chainId}`);
  const isFork = network.name !== "robinhood";
  const only = (process.env.ONLY || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const key = (m) => m.symbol + (m.hours ? ` ${m.hours}` : "");
  const have = new Set(dep.markets.map(key));
  const todo = [...A.newMarkets, ...(A.markets247 || [])].filter(
    (m) => !have.has(key(m)) && (!only.length || only.includes(m.symbol) || only.includes(key(m).toUpperCase())),
  );
  if (!todo.length) return console.log("Nothing to add: every new market is already in deployments/robinhood.json.");
  const cap = ethers.parseUnits(process.env.CAP_USDG || String(dep.capPerMarket || "10000").split(".")[0], 6);

  const vault = await ethers.getContractAt("EarnVault", dep.vault);
  const owner = await vault.owner();
  let signer;
  if (isFork) {
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [owner] });
    await network.provider.request({ method: "hardhat_setBalance", params: [owner, "0x8AC7230489E80000"] });
    signer = await ethers.getSigner(owner);
  } else {
    [signer] = await ethers.getSigners();
    if (!signer && process.env.CONFIRM_MAINNET === "yes") throw new Error("No signer. Run: bash scripts/run-add-markets.sh add");
    if (signer && signer.address.toLowerCase() !== owner.toLowerCase())
      throw new Error(`Signer ${signer.address} is not the vault owner ${owner}. Nothing was sent.`);
  }
  const bal = await ethers.provider.getBalance(owner);
  console.log(`${isFork ? "DRY RUN on a mainnet fork" : signer ? "MAINNET" : "ESTIMATE ONLY (no key, read-only)"}: add ${todo.map((m) => `${key(m)} (cap ${m.cap || ethers.formatUnits(cap, 6)} USDG)`).join(", ")}`);
  console.log(`  owner ${owner}  (${ethers.formatEther(bal)} ETH)`);

  // 1. check every token and feed on-chain before spending anything
  for (const m of todo) {
    const t = new ethers.Contract(m.token, ERC20, ethers.provider);
    const f = new ethers.Contract(m.feed, FEED, ethers.provider);
    const [sym, d, desc, fdec, r] = await Promise.all([t.symbol(), t.decimals(), f.description(), f.decimals(), f.latestRoundData()]);
    if (sym !== m.symbol || Number(d) !== 18) throw new Error(`${m.symbol}: token is ${sym} with ${d} decimals`);
    if (!desc.toUpperCase().includes(m.symbol)) throw new Error(`${m.symbol}: feed is "${desc}"`);
    if (!(r[1] > 0n)) throw new Error(`${m.symbol}: feed price not positive`);
    console.log(`  ok ${key(m).padEnd(10)} token ${sym}  feed "${desc}" $${ethers.formatUnits(r[1], fdec)}`);
  }

  const fee = await ethers.provider.getFeeData();
  const price = fee.gasPrice ?? fee.maxFeePerGas;
  const ov = { maxFeePerGas: price * 2n, maxPriorityFeePerGas: 0n };
  // Read-only gas estimate from the owner address: the two deployments of the first market, exactly as
  // they will be sent (eth_estimateGas, nothing is signed or broadcast).
  if (!isFork) {
    const m = todo[0];
    const OF = await ethers.getContractFactory("StockOracle");
    const LF = await ethers.getContractFactory("LendingMarket");
    const oTx = await OF.getDeployTransaction(owner, m.feed, dep.calendar, 26 * 3600, 97 * 3600);
    const gO = await ethers.provider.estimateGas({ ...oTx, from: owner });
    const mTx = await LF.getDeployTransaction({
      owner, vault: dep.vault, treasury: dep.treasury, collateralToken: m.token, borrowToken: dep.usdg.address,
      collateralOracle: dep.markets[0].oracle, borrowOracle: dep.usdg.oracle, irm: dep.irm,
      ltv: WAD(m.ltv), liquidationThreshold: WAD(m.lt), liquidationBonus: WAD(0.05), reserveFactor: WAD(0.1), borrowFee: WAD(0.001),
    });
    const gM = await ethers.provider.estimateGas({ ...mTx, from: owner });
    const gA = 200_000n; // vault.addMarket: storage writes + approve, well under this
    const per = gO + gM + gA;
    console.log(`  estimate per market: oracle ${gO} + market ${gM} + addMarket ~${gA} = ${per} gas`);
    console.log(`  estimate for ${todo.length}: ${per * BigInt(todo.length)} gas = ${ethers.formatEther(per * BigInt(todo.length) * price)} ETH at ${ethers.formatUnits(price, "gwei")} gwei`);
  }
  const need = GAS_PER_MARKET * BigInt(todo.length) * price;
  console.log(`  required balance (with headroom): ${ethers.formatEther(need)} ETH; owner has ${ethers.formatEther(bal)}`);
  if (!isFork && process.env.CONFIRM_MAINNET !== "yes") return console.log("\nChecks passed. Nothing sent.");
  if (!isFork && bal < need) throw new Error(`Owner has ${ethers.formatEther(bal)} ETH; needs at least ${ethers.formatEther(need)} ETH. Nothing was sent.`);

  let gasUsed = 0n;
  const deploy = async (name, ...args) => {
    const c = await (await ethers.getContractFactory(name, signer)).deploy(...args, ov);
    await c.waitForDeployment();
    gasUsed += (await c.deploymentTransaction().wait()).gasUsed;
    console.log(`  ${name.padEnd(14)} ${await c.getAddress()}`);
    return c;
  };

  for (const m of todo) {
    const h247 = m.hours === "24/7";
    const mcap = m.cap ? ethers.parseUnits(m.cap, 6) : cap;
    console.log(`\n${key(m)}`);
    // 24/7: no calendar, a price is Fresh while younger than `window`; regular: NYSE calendar, 26h / 97h windows
    const oracle = h247
      ? await deploy("StockOracle", owner, m.feed, ethers.ZeroAddress, m.window, m.window)
      : await deploy("StockOracle", owner, m.feed, dep.calendar, 26 * 3600, 97 * 3600);
    const market = await deploy("LendingMarket", {
      owner,
      vault: dep.vault,
      treasury: dep.treasury,
      collateralToken: m.token,
      borrowToken: dep.usdg.address,
      collateralOracle: await oracle.getAddress(),
      borrowOracle: dep.usdg.oracle,
      irm: dep.irm,
      ltv: WAD(m.ltv),
      liquidationThreshold: WAD(m.lt),
      liquidationBonus: WAD(m.bonus ?? 0.05),
      reserveFactor: WAD(0.1),
      borrowFee: WAD(0.001),
    });
    const r = await (await vault.connect(signer).addMarket(await market.getAddress(), mcap, ov)).wait();
    gasUsed += r.gasUsed;
    console.log(`  vault.addMarket  cap ${ethers.formatUnits(mcap, 6)} USDG`);
    dep.markets.push({
      symbol: m.symbol, ...(h247 ? { hours: "24/7", window: m.window } : {}), name: m.name, decimals: 18,
      token: m.token, feed: m.feed, oracle: await oracle.getAddress(), market: await market.getAddress(),
      ltv: m.ltv, lt: m.lt, ...(m.bonus ? { bonus: m.bonus } : {}), ...(m.cap ? { cap: m.cap } : {}),
    });
    // record after every market, so a later failure loses nothing
    if (!isFork) fs.writeFileSync(DEP, JSON.stringify(dep, null, 2));
  }

  console.log("\nCheck");
  for (const m of dep.markets.slice(-todo.length)) {
    const o = await ethers.getContractAt("StockOracle", m.oracle);
    const [p, st] = await o.latest();
    const mk = await ethers.getContractAt("LendingMarket", m.market);
    console.log(`  ${key(m).padEnd(10)} price $${Number(ethers.formatUnits(p, 18)).toFixed(2)}  ${STATUS[Number(st)]}  collateral ${await mk.collateralToken()}`);
  }
  console.log(`  vault markets: ${await vault.marketCount()}`);
  console.log(`\nGas used ${gasUsed} (${gasUsed / BigInt(todo.length)} per market) = ${ethers.formatEther(gasUsed * price)} ETH at ${ethers.formatUnits(price, "gwei")} gwei`);
  if (!isFork) {
    dep.marketsAddedAt = new Date().toISOString();
    fs.writeFileSync(DEP, JSON.stringify(dep, null, 2));
    require("./app-config").writeAppConfig(dep);
    console.log("Wrote deployments/robinhood.json and app/deployment.js");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
