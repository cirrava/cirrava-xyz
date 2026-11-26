import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

/* ================================================================ config */
const D = window.CIRRAVA_DEPLOYMENT;
const STATUS = ["Fresh", "MarketClosed", "Stale", "Invalid", "Paused"];
const STATUS_LABEL = { Fresh: "Fresh", MarketClosed: "Market closed", Stale: "Stale", Invalid: "Invalid", Paused: "Paused" };
// Hardhat's published test account #1 — worthless outside the local dev chain (31337). Never used elsewhere.
const LOCAL_TEST_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function faucet()",
  "function lastFaucet(address) view returns (uint256)",
];
const VAULT = [
  "function totalAssets() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function maxRedeem(address) view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function withdraw(uint256,address,address) returns (uint256)",
  "function redeem(uint256,address,address) returns (uint256)",
];
const MARKET = [
  "function marketInfo() view returns (tuple(address collateralToken,address borrowToken,uint256 cash,uint256 totalBorrows,uint256 supplyAssets,uint256 reserves,uint256 utilization,uint256 borrowAPR,uint256 supplyAPR,uint256 collateralPrice,uint8 collateralStatus,uint256 collateralUpdatedAt,uint256 borrowPrice,uint8 borrowStatus,uint256 ltv,uint256 liquidationThreshold,uint256 liquidationBonus,uint256 borrowFee,bool paused))",
  "function positionOf(address) view returns (uint256 collateral,uint256 debt,uint256 collateralValue,uint256 debtValue,uint256 healthFactor,uint256 maxBorrow)",
  "function depositCollateral(uint256,address)",
  "function withdrawCollateral(uint256,address)",
  "function borrow(uint256,address)",
  "function repay(uint256,address) returns (uint256)",
];
const CAL = ["function isOpenNow() view returns (bool)", "function sessionOf(uint256) view returns (uint256 open,uint256 close)"];

/* ================================================================ helpers */
const $ = (id) => document.getElementById(id);
const WAD = 10n ** 18n;
const n = (x, dec) => Number(ethers.formatUnits(x, dec));
const usd = (v, d = 2) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const amt = (v, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
const pct = (wad) => (n(wad, 18) * 100).toFixed(2) + "%";
const apy = (aprWad) => ((Math.pow(1 + n(aprWad, 18) / 365, 365) - 1) * 100).toFixed(2) + "%";
const etFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const et = (ts) => etFmt.format(new Date(Number(ts) * 1000)) + " ET";
const ago = (ts) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - Number(ts)));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
// Token logos. Stock Tokens show the company's mark plus the official Robinhood Token icon (the icon
// their on-chain token metadata points to); USDG uses its own official icon.
const ICONS = { NVDA: "nvda.svg", SPY: "spy.svg", TSLA: "tsla.svg", AAPL: "aapl.svg", USDG: "usdg.png" };
const icon = (sym) => {
  const f = ICONS[sym];
  if (!f) return `<span class="ic">${sym}</span>`;
  const badge = sym === "USDG" ? "" : `<img class="rh" src="../art/tokens/robinhood-token.png" alt="" title="${sym} • Robinhood Token">`;
  return `<span class="ic ic-${sym.toLowerCase()}"><img class="mk" src="../art/tokens/${f}" alt="${sym}" decoding="sync">${badge}</span>`;
};
const hfText =(hf) => (hf >= ethers.MaxUint256 / 2n ? "∞" : n(hf, 18).toFixed(2));
const parse = (s, dec) => {
  try {
    const v = ethers.parseUnits((s || "").trim().replace(/,/g, "") || "0", dec);
    return v > 0n ? v : 0n;
  } catch {
    return 0n;
  }
};
let toastT;
function toast(msg, err = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast on" + (err ? " err" : "");
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = "toast"), err ? 7000 : 4000);
}
const reason = (e) =>
  e?.reason || e?.info?.error?.data?.message || e?.info?.error?.message || e?.shortMessage || e?.message || String(e);

