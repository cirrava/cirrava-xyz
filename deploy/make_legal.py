"""Generates the legal pages (terms.html, privacy.html, risk.html) from one template, so they share
layout and navigation. Edit the text here, then run:

  python deploy/make_legal.py && python deploy/add_meta.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPDATED = "26 November 2026"
GH = "https://github.com/cirrava/cirrava-xyz"
X = "https://x.com/Cirrava"
EXP = "https://robinhoodchain.blockscout.com/address"
OWNER = "0xa319B076571a93C345Eb61Ec5131364dE81D0BA1"

PAGES = {
    "terms": ("Terms of Use", "Terms of Use | Cirrava"),
    "privacy": ("Privacy Policy", "Privacy Policy | Cirrava"),
    "risk": ("Risk Disclosure", "Risk Disclosure | Cirrava"),
}

TERMS = f"""
<p class="lead">These terms apply when you use cirrava.xyz, the Cirrava app and the Cirrava smart contracts on Robinhood Chain. By using any of them you accept these terms. If you do not accept them, do not use Cirrava.</p>
<div class="note">Cirrava is experimental software that has not been audited. You can lose everything you deposit or post as collateral. Read the <a href="/risk">Risk Disclosure</a> before you use it.</div>

<h2 id="what">1. What Cirrava is</h2>
<p>Cirrava is a set of smart contracts on Robinhood Chain (chain ID 4663) that let people lend USDG through an Earn vault and borrow USDG against Robinhood Stock Tokens, together with a website and app that read those contracts and help you send transactions to them.</p>
<p>Cirrava is <b>non-custodial</b>. The team never holds your assets or your keys. Every deposit, loan, repayment and liquidation is carried out by the contracts when you, or someone else, sends a transaction. Transactions on a blockchain are final: nobody, including the team, can reverse one.</p>
<p>The source code is public on <a href="{GH}" target="_blank" rel="noopener">GitHub</a> and every contract address is listed in the <a href="/docs/contracts">docs</a>.</p>

<h2 id="eligibility">2. Who may use Cirrava</h2>
<p>You may use Cirrava only if all of the following are true:</p>
<ul>
<li>you are at least 18 years old and able to enter into a binding agreement;</li>
<li>you are not a person to whom Stock Tokens may not be offered, including persons in the United States, Canada, the United Kingdom or Switzerland;</li>
<li>you are not subject to sanctions, and you are not located in, or acting for anyone in, a country or territory subject to comprehensive sanctions;</li>
<li>using Cirrava is lawful where you live, and you are responsible for checking that.</li>
</ul>
<p>Stock Tokens are issued by third parties under their own terms and eligibility rules. Cirrava does not issue, sell or redeem them.</p>

<h2 id="advice">3. No advice, no offer</h2>
<p>Nothing on cirrava.xyz, in the app, in the docs or in any post by Cirrava is financial, investment, legal or tax advice, or an offer, solicitation or recommendation to buy, sell or hold any security, token or other asset. Rates and prices shown are estimates that change with market conditions. Decide for yourself, and get independent advice if you need it.</p>

<h2 id="you">4. Your responsibilities</h2>
<ul>
<li><b>Your wallet.</b> You are responsible for your wallet, private keys and seed phrase. Cirrava will never ask for them. Anyone who does is not us.</li>
<li><b>Your transactions.</b> Check every transaction in your wallet before you sign it, including the contract address. Only use addresses listed in the docs or on GitHub.</li>
<li><b>Your positions.</b> Keep borrowing positions healthy. A position that crosses its liquidation threshold can be liquidated by anyone, with a 5% bonus paid from your collateral.</li>
<li><b>Taxes.</b> You are responsible for any taxes and reporting that apply to you.</li>
</ul>

