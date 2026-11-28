const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const G = require("../scripts/lib/governance");

const E = (n) => ethers.parseUnits(String(n), 18);
const U = (n) => ethers.parseUnits(String(n), 6);
const P8 = (n) => ethers.parseUnits(String(n), 8);

// A small Cirrava deployment owned by an EOA, plus a "Safe" (an account standing in for the multisig).
async function deploy() {
  const [eoa, safe, stranger] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("MockERC20");
  const usdg = await Token.deploy("USDG", "USDG", 6, U(10_000));
  const nvda = await Token.deploy("NVDA", "NVDA", 18, E(10));
  const Agg = await ethers.getContractFactory("MockAggregator");
  const now = await time.latest();
  const nvdaFeed = await Agg.deploy(8, "NVDA / USD", eoa.address);
  const usdgFeed = await Agg.deploy(8, "USDG / USD", eoa.address);
  await nvdaFeed.push(P8(180), now);
  await usdgFeed.push(P8(1), now);
  const calendar = await (await ethers.getContractFactory("MarketCalendar")).deploy(eoa.address);
  const Oracle = await ethers.getContractFactory("StockOracle");
  const nvdaOracle = await Oracle.deploy(eoa.address, nvdaFeed, ethers.ZeroAddress, 3600, 3600, nvda);
  const usdgOracle = await Oracle.deploy(eoa.address, usdgFeed, ethers.ZeroAddress, 26 * 3600, 26 * 3600, ethers.ZeroAddress);
  const irm = await (await ethers.getContractFactory("InterestRateModel")).deploy(E(0.02), E(0.08), E(1), E(0.8));
  const vault = await (await ethers.getContractFactory("EarnVault")).deploy(usdg, eoa.address);
  const market = await (await ethers.getContractFactory("LendingMarket")).deploy({
    owner: eoa.address, vault: await vault.getAddress(), treasury: eoa.address,
    collateralToken: await nvda.getAddress(), borrowToken: await usdg.getAddress(),
    collateralOracle: await nvdaOracle.getAddress(), borrowOracle: await usdgOracle.getAddress(), irm: await irm.getAddress(),
    ltv: E(0.6), liquidationThreshold: E(0.65), liquidationBonus: E(0.05), reserveFactor: E(0.1), borrowFee: E(0.001),
  });
  await vault.addMarket(market, U(10_000));
  const dep = {
    calendar: await calendar.getAddress(), vault: await vault.getAddress(),
    usdg: { oracle: await usdgOracle.getAddress() },
    markets: [{ symbol: "NVDA", oracle: await nvdaOracle.getAddress(), market: await market.getAddress() }],
  };
  return { eoa, safe, stranger, calendar, vault, market, nvdaOracle, usdgOracle, dep };
}

// Steps 1-3 of the handover, exactly as the mainnet scripts do them.
async function handover() {
  const f = await deploy();
  const timelock = await (await ethers.getContractFactory("CirravaTimelock")).deploy(0, [f.safe.address], [ethers.ZeroAddress], ethers.ZeroAddress);
  const tl = await timelock.getAddress();
  const owned = G.ownedContracts(f.dep, null);
  for (const c of owned.filter((c) => c.market)) {
    const m = await ethers.getContractAt("LendingMarket", c.address);
    await m.setPauser(f.safe.address);
    await m.setTreasury(f.safe.address);
  }
  for (const c of owned) await (await ethers.getContractAt("MarketCalendar", c.address)).transferOwnership(tl);
  const batch = G.acceptBatch(owned, tl);
  for (const call of G.safeCalls(batch)) await f.safe.sendTransaction({ to: tl, data: call.data });
  return { ...f, timelock, tl, owned };
}

