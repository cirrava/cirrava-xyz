# Cirrava protocol

Lending market for Stock Tokens: an ERC-4626 **Earn vault** lends USDG to isolated **markets**,
each taking one Stock Token as collateral. Prices come from Chainlink-style feeds classified against
**US market hours** on-chain, so borrowing and liquidations pause while the exchange is closed and
risk-reducing actions (repay, add collateral, vault withdrawals) never do.

> **Live on Robinhood Chain mainnet since 21 Nov 2026, not audited.** Addresses are in
> [`deployments/robinhood.json`](deployments/robinhood.json). The sections below cover running it locally.

## Contracts

| Contract | Role |
|---|---|
| `MarketCalendar` | NYSE session 09:30–16:00 New York, automatic DST, owner-set holidays/early closes |
| `StockOracle` | Wraps a feed → `Fresh` / `MarketClosed` / `Stale` / `Invalid` / `Paused` |
| `InterestRateModel` | Kinked utilization curve (2% base, +8% to 80% util, +100% above) |
| `LendingMarket` | One collateral, borrow USDG; LTV, liquidation threshold + bonus, 0.1% borrow fee, reserves, bad-debt write-off, pauser |
| `EarnVault` | ERC-4626 (`cvUSDG`), the only lender to every market, per-market caps |
| `mocks/MockERC20`, `mocks/MockAggregator` | Test tokens with a faucet; feeds the keeper writes real prices into |

## Run it locally

```powershell
cd protocol
npm install --legacy-peer-deps
npx hardhat test                                   # 13 tests
npx hardhat node                                   # terminal 1: local chain (keep it running)
npx hardhat run scripts/deploy.js --network localhost   # terminal 2: deploy + write ../app/deployment.js
npx hardhat run scripts/keeper.js --network localhost   # terminal 3: push real prices every 30s
npx hardhat run scripts/status.js --network localhost   # optional: print live state
```

Then serve the site and open the app:

```powershell
python -m http.server 5318   # from the repository root
```
`http://localhost:5318/app/` → **Use local test account** (Hardhat's public test key, local chain only)
or connect MetaMask to `http://127.0.0.1:8545`, chain id 31337.

Restarting `npx hardhat node` wipes the chain, so run `deploy.js` again afterwards.

### Weekend testing
Real prices mean real market hours: on weekends every market is `MarketClosed` and borrowing is paused.
To try borrowing anyway on a local chain, deploy with market hours ignored:
```powershell
$env:DEMO_24_7="1"; npx hardhat run scripts/deploy.js --network localhost; Remove-Item Env:DEMO_24_7
```

## Testnet
Set your own RPC and a throwaway deployer key in the shell (never commit them), then:
```powershell
$env:RPC_URL="https://<testnet rpc>"; $env:DEPLOYER_KEY="0x<test key>"
npx hardhat run scripts/deploy.js --network testnet
npx hardhat run scripts/keeper.js --network testnet
```
The keeper must keep running for feeds to stay fresh. On a real deployment, replace `MockAggregator`
with the chain's Chainlink feeds and `MockERC20` with the real tokens, and get an audit first.

## Price source
`scripts/lib/prices.js` reads Yahoo Finance quotes (price + exchange trade time). On mainnet the
protocol would read Chainlink directly; the keeper exists only because test networks have no equity feeds.
