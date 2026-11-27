import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

/* Owner-only page: adds new markets to the live vault with the owner's own wallet (MetaMask etc.).
   For each Stock Token: 1) deploy StockOracle  2) deploy LendingMarket  3) vault.addMarket(market, cap).
   Progress is read back from the chain, so a refresh or a failed step can always be resumed. */
const D = window.CIRRAVA_DEPLOYMENT;
const X = window.CIRRAVA_ADMIN;
const $ = (id) => document.getElementById(id);
const LOCAL = D?.chainId === 31337;
// Hardhat's published test account #0 (owner of a local test deployment). Worthless outside chain 31337.
const LOCAL_OWNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const VAULT = [
  "function owner() view returns (address)",
  "function marketCount() view returns (uint256)",
  "function markets(uint256) view returns (address)",
  "function addMarket(address,uint256)",
];
const MKT = [
  "function collateralToken() view returns (address)",
  "function vault() view returns (address)",
  "function collateralOracle() view returns (address)",
  "function borrowOracle() view returns (address)",
  "function owner() view returns (address)",
];
const ORC = ["function feed() view returns (address)", "function calendar() view returns (address)", "function owner() view returns (address)", "function token() view returns (address)"];
const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
const FEED = ["function description() view returns (string)", "function decimals() view returns (uint8)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];

const READ_URL = D?.readRpc ? new URL(D.readRpc, location.href).href : D?.rpcUrl || "http://127.0.0.1:8545";
const rpc = new ethers.JsonRpcProvider(READ_URL, D?.chainId, { staticNetwork: true });
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
const link = (a) => (D.explorer ? `<a href="${D.explorer}/address/${a}" target="_blank" rel="noopener"><code>${short(a)}</code></a>` : `<code>${short(a)}</code>`);
const WAD = (x) => ethers.parseUnits(String(x), 18);
const cap = ethers.parseUnits(String(D?.capPerMarket || "10000").split(".")[0], 6);
const is247 = (m) => m.hours === "24/7";
const id = (m) => m.symbol + (m.hours ? " " + m.hours : "");
const capOf = (m) => (m.cap ? ethers.parseUnits(m.cap, 6) : cap);

const KEY = `cirrava-admin-${D?.chainId}-${D?.vault}`;
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } },
  set(sym, patch) { try { const s = store.get(); s[sym] = { ...(s[sym] || {}), ...patch }; localStorage.setItem(KEY, JSON.stringify(s)); } catch {} },
};

let signer = null, account = null, owner = null, busy = false;
let state = []; // [{m, checks, oracle, market, added}]

function log(line, cls = "") {
  const el = $("log");
  const t = new Date().toLocaleTimeString();
  el.innerHTML += `<div class="${cls}">[${t}] ${line}</div>`;
  el.scrollTop = el.scrollHeight;
}
const reason = (e) => e?.shortMessage || e?.info?.error?.message || e?.reason || e?.message || String(e);

/* ------------------------------------------------------------------ chain state */
async function readState() {
  const vault = new ethers.Contract(D.vault, VAULT, rpc);
  owner = await vault.owner();
  const n = Number(await vault.marketCount());
  // a market is identified by its collateral token AND its price feed (a token can have a regular and a 24/7 market)
  const byKey = {};
  for (let i = 0; i < n; i++) {
    const addr = await vault.markets(i);
    const k = new ethers.Contract(addr, MKT, rpc);
    const [tok, orc] = await Promise.all([k.collateralToken(), k.collateralOracle()]);
    const feed = await new ethers.Contract(orc, ORC, rpc).feed();
    byKey[(tok + feed).toLowerCase()] = addr;
  }
  const saved = store.get();
  const out = [];
  for (const m of X.newMarkets) {
    const s = { m, checks: [], ok: true, oracle: null, market: null, added: byKey[(m.token + m.feed).toLowerCase()] || null };
    // token + feed checks
    try {
      const t = new ethers.Contract(m.token, ERC20, rpc), f = new ethers.Contract(m.feed, FEED, rpc);
      const [sym, dec, desc, fdec, r] = await Promise.all([t.symbol(), t.decimals(), f.description(), f.decimals(), f.latestRoundData()]);
      const good = sym === m.symbol && Number(dec) === 18 && desc.toUpperCase().includes(m.symbol) && r[1] > 0n;
      s.ok = good;
      s.checks.push(`${good ? "✓" : "✗"} token ${sym}, feed “${desc}” $${Number(ethers.formatUnits(r[1], fdec)).toFixed(2)}`);
    } catch (e) {
      s.ok = false;
      s.checks.push(`✗ token/feed unreadable: ${reason(e)}`);
    }
    if (s.added) { s.market = s.added; out.push(s); continue; }
    // resume: a previously deployed oracle / market is reused only if it matches exactly
    const sv = saved[id(m)] || {};
    if (sv.oracle && (await rpc.getCode(sv.oracle)) !== "0x") {
      const o = new ethers.Contract(sv.oracle, ORC, rpc);
      try {
        if (same(await o.feed(), m.feed) && same(await o.calendar(), is247(m) ? ethers.ZeroAddress : D.calendar) && same(await o.token(), m.token) && same(await o.owner(), owner)) s.oracle = sv.oracle;
      } catch {}
    }
    if (s.oracle && sv.market && (await rpc.getCode(sv.market)) !== "0x") {
      const k = new ethers.Contract(sv.market, MKT, rpc);
      try {
        const [ct, v, co, bo, ow] = await Promise.all([k.collateralToken(), k.vault(), k.collateralOracle(), k.borrowOracle(), k.owner()]);
        if (same(ct, m.token) && same(v, D.vault) && same(co, s.oracle) && same(bo, D.usdg.oracle) && same(ow, owner)) s.market = sv.market;
      } catch {}
    }
    out.push(s);
  }
  state = out;
}