describe("Admin handover: Safe multisig + 48h timelock", () => {
  it("makes the timelock the owner of every contract, with a 48h delay, in one Safe transaction", async () => {
    const f = await loadFixture(handover);
    for (const c of f.owned) expect(await (await ethers.getContractAt("MarketCalendar", c.address)).owner()).to.equal(f.tl);
    expect(await f.timelock.getMinDelay()).to.equal(48n * 3600n);
    expect(await f.market.pauser()).to.equal(f.safe.address);
    expect(await f.market.treasury()).to.equal(f.safe.address);
  });

  it("leaves the old admin wallet with no power", async () => {
    const f = await loadFixture(handover);
    await expect(f.market.connect(f.eoa).setRiskParams(E(0.9), E(0.95), E(0.05))).to.be.revertedWithCustomError(f.market, "OwnableUnauthorizedAccount");
    await expect(f.vault.connect(f.eoa).setCap(f.market, 0)).to.be.revertedWithCustomError(f.vault, "OwnableUnauthorizedAccount");
    await expect(f.nvdaOracle.connect(f.eoa).setPaused(true)).to.be.revertedWithCustomError(f.nvdaOracle, "OwnableUnauthorizedAccount");
    await expect(f.market.connect(f.eoa).pause()).to.be.revertedWith("not pauser");
  });

  it("lets the Safe pause a market at once, but unpausing waits 48 hours", async () => {
    const f = await loadFixture(handover);
    await f.market.connect(f.safe).pause();
    expect(await f.market.paused()).to.equal(true);
    const data = f.market.interface.encodeFunctionData("unpause");
    const salt = ethers.id("unpause");
    await f.timelock.connect(f.safe).schedule(await f.market.getAddress(), 0, data, ethers.ZeroHash, salt, 48 * 3600);
    await expect(f.timelock.execute(await f.market.getAddress(), 0, data, ethers.ZeroHash, salt)).to.be.revertedWithCustomError(f.timelock, "TimelockUnexpectedOperationState");
    await time.increase(48 * 3600);
    await f.timelock.connect(f.stranger).execute(await f.market.getAddress(), 0, data, ethers.ZeroHash, salt); // anyone executes after the delay
    expect(await f.market.paused()).to.equal(false);
  });

  it("refuses a shorter delay and proposals from anyone but the Safe; the Safe can cancel", async () => {
    const f = await loadFixture(handover);
    const target = await f.market.getAddress();
    const data = f.market.interface.encodeFunctionData("setRiskParams", [E(0.5), E(0.55), E(0.05)]);
    await expect(f.timelock.connect(f.safe).schedule(target, 0, data, ethers.ZeroHash, ethers.id("a"), 3600)).to.be.revertedWithCustomError(f.timelock, "TimelockInsufficientDelay");
    await expect(f.timelock.connect(f.stranger).schedule(target, 0, data, ethers.ZeroHash, ethers.id("a"), 48 * 3600)).to.be.revertedWithCustomError(f.timelock, "AccessControlUnauthorizedAccount");
    await f.timelock.connect(f.safe).schedule(target, 0, data, ethers.ZeroHash, ethers.id("b"), 48 * 3600);
    const id = await f.timelock.hashOperation(target, 0, data, ethers.ZeroHash, ethers.id("b"));
    await f.timelock.connect(f.safe).cancel(id);
    await time.increase(48 * 3600);
    await expect(f.timelock.execute(target, 0, data, ethers.ZeroHash, ethers.id("b"))).to.be.revertedWithCustomError(f.timelock, "TimelockUnexpectedOperationState");
  });

  it("has no admin: roles can only change through a timelocked operation", async () => {
    const f = await loadFixture(handover);
    const ADMIN = await f.timelock.DEFAULT_ADMIN_ROLE();
    const PROPOSER = await f.timelock.PROPOSER_ROLE();
    expect(await f.timelock.hasRole(ADMIN, f.eoa.address)).to.equal(false);
    expect(await f.timelock.hasRole(ADMIN, f.safe.address)).to.equal(false);
    expect(await f.timelock.hasRole(ADMIN, f.tl)).to.equal(true);
    await expect(f.timelock.connect(f.safe).grantRole(PROPOSER, f.stranger.address)).to.be.revertedWithCustomError(f.timelock, "AccessControlUnauthorizedAccount");
  });
});