/* ================================================================ theme + routing */
try { document.documentElement.dataset.theme = localStorage.getItem("cirrava-theme") || "day"; } catch {}
$("themeBtn").onclick = () => {
  const t = document.documentElement.dataset.theme === "night" ? "day" : "night";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("cirrava-theme", t); } catch {}
};
// Clean URLs: /app/earn, /app/borrow, /app/portfolio, /app/status (nginx serves app/index.html for each).
const VIEWS = ["earn", "borrow", "portfolio", "status"];
// when opened as a local file or a plain static server there are no path routes, so fall back to #view
const PATH_ROUTES = location.protocol.startsWith("http") && location.pathname.startsWith("/app");
function currentView() {
  const seg = location.pathname.replace(/\/+$/, "").split("/").pop();
  if (VIEWS.includes(seg)) return seg;
  const h = location.hash.slice(1);
  return VIEWS.includes(h) ? h : "earn";
}
function route() {
  const view = currentView();
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("on", s.id === "view-" + view));
  document.querySelectorAll(".nav").forEach((a) => a.classList.toggle("on", a.dataset.view === view));
  document.title = `${view[0].toUpperCase() + view.slice(1)} | Cirrava`;
}
function navigate(view) {
  if (PATH_ROUTES) history.pushState(null, "", `/app/${view}`);
  else location.hash = view;
  route();
  scrollTo(0, 0);
}
// old links like /app/#borrow → /app/borrow
if (PATH_ROUTES && VIEWS.includes(location.hash.slice(1))) history.replaceState(null, "", `/app/${location.hash.slice(1)}`);
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-view]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  navigate(a.dataset.view);
});
addEventListener("popstate", route);
addEventListener("hashchange", route);
window.cirravaNavigate = navigate;
route();

/* ================================================================ chain */
if (!D) {
  $("offline").hidden = false;
  $("offline").innerHTML = `<h2 style="font-family:var(--serif);font-weight:500">The Cirrava app isn't live yet</h2>
    <p class="sub" style="margin-top:8px">Markets open once the protocol is deployed. Until then, read how it works in the
    <a href="/docs">docs</a> or head back to the <a href="/">homepage</a>.</p>`;
  ["connectBtn", "localBtn", "demoTag"].forEach((id) => ($(id).hidden = true));
  $("mktText").textContent = "Coming soon";
  document.body.classList.add("notlive");
  await new Promise(() => {}); // stop here quietly: nothing to read until the protocol is deployed
}
const LOCAL = D.chainId === 31337;
const MAINNET = D.chainId === 4663;
// read through the site's own /rpc proxy when available (works for visitors whose ISP blocks the public RPC)
const READ_URL = D.readRpc ? new URL(D.readRpc, location.href).href : D.rpcUrl || "http://127.0.0.1:8545";
const rpc = new ethers.JsonRpcProvider(READ_URL, D.chainId, { staticNetwork: true });
const vaultR = new ethers.Contract(D.vault, VAULT, rpc);
const usdgR = new ethers.Contract(D.usdg.address, ERC20, rpc);
const calR = new ethers.Contract(D.calendar, CAL, rpc);
const MK = D.markets.map((m) => ({ ...m, c: new ethers.Contract(m.market, MARKET, rpc), t: new ethers.Contract(m.token, ERC20, rpc) }));
$("netLabel").textContent = LOCAL ? "Local chain · 31337" : MAINNET ? "Robinhood Chain · 4663" : `${D.network} · ${D.chainId}`;
if (LOCAL) {
  $("demoTag").textContent = D.demo247 ? "TEST NETWORK · REAL PRICES · 24/7 DEMO" : "TEST NETWORK · REAL PRICES";
  $("demoTag").title = "Test tokens on a test network, priced by real market data";
  $("demoTag").hidden = false;
}
// The footer in index.html is the mainnet text (with legal links); only a local test chain replaces it.
if (LOCAL) document.querySelector("footer").textContent =
  "Cirrava is unaudited software running on a test network with test tokens. Prices are real market quotes pushed by a keeper; nothing here is an offer, solicitation or recommendation to buy or sell any security.";
if (!LOCAL) document.querySelectorAll("[data-faucet]").forEach((b) => b.remove()); // no faucets on real networks

let signer = null;
let account = null;
const S = { info: [], pos: [], wal: [], usdgBal: 0n, shares: 0n, myAssets: 0n, maxW: 0n, total: 0n, avail: 0n, open: false, next: null, closeAt: null, block: 0, sel: 0, earn: "deposit", act: "supply", busy: false, loaded: false };