<h2 id="admin">5. Admin powers</h2>
<p>One wallet, <a href="{EXP}/{OWNER}" target="_blank" rel="noopener"><code>{OWNER[:6]}…{OWNER[-4:]}</code></a>, currently owns every Cirrava contract. It can change risk parameters, fees and the interest-rate model, pause markets, add markets to the Earn vault, set caps, move vault liquidity between markets and withdraw protocol reserves. The contracts are not upgradeable. Moving ownership to a multisig is planned. The <a href="/risk#admin">Risk Disclosure</a> explains what these powers mean for you.</p>

<h2 id="fees">6. Fees</h2>
<p>Each borrow pays a 0.1% fee, and 10% of the interest borrowers pay goes to the protocol reserve (the reserve factor). Both go to the treasury address set in the contracts. You also pay Robinhood Chain network fees for every transaction. Fees are enforced by the contracts and may change through the admin powers above.</p>

<h2 id="token">7. The $CIRRAVA token</h2>
<p>$CIRRAVA (<a href="{EXP}/0x0267939aCc8C236e0eB2bd425c026c9180e7446A" target="_blank" rel="noopener"><code>0x0267…446A</code></a>) is an ERC-20 token on Robinhood Chain. It is not used by the Cirrava lending contracts, and holding it gives no right to protocol fees, revenue, profits, governance, redemption or any claim on the team. Its price can fall to zero. Tokens with the same name created by others are not Cirrava.</p>

<h2 id="third">8. Third parties</h2>
<p>Cirrava depends on services it does not control, including Robinhood Chain, the Stock Token and USDG issuers, Chainlink price feeds, wallet software, RPC providers and block explorers. Cirrava is not responsible for their failures, decisions or terms.</p>

<h2 id="conduct">9. Prohibited use</h2>
<p>Do not use Cirrava to break the law, to launder money or finance illegal activity, to evade sanctions, or to manipulate prices or markets. Do not attack the website or its servers. If you find a vulnerability in the contracts, report it privately as described in our <a href="{GH}/blob/main/SECURITY.md" target="_blank" rel="noopener">security policy</a> and test only on a local fork.</p>

<h2 id="availability">10. The website and app</h2>
<p>We may change, suspend or stop the website, the app or the RPC proxy at any time, and may block access for anyone in breach of these terms. The contracts keep running on Robinhood Chain regardless, and you can always reach them directly or through a block explorer.</p>

<h2 id="warranty">11. No warranty</h2>
<p>Cirrava, including the website, app and contracts, is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy and non-infringement. We do not promise that it is secure, error-free or always available.</p>

<h2 id="liability">12. Limitation of liability</h2>
<p>To the fullest extent the law allows, the Cirrava team and contributors are not liable for any loss or damage arising from your use of Cirrava, including lost assets, lost profits, liquidations, bad debt, smart-contract failures, oracle failures, network failures, or the acts of third parties. Some places do not allow certain limits on liability; there, these limits apply as far as the law permits.</p>

<h2 id="changes">13. Changes to these terms</h2>
<p>We may update these terms. The date at the top shows the latest version, and changes are recorded in the <a href="{GH}/commits/main/deploy/make_legal.py" target="_blank" rel="noopener">public history</a>. Using Cirrava after a change means you accept the updated terms.</p>

<h2 id="contact">14. Contact</h2>
<p>Send a direct message to <a href="{X}" target="_blank" rel="noopener">@Cirrava on X</a>.</p>
"""

PRIVACY = f"""
<p class="lead">Cirrava has no accounts, no sign-up, no tracking cookies and no analytics. This page explains the little data that is still processed when you use cirrava.xyz, and by whom.</p>

<h2 id="collect">1. What our server records</h2>
<p>Like almost every website, our web server (nginx) keeps an access log of each request: your IP address, the date and time, the page or file requested, the response, the referring page and your browser's user-agent string. We use these logs only to keep the site running and secure, for example to stop abuse. They are deleted automatically after 14 days.</p>
<p>We do not ask for your name, email address or any other personal details, and we do not sell, rent or share data for advertising.</p>

