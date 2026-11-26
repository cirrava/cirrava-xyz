"""Rewrites the technical sections of docs.html from the live deployment record
(protocol/deployments/robinhood.json), so the docs always match what is on-chain.

  python deploy/docs_contracts.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
dep = json.loads((ROOT / "protocol" / "deployments" / "robinhood.json").read_text(encoding="utf-8"))
ex = dep["explorer"]
# $CIRRAVA token (ERC-20 on Robinhood Chain, verified on-chain: 18 decimals, 1,000,000,000 supply, no owner, not a proxy)
CIRRAVA = "0x0267939aCc8C236e0eB2bd425c026c9180e7446A"


def a(addr):
    return f'<a href="{ex}/address/{addr}" target="_blank" rel="noopener"><code>{addr[:6]}…{addr[-4:]}</code></a>'


def pct(x):
    return f"{x * 100:.0f}%"


cap = dep.get("capPerMarket", "10000").split(".")[0]
cap_fmt = f"{int(cap):,}"
mrows = "\n".join(
    f'    <tr><td>{m["symbol"]}/USDG</td><td>{a(m["market"])}</td><td>{a(m["oracle"])}</td><td>{pct(m["ltv"])} / {pct(m["lt"])}</td></tr>'
    for m in dep["markets"]
)
core = "\n".join([
    f'    <tr><td>EarnVault (cvUSDG)</td><td>{a(dep["vault"])}</td></tr>',
    f'    <tr><td>MarketCalendar</td><td>{a(dep["calendar"])}</td></tr>',
    f'    <tr><td>InterestRateModel</td><td>{a(dep["irm"])}</td></tr>',
    f'    <tr><td>USDG oracle (24/7)</td><td>{a(dep["usdg"]["oracle"])}</td></tr>',
    f'    <tr><td>Owner &amp; treasury</td><td>{a(dep["deployer"])}</td></tr>',
])
tokens = "\n".join(
    [f'    <tr><td>USDG</td><td>{a(dep["usdg"]["address"])}</td><td>6</td><td>{a(dep["usdg"]["feed"])}</td></tr>']
    + [f'    <tr><td>{m["symbol"]}</td><td>{a(m["token"])}</td><td>18</td><td>{a(m["feed"])}</td></tr>' for m in dep["markets"]]
)
symbols = ", ".join(m["symbol"] for m in dep["markets"][:-1]) + " or " + dep["markets"][-1]["symbol"]

NEW = f"""  <h2 id="intro">Introduction</h2>
  <p>Cirrava lets you borrow against Stock Tokens without selling them, and lets lenders earn yield on the stablecoin the borrowing is denominated in. It is live on Robinhood Chain mainnet (chain ID {dep["chainId"]}) since 21 November 2026.</p>
  <p>Hold NVDA as a Stock Token and need cash without closing the position? Deposit it as collateral and borrow USDG. Hold USDG and want yield? Deposit it into the Earn vault, which lends to every market and earns what borrowers pay. Contracts hold the assets; nobody else does.</p>
  <h3>Why stocks are different from ETH</h3>
  <p>A Stock Token tracks an instrument that stops trading overnight, at weekends and on holidays, and its price feed stops with it. Cirrava treats a closed market as an expected state, not an oracle failure: the last price stands, borrowing and liquidations pause, and every risk-reducing action stays open.</p>
  <table><tr><th>Action</th><th>What it does</th></tr>
    <tr><td>Earn</td><td>Deposit USDG into the Earn vault and receive cvUSDG shares. The vault is the only lender to the markets.</td></tr>
    <tr><td>Borrow</td><td>Deposit {symbols} (Robinhood Stock Tokens) and borrow USDG against it. A 0.1% fee is taken from each borrow.</td></tr>
    <tr><td>Repay</td><td>In USDG, from your wallet, at any time.</td></tr></table>

  <h2 id="how">How it works</h2>
  <p>Each market is an isolated pair: one Stock Token as collateral, USDG to borrow. A position in NVDA/USDG is priced and liquidated on NVDA alone. Lenders share one Earn vault, and a cap per market (currently {cap_fmt} USDG) bounds how much of the vault any one market can use.</p>
  <h3>Borrowing</h3>
  <p>Deposit collateral, borrow USDG up to the market's LTV, pay interest continuously, repay in USDG. Positions are recorded per wallet inside each market contract.</p>
  <h3>Interest</h3>
  <p>A kinked curve: 2% a year at zero utilization, rising to 10% at 80% utilization, then steeply to 110% at full utilization to pull liquidity back. Lenders earn what borrowers pay, minus a 10% reserve factor.</p>
  <h3>Health and liquidation</h3>
  <p>Two thresholds, with a deliberate gap: the <b>LTV</b> caps what you may borrow, and the <b>liquidation threshold</b> is where a position becomes liquidatable.</p>
  <p><code>borrowed value &gt; collateral value × liquidation threshold</code></p>
  <p>A liquidator may repay up to half of an unhealthy position's debt (all of it below $100) and receives collateral worth the repaid amount plus a 5% bonus.</p>

  <h2 id="hours">Market hours</h2>
  <p>The on-chain calendar follows the NYSE regular session, 09:30–16:00 New York time, Monday to Friday. US daylight-saving time is computed in the contract; NYSE holidays and early closes for 2026–2027 are stored on-chain.</p>
  <table><tr><th>While the market is closed</th><th></th></tr>
    <tr><td>Earn vault deposit / withdraw</td><td>Allowed</td></tr>
    <tr><td>Supplying collateral</td><td>Allowed</td></tr>
    <tr><td>Repaying</td><td>Allowed</td></tr>
    <tr><td>Withdrawing collateral, no debt</td><td>Allowed</td></tr>
    <tr><td>Withdrawing collateral, with debt</td><td>Paused</td></tr>
    <tr><td>Borrowing</td><td>Paused</td></tr>
    <tr><td>Liquidation</td><td>Paused</td></tr></table>
  <p>Everything that reduces risk stays available; everything that takes a new position on a frozen price does not. After the open, a price published before the open still counts as closed until Chainlink publishes a fresh in-session price.</p>

  <h2 id="risks">Risks</h2>
  <div class="note">Read this before you deposit or borrow. Cirrava's contracts have not been audited. Deposits and loans use real assets and can be lost. The full <a href="/risk">Risk Disclosure</a> covers every risk in detail.</div>
  <h3>Admin key</h3><p>One wallet currently owns every contract. It can change risk parameters, fees and the interest-rate model, pause a market, add markets to the Earn vault, set their caps, move vault liquidity between markets and withdraw protocol reserves. Lowering a liquidation threshold can make positions liquidatable, and adding a market lets that wallet route vault deposits to it, so a lost or stolen admin key puts deposits at risk. Moving ownership to a multisig is on the roadmap.</p>
  <h3>No upgrades</h3><p>The contracts are not upgradeable proxies: the code at each address is fixed. A fix would mean deploying new contracts.</p>
  <h3>Oracle dependencies</h3><p>Positions are priced from Chainlink's feeds on Robinhood Chain. A paused, stale or wrong feed stops or misprices borrowing and liquidations.</p>
  <h3>Weekend gaps</h3><p>Prices can move sharply between Friday's close and Monday's open; a position can open the week already liquidatable.</p>
  <h3>Liquidity</h3><p>Vault withdrawals are limited to USDG that is not lent out. If markets are fully borrowed, a withdrawal waits until borrowers repay.</p>

  <h2 id="contracts">Contracts</h2>
  <p>Robinhood Chain mainnet, chain ID {dep["chainId"]}, deployed 21 November 2026. Every address links to the explorer. Source code, tests and the deployment record are on <a href="https://github.com/cirrava/cirrava-xyz" target="_blank" rel="noopener">GitHub</a>; changes are listed in the <a href="https://github.com/cirrava/cirrava-xyz/blob/main/CHANGELOG.md" target="_blank" rel="noopener">changelog</a>.</p>
  <h3>Markets</h3>
  <table><tr><th>Market</th><th>LendingMarket</th><th>Price oracle</th><th>LTV / Liq.</th></tr>
{mrows}</table>
  <h3>Core</h3>
  <table><tr><th>Contract</th><th>Address</th></tr>
{core}</table>
  <h3 id="token">$CIRRAVA token</h3>
  <table><tr><th>Token</th><th>Address</th><th>Decimals</th><th>Total supply</th></tr>
    <tr><td>CIRRAVA</td><td>{a(CIRRAVA)}</td><td>18</td><td>1,000,000,000</td></tr></table>
  <p>ERC-20 on Robinhood Chain. The contract has no owner and is not upgradeable. Check the address above before you trade: anyone can create a token with the same name.</p>
  <h3>Assets (issued by Robinhood, Paxos and Chainlink, not by Cirrava)</h3>
  <table><tr><th>Token</th><th>Address</th><th>Decimals</th><th>Chainlink feed</th></tr>
{tokens}</table>

"""

p = ROOT / "docs.html"
s = p.read_text(encoding="utf-8")
start, end = s.index('  <h2 id="intro">'), s.index('  <h2 id="app">')
s = s[:start] + NEW + s[end:]
REPL = {
    '<a href="#">Status</a>': '<a href="/app/status">Status</a>',
    '<span>Addresses for each market, and which one to call.</span>': '<span>Every address on Robinhood Chain mainnet.</span>',
    '<a href="#indexer"><b>Indexer</b><span>A GraphQL API for everything the chain cannot answer directly.</span></a>':
        '<a href="/app/status"><b>Live status</b><span>Market hours, prices and what the protocol may do right now.</span></a>',
    '<a href="#indexer">Indexer</a>': '<a href="/app/status">Live status</a>',
    '<span>Supplying, borrowing, health, and the two addresses every market has.</span>': '<span>Supplying, borrowing, interest, health and liquidation.</span>',
}
for k, v in REPL.items():
    s = s.replace(k, v)
p.write_text(s, encoding="utf-8")
print("indexer:", s.count('id="indexer"') + s.count("#indexer"), "| placeholders 0x…:", s.count("<code>0x…</code>"),
      "| template note:", s.count("template and does"), "| href=#:", s.count('href="#"'))