/* ------------------------------------------------------------------ render */
function render() {
  $("owner").innerHTML = owner ? link(owner) : "…";
  $("acct").innerHTML = account ? link(account) + (same(account, owner) ? " ✓ owner" : " (not owner)") : "not connected";
  $("rows").innerHTML = state.map((s) => {
    const steps = [["Oracle", s.oracle || s.added], ["Market", s.market], ["Added to vault", s.added]]
      .map(([t, d]) => `<span class="${d ? "done" : ""}">${d ? "✓ " : ""}${t}</span>`).join("");
    const status = s.added ? `<span class="tag ok">Live</span>` : !s.ok ? `<span class="tag bad">Check failed</span>` : `<span class="tag warn">Pending</span>`;
    const addrs = [s.oracle && `oracle ${link(s.oracle)}`, s.market && `market ${link(s.market)}`].filter(Boolean).join(" · ");
    return `<tr>
      <td><b>${id(s.m)}</b> ${status}<br><span class="lead" style="font-size:13px">${s.m.name} · LTV ${Math.round(s.m.ltv * 100)}% / liq. ${Math.round(s.m.lt * 100)}% · bonus ${((s.m.bonus ?? X.params.liquidationBonus) * 100).toFixed(1)}% · cap ${ethers.formatUnits(capOf(s.m), 6)} USDG${is247(s.m) ? ` · fresh if updated within ${s.m.window / 3600}h` : " · NYSE hours"}</span></td>
      <td style="font-size:13px">${s.checks.join("<br>")}</td>
      <td><div class="steps">${steps}</div><div style="font-size:12.5px;margin-top:6px">${addrs}</div></td>
      <td>${s.added ? "" : `<button class="btn sm" data-add="${id(s.m)}" ${canAct() && s.ok ? "" : "disabled"}>Add</button>`}</td>
    </tr>`;
  }).join("");
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => run([b.dataset.add])));
  const pending = state.filter((s) => !s.added && s.ok);
  $("runAll").disabled = !canAct() || !pending.length;
  const steps = pending.reduce((a, s) => a + (s.oracle ? 0 : 1) + (s.market ? 0 : 1) + 1, 0);
  $("hint").textContent = !pending.length ? "Every market is live." : !account ? "Connect the owner wallet to continue."
    : !same(account, owner) ? "The connected wallet is not the vault owner." : `${pending.length} market(s), ${steps} transaction(s) to confirm in your wallet.`;
  if (!pending.length && state.length) showDone();
}
const canAct = () => !busy && signer && same(account, owner);

function showDone() {
  const live = state.filter((s) => s.added);
  $("done").innerHTML = `<div class="note">All ${live.length} new markets are live. Tell Claude they are done, so the app, docs and site can be updated.</div>
  <pre class="out">${JSON.stringify(live.map((s) => ({ market: id(s.m), address: s.added })), null, 2)}</pre>`;
}

async function refresh() {
  try {
    await readState();
    const bal = await rpc.getBalance(owner);
    $("bal").textContent = Number(ethers.formatEther(bal)).toFixed(6) + " ETH";
    $("msg").innerHTML = "";
    render();
  } catch (e) {
    $("msg").innerHTML = `<div class="note bad">Could not read the chain through <code>${READ_URL}</code>: ${reason(e)}</div>`;
  }
}