<h2 id="wallet">2. Your wallet and the blockchain</h2>
<p>When you connect a wallet, the app reads your wallet address from your wallet in your browser in order to show your balances and positions. We do not store it on our server.</p>
<p>Anything you do on Robinhood Chain (deposits, loans, repayments, transfers) is recorded on a public blockchain. Anyone can see it, forever, and it can sometimes be linked to you. Neither we nor anyone else can delete it.</p>

<h2 id="rpc">3. The RPC proxy</h2>
<p>To read the blockchain, the app sends requests to <code>cirrava.xyz/rpc</code>, which forwards them to Robinhood Chain's public RPC. These requests can contain wallet addresses you are looking up. The proxy does not pass your IP address on to Robinhood Chain and does not log the contents of requests; the request itself appears in the server log described above. Transactions you sign are sent by your own wallet through the network it is configured to use, not by us.</p>

<h2 id="browser">4. Data kept in your browser</h2>
<p>The site stores one value in your browser's local storage: your choice of light or dark theme (<code>cirrava-theme</code>). It never leaves your device. We use no cookies.</p>

<h2 id="third">5. Third-party services</h2>
<p>Loading the site contacts a few other services, which receive your IP address and browser details under their own privacy policies:</p>
<ul>
<li><b>Google Fonts</b> (fonts.googleapis.com, fonts.gstatic.com) for typefaces;</li>
<li><b>jsDelivr</b> (cdn.jsdelivr.net) for open-source JavaScript libraries;</li>
<li>your <b>wallet</b> software and the network it connects to, when you connect or sign.</li>
</ul>
<p>Links to Blockscout, GitHub and X only contact those services if you follow them.</p>

<h2 id="security">6. Security</h2>
<p>The site is served over HTTPS only, with strict security headers. No method of storage or transmission is perfectly secure, but we keep as little as possible so there is little to lose.</p>

<h2 id="rights">7. Your choices and rights</h2>
<p>Depending on where you live, you may have the right to ask what personal data we hold about you, or to have it corrected or deleted. Because we only hold short-lived server logs that are not linked to names or wallets, there is usually nothing we can identify as yours; we will still answer any request. Contact us as described below.</p>

<h2 id="children">8. Children</h2>
<p>Cirrava is not meant for anyone under 18.</p>

<h2 id="changes">9. Changes</h2>
<p>If what we process changes, we will update this page and the date at the top. The full history is <a href="{GH}/commits/main/deploy/make_legal.py" target="_blank" rel="noopener">public</a>.</p>

<h2 id="contact">10. Contact</h2>
<p>Send a direct message to <a href="{X}" target="_blank" rel="noopener">@Cirrava on X</a>.</p>
"""

RISK = f"""
<p class="lead">Lending and borrowing on Cirrava involves serious risk. You can lose some or all of what you deposit or post as collateral. Only use money you can afford to lose, and read this whole page first.</p>
<div class="note">Cirrava's contracts are live on mainnet with real assets and <b>have not been audited</b>. A review is not a guarantee, and neither is public source code.</div>

<h2 id="contracts">1. Smart-contract risk</h2>
<p>The contracts may contain bugs or design flaws that let someone take funds, lock them, or misprice positions. The code is <a href="{GH}" target="_blank" rel="noopener">public</a> and verified, which lets anyone check it, including attackers. The contracts are not upgradeable: a fix means deploying new contracts and moving to them, and funds in the old ones may be affected in the meantime.</p>

<h2 id="admin">2. Admin key risk</h2>
<p>One wallet owns every contract. It can change risk parameters, fees and the interest-rate model, pause markets, add markets to the Earn vault, set caps, move vault liquidity between markets and withdraw protocol reserves. Lowering a liquidation threshold can make positions liquidatable at once, and adding a market lets that wallet route vault deposits to it. If that key is lost, stolen or misused, deposits are at risk. Moving ownership to a multisig is planned but not done.</p>

