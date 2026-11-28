// Read-only: is Cirrava's admin fully handed to the Safe + timelock?
//   npx hardhat run scripts/verify-governance.js --network robinhood
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const G = require("./lib/governance");

let failures = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) failures++; };
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

async function main() {
  const DIR = path.join(__dirname, "..", "deployments");
  const dep = JSON.parse(fs.readFileSync(path.join(DIR, "robinhood.json"), "utf8"));
  const v1File = path.join(DIR, "robinhood-v1.json");
  const v1 = fs.existsSync(v1File) ? JSON.parse(fs.readFileSync(v1File, "utf8")) : null;
  const gov = JSON.parse(fs.readFileSync(path.join(DIR, "governance.json"), "utf8"));
  const p = ethers.provider;
  const tl = await ethers.getContractAt("CirravaTimelock", gov.timelock);
  const [PROPOSER, EXECUTOR, CANCELLER, ADMIN] = await Promise.all([tl.PROPOSER_ROLE(), tl.EXECUTOR_ROLE(), tl.CANCELLER_ROLE(), tl.DEFAULT_ADMIN_ROLE()]);

  const safe = new ethers.Contract(gov.safe, ["function getOwners() view returns (address[])", "function getThreshold() view returns (uint256)"], p);
  const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()]);
  ok(owners.length >= 2 && threshold >= 2n, `Safe ${gov.safe}: ${threshold} of ${owners.length}`);
  ok((await tl.getMinDelay()) === BigInt(G.DELAY), `timelock ${gov.timelock} delay ${(await tl.getMinDelay()) / 3600n}h`);
  ok(await tl.hasRole(PROPOSER, gov.safe), "Safe is proposer");
  ok(await tl.hasRole(CANCELLER, gov.safe), "Safe is canceller");
  ok(await tl.hasRole(EXECUTOR, ethers.ZeroAddress), "anyone can execute after the delay");
  ok(!(await tl.hasRole(ADMIN, dep.deployer)) && !(await tl.hasRole(PROPOSER, dep.deployer)), "old admin wallet has no timelock role");
  ok(!(await tl.hasRole(ADMIN, gov.safe)), "Safe is not timelock admin (roles change only through the timelock)");

  for (const c of G.ownedContracts(dep, v1)) {
    const o = new ethers.Contract(c.address, ["function owner() view returns (address)", "function pendingOwner() view returns (address)"], p);
    const [owner, pending] = await Promise.all([o.owner(), o.pendingOwner()]);
    ok(same(owner, gov.timelock) && pending === ethers.ZeroAddress, `${c.label} owner = timelock`);
    if (c.market) {
      const m = new ethers.Contract(c.address, ["function pauser() view returns (address)", "function treasury() view returns (address)"], p);
      ok(same(await m.pauser(), gov.safe) && same(await m.treasury(), gov.safe), `  pauser + treasury = Safe`);
    }
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed: the admin wallet no longer controls Cirrava.");
  if (failures) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
