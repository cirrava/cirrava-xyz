// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title MarketCalendar
/// @notice US equity regular session (NYSE/Nasdaq): 09:30–16:00 New York time, Monday–Friday.
///         New York daylight-saving time is computed on-chain (2nd Sunday of March to 1st Sunday of
///         November), so the only things the owner maintains are exchange holidays and early closes.
contract MarketCalendar is Ownable2Step {
    uint32 public constant OPEN_SEC = 9 hours + 30 minutes;
    uint32 public constant CLOSE_SEC = 16 hours;

    /// @dev key: New York local day number (days since 1970-01-01 in NY local time)
    mapping(uint256 => bool) public isHoliday;
    /// @dev key: NY local day number → close time in seconds after local midnight (e.g. 13:00 = 46800)
    mapping(uint256 => uint32) public earlyClose;

    event HolidaySet(uint256 indexed nyDay, bool closed);
    event EarlyCloseSet(uint256 indexed nyDay, uint32 closeSec);

    constructor(address owner_) Ownable(owner_) {}

    // ---------------------------------------------------------------- admin

    function setHolidays(uint256[] calldata nyDays, bool closed) external onlyOwner {
        for (uint256 i; i < nyDays.length; ++i) {
            isHoliday[nyDays[i]] = closed;
            emit HolidaySet(nyDays[i], closed);
        }
    }

    function setEarlyClose(uint256 day, uint32 closeSec) external onlyOwner {
        require(closeSec == 0 || (closeSec > OPEN_SEC && closeSec < CLOSE_SEC), "bad close");
        earlyClose[day] = closeSec;
        emit EarlyCloseSet(day, closeSec);
    }

    // ---------------------------------------------------------------- views

    /// @notice New York UTC offset in seconds at `ts` (-4h during DST, -5h otherwise).
    function nyOffset(uint256 ts) public pure returns (int256) {
        uint256 y = _yearOf(ts / 1 days);
        uint256 mar1 = _daysFromCivil(y, 3, 1);
        uint256 dstStartDay = mar1 + ((7 - _dow(mar1)) % 7) + 7; // second Sunday of March
        uint256 nov1 = _daysFromCivil(y, 11, 1);
        uint256 dstEndDay = nov1 + ((7 - _dow(nov1)) % 7); // first Sunday of November
        uint256 start = dstStartDay * 1 days + 7 hours; // 02:00 EST
        uint256 end = dstEndDay * 1 days + 6 hours; // 02:00 EDT
        return (ts >= start && ts < end) ? -4 hours : -5 hours;
    }

    /// @notice NY local day number for a UTC timestamp.
    function nyDay(uint256 ts) public pure returns (uint256) {
        return uint256(int256(ts) + nyOffset(ts)) / 1 days;
    }

    /// @notice UTC timestamps of the regular session on the NY day containing `ts`
    ///         (open == close == 0 when the exchange is shut that day).
    function sessionOf(uint256 ts) public view returns (uint256 open, uint256 close) {
        int256 off = nyOffset(ts);
        uint256 local = uint256(int256(ts) + off);
        uint256 day = local / 1 days;
        uint256 dow = _dow(day);
        if (dow == 0 || dow == 6 || isHoliday[day]) return (0, 0);
        uint32 closeSec = earlyClose[day] == 0 ? CLOSE_SEC : earlyClose[day];
        uint256 midnightUtc = uint256(int256(day * 1 days) - off);
        return (midnightUtc + OPEN_SEC, midnightUtc + closeSec);
    }

    function isOpen(uint256 ts) public view returns (bool) {
        (uint256 open, uint256 close) = sessionOf(ts);
        return open != 0 && ts >= open && ts < close;
    }

    function isOpenNow() external view returns (bool) {
        return isOpen(block.timestamp);
    }

    // ---------------------------------------------------------------- date math (H. Hinnant's algorithms)

    /// @dev 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday.
    function _dow(uint256 day) internal pure returns (uint256) {
        return (day + 4) % 7;
    }

    function _daysFromCivil(uint256 y, uint256 m, uint256 d) internal pure returns (uint256) {
        if (m <= 2) y -= 1;
        uint256 era = y / 400;
        uint256 yoe = y - era * 400;
        uint256 doy = (153 * (m > 2 ? m - 3 : m + 9) + 2) / 5 + d - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    function _yearOf(uint256 day) internal pure returns (uint256) {
        uint256 z = day + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        return m <= 2 ? y + 1 : y;
    }
}
