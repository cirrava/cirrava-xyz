# Changelog

Notable changes to Cirrava's contracts, app and website. Dates are UTC.

## 2026-11-28 — Roadmap: $CIRRAVA staking planned

- Planned: $CIRRAVA staking as a first-loss safety layer for the Earn vault (design draft at /docs/staking;
  nothing built or deployed yet).
- Roadmap order: Phase 03 staking, Phase 04 independent audit.

## 2026-11-27 — v2: security fix and 24/7 markets

- **Security (GHSA-7hw7-pqjf-gcxx, Low):** `StockOracle` did not read a Robinhood Stock Token's `oraclePaused()`
  flag, which Robinhood sets while it processes a corporate action (split, reverse split, dividend through the
  multiplier). A wrongly scaled answer in that window could have let healthy positions be liquidated cheaply or a
  market's cash be borrowed against inflated collateral. `StockOracle` now takes the token and returns `Paused`
  while `oraclePaused()` or `paused()` is set (fail-closed). No funds were ever at risk: the vault was empty.
  Reported privately by HEY Research Lab (@HeyResearch) in a free security review (not an audit).
- Contracts are not upgradeable, so Cirrava was redeployed as **v2**: new Earn vault
  [`0xd1251c9402fDb71C95B766BE425E9a0076de0Ac8`](https://robinhoodchain.blockscout.com/address/0xd1251c9402fDb71C95B766BE425E9a0076de0Ac8), new oracles and markets; the market calendar and
  interest-rate model are reused. All 26 v2 contracts are verified on Sourcify (exact match).
- **v1 retired:** every v1 market is paused with a cap of 0 in the v1 vault
  (record in `protocol/deployments/robinhood-v1.json`).
- **Retest:** HEY Research Lab retested the fix against the deployed v2 contracts at `476434a`: fixed, all 26
  contracts match the commit, no new findings at Low or above.
- **24/7 markets** for NVDA, TSLA and GOOGL, priced by Chainlink's 24/7 feeds: open whenever the price updated
  within 3 hours, weekends included; LTV 50% / 55% (TSLA 35% / 40%), 7.5% liquidation bonus, 5,000 USDG cap.

## 2026-11-26 — Four new markets

- Added MSFT, QQQ, GOOGL and AMZN markets to the live Earn vault (cap 10,000 USDG each); the vault now
  supplies eight markets. Same contract code as the first four, verified on Sourcify (exact match).
- Owner admin page (/app/admin) to add markets with a browser wallet, and `protocol/scripts/add-markets.js`
  for the command line.

## 2026-11-26 — Legal pages

- Added Terms of Use (/terms) and Privacy Policy (/privacy), linked from the site footer, docs and app.
  Risks stay in the docs (/docs/risks).

## 2026-11-26 — Source published

- Published the contracts, tests, scripts, website and app source on GitHub.
- Added a security policy (private vulnerability reporting) and this changelog.
- Verified the source of all 12 live contracts on Sourcify (exact match) and added
  `protocol/scripts/match-bytecode.js`, which checks live bytecode against this repository.
- $CIRRAVA token linked on the website and in the docs:
  [`0x0267939aCc8C236e0eB2bd425c026c9180e7446A`](https://robinhoodchain.blockscout.com/address/0x0267939aCc8C236e0eB2bd425c026c9180e7446A)
  (ERC-20, 18 decimals, 1,000,000,000 supply, no owner, not upgradeable).

## 2026-11-22 — Website and app

- Real-time app at cirrava.xyz/app: Earn, Borrow, Portfolio and Status read live data from Robinhood Chain.
- Docs regenerated from the deployment record, with every address linked to the explorer.
- Blog posts on launch, market hours and position health.

## 2026-11-21 — Mainnet launch

- Deployed to Robinhood Chain mainnet (chain ID 4663):
  EarnVault (cvUSDG), LendingMarket for NVDA, SPY, TSLA and AAPL against USDG, MarketCalendar,
  InterestRateModel and StockOracle wrappers around Chainlink feeds.
- Cap of 10,000 USDG per market. Addresses in [`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json).
