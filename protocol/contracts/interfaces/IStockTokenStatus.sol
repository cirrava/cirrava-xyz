// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Status flags a Robinhood Stock Token exposes.
/// `oraclePaused` is true while Robinhood processes a corporate action (split, reverse split, dividend
/// reinvested through the multiplier); integrators must treat the price as unavailable during that window.
/// `paused` is true while the token itself is paused (transfers fail).
interface IStockTokenStatus {
    function oraclePaused() external view returns (bool);
    function paused() external view returns (bool);
}