/* ================================================================ wallet */
if (D.chainId === 31337) $("localBtn").hidden = false;

async function connectInjected() {
  if (!window.ethereum) {
    if (D.chainId === 31337) return connectLocal();
    toast("No wallet found. Install MetaMask or another browser wallet.", true);
    return;
  }
  const bp = new ethers.BrowserProvider(window.ethereum);
  await bp.send("eth_requestAccounts", []);
  const hex = "0x" + D.chainId.toString(16);
  try {
    await bp.send("wallet_switchEthereumChain", [{ chainId: hex }]);
  } catch (e) {
    if (e?.error?.code === 4902 || e?.code === 4902 || /Unrecognized chain/i.test(reason(e))) {
      await bp.send("wallet_addEthereumChain", [{
        chainId: hex,
        chainName: LOCAL ? "Cirrava Local (Hardhat)" : MAINNET ? "Robinhood Chain" : D.network,
        rpcUrls: [D.rpcUrl || "http://127.0.0.1:8545"],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        ...(D.explorer ? { blockExplorerUrls: [D.explorer] } : {}),
      }]);
    } else throw e;
  }
  signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
  account = await signer.getAddress();
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
  afterConnect();
}
function connectLocal() {
  signer = new ethers.Wallet(LOCAL_TEST_KEY, rpc);
  account = signer.address;
  afterConnect();
}
function afterConnect() {
  $("connectBtn").textContent = account.slice(0, 6) + "…" + account.slice(-4);
  $("localBtn").hidden = true;
  refresh();
}
$("connectBtn").onclick = () => !account && connectInjected().catch((e) => toast(reason(e), true));
$("localBtn").onclick = connectLocal;

/* ================================================================ data */
async function nextOpen(nowTs) {
  for (let d = 0; d < 8; d++) {
    const [open, close] = await calR.sessionOf(nowTs + d * 86400);
    if (open > 0n && Number(open) > nowTs) return Number(open);
    if (d === 0 && open > 0n && Number(close) > nowTs) S.closeAt = Number(close);
  }
  return null;
}

async function refresh() {
  try {
    const block = await rpc.getBlock("latest");
    S.block = block.number;
    const now = block.timestamp;
    const reads = [
      vaultR.totalAssets(),
      vaultR.availableLiquidity(),
      calR.isOpenNow(),
      ...MK.map((m) => m.c.marketInfo()),
    ];
    const r = await Promise.all(reads);
    [S.total, S.avail, S.open] = r;
    S.info = r.slice(3);
    S.closeAt = null;
    S.next = await nextOpen(now);
    if (account) {
      const a = await Promise.all([
        usdgR.balanceOf(account),
        vaultR.balanceOf(account),
        vaultR.maxWithdraw(account),
        ...MK.map((m) => m.c.positionOf(account)),
        ...MK.map((m) => m.t.balanceOf(account)),
      ]);
      [S.usdgBal, S.shares, S.maxW] = a;
      S.myAssets = await vaultR.convertToAssets(S.shares);
      S.pos = a.slice(3, 3 + MK.length);
      S.wal = a.slice(3 + MK.length);
    }
    S.loaded = true;
    $("offline").hidden = true;
    render();
  } catch (e) {
    console.error(e);
    if (!S.loaded) {
      $("offline").hidden = false;
      $("offline").innerHTML = LOCAL
        ? `<h2 style="font-family:var(--serif);font-weight:500">Can't reach the chain</h2>
        <p class="sub" style="margin-top:8px">No response from <code>${READ_URL}</code>. Start it with
        <code>npx hardhat node</code> in <code>protocol/</code> (and redeploy if it was restarted), then reload.</p>`
        : `<h2 style="font-family:var(--serif);font-weight:500">Can't reach Robinhood Chain right now</h2>
        <p class="sub" style="margin-top:8px">The network didn't answer. It retries automatically every few seconds.</p>`;
    }
  }
}

