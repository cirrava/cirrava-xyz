// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface ILendingMarket {
    function borrowToken() external view returns (IERC20);
    function cash() external view returns (uint256);
    function supplyAssets() external view returns (uint256);
    function supplyLiquidity(uint256 amount) external;
    function withdrawLiquidity(uint256 amount) external;
}

/// @title EarnVault
/// @notice Deposit USDG, receive cvUSDG shares. The vault is the single lender to every market;
///         share value grows with the interest borrowers pay. Withdrawals read no price, so they
///         work while the stock market is closed — bounded only by liquidity not lent out.
contract EarnVault is ERC4626, Ownable2Step {
    using SafeERC20 for IERC20;

    ILendingMarket[] public markets;
    mapping(address => bool) public isMarket;
    /// @notice max assets the vault will supply to a market (type(uint256).max = unlimited)
    mapping(address => uint256) public cap;

    event MarketAdded(address indexed market, uint256 cap);
    event CapSet(address indexed market, uint256 cap);
    event Reallocated(address indexed from, address indexed to, uint256 amount);

    constructor(IERC20 usdg, address owner_)
        ERC20("Cirrava Earn USDG", "cvUSDG")
        ERC4626(usdg)
        Ownable(owner_)
    {}

    /// @dev virtual shares/assets offset defends against the first-depositor inflation attack
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------- admin

    function addMarket(ILendingMarket m, uint256 cap_) external onlyOwner {
        require(!isMarket[address(m)], "exists");
        require(address(m.borrowToken()) == asset(), "asset mismatch");
        isMarket[address(m)] = true;
        cap[address(m)] = cap_;
        markets.push(m);
        IERC20(asset()).forceApprove(address(m), type(uint256).max);
        emit MarketAdded(address(m), cap_);
    }

    function setCap(ILendingMarket m, uint256 cap_) external onlyOwner {
        require(isMarket[address(m)], "unknown");
        cap[address(m)] = cap_;
        emit CapSet(address(m), cap_);
    }

    /// @notice move liquidity between markets (or to/from idle with address(0))
    function reallocate(ILendingMarket from, ILendingMarket to, uint256 amount) external onlyOwner {
        if (address(from) != address(0)) {
            require(isMarket[address(from)], "unknown from");
            from.withdrawLiquidity(amount);
        }
        if (address(to) != address(0)) {
            require(isMarket[address(to)], "unknown to");
            require(to.supplyAssets() + amount <= cap[address(to)], "cap");
            to.supplyLiquidity(amount);
        }
        emit Reallocated(address(from), address(to), amount);
    }

    // ---------------------------------------------------------------- views

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function idle() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function totalAssets() public view override returns (uint256 total) {
        total = idle();
        for (uint256 i; i < markets.length; ++i) total += markets[i].supplyAssets();
    }

    /// @notice USDG that can leave the vault right now (idle + un-lent cash in markets)
    function availableLiquidity() public view returns (uint256 avail) {
        avail = idle();
        for (uint256 i; i < markets.length; ++i) {
            ILendingMarket m = markets[i];
            avail += Math.min(m.cash(), m.supplyAssets());
        }
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner_), availableLiquidity());
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner_), convertToShares(availableLiquidity()));
    }

    // ---------------------------------------------------------------- hooks

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        _supplyIdle();
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 have = idle();
        for (uint256 i; i < markets.length && have < assets; ++i) {
            ILendingMarket m = markets[i];
            uint256 take = Math.min(assets - have, Math.min(m.cash(), m.supplyAssets()));
            if (take > 0) {
                m.withdrawLiquidity(take);
                have += take;
            }
        }
        require(have >= assets, "liquidity: markets fully borrowed");
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    /// @dev fill markets in order up to their caps
    function _supplyIdle() internal {
        uint256 left = idle();
        for (uint256 i; i < markets.length && left > 0; ++i) {
            ILendingMarket m = markets[i];
            uint256 c = cap[address(m)];
            uint256 used = m.supplyAssets();
            if (used >= c) continue;
            uint256 amt = Math.min(left, c - used);
            m.supplyLiquidity(amt);
            left -= amt;
        }
    }
}
