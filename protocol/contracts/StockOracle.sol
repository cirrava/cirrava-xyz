// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {MarketCalendar} from "./MarketCalendar.sol";

/// @notice What the protocol may do with a price.
/// Fresh        – usable for borrowing, liquidation and withdrawing collateral against debt.
/// MarketClosed – the exchange is shut (or the answer predates the current session); last price stands,
///                risk-increasing actions pause.
/// Stale        – too old even for a closed market, or not updated in session.
/// Invalid      – zero/negative answer or a timestamp in the future.
/// Paused       – the adapter was paused by its owner.
enum PriceStatus {
    Fresh,
    MarketClosed,
    Stale,
    Invalid,
    Paused
}

/// @title StockOracle
/// @notice Wraps a Chainlink feed and classifies its answer against US market hours.
///         Pass `calendar = address(0)` for assets that trade 24/7 (e.g. USDG, WETH).
contract StockOracle is Ownable2Step {
    AggregatorV3Interface public immutable feed;
    MarketCalendar public immutable calendar;
    uint8 public immutable feedDecimals;

    /// @notice max age of an answer while the market is in session (or always, for 24/7 assets)
    uint256 public maxAgeInSession;
    /// @notice hard cap on age while the market is closed (covers long weekends)
    uint256 public maxAgeHard;
    bool public paused;

    event WindowsSet(uint256 maxAgeInSession, uint256 maxAgeHard);
    event PausedSet(bool paused);

    constructor(address owner_, AggregatorV3Interface feed_, MarketCalendar calendar_, uint256 inSession, uint256 hard)
        Ownable(owner_)
    {
        feed = feed_;
        calendar = calendar_;
        feedDecimals = feed_.decimals();
        require(feedDecimals <= 18, "decimals");
        _setWindows(inSession, hard);
    }

    function setWindows(uint256 inSession, uint256 hard) external onlyOwner {
        _setWindows(inSession, hard);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function _setWindows(uint256 inSession, uint256 hard) internal {
        require(inSession > 0 && hard >= inSession, "windows");
        maxAgeInSession = inSession;
        maxAgeHard = hard;
        emit WindowsSet(inSession, hard);
    }

    /// @return priceWad USD price scaled to 1e18
    /// @return status   how the protocol may use it
    /// @return updatedAt timestamp of the underlying answer
    function latest() public view returns (uint256 priceWad, PriceStatus status, uint256 updatedAt) {
        (, int256 answer,, uint256 upd,) = feed.latestRoundData();
        updatedAt = upd;
        if (answer > 0) priceWad = uint256(answer) * 10 ** (18 - feedDecimals);
        if (paused) return (priceWad, PriceStatus.Paused, upd);
        if (answer <= 0 || upd == 0 || upd > block.timestamp) return (priceWad, PriceStatus.Invalid, upd);

        uint256 age = block.timestamp - upd;
        if (address(calendar) == address(0)) {
            return (priceWad, age <= maxAgeInSession ? PriceStatus.Fresh : PriceStatus.Stale, upd);
        }
        if (!calendar.isOpen(block.timestamp)) {
            return (priceWad, age <= maxAgeHard ? PriceStatus.MarketClosed : PriceStatus.Stale, upd);
        }
        // In session. An answer published before today's open has not seen a single trade yet:
        // keep treating it as closed for up to one in-session window, then it is simply stale.
        (uint256 open,) = calendar.sessionOf(block.timestamp);
        if (upd < open) {
            return (priceWad, block.timestamp - open <= maxAgeInSession ? PriceStatus.MarketClosed : PriceStatus.Stale, upd);
        }
        return (priceWad, age <= maxAgeInSession ? PriceStatus.Fresh : PriceStatus.Stale, upd);
    }
}