/* ================================================================ render */
function statusOf(i) {
  return STATUS[Number(i.collateralStatus)];
}
function canBorrow(i) {
  return !i.paused && Number(i.collateralStatus) === 0 && Number(i.borrowStatus) === 0;
}
function pausedReason(i) {
  if (i.paused) return "This market is paused by the pauser.";
  const s = statusOf(i);
  if (s === "MarketClosed") return `Paused while the US market is closed${S.next ? ` · reopens ${et(S.next)}` : ""}. Repaying and adding collateral stay open.`;
  if (s === "Stale") return "Price feed is stale; risk-increasing actions are paused until it updates.";
  if (Number(i.borrowStatus) !== 0) return "USDG price feed is not fresh.";
  return `Price status: ${STATUS_LABEL[s]}.`;
}
const badge = (s) => `<span class="badge ${s}">${STATUS_LABEL[s]}</span>`;

function render() {
  // market-hours pill
  $("mktDot").className = "dot" + (S.open ? " open" : "");
  $("mktText").textContent = S.open
    ? `US market open${S.closeAt ? ` · closes ${et(S.closeAt)}` : ""}`
    : `US market closed${S.next ? ` · opens ${et(S.next)}` : ""}`;

  renderEarn();
  renderBorrow();
  renderPortfolio();
  renderStatus();
}

function renderEarn() {
  const total = n(S.total, 6);
  $("eTotal").innerHTML = `${amt(total, 0)}<small>USDG</small>`;
  $("eAvail").innerHTML = `${amt(n(S.avail, 6), 0)}<small>USDG</small>`;
  let weighted = 0n;
  S.info.forEach((i) => (weighted += i.supplyAPR * i.supplyAssets));
  const apr = S.total > 0n ? weighted / S.total : 0n;
  $("eApy").textContent = apy(apr);
  $("allocBody").innerHTML = MK.map((m, k) => {
    const i = S.info[k];
    return `<tr><td><div class="asset">${icon(m.symbol)}${m.symbol}/USDG</div></td>
      <td>${amt(n(i.supplyAssets, 6), 0)}</td><td class="hide-m">${pct(i.utilization)}</td><td>${apy(i.supplyAPR)}</td></tr>`;
  }).join("");
  $("eWallet").textContent = account ? `${amt(n(S.usdgBal, 6))} USDG` : "–";
  $("eYours").textContent = account ? `${amt(n(S.myAssets, 6), 4)} USDG` : "–";
  $("eShares").textContent = account ? `${amt(n(S.shares, 12), 4)} cvUSDG` : "–";
  const go = $("eGo");
  if (!account) { go.textContent = "Connect wallet"; go.disabled = false; return; }
  const v = parse($("eAmt").value, 6);
  if (S.earn === "deposit") {
    go.textContent = v > S.usdgBal ? "Insufficient USDG" : "Deposit";
    go.disabled = S.busy || v === 0n || v > S.usdgBal;
  } else {
    go.textContent = v > S.maxW ? "Exceeds available" : "Withdraw";
    go.disabled = S.busy || v === 0n || v > S.maxW;
  }
}

