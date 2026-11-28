// Moves Cirrava's admin from the deployer wallet (EOA) to the Cirrava Safe behind a 48h timelock.
// Run by the CURRENT owner. Steps 1-2 here; step 3 is one Safe transaction (file written at the end).
//
//   Check only (no key):  SAFE=0x… npx hardhat run scripts/handover.js --network robinhood
//   Real:                 SAFE=0x… bash scripts/run-handover.sh go
//
//  1. deploy CirravaTimelock(minDelay 0, proposers [Safe], executors [anyone], admin none)   (skipped if
//     deployments/governance.json already has one for this Safe)
//  2. v2 markets: pauser -> Safe, treasury -> Safe; then transferOwnership(timelock) on every owned contract
//     (v2 and retired v1). Ownable2Step: ownership stays with the EOA until the timelock accepts.
//  3. writes deployments/safe-handover-batch.json for the Safe Transaction Builder: scheduleBatch + executeBatch
//     of acceptOwnership() on every contract + updateDelay(48h).
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const G = require("./lib/governance");

const DIR = path.join(__dirname, "..", "deployments");
const SAFE_ABI = ["function getOwners() view returns (address[])", "function getThreshold() view returns (uint256)", "function VERSION() view returns (string)"];
const MARKET_ABI = ["function pauser() view returns (address)", "function treasury() view returns (address)", "function setPauser(address)", "function setTreasury(address)"];