<h2 id="liquidation">3. Liquidation risk</h2>
<p>If the value of your debt rises above your collateral value times the market's liquidation threshold, anyone can repay part of your debt and take your collateral at a 5% discount. You lose that collateral. Prices can move faster than you can react, and liquidations can happen while you are not watching.</p>

<h2 id="hours">4. Market hours and price gaps</h2>
<p>Stock Token prices follow US stock markets. While the market is closed (nights, weekends, holidays) the price feed stops, and borrowing and liquidations pause. When the market reopens, the price can jump. A position can open the next session already liquidatable, and liquidation can then take more than a normal move would. Market-hours rules are enforced by an on-chain calendar that may contain mistakes.</p>

<h2 id="oracle">5. Oracle risk</h2>
<p>Positions are priced from Chainlink feeds on Robinhood Chain. A feed that is delayed, paused, stale, manipulated or simply wrong can block borrowing, block liquidations or cause unfair ones. Cirrava does not control these feeds.</p>

<h2 id="liquidity">6. Liquidity and withdrawal risk</h2>
<p>Earn vault deposits are lent to borrowers. You can only withdraw USDG that is not lent out. If markets are heavily borrowed, a withdrawal may have to wait until borrowers repay or are liquidated. Interest rates change with utilization and can rise steeply for borrowers.</p>

<h2 id="baddebt">7. Bad debt</h2>
<p>If collateral loses value too fast to be liquidated in time, or liquidations pause during a price move, a position can end up owing more than its collateral is worth. That shortfall is written off and borne by Earn vault depositors.</p>

<h2 id="assets">8. Stock Token and USDG risk</h2>
<p>Stock Tokens are issued by third parties, not by Cirrava, and are not shares: holding one does not give you the rights of a shareholder. Their value depends on the issuer, its custody arrangements and its ability to keep the token tracking the stock. Issuers may pause, freeze, restrict or stop supporting their tokens, and regulators may act against them. USDG is a stablecoin issued by a third party; it can lose its peg, or be frozen or restricted by its issuer.</p>

<h2 id="chain">9. Network risk</h2>
<p>Robinhood Chain may slow down, halt, reorganise or censor transactions, and its fees can change. If it is unavailable, you may be unable to repay or add collateral while liquidations become possible once it resumes.</p>

<h2 id="you">10. Wallet and scam risk</h2>
<p>If your wallet or seed phrase is compromised, your assets can be taken and nobody can reverse that. Scammers impersonate projects with fake websites, fake tokens and direct messages. Only use cirrava.xyz and the addresses in the <a href="/docs/contracts">docs</a>. Cirrava will never ask for your keys or for payment.</p>

<h2 id="token">11. $CIRRAVA token risk</h2>
<p>$CIRRAVA is not connected to the lending protocol and gives no claim on fees, revenue or the team. Its price can be extremely volatile and can fall to zero, and its liquidity can disappear.</p>

<h2 id="legal">12. Legal and tax risk</h2>
<p>Rules for tokenised securities, stablecoins and decentralised lending are unsettled and differ by country. A change in law or enforcement could restrict your access to Cirrava, to Stock Tokens or to USDG, or create tax consequences for you.</p>

