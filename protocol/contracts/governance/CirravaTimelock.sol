// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title CirravaTimelock
/// @notice OpenZeppelin's TimelockController, unchanged. It owns every Cirrava contract, so any owner action
///         (risk parameters, fees, caps, markets, reserves, unpausing) must be scheduled on-chain and wait
///         `getMinDelay()` before it can run. The Cirrava Safe is the only proposer (and canceller);
///         execution after the delay is open to anyone; there is no admin, so roles can only change through the
///         timelock itself. Emergency pausing of markets does not go through here: the Safe is each market's
///         pauser directly.
contract CirravaTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