async function main() {
  if (network.name !== "robinhood") throw new Error("Run with --network robinhood");
  const safe = process.env.SAFE;
  if (!safe || !ethers.isAddress(safe)) throw new Error("Set SAFE=0x… (the Cirrava Safe address)");
  const dep = JSON.parse(fs.readFileSync(path.join(DIR, "robinhood.json"), "utf8"));
  const v1File = path.join(DIR, "robinhood-v1.json");
  const v1 = fs.existsSync(v1File) ? JSON.parse(fs.readFileSync(v1File, "utf8")) : null;
  const p = ethers.provider;
  const eoa = dep.deployer;
  const [signer] = await ethers.getSigners();
  const confirm = process.env.CONFIRM_MAINNET === "yes";
  if (confirm && !signer) throw new Error("No signer. Run: bash scripts/run-handover.sh go");
  if (signer && signer.address.toLowerCase() !== eoa.toLowerCase()) throw new Error(`Signer ${signer.address} is not the admin wallet ${eoa}. Nothing was sent.`);

  // ---- the Safe must be a real Safe on this chain, with more than one owner
  if ((await p.getCode(safe)) === "0x") throw new Error(`No contract at ${safe} on Robinhood Chain. Create the Safe first.`);
  const s = new ethers.Contract(safe, SAFE_ABI, p);
  const [owners, threshold, version] = await Promise.all([s.getOwners(), s.getThreshold(), s.VERSION()]);
  console.log(`Safe ${safe}  v${version}  threshold ${threshold} of ${owners.length}\n  owners: ${owners.join(", ")}`);
  if (owners.length < 2 || threshold < 2n) throw new Error("The Safe must have at least 2 owners and a threshold of at least 2.");
  if (owners.some((o) => o.toLowerCase() === eoa.toLowerCase())) console.log("  note: the old admin wallet is one of the Safe owners. That is allowed, but it cannot act alone.");

  const owned = G.ownedContracts(dep, v1);
  const own = new ethers.Contract(ethers.ZeroAddress, ["function owner() view returns (address)", "function pendingOwner() view returns (address)", "function transferOwnership(address)"], p);
  const rows = [];
  for (const c of owned) {
    const o = own.attach(c.address);
    rows.push({ ...c, owner: await o.owner(), pending: await o.pendingOwner() });
  }
  const notMine = rows.filter((r) => r.owner.toLowerCase() !== eoa.toLowerCase());
  console.log(`\n${owned.length} owned contracts (v2 + retired v1); ${notMine.length} not owned by the admin wallet`);
  for (const r of notMine) console.log(`  ! ${r.label} ${r.address} owner ${r.owner}`);

  // ---- existing timelock for this Safe (resume) or a new one
  const govFile = path.join(DIR, "governance.json");
  const gov = fs.existsSync(govFile) ? JSON.parse(fs.readFileSync(govFile, "utf8")) : {};
  let timelock = gov.safe && gov.safe.toLowerCase() === safe.toLowerCase() ? gov.timelock : null;

  const fee = await p.getFeeData();
  const price = fee.gasPrice ?? fee.maxFeePerGas;
  const ov = { maxFeePerGas: price * 2n, maxPriorityFeePerGas: 0n };
  const bal = await p.getBalance(eoa);
  const marketsV2 = owned.filter((c) => c.market);
  const est = 1_500_000n + BigInt(marketsV2.length) * 70_000n + BigInt(owned.length) * 60_000n;
  console.log(`\nadmin wallet ${eoa}: ${ethers.formatEther(bal)} ETH; needs about ${ethers.formatEther(est * price)} ETH (${est} gas)`);
  if (!confirm) return console.log("\nChecks passed. Nothing sent.");
  if (bal < (est * price * 3n) / 2n) throw new Error("Not enough ETH for gas. Nothing was sent.");

  // ---- 1. timelock
  if (!timelock) {
    const TL = await ethers.getContractFactory("CirravaTimelock", signer);
    const c = await TL.deploy(0, [safe], [ethers.ZeroAddress], ethers.ZeroAddress, ov);
    await c.waitForDeployment();
    timelock = await c.getAddress();
    fs.writeFileSync(govFile, JSON.stringify({ safe, timelock, delay: G.DELAY, createdAt: new Date().toISOString(), status: "timelock deployed" }, null, 2));
    console.log(`\n1. CirravaTimelock ${timelock}`);
  } else console.log(`\n1. reuse CirravaTimelock ${timelock}`);

  // ---- 2a. pauser + treasury -> Safe (v2 markets)
  for (const c of marketsV2) {
    const m = new ethers.Contract(c.address, MARKET_ABI, signer);
    if ((await m.pauser()).toLowerCase() !== safe.toLowerCase()) await (await m.setPauser(safe, ov)).wait();
    if ((await m.treasury()).toLowerCase() !== safe.toLowerCase()) await (await m.setTreasury(safe, ov)).wait();
    console.log(`2a. ${c.label}: pauser + treasury = Safe`);
  }
  // ---- 2b. offer ownership to the timelock
  for (const r of rows) {
    if (r.owner.toLowerCase() !== eoa.toLowerCase()) continue;
    if (r.pending.toLowerCase() === timelock.toLowerCase()) { console.log(`2b. ${r.label}: already offered`); continue; }
    await (await own.attach(r.address).connect(signer).transferOwnership(timelock, ov)).wait();
    console.log(`2b. ${r.label}: ownership offered to the timelock`);
  }

  // ---- 3. the Safe batch
  const batch = G.acceptBatch(owned, timelock);
  const calls = G.safeCalls(batch);
  const txb = {
    version: "1.0",
    chainId: String(dep.chainId),
    createdAt: Date.now(),
    meta: {
      name: "Cirrava: accept ownership + 48h timelock",
      description: `Timelock ${timelock} accepts ownership of ${owned.length} Cirrava contracts, then sets its own delay to 48 hours.`,
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: safe,
    },
    transactions: calls.map((c) => ({ to: timelock, value: "0", data: c.data, contractMethod: null, contractInputsValues: null })),
  };
  fs.writeFileSync(path.join(DIR, "safe-handover-batch.json"), JSON.stringify(txb, null, 2));
  fs.writeFileSync(govFile, JSON.stringify({ safe, timelock, delay: G.DELAY, owners: owners.map(String), threshold: Number(threshold), createdAt: gov.createdAt || new Date().toISOString(), status: "ownership offered; waiting for the Safe batch" }, null, 2));
  console.log(`\n3. Wrote deployments/safe-handover-batch.json (${calls.length} calls to the timelock).`);
  console.log("   In app.safe.global: Apps -> Transaction Builder -> drag in the file -> Create batch -> sign with the threshold -> execute.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
