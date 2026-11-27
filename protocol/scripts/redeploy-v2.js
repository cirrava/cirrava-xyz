// Cirrava v2 on Robinhood Chain: fixes GHSA-7hw7-pqjf-gcxx (StockOracle now reads the Stock Token's
// oraclePaused()/paused()). Contracts are not upgradeable, so v2 is a new vault with new oracles and markets.
//
//  Reused from v1 (code unchanged): MarketCalendar, InterestRateModel, treasury.
//  New: USDG StockOracle, EarnVault, and one StockOracle + LendingMarket per entry of mainnet-assets.js
//       `markets`, `newMarkets` and `markets247`, each added to the new vault.
//  Retire v1 (owner only): every v1 market's cap in the v1 vault -> 0 and every v1 market paused, so nothing
//       can be lent or borrowed through v1. v1 vault deposits/withdrawals keep working (it holds no funds today).
//
//   Estimate (read-only, no key):  npx hardhat run scripts/redeploy-v2.js --network robinhood
//   Real (costs gas, final):       bash scripts/run-redeploy-v2.sh deploy
// The v1 record is kept as deployments/robinhood-v1.json; deployments/robinhood.json becomes v2.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const A = require("./mainnet-assets");

const WAD = (x) => ethers.parseUnits(String(x), 18);
const DIR = path.join(__dirname, "..", "deployments");
const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function oraclePaused() view returns (bool)", "function paused() view returns (bool)"];
const FEED = ["function description() view returns (string)", "function decimals() view returns (uint8)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];
// measured: ~3.5M gas per market (oracle + market + addMarket), vault + USDG oracle ~3.5M, retiring ~1.5M; 1.3x headroom
const GAS = (n) => BigInt(Math.ceil((3_500_000 * n + 5_000_000) * 1.3));

async function main() {
  if (network.name !== "robinhood") throw new Error("Run with --network robinhood");
  const v1File = path.join(DIR, "robinhood.json");
  const v1 = JSON.parse(fs.readFileSync(v1File, "utf8"));
  if (v1.version === 2) return console.log("deployments/robinhood.json is already v2. Nothing to do.");
  const p = ethers.provider;
  const vault1 = await ethers.getContractAt("EarnVault", v1.vault);
  const owner = await vault1.owner();
  const [signer] = await ethers.getSigners();
  const confirm = process.env.CONFIRM_MAINNET === "yes";
  if (confirm && !signer) throw new Error("No signer. Run: bash scripts/run-redeploy-v2.sh deploy");
  if (signer && signer.address.toLowerCase() !== owner.toLowerCase()) throw new Error(`Signer ${signer.address} is not the v1 owner ${owner}. Nothing was sent.`);

  const list = [...A.markets, ...A.newMarkets, ...(A.markets247 || [])];
  const key = (m) => m.symbol + (m.hours ? ` ${m.hours}` : "");
  const bal = await p.getBalance(owner);
  console.log(`${confirm ? "MAINNET REDEPLOY" : "ESTIMATE ONLY (read-only)"}: Cirrava v2, ${list.length} markets: ${list.map(key).join(", ")}`);
  console.log(`  owner ${owner} (${ethers.formatEther(bal)} ETH)   reuse calendar ${v1.calendar}, IRM ${v1.irm}`);

  // 1. on-chain checks before anything is sent: tokens expose the status flags, feeds answer
  for (const m of list) {
    const t = new ethers.Contract(m.token, ERC20, p), f = new ethers.Contract(m.feed, FEED, p);
    const [sym, dec, op, tp, desc, fdec, r] = await Promise.all([t.symbol(), t.decimals(), t.oraclePaused(), t.paused(), f.description(), f.decimals(), f.latestRoundData()]);
    if (sym !== m.symbol || Number(dec) !== 18 || !desc.toUpperCase().includes(m.symbol) || !(r[1] > 0n)) throw new Error(`${key(m)}: token ${sym}/${dec}, feed "${desc}"`);
    console.log(`  ok ${key(m).padEnd(10)} oraclePaused=${op} paused=${tp}  "${desc}" $${ethers.formatUnits(r[1], fdec)}`);
  }

  const fee = await p.getFeeData();
  const price = fee.gasPrice ?? fee.maxFeePerGas;
  const ov = { maxFeePerGas: price * 2n, maxPriorityFeePerGas: 0n };
  const need = GAS(list.length) * price;
  // read-only estimate of the two big deployments
  const OF = await ethers.getContractFactory("StockOracle"), LF = await ethers.getContractFactory("LendingMarket"), VF = await ethers.getContractFactory("EarnVault");
  const m0 = list[0];
  const gO = await p.estimateGas({ ...(await OF.getDeployTransaction(owner, m0.feed, v1.calendar, 26 * 3600, 97 * 3600, m0.token)), from: owner });
  const gM = await p.estimateGas({ ...(await LF.getDeployTransaction({ owner, vault: v1.vault, treasury: v1.treasury, collateralToken: m0.token, borrowToken: v1.usdg.address, collateralOracle: v1.markets[0].oracle, borrowOracle: v1.usdg.oracle, irm: v1.irm, ltv: WAD(m0.ltv), liquidationThreshold: WAD(m0.lt), liquidationBonus: WAD(0.05), reserveFactor: WAD(0.1), borrowFee: WAD(0.001) })), from: owner });
  const gV = await p.estimateGas({ ...(await VF.getDeployTransaction(v1.usdg.address, owner)), from: owner });
  const est = (gO + gM + 200_000n) * BigInt(list.length) + gV + gO + 1_500_000n;
  console.log(`  estimate: oracle ${gO}, market ${gM}, vault ${gV} -> total ~${est} gas = ${ethers.formatEther(est * price)} ETH at ${ethers.formatUnits(price, "gwei")} gwei`);
  console.log(`  required balance (with headroom): ${ethers.formatEther(need)} ETH; owner has ${ethers.formatEther(bal)}`);
  if (!confirm) return console.log("\nChecks passed. Nothing sent.");
  if (bal < need) throw new Error(`Owner has ${ethers.formatEther(bal)} ETH; needs ${ethers.formatEther(need)}. Nothing was sent.`);

  let gasUsed = 0n;
  const deploy = async (name, ...args) => {
    const c = await (await ethers.getContractFactory(name, signer)).deploy(...args, ov);
    await c.waitForDeployment();
    gasUsed += (await c.deploymentTransaction().wait()).gasUsed;
    console.log(`  ${name.padEnd(14)} ${await c.getAddress()}`);
    return c;
  };
  const send = async (txp) => { const r = await (await txp).wait(); gasUsed += r.gasUsed; return r; };

  // 2. v2 core
  fs.writeFileSync(path.join(DIR, "robinhood-v1.json"), JSON.stringify(v1, null, 2));
  console.log("\nv2 core");
  const usdgOracle = await deploy("StockOracle", owner, v1.usdg.feed, ethers.ZeroAddress, 26 * 3600, 26 * 3600, ethers.ZeroAddress);
  const vault = await deploy("EarnVault", v1.usdg.address, owner);
  const cap = ethers.parseUnits(String(v1.capPerMarket || "10000").split(".")[0], 6);
  const v2 = {
    ...v1, version: 2, fixes: ["GHSA-7hw7-pqjf-gcxx"], deployedAt: new Date().toISOString(), previous: "deployments/robinhood-v1.json",
    usdg: { ...v1.usdg, oracle: await usdgOracle.getAddress() }, vault: await vault.getAddress(), markets: [],
  };
  delete v2.marketsAddedAt;
  const out = path.join(DIR, "robinhood-v2.partial.json");

  // 3. markets
  for (const m of list) {
    const h247 = m.hours === "24/7";
    const mcap = m.cap ? ethers.parseUnits(m.cap, 6) : cap;
    console.log(`\n${key(m)}`);
    const oracle = h247
      ? await deploy("StockOracle", owner, m.feed, ethers.ZeroAddress, m.window, m.window, m.token)
      : await deploy("StockOracle", owner, m.feed, v1.calendar, 26 * 3600, 97 * 3600, m.token);
    const market = await deploy("LendingMarket", {
      owner, vault: v2.vault, treasury: v1.treasury, collateralToken: m.token, borrowToken: v1.usdg.address,
      collateralOracle: await oracle.getAddress(), borrowOracle: v2.usdg.oracle, irm: v1.irm,
      ltv: WAD(m.ltv), liquidationThreshold: WAD(m.lt), liquidationBonus: WAD(m.bonus ?? 0.05), reserveFactor: WAD(0.1), borrowFee: WAD(0.001),
    });
    await send(vault.addMarket(await market.getAddress(), mcap, ov));
    console.log(`  vault.addMarket cap ${ethers.formatUnits(mcap, 6)} USDG`);
    v2.markets.push({
      symbol: m.symbol, ...(h247 ? { hours: "24/7", window: m.window } : {}), name: m.name, decimals: 18,
      token: m.token, feed: m.feed, oracle: await oracle.getAddress(), market: await market.getAddress(),
      ltv: m.ltv, lt: m.lt, ...(m.bonus ? { bonus: m.bonus } : {}), ...(m.cap ? { cap: m.cap } : {}),
    });
    fs.writeFileSync(out, JSON.stringify(v2, null, 2)); // progress survives a failure half-way
  }

  // 4. retire v1: no lending, no borrowing
  console.log("\nretire v1");
  for (const m of v1.markets) {
    const mk = await ethers.getContractAt("LendingMarket", m.market, signer);
    if ((await vault1.cap(m.market)) !== 0n) await send(vault1.setCap(m.market, 0, ov));
    if (!(await mk.paused())) await send(mk.pause(ov));
    console.log(`  v1 ${m.symbol.padEnd(5)} cap 0, paused`);
  }

  // 5. record + checks
  fs.writeFileSync(v1File, JSON.stringify(v2, null, 2));
  fs.rmSync(out, { force: true });
  require("./app-config").writeAppConfig(v2);
  console.log("\ncheck");
  for (const m of v2.markets) {
    const [px, st] = await (await ethers.getContractAt("StockOracle", m.oracle)).latest();
    console.log(`  ${key(m).padEnd(10)} $${Number(ethers.formatUnits(px, 18)).toFixed(2)} ${STATUS[Number(st)]}`);
  }
  console.log(`  v2 vault ${v2.vault} markets: ${await vault.marketCount()}`);
  console.log(`\nGas used ${gasUsed} = ${ethers.formatEther(gasUsed * price)} ETH. Wrote deployments/robinhood.json (v2), robinhood-v1.json and app/deployment.js`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
