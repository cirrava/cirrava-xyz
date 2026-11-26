// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title InterestRateModel
/// @notice Kinked utilization curve. Rates are annual, WAD-scaled (1e18 = 100%).
contract InterestRateModel {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant YEAR = 365 days;
    uint256 public constant MAX_RATE = 10 * WAD; // 1,000% APR hard ceiling

    uint256 public immutable baseRate;
    uint256 public immutable slope1;
    uint256 public immutable slope2;
    uint256 public immutable kink;

    constructor(uint256 base_, uint256 slope1_, uint256 slope2_, uint256 kink_) {
        require(kink_ > 0 && kink_ < WAD, "kink");
        require(slope1_ > 0 || base_ > 0, "zero curve");
        require(base_ + slope1_ + slope2_ <= MAX_RATE, "too steep");
        baseRate = base_;
        slope1 = slope1_;
        slope2 = slope2_;
        kink = kink_;
    }

    function utilization(uint256 cash, uint256 borrows) public pure returns (uint256) {
        if (borrows == 0) return 0;
        return borrows * WAD / (cash + borrows);
    }

    /// @notice annual borrow rate (WAD)
    function borrowRate(uint256 cash, uint256 borrows) public view returns (uint256) {
        uint256 u = utilization(cash, borrows);
        if (u <= kink) return baseRate + slope1 * u / kink;
        return baseRate + slope1 + slope2 * (u - kink) / (WAD - kink);
    }

    function borrowRatePerSecond(uint256 cash, uint256 borrows) external view returns (uint256) {
        return borrowRate(cash, borrows) / YEAR;
    }
}
