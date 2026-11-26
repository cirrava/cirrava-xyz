const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const U = (n) => ethers.parseUnits(String(n), 6); // USDG
const E = (n) => ethers.parseUnits(String(n), 18); // stock token / WAD
const P8 = (n) => ethers.parseUnits(String(n), 8); // feed answer
const utc = (y, m, d, h = 0, mi = 0) => Math.floor(Date.UTC(y, m - 1, d, h, mi) / 1000);
const Status = { Fresh: 0, MarketClosed: 1, Stale: 2, Invalid: 3, Paused: 4 };

// Wednesday 13 Jan 2027, 10:00 New York (EST) — in session
const T0 = utc(2027, 1, 13, 15, 0);
const SAT = utc(2027, 1, 16, 15, 0);
const MON_OPEN = utc(2027, 1, 18, 14, 30); // 09:30 EST Monday

async function deploy() {
  const [owner, alice, bob, carol, treasury] = await ethers.getSigners();
  await time.increaseTo(T0 - 60);

  const Token = await ethers.getContractFactory("MockERC20");
  const usdg = await Token.deploy("Global Dollar (test)", "USDG", 6, U(10_000));
  const nvda = await Token.deploy("NVIDIA Stock Token (test)", "NVDA", 18, E(10));

  const Agg = await ethers.getContractFactory("MockAggregator");
  const nvdaFeed = await Agg.deploy(8, "NVDA / USD", owner.address);
  const usdgFeed = await Agg.deploy(8, "USDG / USD", owner.address);
  await nvdaFeed.push(P8(180), T0 - 60);
  await usdgFeed.push(P8(1), T0 - 60);

  const calendar = await (await ethers.getContractFactory("MarketCalendar")).deploy(owner.address);
  const Oracle = await ethers.getContractFactory("StockOracle");
  const nvdaOracle = await Oracle.deploy(owner.address, nvdaFeed, calendar, 26 * 3600, 97 * 3600);
  const usdgOracle = await Oracle.deploy(owner.address, usdgFeed, ethers.ZeroAddress, 26 * 3600, 26 * 3600);

  const irm = await (await ethers.getContractFactory("InterestRateModel")).deploy(E(0.02), E(0.08), E(1), E(0.8));
  const vault = await (await ethers.getContractFactory("EarnVault")).deploy(usdg, owner.address);
  const market = await (await ethers.getContractFactory("LendingMarket")).deploy({
    owner: owner.address,
    vault: await vault.getAddress(),
    treasury: treasury.address,
    collateralToken: await nvda.getAddress(),
    borrowToken: await usdg.getAddress(),
    collateralOracle: await nvdaOracle.getAddress(),
    borrowOracle: await usdgOracle.getAddress(),
    irm: await irm.getAddress(),
    ltv: E(0.6),
    liquidationThreshold: E(0.65),
    liquidationBonus: E(0.05),
    reserveFactor: E(0.1),
    borrowFee: E(0.001),
  });
  await vault.addMarket(market, ethers.MaxUint256);

  for (const s of [alice, bob, carol]) {
    await usdg.mint(s.address, U(1_000_000));
    await usdg.connect(s).approve(vault, ethers.MaxUint256);
    await usdg.connect(s).approve(market, ethers.MaxUint256);
  }
  await nvda.mint(bob.address, E(100));
  await nvda.connect(bob).approve(market, ethers.MaxUint256);
  await time.increaseTo(T0);
  return { owner, alice, bob, carol, treasury, usdg, nvda, nvdaFeed, usdgFeed, calendar, nvdaOracle, usdgOracle, irm, vault, market };
}

/** push fresh prices as of the current block (keeper behaviour) */
async function refresh(f, nvdaPrice = 180) {
  const now = await time.latest();
  await f.nvdaFeed.push(P8(nvdaPrice), now);
  await f.usdgFeed.push(P8(1), now);
}

