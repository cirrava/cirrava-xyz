// Read-only check of every external mainnet address before deploying. Sends no transactions.
//   node scripts/verify-mainnet.js
const { ethers } = require("ethers");
const A = require("./mainnet-assets");

const ERC20 = ["function symbol() view returns (string)", "function name() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)"];
const FEED = ["function decimals() view returns (uint8)", "function description() view returns (string)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];

async function main() {
  const p = new ethers.JsonRpcProvider(A.rpcUrl);
  const chainId = Number((await p.getNetwork()).chainId);
  const block = await p.getBlock("latest");
  console.log(`chainId ${chainId} (expected ${A.chainId}), block ${block.number}, ${new Date(block.timestamp * 1000).toISOString()}`);
  if (chainId !== A.chainId) throw new Error("wrong chain");
  let ok = true;
  const check = async (label, token, feed, expectDec) => {
    try {
      if ((await p.getCode(token)) === "0x") throw new Error("token: no code");
      if ((await p.getCode(feed)) === "0x") throw new Error("feed: no code");
      const t = new ethers.Contract(token, ERC20, p);
      const f = new ethers.Contract(feed, FEED, p);
      const [sym, name, dec, supply, fdec, desc, round] = await Promise.all([t.symbol(), t.name(), t.decimals(), t.totalSupply(), f.decimals(), f.description(), f.latestRoundData()]);
      const age = (block.timestamp - Number(round[3])) / 3600;
      const price = Number(ethers.formatUnits(round[1], fdec));
      const bad = [];
      if (Number(dec) !== expectDec) bad.push(`decimals ${dec}≠${expectDec}`);
      if (!desc.toUpperCase().includes(label)) bad.push(`feed "${desc}" ≠ ${label}`);
      if (!(price > 0)) bad.push("non-positive price");
      if (bad.length) ok = false;
      console.log(`${bad.length ? "✗" : "✓"} ${label.padEnd(5)} token ${sym} "${name}" dec ${dec} supply ${Number(ethers.formatUnits(supply, dec)).toFixed(2)} | feed "${desc}" $${price} (${age.toFixed(1)}h old)${bad.length ? "  → " + bad.join(", ") : ""}`);
    } catch (e) {
      ok = false;
      console.log(`✗ ${label}: ${e.shortMessage || e.message}`);
    }
  };
  await check("USDG", A.usdg.token, A.usdg.feed, 6);
  for (const m of A.markets) await check(m.symbol, m.token, m.feed, 18);
  if (!ok) {
    console.log("\nSome checks failed — do NOT deploy.");
    process.exitCode = 1;
  } else console.log("\nAll external addresses verified on-chain.");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
