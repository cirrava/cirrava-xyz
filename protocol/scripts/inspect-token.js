// Read-only inspection of an ERC-20 on Robinhood Chain: identity, supply, ownership, proxy, deployer.
//   node scripts/inspect-token.js 0xTOKEN
const { ethers } = require("ethers");
const A = require("./mainnet-assets");

const addr = process.argv[2];
const ABI = [
  "function name() view returns (string)", "function symbol() view returns (string)",
  "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)", "function balanceOf(address) view returns (uint256)",
];
const try_ = async (f) => { try { return await f(); } catch { return null; } };

(async () => {
  const p = new ethers.JsonRpcProvider(process.env.RPC_URL || A.rpcUrl);
  const net = await p.getNetwork();
  const code = await p.getCode(addr);
  console.log(`chain ${net.chainId}  address ${ethers.getAddress(addr)}  code ${(code.length - 2) / 2} bytes`);
  if (code === "0x") return console.log("NO CONTRACT at this address on this chain");
  const t = new ethers.Contract(addr, ABI, p);
  const [name, symbol, decimals, supply, owner] = await Promise.all([try_(() => t.name()), try_(() => t.symbol()), try_(() => t.decimals()), try_(() => t.totalSupply()), try_(() => t.owner())]);
  console.log(`name "${name}"  symbol "${symbol}"  decimals ${decimals}`);
  if (supply != null && decimals != null) console.log(`totalSupply ${ethers.formatUnits(supply, decimals)}`);
  console.log(`owner() ${owner ?? "(none)"}`);
  // EIP-1967 proxy slots
  const impl = await p.getStorage(addr, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
  const admin = await p.getStorage(addr, "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103");
  console.log(`EIP-1967 implementation ${BigInt(impl) ? "0x" + impl.slice(26) : "(not a proxy)"}  admin ${BigInt(admin) ? "0x" + admin.slice(26) : "-"}`);
  // explorer metadata (creator, verification) — best effort
  try {
    const r = await fetch(`${A.explorer}/api/v2/addresses/${addr}`, { headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" } });
    const d = await r.json();
    console.log(`explorer: verified=${d.is_verified}  creator=${d.creator_address_hash}  creation tx=${d.creation_tx_hash || d.creation_transaction_hash}  name=${d.name}`);
    const tk = await (await fetch(`${A.explorer}/api/v2/tokens/${addr}`, { headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" } })).json();
    console.log(`token info: type=${tk.type} holders=${tk.holders_count ?? tk.holders} icon=${tk.icon_url || "-"}`);
  } catch (e) {
    console.log("explorer lookup failed:", e.message);
  }
})();
