// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {StockOracle, PriceStatus} from "./StockOracle.sol";
import {InterestRateModel} from "./InterestRateModel.sol";

/// @title LendingMarket
/// @notice One isolated market: one collateral (a Stock Token), one borrow asset (USDG).
///         Its only lender is the Earn vault. Borrowers post collateral and borrow against it.
///         Risk-increasing actions (borrow, liquidate, withdraw collateral with debt) need Fresh prices;
///         risk-reducing actions (repay, add collateral, withdraw with no debt) work in every price status.
contract LendingMarket is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 public constant CLOSE_FACTOR = 0.5e18;
    /// @notice positions whose debt is worth less than this can be liquidated in full
    uint256 public constant DUST_VALUE = 100e18;

    struct Config {
        address owner;
        address vault;
        address treasury;
        IERC20Metadata collateralToken;
        IERC20Metadata borrowToken;
        StockOracle collateralOracle;
        StockOracle borrowOracle;
        InterestRateModel irm;
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 reserveFactor;
        uint256 borrowFee;
    }

    struct Position {
        uint256 collateral;
        uint256 scaledDebt;
    }

    struct MarketInfo {
        address collateralToken;
        address borrowToken;
        uint256 cash;
        uint256 totalBorrows;
        uint256 supplyAssets;
        uint256 reserves;
        uint256 utilization;
        uint256 borrowAPR;
        uint256 supplyAPR;
        uint256 collateralPrice;
        PriceStatus collateralStatus;
        uint256 collateralUpdatedAt;
        uint256 borrowPrice;
        PriceStatus borrowStatus;
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 borrowFee;
        bool paused;
    }

    IERC20 public immutable collateralToken;
    IERC20 public immutable borrowToken;
    uint8 public immutable collateralDecimals;
    uint8 public immutable borrowDecimals;
    StockOracle public immutable collateralOracle;
    StockOracle public immutable borrowOracle;
    address public immutable vault;

    InterestRateModel public irm;
    address public treasury;
    address public pauser;

    uint256 public ltv;
    uint256 public liquidationThreshold;
    uint256 public liquidationBonus;
    uint256 public reserveFactor;
    uint256 public borrowFee;

    uint256 public cash;
    uint256 public totalScaledDebt;
    uint256 public borrowIndex = WAD;
    uint256 public reserves;
    uint256 public lastAccrual;

    mapping(address => Position) public positions;

    event Accrued(uint256 borrowIndex, uint256 totalBorrows, uint256 reserves);
    event LiquiditySupplied(uint256 amount);
    event LiquidityWithdrawn(uint256 amount);
    event CollateralDeposited(address indexed from, address indexed onBehalf, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
    event Borrowed(address indexed user, address indexed receiver, uint256 amount, uint256 fee);
    event Repaid(address indexed payer, address indexed onBehalf, uint256 amount);
    event Liquidated(address indexed liquidator, address indexed user, uint256 repaid, uint256 seized);
    event BadDebt(address indexed user, uint256 amount);
    event RiskParamsSet(uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus);
    event FeesSet(uint256 reserveFactor, uint256 borrowFee);

    modifier onlyVault() {
        require(msg.sender == vault, "only vault");
        _;
    }

    constructor(Config memory c) Ownable(c.owner) {
        require(c.vault != address(0) && c.treasury != address(0), "zero addr");
        collateralToken = IERC20(address(c.collateralToken));
        borrowToken = IERC20(address(c.borrowToken));
        collateralDecimals = c.collateralToken.decimals();
        borrowDecimals = c.borrowToken.decimals();
        collateralOracle = c.collateralOracle;
        borrowOracle = c.borrowOracle;
        vault = c.vault;
        treasury = c.treasury;
        pauser = c.owner;
        irm = c.irm;
        lastAccrual = block.timestamp;
        _setRiskParams(c.ltv, c.liquidationThreshold, c.liquidationBonus);
        _setFees(c.reserveFactor, c.borrowFee);
    }

    // ================================================================ interest

    function accrue() public {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0) return;
        lastAccrual = block.timestamp;
        if (totalScaledDebt == 0) return;
        (uint256 newIndex, uint256 newReserves) = _preview(dt);
        borrowIndex = newIndex;
        reserves = newReserves;
        emit Accrued(newIndex, _debt(totalScaledDebt, newIndex), newReserves);
    }

    function _preview(uint256 dt) internal view returns (uint256 index, uint256 res) {
        index = borrowIndex;
        res = reserves;
        if (dt == 0 || totalScaledDebt == 0) return (index, res);
        uint256 before = _debt(totalScaledDebt, index);
        uint256 rate = irm.borrowRatePerSecond(cash, before);
        index = index + Math.mulDiv(index, rate * dt, WAD);
        uint256 afterB = _debt(totalScaledDebt, index);
        res += (afterB - before) * reserveFactor / WAD;
    }

    function _currentIndex() internal view returns (uint256 index, uint256 res) {
        return _preview(block.timestamp - lastAccrual);
    }

    function _debt(uint256 scaled, uint256 index) internal pure returns (uint256) {
        return Math.mulDiv(scaled, index, WAD, Math.Rounding.Ceil);
    }

    // ================================================================ lender (vault only)

    function supplyLiquidity(uint256 amount) external nonReentrant onlyVault {
        accrue();
        cash += amount;
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquiditySupplied(amount);
    }

    function withdrawLiquidity(uint256 amount) external nonReentrant onlyVault {
        accrue();
        require(amount <= cash, "insufficient liquidity");
        require(amount <= supplyAssets(), "exceeds supply");
        cash -= amount;
        borrowToken.safeTransfer(msg.sender, amount);
        emit LiquidityWithdrawn(amount);
    }

    // ================================================================ borrower

    function depositCollateral(uint256 amount, address onBehalf) external nonReentrant {
        require(amount > 0, "zero");
        positions[onBehalf].collateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, onBehalf, amount);
    }

    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        accrue();
        Position storage p = positions[msg.sender];
        require(amount > 0 && amount <= p.collateral, "amount");
        p.collateral -= amount;
        if (p.scaledDebt > 0) {
            _requireNotPaused();
            (uint256 cp, uint256 bp) = _freshPrices();
            require(_debtValue(p, bp) <= _collateralValue(p, cp) * ltv / WAD, "exceeds LTV");
        }
        collateralToken.safeTransfer(to, amount);
        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    function borrow(uint256 amount, address receiver) external nonReentrant whenNotPaused {
        require(amount > 0, "zero");
        accrue();
        require(amount <= cash, "insufficient liquidity");
        Position storage p = positions[msg.sender];
        uint256 scaled = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil);
        p.scaledDebt += scaled;
        totalScaledDebt += scaled;
        (uint256 cp, uint256 bp) = _freshPrices();
        require(_debtValue(p, bp) <= _collateralValue(p, cp) * ltv / WAD, "exceeds LTV");
        cash -= amount;
        uint256 fee = amount * borrowFee / WAD;
        if (fee > 0) borrowToken.safeTransfer(treasury, fee);
        borrowToken.safeTransfer(receiver, amount - fee);
        emit Borrowed(msg.sender, receiver, amount, fee);
    }

    /// @notice Repay in USDG. Any amount >= the debt repays it exactly (use type(uint256).max for "all").
    function repay(uint256 amount, address onBehalf) external nonReentrant returns (uint256 paid) {
        accrue();
        Position storage p = positions[onBehalf];
        uint256 debt = _debt(p.scaledDebt, borrowIndex);
        require(debt > 0, "no debt");
        uint256 scaled;
        if (amount >= debt) {
            paid = debt;
            scaled = p.scaledDebt;
        } else {
            paid = amount;
            scaled = Math.mulDiv(amount, WAD, borrowIndex);
        }
        p.scaledDebt -= scaled;
        totalScaledDebt -= scaled;
        cash += paid;
        borrowToken.safeTransferFrom(msg.sender, address(this), paid);
        emit Repaid(msg.sender, onBehalf, paid);
    }

    // ================================================================ liquidation

    function liquidate(address user, uint256 repayAmount) external nonReentrant whenNotPaused returns (uint256 seized) {
        accrue();
        Position storage p = positions[user];
        uint256 debt = _debt(p.scaledDebt, borrowIndex);
        require(debt > 0, "no debt");
        (uint256 cp, uint256 bp) = _freshPrices();
        uint256 dv = _value(debt, borrowDecimals, bp);
        uint256 cv = _value(p.collateral, collateralDecimals, cp);
        require(dv * WAD > cv * liquidationThreshold, "healthy");

        uint256 maxRepay = dv < DUST_VALUE ? debt : debt * CLOSE_FACTOR / WAD;
        uint256 repaid = Math.min(repayAmount, maxRepay);
        require(repaid > 0, "zero");

        uint256 seizeValue = _value(repaid, borrowDecimals, bp) * (WAD + liquidationBonus) / WAD;
        seized = Math.mulDiv(seizeValue, 10 ** collateralDecimals, cp);
        if (seized > p.collateral) {
            // not enough collateral for the full bonus: take all of it and repay only what it covers
            seized = p.collateral;
            uint256 coverValue = cv * WAD / (WAD + liquidationBonus);
            repaid = Math.min(repaid, Math.mulDiv(coverValue, 10 ** borrowDecimals, bp));
        }

        uint256 scaled = repaid >= debt ? p.scaledDebt : Math.mulDiv(repaid, WAD, borrowIndex);
        p.scaledDebt -= scaled;
        totalScaledDebt -= scaled;
        p.collateral -= seized;
        cash += repaid;

        // collateral exhausted but debt remains: write it off (the vault absorbs it)
        if (p.collateral == 0 && p.scaledDebt > 0) {
            uint256 bad = _debt(p.scaledDebt, borrowIndex);
            totalScaledDebt -= p.scaledDebt;
            p.scaledDebt = 0;
            emit BadDebt(user, bad);
        }

        borrowToken.safeTransferFrom(msg.sender, address(this), repaid);
        collateralToken.safeTransfer(msg.sender, seized);
        emit Liquidated(msg.sender, user, repaid, seized);
    }

    // ================================================================ views

    function totalBorrows() public view returns (uint256) {
        (uint256 index,) = _currentIndex();
        return _debt(totalScaledDebt, index);
    }

    /// @notice what the vault is owed: cash + borrows − protocol reserves
    function supplyAssets() public view returns (uint256) {
        (uint256 index, uint256 res) = _currentIndex();
        uint256 gross = cash + _debt(totalScaledDebt, index);
        return gross > res ? gross - res : 0;
    }

    function debtOf(address user) public view returns (uint256) {
        (uint256 index,) = _currentIndex();
        return _debt(positions[user].scaledDebt, index);
    }

    function positionOf(address user)
        external
        view
        returns (
            uint256 collateral,
            uint256 debt,
            uint256 collateralValue,
            uint256 debtValue,
            uint256 healthFactor,
            uint256 maxBorrow
        )
    {
        collateral = positions[user].collateral;
        debt = debtOf(user);
        (uint256 cp,,) = collateralOracle.latest();
        (uint256 bp,,) = borrowOracle.latest();
        collateralValue = _value(collateral, collateralDecimals, cp);
        debtValue = _value(debt, borrowDecimals, bp);
        healthFactor = debtValue == 0 ? type(uint256).max : collateralValue * liquidationThreshold / debtValue;
        uint256 limit = collateralValue * ltv / WAD;
        if (limit > debtValue && bp > 0) maxBorrow = Math.mulDiv(limit - debtValue, 10 ** borrowDecimals, bp);
    }

    function marketInfo() external view returns (MarketInfo memory m) {
        m.collateralToken = address(collateralToken);
        m.borrowToken = address(borrowToken);
        m.cash = cash;
        m.totalBorrows = totalBorrows();
        m.supplyAssets = supplyAssets();
        (, m.reserves) = _currentIndex();
        m.utilization = irm.utilization(cash, m.totalBorrows);
        m.borrowAPR = irm.borrowRate(cash, m.totalBorrows);
        m.supplyAPR = m.borrowAPR * m.utilization / WAD * (WAD - reserveFactor) / WAD;
        (m.collateralPrice, m.collateralStatus, m.collateralUpdatedAt) = collateralOracle.latest();
        (m.borrowPrice, m.borrowStatus,) = borrowOracle.latest();
        m.ltv = ltv;
        m.liquidationThreshold = liquidationThreshold;
        m.liquidationBonus = liquidationBonus;
        m.borrowFee = borrowFee;
        m.paused = paused();
    }

    // ================================================================ admin

    function setRiskParams(uint256 ltv_, uint256 lt_, uint256 bonus_) external onlyOwner {
        _setRiskParams(ltv_, lt_, bonus_);
    }

    function setFees(uint256 reserveFactor_, uint256 borrowFee_) external onlyOwner {
        accrue();
        _setFees(reserveFactor_, borrowFee_);
    }

    function setInterestRateModel(InterestRateModel irm_) external onlyOwner {
        accrue();
        irm = irm_;
    }

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "zero addr");
        treasury = t;
    }

    function setPauser(address p) external onlyOwner {
        pauser = p;
    }

    /// @notice the pauser can stop a market within one block; only the owner can resume it
    function pause() external {
        require(msg.sender == pauser || msg.sender == owner(), "not pauser");
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawReserves(uint256 amount) external onlyOwner nonReentrant {
        accrue();
        require(amount <= reserves && amount <= cash, "amount");
        reserves -= amount;
        cash -= amount;
        borrowToken.safeTransfer(treasury, amount);
    }

    // ================================================================ internals

    function _setRiskParams(uint256 ltv_, uint256 lt_, uint256 bonus_) internal {
        require(ltv_ > 0 && ltv_ < lt_ && lt_ <= 0.95e18, "ltv/lt");
        require(bonus_ <= 0.2e18, "bonus");
        require(lt_ * (WAD + bonus_) / WAD < WAD, "insolvent liquidations");
        ltv = ltv_;
        liquidationThreshold = lt_;
        liquidationBonus = bonus_;
        emit RiskParamsSet(ltv_, lt_, bonus_);
    }

    function _setFees(uint256 rf, uint256 fee) internal {
        require(rf <= 0.5e18 && fee <= 0.1e18, "fees");
        reserveFactor = rf;
        borrowFee = fee;
        emit FeesSet(rf, fee);
    }

    function _freshPrices() internal view returns (uint256 cp, uint256 bp) {
        PriceStatus cs;
        PriceStatus bs;
        (cp, cs,) = collateralOracle.latest();
        (bp, bs,) = borrowOracle.latest();
        require(cs == PriceStatus.Fresh, "collateral price not fresh");
        require(bs == PriceStatus.Fresh, "borrow price not fresh");
    }

    function _value(uint256 amount, uint8 decimals, uint256 priceWad) internal pure returns (uint256) {
        return Math.mulDiv(amount, priceWad, 10 ** decimals);
    }

    function _collateralValue(Position storage p, uint256 cp) internal view returns (uint256) {
        return _value(p.collateral, collateralDecimals, cp);
    }

    function _debtValue(Position storage p, uint256 bp) internal view returns (uint256) {
        return _value(_debt(p.scaledDebt, borrowIndex), borrowDecimals, bp);
    }
}
