# Cirrava

Borrow against Stock Tokens without selling them. Cirrava is a lending market on
[Robinhood Chain](https://robinhoodchain.blockscout.com) (chain ID 4663): post a Robinhood Stock Token
(NVDA, SPY, TSLA, AAPL) as collateral and borrow USDG, or deposit USDG into the Earn vault and earn
what borrowers pay. Borrowing and liquidations follow US market hours on-chain: they pause while the
exchange is closed, and repaying, adding collateral and vault withdrawals never do.

- Website: https://cirrava.xyz
- App: https://cirrava.xyz/app
- Docs: https://cirrava.xyz/docs
- X: https://x.com/Cirrava

> **Not audited.** The contracts are live on mainnet with real assets and have not been audited.
> One wallet owns every contract. Read the [risks](https://cirrava.xyz/docs#risks) before you deposit.

## Repository

| Path | What it is |
|---|---|
| [`protocol/contracts`](protocol/contracts) | Solidity contracts (the code deployed on mainnet) |
| [`protocol/test`](protocol/test) | Hardhat tests |
| [`protocol/scripts`](protocol/scripts) | Deploy, verification and read-only inspection scripts |
| [`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json) | Every live mainnet address |
| `index.html`, `docs.html`, [`app/`](app) | The website, docs and dApp served at cirrava.xyz |
| [`deploy/`](deploy) | Static build and nginx config for the site |

## Live contracts (Robinhood Chain mainnet, deployed 21 Nov 2026)

| Contract | Address |
|---|---|
| EarnVault (cvUSDG) | [`0xfF2F860F2eBFe6E615f8f27563f2684334D5de24`](https://robinhoodchain.blockscout.com/address/0xfF2F860F2eBFe6E615f8f27563f2684334D5de24) |
| LendingMarket NVDA/USDG | [`0x95477C96CB4dFA66b2baCA583e09eb676FEe0aE4`](https://robinhoodchain.blockscout.com/address/0x95477C96CB4dFA66b2baCA583e09eb676FEe0aE4) |
| LendingMarket SPY/USDG | [`0x13EFa3249eA871B0f3fB014386312061D3248620`](https://robinhoodchain.blockscout.com/address/0x13EFa3249eA871B0f3fB014386312061D3248620) |
| LendingMarket TSLA/USDG | [`0xc28c3C4a75590F22B9C97D550b2AC2Bf28603971`](https://robinhoodchain.blockscout.com/address/0xc28c3C4a75590F22B9C97D550b2AC2Bf28603971) |
| LendingMarket AAPL/USDG | [`0xf8452a202b36dcDBb5da1b45A5fB1b5653295886`](https://robinhoodchain.blockscout.com/address/0xf8452a202b36dcDBb5da1b45A5fB1b5653295886) |
| MarketCalendar | [`0x13C77954bE518078Bb88a3A144A06246484Db946`](https://robinhoodchain.blockscout.com/address/0x13C77954bE518078Bb88a3A144A06246484Db946) |
| InterestRateModel | [`0x667db67029E681420Ba684a073b7Eb9E52103Cb3`](https://robinhoodchain.blockscout.com/address/0x667db67029E681420Ba684a073b7Eb9E52103Cb3) |
| StockOracle USDG | [`0xAa2cFF138aeAB9d204eae2406cE1E295deFa22CC`](https://robinhoodchain.blockscout.com/address/0xAa2cFF138aeAB9d204eae2406cE1E295deFa22CC) |
| Owner & treasury | [`0xa319B076571a93C345Eb61Ec5131364dE81D0BA1`](https://robinhoodchain.blockscout.com/address/0xa319B076571a93C345Eb61Ec5131364dE81D0BA1) |
| $CIRRAVA token | [`0x0267939aCc8C236e0eB2bd425c026c9180e7446A`](https://robinhoodchain.blockscout.com/address/0x0267939aCc8C236e0eB2bd425c026c9180e7446A) |

**Source verified:** all 12 contracts are an exact match on [Sourcify](https://repo.sourcify.dev/4663/0xfF2F860F2eBFe6E615f8f27563f2684334D5de24)
(chain 4663). [`protocol/verification`](protocol/verification) has the standard-JSON input and a script that
compares the live bytecode with this source.

Per-market Stock Token, Chainlink feed and oracle addresses are in
[`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json).

## Build and test the contracts

```bash
cd protocol
npm install --legacy-peer-deps
npx hardhat test
```

Compiler: Solidity 0.8.24, optimizer 200 runs, `viaIR: true`, `evmVersion: shanghai`
(see [`protocol/hardhat.config.js`](protocol/hardhat.config.js)).

## Security

Found a vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md).

## Changes

See [CHANGELOG.md](CHANGELOG.md).
