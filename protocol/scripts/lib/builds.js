// Every Hardhat build-info in artifacts/build-info, and a lookup for the one a live contract was built from.
// (After a code change Hardhat keeps older build-infos next to the new one; v1 and v2 contracts come from
// different builds, so a single "first file" is not enough.)
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "..", "artifacts", "build-info");
const builds = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ id: f.replace(/\.json$/, ""), ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));

function mask(hex, refs) {
  const b = Buffer.from(hex.replace(/^0x/, ""), "hex");
  for (const list of Object.values(refs || {})) for (const { start, length } of list) b.fill(0, start, start + length);
  return b.toString("hex");
}

/** the build whose deployed bytecode for file:name equals `code` (immutables masked), or null */
function findBuild(file, name, code) {
  for (const b of builds) {
    const c = b.output?.contracts?.[file]?.[name];
    if (!c) continue;
    const d = c.evm.deployedBytecode;
    if (mask(code, d.immutableReferences) === mask(d.object, d.immutableReferences)) return b;
  }
  return null;
}

module.exports = { builds, findBuild, mask };
