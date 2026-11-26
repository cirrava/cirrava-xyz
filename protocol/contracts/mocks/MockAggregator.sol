// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice TEST FEED ONLY. Stands in for a Chainlink feed on local/test networks.
///         The keeper script pushes real market prices (and their real trade timestamps) into it.
contract MockAggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    string public override description;
    address public keeper;

    uint80 public roundId;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 decimals_, string memory description_, address keeper_) {
        decimals = decimals_;
        description = description_;
        keeper = keeper_;
    }

    function setKeeper(address k) external {
        require(msg.sender == keeper, "only keeper");
        keeper = k;
    }

    function push(int256 answer_, uint256 updatedAt_) external {
        require(msg.sender == keeper, "only keeper");
        require(updatedAt_ <= block.timestamp, "future");
        roundId += 1;
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