describe("MarketCalendar", () => {
  it("knows the NYSE session in winter (EST)", async () => {
    const { calendar } = await loadFixture(deploy);
    expect(await calendar.isOpen(utc(2027, 1, 13, 14, 29))).to.equal(false); // 09:29 EST
    expect(await calendar.isOpen(utc(2027, 1, 13, 14, 30))).to.equal(true); // 09:30 EST
    expect(await calendar.isOpen(utc(2027, 1, 13, 20, 59))).to.equal(true); // 15:59 EST
    expect(await calendar.isOpen(utc(2027, 1, 13, 21, 0))).to.equal(false); // 16:00 EST
    expect(await calendar.isOpen(SAT)).to.equal(false);
  });

  it("switches to daylight time automatically", async () => {
    const { calendar } = await loadFixture(deploy);
    expect(await calendar.nyOffset(utc(2027, 7, 14, 12))).to.equal(-4 * 3600);
    expect(await calendar.isOpen(utc(2027, 7, 14, 13, 30))).to.equal(true); // 09:30 EDT
    expect(await calendar.isOpen(utc(2027, 7, 14, 20, 30))).to.equal(false); // 16:30 EDT
    // 2027 DST starts Sun 14 Mar 07:00 UTC, ends Sun 7 Nov 06:00 UTC
    expect(await calendar.nyOffset(utc(2027, 3, 14, 6, 59))).to.equal(-5 * 3600);
    expect(await calendar.nyOffset(utc(2027, 3, 14, 7, 0))).to.equal(-4 * 3600);
    expect(await calendar.nyOffset(utc(2027, 11, 7, 5, 59))).to.equal(-4 * 3600);
    expect(await calendar.nyOffset(utc(2027, 11, 7, 6, 0))).to.equal(-5 * 3600);
  });

  it("honours holidays and early closes", async () => {
    const { calendar } = await loadFixture(deploy);
    const xmasEve = utc(2027, 12, 24, 15); // Friday 24 Dec 2027, 10:00 EST
    const day = await calendar.nyDay(xmasEve);
    await calendar.setHolidays([day], true);
    expect(await calendar.isOpen(xmasEve)).to.equal(false);
    await calendar.setHolidays([day], false);
    await calendar.setEarlyClose(day, 13 * 3600);
    expect(await calendar.isOpen(utc(2027, 12, 24, 17, 59))).to.equal(true); // 12:59 EST
    expect(await calendar.isOpen(utc(2027, 12, 24, 18, 0))).to.equal(false); // 13:00 EST
  });
});

describe("StockOracle", () => {
  it("is Fresh in session, MarketClosed at the weekend, Stale past the hard cap", async () => {
    const f = await loadFixture(deploy);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.Fresh);
    await time.increaseTo(SAT);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.MarketClosed);
    await time.increaseTo(T0 + 98 * 3600);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.Stale);
  });

  it("treats a pre-open answer as closed right after the open", async () => {
    const f = await loadFixture(deploy);
    await time.increaseTo(utc(2027, 1, 15, 20, 59)); // Friday 15:59 EST
    await refresh(f);
    await time.increaseTo(MON_OPEN + 60);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.MarketClosed);
    await refresh(f);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.Fresh);
  });

  it("flags invalid answers and pauses", async () => {
    const f = await loadFixture(deploy);
    await f.nvdaFeed.push(0, await time.latest());
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.Invalid);
    await refresh(f);
    await f.nvdaOracle.setPaused(true);
    expect((await f.nvdaOracle.latest())[1]).to.equal(Status.Paused);
  });
});