function renderBorrow() {
  $("mktBody").innerHTML = MK.map((m, k) => {
    const i = S.info[k];
    const s = statusOf(i);
    return `<tr data-k="${k}" class="${k === S.sel ? "sel" : ""}">
      <td><div class="asset">${icon(m.symbol)}<div>${m.symbol}<span>${m.name}</span></div></div></td>
      <td>${usd(n(i.collateralPrice, 18))}<div style="margin-top:4px">${badge(s)}</div></td>
      <td class="hide-m">${pct(i.ltv)} / ${pct(i.liquidationThreshold)}</td>
      <td class="hide-m">${amt(n(i.cash, 6), 0)} USDG</td>
      <td>${pct(i.borrowAPR)}</td></tr>`;
  }).join("");
  document.querySelectorAll("#mktBody tr").forEach((tr) => (tr.onclick = () => { S.sel = Number(tr.dataset.k); $("bAmt").value = ""; render(); }));

  const m = MK[S.sel];
  const i = S.info[S.sel];
  const p = S.pos[S.sel];
  const price = n(i.collateralPrice, 18);
  $("pSym").textContent = `${m.symbol}/USDG`;
  $("pUpd").textContent = `${et(i.collateralUpdatedAt)} · ${ago(i.collateralUpdatedAt)}`;
  if (p) {
    const coll = n(p.collateral, 18);
    const debt = n(p.debt, 6);
    $("pColl").innerHTML = `${amt(coll, 4)}<small>${m.symbol}</small>`;
    $("pDebt").innerHTML = `${amt(debt, 2)}<small>USDG</small>`;
    $("pHf").textContent = hfText(p.healthFactor);
    const hf = p.healthFactor >= ethers.MaxUint256 / 2n ? 3 : n(p.healthFactor, 18);
    $("pHfBar").style.width = Math.min(100, (hf / 3) * 100) + "%";
    $("pMax").textContent = `${amt(n(p.maxBorrow, 6))} USDG`;
    const lt = n(i.liquidationThreshold, 18);
    $("pLiq").textContent = debt > 0 && coll > 0 ? usd(n(p.debtValue, 18) / (coll * lt)) : "–";
  } else {
    ["pColl", "pDebt", "pHf", "pMax", "pLiq"].forEach((id) => ($(id).textContent = "–"));
    $("pHfBar").style.width = "0";
  }
  $("bFaucet").innerHTML = LOCAL
    ? `<button class="mini" data-faucet="${m.symbol}">Get test ${m.symbol}</button><button class="mini" data-faucet="USDG">Get test USDG</button>`
    : D.explorer
      ? `<a class="mini" style="display:inline-flex;align-items:center;text-decoration:none" target="_blank" rel="noopener" href="${D.explorer}/address/${m.market}">View ${m.symbol} market on explorer ↗</a>`
      : "";
  bindFaucets();
  renderAction();
}

function actionNumbers() {
  const m = MK[S.sel], i = S.info[S.sel], p = S.pos[S.sel];
  const isColl = S.act === "supply" || S.act === "withdraw";
  const dec = isColl ? 18 : 6;
  const v = parse($("bAmt").value, dec);
  let max = 0n, label = "Wallet";
  if (p) {
    if (S.act === "supply") max = S.wal[S.sel];
    if (S.act === "borrow") { max = p.maxBorrow < i.cash ? p.maxBorrow : i.cash; label = "Can borrow"; }
    if (S.act === "repay") { max = S.usdgBal < p.debt ? S.usdgBal : p.debt; label = "Debt"; }
    if (S.act === "withdraw") {
      label = "Withdrawable";
      if (p.debt === 0n) max = p.collateral;
      else if (i.collateralPrice > 0n) {
        // collateral needed to keep debt within LTV
        const need = (p.debtValue * WAD * WAD) / (i.ltv * i.collateralPrice) + 1n;
        max = p.collateral > need ? p.collateral - need : 0n;
      }
    }
  }
  // health after
  let hfAfter = "–";
  if (p) {
    let cv = p.collateralValue, dv = p.debtValue;
    const val = (x, d, pr) => (x * pr) / 10n ** BigInt(d);
    if (S.act === "supply") cv += val(v, 18, i.collateralPrice);
    if (S.act === "withdraw") cv = cv > val(v, 18, i.collateralPrice) ? cv - val(v, 18, i.collateralPrice) : 0n;
    if (S.act === "borrow") dv += val(v, 6, i.borrowPrice);
    if (S.act === "repay") dv = dv > val(v, 6, i.borrowPrice) ? dv - val(v, 6, i.borrowPrice) : 0n;
    hfAfter = dv === 0n ? "∞" : ((Number(cv) * n(i.liquidationThreshold, 18)) / Number(dv)).toFixed(2);
  }
  return { m, i, p, v, max, dec, label, sym: isColl ? m.symbol : "USDG", hfAfter };
}