/* ------------------------------------------------------------------ wallet */
async function connect() {
  if (!window.ethereum) return void ($("msg").innerHTML = `<div class="note bad">No browser wallet found. Open this page in a browser with MetaMask (or another wallet) installed.</div>`);
  const bp = new ethers.BrowserProvider(window.ethereum);
  await bp.send("eth_requestAccounts", []);
  const hex = "0x" + D.chainId.toString(16);
  try {
    await bp.send("wallet_switchEthereumChain", [{ chainId: hex }]);
  } catch (e) {
    if (e?.error?.code === 4902 || e?.code === 4902 || /Unrecognized chain/i.test(reason(e))) {
      // RPC through cirrava.xyz, so it works where the public RPC is blocked by the ISP
      await bp.send("wallet_addEthereumChain", [{
        chainId: hex, chainName: "Robinhood Chain",
        rpcUrls: [new URL("/rpc", location.href).href],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        ...(D.explorer ? { blockExplorerUrls: [D.explorer] } : {}),
      }]);
    } else throw e;
  }
  signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
  account = await signer.getAddress();
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
  $("connectBtn").textContent = short(account);
  log(`Connected ${account}${same(account, owner) ? " (vault owner)" : " — NOT the vault owner, actions disabled"}`);
  render();
}
function connectLocal() {
  // NonceManager: back-to-back txs from a raw Wallet can reuse a cached nonce (MetaMask tracks its own)
  signer = new ethers.NonceManager(new ethers.Wallet(LOCAL_OWNER_KEY, rpc));
  account = new ethers.Wallet(LOCAL_OWNER_KEY).address;
  $("connectBtn").textContent = short(account);
  log(`Local test owner ${account}`);
  render();
}

/* ------------------------------------------------------------------ actions */
async function fees() {
  // Robinhood Chain (Arbitrum Nitro) charges no priority fee
  const fd = await rpc.getFeeData();
  const base = fd.maxFeePerGas ?? fd.gasPrice;
  return base ? { maxFeePerGas: base * 2n, maxPriorityFeePerGas: 0n } : {};
}

async function step(s) {
  const m = s.m, P = X.params, name = id(m);
  if (!s.oracle) {
    log(`${name}: deploy StockOracle — confirm in your wallet…`);
    const f = new ethers.ContractFactory(X.StockOracle.abi, X.StockOracle.bytecode, signer);
    // 24/7: no exchange calendar, fresh while the feed updated within m.window
    const c = is247(m)
      ? await f.deploy(owner, m.feed, ethers.ZeroAddress, m.window, m.window, m.token, await fees())
      : await f.deploy(owner, m.feed, D.calendar, P.inSessionMaxAge, P.hardMaxAge, m.token, await fees());
    const addr = await c.getAddress();
    store.set(name, { oracle: addr, market: null });
    log(`${name}: oracle tx ${c.deploymentTransaction().hash} → ${addr}, waiting…`);
    await c.waitForDeployment();
    s.oracle = addr;
    log(`${name}: ✓ oracle ${addr}`, "ok");
    render();
  }
  if (!s.market) {
    log(`${name}: deploy LendingMarket — confirm in your wallet…`);
    const f = new ethers.ContractFactory(X.LendingMarket.abi, X.LendingMarket.bytecode, signer);
    const c = await f.deploy({
      owner, vault: D.vault, treasury: D.treasury || owner, collateralToken: m.token, borrowToken: D.usdg.address,
      collateralOracle: s.oracle, borrowOracle: D.usdg.oracle, irm: D.irm,
      ltv: WAD(m.ltv), liquidationThreshold: WAD(m.lt), liquidationBonus: WAD(m.bonus ?? P.liquidationBonus),
      reserveFactor: WAD(P.reserveFactor), borrowFee: WAD(P.borrowFee),
    }, await fees());
    const addr = await c.getAddress();
    store.set(name, { market: addr });
    log(`${name}: market tx ${c.deploymentTransaction().hash} → ${addr}, waiting…`);
    await c.waitForDeployment();
    s.market = addr;
    log(`${name}: ✓ market ${addr}`, "ok");
    render();
  }
  log(`${name}: vault.addMarket (cap ${ethers.formatUnits(capOf(m), 6)} USDG) — confirm in your wallet…`);
  const vault = new ethers.Contract(D.vault, VAULT, signer);
  const tx = await vault.addMarket(s.market, capOf(m), await fees());
  log(`${name}: addMarket tx ${tx.hash}, waiting…`);
  await tx.wait();
  s.added = s.market;
  log(`${name}: ✓ live in the vault`, "ok");
}

async function run(symbols) {
  if (!canAct()) return;
  busy = true;
  render();
  try {
    for (const s of state.filter((x) => symbols.includes(id(x.m)) && !x.added && x.ok)) await step(s);
  } catch (e) {
    log(`✗ ${reason(e)} — nothing is lost: press Add again to resume from the last confirmed step.`, "bad");
  } finally {
    busy = false;
    await refresh();
  }
}

/* ------------------------------------------------------------------ boot */
if (!D || !X) {
  $("rows").innerHTML = `<tr><td colspan="4">No deployment config on this site.</td></tr>`;
} else {
  $("net").textContent = LOCAL ? "Local test chain (31337)" : `Robinhood Chain (${D.chainId})`;
  if (LOCAL) { $("localBtn").hidden = false; $("localBtn").onclick = connectLocal; }
  $("connectBtn").onclick = () => connect().catch((e) => log(`✗ ${reason(e)}`, "bad"));
  $("runAll").onclick = () => run(state.filter((s) => !s.added).map((s) => id(s.m)));
  log(`Build ${X.build} · ${X.newMarkets.length} market(s) configured · reading ${READ_URL}`);
  refresh();
}
