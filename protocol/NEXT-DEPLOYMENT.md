# Notes for the next deployment

Informational notes from HEY Research Lab's retest of v2 (476434a). None affects funds today; each needs new
contracts, so they wait for the next deployment.

1. **Status check: decode failures revert instead of reading `Paused`.** `StockOracle._tokenPaused()` uses `try`,
   which catches a revert from the token but not an answer that is not a `bool`, an empty answer or a token without
   code. In those cases `latest()` reverts: borrowing and liquidation still refuse (fail-closed) and exits stay open,
   but the `positionOf()` / `marketInfo()` views revert too. Robinhood's tokens answer correctly today.
   Fix: a low-level `staticcall` with a return-length check, so all three cases read `Paused`.
2. **Use the same Chainlink proxy kind for every feed.** NVDA 24/7 and GOOGL 24/7 read Chainlink's secondary proxy;
   TSLA 24/7 and every other feed read the primary. Both proxies of each feed point at the same aggregator and
   return the same answer and timestamp (only round ids differ, which the oracle ignores). Pick one kind consistently.