function renderAction() {
  const { i, p, v, max, dec, label, sym, hfAfter } = actionNumbers();
  $("bSym").textContent = sym;
  $("bBalLabel").textContent = label;
  $("bBal").textContent = p ? `${amt(n(max, dec), 4)} ${sym}` : "–";
  $("bHfAfter").textContent = hfAfter;
  const go = $("bGo");
  const note = $("bNote");
  note.hidden = true;
  const riskUp = S.act === "borrow" || (S.act === "withdraw" && p && p.debt > 0n);
  if (riskUp && !canBorrow(i)) { note.hidden = false; note.textContent = pausedReason(i); }
  if (S.act === "borrow" && note.hidden && v > 0n) {
    const fee = (v * i.borrowFee) / WAD;
    note.hidden = false;
    note.textContent = `Borrow fee ${pct(i.borrowFee)}: you receive ${amt(n(v - fee, 6), 4)} USDG; your debt grows by ${amt(n(v, 6), 4)}.`;
  }
  if (!account) { go.textContent = "Connect wallet"; go.disabled = false; return; }
  const names = { supply: "Add collateral", borrow: "Borrow", repay: "Repay", withdraw: "Withdraw collateral" };
  go.textContent = v > max ? (S.act === "supply" || S.act === "repay" ? `Insufficient ${sym}` : "Exceeds limit") : names[S.act];
  go.disabled = S.busy || v === 0n || v > max || (riskUp && !canBorrow(i));
}

function renderPortfolio() {
  if (!account) {
    $("fEarn").textContent = $("fColl").textContent = $("fDebt").textContent = "–";
    $("posBody").innerHTML = `<tr><td colspan="5" class="empty">Connect a wallet to see your positions.</td></tr>`;
    return;
  }
  let coll = 0, debt = 0;
  S.pos.forEach((p) => { coll += n(p.collateralValue, 18); debt += n(p.debtValue, 18); });
  $("fEarn").innerHTML = `${amt(n(S.myAssets, 6))}<small>USDG</small>`;
  $("fColl").textContent = usd(coll);
  $("fDebt").textContent = usd(debt);
  $("posBody").innerHTML = MK.map((m, k) => {
    const p = S.pos[k];
    return `<tr onclick="cirravaNavigate('borrow')"><td><div class="asset">${icon(m.symbol)}${m.symbol}/USDG</div></td>
      <td>${amt(n(p.collateral, 18), 4)} ${m.symbol}<div style="font-size:12px;color:var(--muted)">${usd(n(p.collateralValue, 18))}</div></td>
      <td>${amt(n(p.debt, 6), 2)} USDG</td><td>${hfText(p.healthFactor)}</td>
      <td class="hide-m">${amt(n(S.wal[k], 18), 4)} ${m.symbol}</td></tr>`;
  }).join("") + `<tr><td><div class="asset">${icon("USDG")}USDG</div></td><td colspan="3" style="color:var(--muted)">Wallet balance</td><td class="hide-m">${amt(n(S.usdgBal, 6))} USDG</td></tr>`;
}

function renderStatus() {
  $("sMkt").textContent = S.open ? "Open" : "Closed";
  $("sNext").textContent = S.open ? (S.closeAt ? `Closes ${et(S.closeAt)}` : "") : S.next ? `Opens ${et(S.next)}` : "";
  $("sChain").textContent = LOCAL ? "Local" : MAINNET ? "Robinhood" : D.network;
  $("sBlock").textContent = "#" + S.block;
  let borrows = 0n;
  S.info.forEach((i) => (borrows += i.totalBorrows));
  $("sVault").innerHTML = `${amt(n(S.total, 6), 0)}<small>USDG</small>`;
  $("sUtil").textContent = S.total > 0n ? ((Number(borrows) / Number(S.total)) * 100).toFixed(2) + "%" : "0%";
  const i0 = S.info[0];
  const usdgRow = i0
    ? `<tr><td><div class="asset">${icon("USDG")}USDG / USD</div></td><td>${usd(n(i0.borrowPrice, 18), 4)}</td>
       <td>${badge(STATUS[Number(i0.borrowStatus)])}</td><td class="hide-m">24/7 heartbeat</td><td>–</td><td>Open</td></tr>`
    : "";
  $("feedBody").innerHTML = MK.map((m, k) => {
    const i = S.info[k];
    return `<tr><td><div class="asset">${icon(m.symbol)}${m.symbol} / USD</div></td>
      <td>${usd(n(i.collateralPrice, 18))}</td><td>${badge(statusOf(i))}</td>
      <td class="hide-m">${et(i.collateralUpdatedAt)} · ${ago(i.collateralUpdatedAt)}</td>
      <td>${canBorrow(i) ? "Open" : "Paused"}</td><td>Open</td></tr>`;
  }).join("") + usdgRow;
}