<p style="margin-top:40px">More detail on how the protocol behaves is in the <a href="/docs">docs</a>. By using Cirrava you accept these risks and the <a href="/terms">Terms of Use</a>.</p>
"""

BODIES = {"terms": TERMS, "privacy": PRIVACY, "risk": RISK}

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500&family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{{--bg:#FFFBF8;--fg:#24182F;--muted:#6E6175;--line:#EFE3DC;--card:#fff;--accent:#E0664A;--code:#F7EEE9}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#120B22;--fg:#F1EAFB;--muted:#A99CBD;--line:#2A2140;--card:#1A1230;--accent:#F49A7A;--code:#211836}}}}
:root[data-theme="dark"]{{--bg:#120B22;--fg:#F1EAFB;--muted:#A99CBD;--line:#2A2140;--card:#1A1230;--accent:#F49A7A;--code:#211836}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:var(--bg);color:var(--fg);font:15px/1.7 "Inter Tight",system-ui,sans-serif;-webkit-font-smoothing:antialiased}}
a{{color:inherit}}
main a{{color:var(--accent)}}
header{{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:22px;padding:14px 24px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(10px)}}
header .brand{{display:flex;align-items:center;gap:8px;font-weight:600;text-decoration:none}}
header .brand svg{{width:20px;height:20px}}
header nav{{display:flex;gap:16px;font-size:13px;color:var(--muted)}}
header nav a{{text-decoration:none}}header nav a:hover{{color:var(--fg)}}
.wrap{{max-width:760px;margin:0 auto;padding:44px 24px 110px}}
.tabs{{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:30px}}
.tabs a{{font-size:13px;padding:6px 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--muted);background:var(--card)}}
.tabs a:hover{{color:var(--fg);border-color:var(--accent)}}
.tabs a[aria-current]{{color:var(--bg);background:var(--accent);border-color:var(--accent)}}
h1{{font-family:"Bodoni Moda",serif;font-weight:500;font-size:46px;line-height:1.05}}
.updated{{color:var(--muted);font-size:13px;margin:10px 0 26px}}
h2{{font-family:"Bodoni Moda",serif;font-weight:500;font-size:24px;margin:44px 0 8px;scroll-margin-top:80px}}
p{{margin:10px 0}}
ul{{margin:10px 0 10px 22px}}li{{margin:6px 0}}
.lead{{font-size:17px;color:var(--muted)}}
code{{font:13px ui-monospace,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:4px}}
.note{{border-left:3px solid var(--accent);padding:10px 14px;background:var(--code);border-radius:0 8px 8px 0;margin:18px 0;font-size:14px}}
footer{{border-top:1px solid var(--line);padding:22px 24px;text-align:center;font-size:13px;color:var(--muted)}}
footer a{{margin:0 8px;text-decoration:none}}footer a:hover{{color:var(--fg)}}
@media (max-width:640px){{header{{padding:12px 18px;gap:14px}}header nav{{gap:12px}}.wrap{{padding:30px 18px 80px}}h1{{font-size:36px}}}}
</style>
<script>try{{var t=localStorage.getItem('cirrava-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}}catch(e){{}}</script>
</head>
<body>
<header>
  <a class="brand" href="/"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M23.5 9.2A9.5 9.5 0 1 0 23.5 22.8" fill="none" stroke="#E0664A" stroke-width="5.2" stroke-linecap="round"/><circle cx="25.2" cy="16" r="2.6" fill="#E0664A"/></svg>Cirrava</a>
  <nav><a href="/docs">Docs</a><a href="/app/earn">App</a><a href="{x}" target="_blank" rel="noopener me">X ↗</a></nav>
</header>
<div class="wrap">
  <nav class="tabs" aria-label="Legal">{tabs}</nav>
  <main>
  <h1>{h1}</h1>
  <p class="updated">Last updated {updated}</p>
{body}
  </main>
</div>
<footer><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/risk">Risks</a><a href="/docs">Docs</a><a href="{gh}" target="_blank" rel="noopener">GitHub</a></footer>
</body>
</html>
"""

for slug, (h1, title) in PAGES.items():
    tabs = "".join(
        f'<a href="/{s}"{" aria-current=\"page\"" if s == slug else ""}>{h}</a>' for s, (h, _) in PAGES.items()
    )
    out = SHELL.format(title=title, h1=h1, updated=UPDATED, body=BODIES[slug].strip("\n"), tabs=tabs, x=X, gh=GH)
    (ROOT / f"{slug}.html").write_text(out, encoding="utf-8", newline="\n")
    print(f"{slug}.html")
