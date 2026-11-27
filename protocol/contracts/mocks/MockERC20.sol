// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST TOKEN ONLY. Anyone can mint via the faucet. Never deploy to mainnet.
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    uint256 public immutable faucetAmount;
    mapping(address => uint256) public lastFaucet;

    constructor(string memory name_, string memory symbol_, uint8 dec_, uint256 faucetAmount_) ERC20(name_, symbol_) {
        _dec = dec_;
        faucetAmount = faucetAmount_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    /// @notice one faucet drip per address per hour
    function faucet() external {
        require(block.timestamp >= lastFaucet[msg.sender] + 1 hours, "faucet: wait 1h");
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }

    /// @notice used by tests and the deploy script
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Robinhood Stock Token status flags (see IStockTokenStatus), settable in tests
    bool public oraclePaused;
    bool public paused;

    function setOraclePaused(bool p) external {
        oraclePaused = p;
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!paused, "token paused");
        super._update(from, to, value);
    }
}