/* ================================================================ actions */
async function ensureAllowance(token, spender, need) {
  const t = token.connect(signer);
  if ((await t.allowance(account, spender)) >= need) return;
  toast("Approve the token spend in your wallet…");
  await (await t.approve(spender, need)).wait();
}

async function run(label, fn) {
  if (S.busy) return;
  S.busy = true;
  render();
  try {
    toast(`${label}: confirm in your wallet…`);
    const tx = await fn();
    toast(`${label}: waiting for confirmation…`);
    await tx.wait();
    toast(`${label} ✓`);
    $("eAmt").value = "";
    $("bAmt").value = "";
  } catch (e) {
    toast(`${label} failed: ${reason(e)}`, true);
  } finally {
    S.busy = false;
    await refresh();
  }
}

// Earn
document.querySelectorAll("[data-earn]").forEach((b) => (b.onclick = () => {
  S.earn = b.dataset.earn;
  document.querySelectorAll("[data-earn]").forEach((x) => x.classList.toggle("on", x === b));
  $("eAmt").value = "";
  renderEarn();
}));
$("eAmt").oninput = renderEarn;
$("eMax").onclick = () => {
  if (!account) return;
  $("eAmt").value = ethers.formatUnits(S.earn === "deposit" ? S.usdgBal : S.maxW, 6);
  renderEarn();
};
$("eGo").onclick = async () => {
  if (!account) return connectInjected().catch((e) => toast(reason(e), true));
  const v = parse($("eAmt").value, 6);
  const vault = new ethers.Contract(D.vault, VAULT, signer);
  if (S.earn === "deposit") {
    await run("Deposit", async () => {
      await ensureAllowance(usdgR, D.vault, v);
      return vault.deposit(v, account);
    });
  } else {
    const all = v >= S.maxW;
    await run("Withdraw", async () =>
      all ? vault.redeem(await vaultR.maxRedeem(account), account, account) : vault.withdraw(v, account, account)
    );
  }
};

// Borrow panel
document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
  S.act = b.dataset.act;
  document.querySelectorAll("[data-act]").forEach((x) => x.classList.toggle("on", x === b));
  $("bAmt").value = "";
  renderAction();
}));
$("bAmt").oninput = renderAction;
$("bMax").onclick = () => {
  if (!account) return;
  const { max, dec } = actionNumbers();
  $("bAmt").value = ethers.formatUnits(max, dec);
  renderAction();
};
$("bGo").onclick = async () => {
  if (!account) return connectInjected().catch((e) => toast(reason(e), true));
  const { m, p, v, max } = actionNumbers();
  const market = m.c.connect(signer);
  if (S.act === "supply")
    await run("Add collateral", async () => { await ensureAllowance(m.t, m.market, v); return market.depositCollateral(v, account); });
  if (S.act === "borrow") await run("Borrow", () => market.borrow(v, account));
  if (S.act === "withdraw") await run("Withdraw collateral", () => market.withdrawCollateral(v, account));
  if (S.act === "repay") {
    // repaying the whole debt: send MaxUint so interest accrued until the tx lands is covered too
    const full = v >= p.debt && S.usdgBal > p.debt;
    const allowance = full ? (p.debt * 1001n) / 1000n + 1n : v;
    const allowCapped = allowance > S.usdgBal ? S.usdgBal : allowance;
    await run("Repay", async () => {
      await ensureAllowance(usdgR, m.market, allowCapped);
      return market.repay(full ? ethers.MaxUint256 : v, account);
    });
  }
  void max;
};

// Faucets (test tokens only)
function bindFaucets() {
  document.querySelectorAll("[data-faucet]").forEach((b) => {
    b.disabled = !account || S.busy;
    b.onclick = () => {
      const sym = b.dataset.faucet;
      const addr = sym === "USDG" ? D.usdg.address : MK.find((m) => m.symbol === sym).token;
      run(`Faucet ${sym}`, () => new ethers.Contract(addr, ERC20, signer).faucet());
    };
  });
}

/* ================================================================ go */
refresh();
setInterval(refresh, 10000);
