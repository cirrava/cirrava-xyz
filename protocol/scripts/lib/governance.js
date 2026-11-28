// Shared plan for moving Cirrava's admin from one wallet (EOA) to a Safe multisig behind a timelock.
//
//  1. EOA deploys CirravaTimelock(minDelay = 0, proposers = [Safe], executors = [anyone], admin = none).
//  2. EOA, while it still owns everything: market pauser -> Safe, market treasury -> Safe,
//     then transferOwnership(timelock) on every owned contract (Ownable2Step: pending until accepted).
//  3. Safe, in ONE transaction: timelock.scheduleBatch(...) + timelock.executeBatch(...) of
//     acceptOwnership() on every contract + timelock.updateDelay(48h). With minDelay 0 both run in the same
//     block, and from then on every owner action waits 48 hours.
const { ethers } = require("ethers");

const OWNABLE = new ethers.Interface([
  "function acceptOwnership()",
  "function transferOwnership(address)",
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
]);
const TIMELOCK = new ethers.Interface([
  "function scheduleBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt,uint256 delay)",
  "function executeBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt)",
  "function updateDelay(uint256 newDelay)",
]);
const DELAY = 48 * 3600;
const SALT = ethers.id("cirrava: accept ownership + 48h delay");

/** every contract the admin wallet owns, v2 and the retired v1 */
function ownedContracts(dep, v1) {
  const list = [
    { label: "MarketCalendar", address: dep.calendar },
    { label: "EarnVault v2", address: dep.vault },
    { label: "StockOracle USDG v2", address: dep.usdg.oracle },
    ...dep.markets.flatMap((m) => {
      const k = m.symbol + (m.hours ? ` ${m.hours}` : "");
      return [
        { label: `StockOracle ${k} v2`, address: m.oracle },
        { label: `LendingMarket ${k} v2`, address: m.market, market: true },
      ];
    }),
  ];
  if (v1) {
    list.push({ label: "EarnVault v1", address: v1.vault }, { label: "StockOracle USDG v1", address: v1.usdg.oracle });
    for (const m of v1.markets) {
      list.push({ label: `StockOracle ${m.symbol} v1`, address: m.oracle }, { label: `LendingMarket ${m.symbol} v1`, address: m.market });
    }
  }
  // the calendar is shared by v1 and v2: keep each address once
  const seen = new Set();
  return list.filter((c) => !seen.has(c.address.toLowerCase()) && seen.add(c.address.toLowerCase()));
}

/** the batch the Safe schedules and executes on the timelock */
function acceptBatch(contracts, timelock, delay = DELAY) {
  const targets = [...contracts.map((c) => c.address), timelock];
  const values = targets.map(() => 0n);
  const payloads = [...contracts.map(() => OWNABLE.encodeFunctionData("acceptOwnership")), TIMELOCK.encodeFunctionData("updateDelay", [delay])];
  return { targets, values, payloads, predecessor: ethers.ZeroHash, salt: SALT };
}

/** the two calls the Safe makes (to the timelock), in order */
function safeCalls(batch) {
  const args = [batch.targets, batch.values, batch.payloads, batch.predecessor, batch.salt];
  return [
    { method: "scheduleBatch", data: TIMELOCK.encodeFunctionData("scheduleBatch", [...args, 0]) },
    { method: "executeBatch", data: TIMELOCK.encodeFunctionData("executeBatch", args) },
  ];
}

module.exports = { OWNABLE, TIMELOCK, DELAY, SALT, ownedContracts, acceptBatch, safeCalls };
