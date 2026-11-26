// Deploys Cirrava on Robinhood Chain mainnet against the REAL assets: Robinhood's Stock Tokens,
// Paxos' USDG and Chainlink's feeds. Nothing mock, no faucet, no seed deposit, no keeper.
//
//   Dry run on a fork (safe, free):   FORK=1 npx hardhat node            (terminal 1)
//                                      npx hardhat run scripts/deploy-mainnet.js --network localhost
//   Real deploy (costs gas, final):    DEPLOYER_KEY=0x... CONFIRM_MAINNET=yes \
//                                      npx hardhat run scripts/deploy-mainnet.js --network robinhood
// Optional env: TREASURY=0x... (fee receiver, default deployer)
//               SAFE=0x...     (Safe multisig: ownership of every contract is offered to it; the Safe
//                               must then call acceptOwnership() on each — addresses are printed)
//               CAP_USDG=10000 (max USDG the vault lends per market; owner can raise it later)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const A = require("./mainnet-assets");
const { HOLIDAYS, EARLY_CLOSES, nyDayNumber } = require("./config");

const WAD = (x) => ethers.parseUnits(String(x), 18);
const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
const FEED = ["function decimals() view returns (uint8)", "function description() view returns (string)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== A.chainId) throw new Error(`Connected to chain ${chainId}, expected Robinhood Chain ${A.chainId}`);
  const isFork = network.name !== "robinhood";
  if (!isFork) {
    const k = process.env.DEPLOYER_KEY || "";
    if (!k) throw new Error("DEPLOYER_KEY is not set in this shell. Run:  read -rs DEPLOYER_KEY   (Enter, paste key, Enter)  then:  export DEPLOYER_KEY");
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(k.trim())) throw new Error("DEPLOYER_KEY does not look like a private key (expected 64 hex characters, optionally starting with 0x). Re-enter it with read -rs.");
  }
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_KEY (read -rs DEPLOYER_KEY, then export DEPLOYER_KEY).");
  const treasury = process.env.TREASURY || deployer.address;
  const safe = process.env.SAFE || "";
  const cap = ethers.parseUnits(process.env.CAP_USDG || "10000", 6);
  if (safe && !ethers.isAddress(safe)) throw new Error("SAFE is not an address");
  if (!ethers.isAddress(treasury)) throw new Error("TREASURY is not an address");

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`${isFork ? "DRY RUN on a mainnet fork" : "MAINNET DEPLOY"} — Robinhood Chain (${chainId})`);
  console.log(`  deployer  ${deployer.address}  (${ethers.formatEther(bal)} ETH)`);
  console.log(`  treasury  ${treasury}`);
  console.log(`  owner     ${safe ? `${deployer.address} → offered to Safe ${safe}` : deployer.address}`);
  console.log(`  cap       ${ethers.formatUnits(cap, 6)} USDG per market`);

  // ---- 1. verify every external address on-chain before spending anything
  const check = async (label, token, feed, dec) => {
    const [sym, d, fdec, desc, round] = await Promise.all([
      new ethers.Contract(token, ERC20, ethers.provider).symbol(),
      new ethers.Contract(token, ERC20, ethers.provider).decimals(),
      new ethers.Contract(feed, FEED, ethers.provider).decimals(),
      new ethers.Contract(feed, FEED, ethers.provider).description(),
      new ethers.Contract(feed, FEED, ethers.provider).latestRoundData(),
    ]);
    if (Number(d) !== dec) throw new Error(`${label}: token decimals ${d}, expected ${dec}`);
    if (!desc.toUpperCase().includes(label)) throw new Error(`${label}: feed is "${desc}"`);
    if (!(round[1] > 0n)) throw new Error(`${label}: feed price not positive`);
    console.log(`  ✓ ${label.padEnd(5)} ${sym} (${d} dec)  feed "${desc}" $${ethers.formatUnits(round[1], fdec)}`);
  };
  await check("USDG", A.usdg.token, A.usdg.feed, 6);
  for (const m of A.markets) await check(m.symbol, m.token, m.feed, 18);

  if (!isFork && process.env.CONFIRM_MAINNET !== "yes") {
    console.log("\nChecks passed. Nothing deployed: set CONFIRM_MAINNET=yes to deploy for real.");
    return;
  }

  // Robinhood Chain charges no priority fee (Arbitrum Nitro); keep tips at zero.
  const fee = await ethers.provider.getFeeData();
  const ov = { maxFeePerGas: (fee.maxFeePerGas ?? fee.gasPrice) * 2n, maxPriorityFeePerGas: 0n };
  // never start a deploy that could run out of gas half-way: measured 17.7M gas incl. L1 data
  // (scripts/estimate-mainnet.js), plus 1.5x headroom
  const need = 27_000_000n * (fee.gasPrice ?? fee.maxFeePerGas);
  if (!isFork && bal < need) {
    throw new Error(`Deployer has ${ethers.formatEther(bal)} ETH; needs at least ${ethers.formatEther(need)} ETH on Robinhood Chain for gas. Nothing was sent.`);
  }
  let gasUsed = 0n;
  const deploy = async (name, ...args) => {
    const c = await (await ethers.getContractFactory(name)).deploy(...args, ov);
    await c.waitForDeployment();
    const r = await c.deploymentTransaction().wait();
    gasUsed += r.gasUsed;
    console.log(`  ${name.padEnd(18)} ${await c.getAddress()}  (${r.gasUsed} gas)`);
    return c;
  };
  const send = async (p) => {
    const r = await (await p).wait();
    gasUsed += r.gasUsed;
    return r;
  };

  // ---- 2. core
  const calendar = await deploy("MarketCalendar", deployer.address);
  await send(calendar.setHolidays(HOLIDAYS.map(nyDayNumber), true, ov));
  for (const d of EARLY_CLOSES) await send(calendar.setEarlyClose(nyDayNumber(d), 13 * 3600, ov));
  const usdgOracle = await deploy("StockOracle", deployer.address, A.usdg.feed, ethers.ZeroAddress, 26 * 3600, 26 * 3600);
  const irm = await deploy("InterestRateModel", WAD(0.02), WAD(0.08), WAD(1), WAD(0.8));
  const vault = await deploy("EarnVault", A.usdg.token, deployer.address);

  const out = {
    network: "robinhood",
    chainId,
    rpcUrl: A.rpcUrl,
    explorer: A.explorer,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    treasury,
    demo247: false,
    usdg: { address: A.usdg.token, feed: A.usdg.feed, oracle: await usdgOracle.getAddress(), decimals: 6 },
    calendar: await calendar.getAddress(),
    irm: await irm.getAddress(),
    vault: await vault.getAddress(),
    capPerMarket: ethers.formatUnits(cap, 6),
    markets: [],
  };

  // ---- 3. one isolated market per Stock Token
  for (const m of A.markets) {
    const oracle = await deploy("StockOracle", deployer.address, m.feed, await calendar.getAddress(), 26 * 3600, 97 * 3600);
    const market = await deploy("LendingMarket", {
      owner: deployer.address,
      vault: await vault.getAddress(),
      treasury,
      collateralToken: m.token,
      borrowToken: A.usdg.token,
      collateralOracle: await oracle.getAddress(),
      borrowOracle: await usdgOracle.getAddress(),
      irm: await irm.getAddress(),
      ltv: WAD(m.ltv),
      liquidationThreshold: WAD(m.lt),
      liquidationBonus: WAD(0.05),
      reserveFactor: WAD(0.1),
      borrowFee: WAD(0.001),
    });
    await send(vault.addMarket(market, cap, ov));
    out.markets.push({ symbol: m.symbol, name: m.name, decimals: 18, token: m.token, feed: m.feed, oracle: await oracle.getAddress(), market: await market.getAddress(), ltv: m.ltv, lt: m.lt });
  }

  // ---- 4. hand ownership to the Safe (two-step: the Safe must accept)
  if (safe) {
    const owned = [calendar, usdgOracle, vault, ...(await Promise.all(out.markets.flatMap((m) => [ethers.getContractAt("StockOracle", m.oracle), ethers.getContractAt("LendingMarket", m.market)])))];
    for (const c of owned) await send(c.transferOwnership(safe, ov));
    out.pendingOwner = safe;
    out.acceptOwnership = await Promise.all(owned.map((c) => c.getAddress()));
    console.log(`\nOwnership offered to ${safe}. In the Safe, call acceptOwnership() on:\n  ${out.acceptOwnership.join("\n  ")}`);
  }

  // ---- 5. record
  const tag = isFork ? "robinhood-fork" : "robinhood";
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${tag}.json`), JSON.stringify(out, null, 2));
  if (!isFork) require("./app-config").writeAppConfig(out);
  console.log(`\nWrote deployments/${tag}.json${isFork ? "" : " and app/deployment.js"}`);
  console.log(`Total gas used: ${gasUsed}  ≈ ${ethers.formatEther(gasUsed * (fee.gasPrice ?? 0n))} ETH at ${ethers.formatUnits(fee.gasPrice ?? 0n, "gwei")} gwei`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
