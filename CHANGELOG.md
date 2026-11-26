# Changelog

Notable changes to Cirrava's contracts, app and website. Dates are UTC.

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