describe("EarnVault + LendingMarket", () => {
  it("supplies deposits to the market and grows share value with interest", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(100_000), f.alice.address);
    expect(await f.market.cash()).to.equal(U(100_000));

    await f.market.connect(f.bob).depositCollateral(E(10), f.bob.address); // $1,800
    await f.market.connect(f.bob).borrow(U(1_000), f.bob.address);

    await time.increase(30 * 24 * 3600);
    const assets = await f.vault.totalAssets();
    expect(assets).to.be.gt(U(100_000));
    const shares = await f.vault.balanceOf(f.alice.address);
    expect(await f.vault.convertToAssets(shares)).to.be.gt(U(100_000) - 2n);
  });

  it("charges the borrow fee and enforces LTV", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(100_000), f.alice.address);
    await f.market.connect(f.bob).depositCollateral(E(10), f.bob.address); // $1,800 → max $1,080
    const before = await f.usdg.balanceOf(f.bob.address);
    await f.market.connect(f.bob).borrow(U(1_000), f.bob.address);
    expect((await f.usdg.balanceOf(f.bob.address)) - before).to.equal(U(999));
    expect(await f.usdg.balanceOf(f.treasury.address)).to.equal(U(1));
    expect(await f.market.debtOf(f.bob.address)).to.be.closeTo(U(1_000), 2n);
    await expect(f.market.connect(f.bob).borrow(U(100), f.bob.address)).to.be.revertedWith("exceeds LTV");
  });

  it("pauses risk-increasing actions while the market is closed, keeps exits open", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(50_000), f.alice.address);
    await f.market.connect(f.bob).depositCollateral(E(10), f.bob.address);
    await f.market.connect(f.bob).borrow(U(500), f.bob.address);

    await time.increaseTo(SAT);
    await expect(f.market.connect(f.bob).borrow(U(10), f.bob.address)).to.be.revertedWith("collateral price not fresh");
    await expect(f.market.connect(f.bob).withdrawCollateral(E(1), f.bob.address)).to.be.revertedWith(
      "collateral price not fresh"
    );
    await f.market.connect(f.bob).depositCollateral(E(1), f.bob.address); // adding collateral: fine
    await f.market.connect(f.bob).repay(ethers.MaxUint256, f.bob.address); // repay all: fine
    expect(await f.market.debtOf(f.bob.address)).to.equal(0);
    await f.market.connect(f.bob).withdrawCollateral(E(11), f.bob.address); // no debt → always open
    await f.vault.connect(f.alice).withdraw(U(10_000), f.alice.address, f.alice.address); // lenders can exit
  });

  it("liquidates an unhealthy position with a bonus", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(50_000), f.alice.address);
    await f.market.connect(f.bob).depositCollateral(E(10), f.bob.address); // $1,800
    await f.market.connect(f.bob).borrow(U(1_000), f.bob.address);
    await expect(f.market.connect(f.carol).liquidate(f.bob.address, U(500))).to.be.revertedWith("healthy");

    await refresh(f, 140); // $1,400 × 0.65 = $910 < $1,000 debt
    const nvdaBefore = await f.nvda.balanceOf(f.carol.address);
    await f.market.connect(f.carol).liquidate(f.bob.address, U(500));
    const seized = (await f.nvda.balanceOf(f.carol.address)) - nvdaBefore;
    // $500 × 1.05 / $140 = 3.75 NVDA
    expect(seized).to.be.closeTo(E(3.75), E(0.0001));
    expect(await f.market.debtOf(f.bob.address)).to.be.closeTo(U(500), U(0.01)); // + a few seconds of interest
  });

  it("writes off bad debt against the vault when collateral runs out", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(50_000), f.alice.address);
    await f.market.connect(f.bob).depositCollateral(E(1), f.bob.address); // $180
    await f.market.connect(f.bob).borrow(U(100), f.bob.address);
    await refresh(f, 50); // collateral now $50 for $100 of debt
    const assetsBefore = await f.vault.totalAssets();
    await expect(f.market.connect(f.carol).liquidate(f.bob.address, U(100))).to.emit(f.market, "BadDebt");
    const pos = await f.market.positionOf(f.bob.address);
    expect(pos.collateral).to.equal(0);
    expect(pos.debt).to.equal(0);
    expect(await f.vault.totalAssets()).to.be.lt(assetsBefore);
  });

  it("caps vault withdrawals at available liquidity", async () => {
    const f = await loadFixture(deploy);
    await f.vault.connect(f.alice).deposit(U(1_000), f.alice.address);
    await f.market.connect(f.bob).depositCollateral(E(10), f.bob.address);
    await f.market.connect(f.bob).borrow(U(900), f.bob.address);
    expect(await f.vault.maxWithdraw(f.alice.address)).to.be.closeTo(U(100), 2n);
    await expect(f.vault.connect(f.alice).withdraw(U(500), f.alice.address, f.alice.address)).to.be.reverted;
  });

  it("lets only the vault supply and only the owner unpause", async () => {
    const f = await loadFixture(deploy);
    await expect(f.market.connect(f.alice).supplyLiquidity(U(1))).to.be.revertedWith("only vault");
    await f.market.pause();
    await expect(f.market.connect(f.alice).unpause()).to.be.reverted;
  });
});
