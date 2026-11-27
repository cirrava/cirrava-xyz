# Cirrava

Borrow against Stock Tokens without selling them. Cirrava is a lending market on
[Robinhood Chain](https://robinhoodchain.blockscout.com) (chain ID 4663): post a Robinhood Stock Token
(NVDA, SPY, TSLA, AAPL, MSFT, QQQ, GOOGL, AMZN) as collateral and borrow USDG, or deposit USDG into the Earn vault and earn
what borrowers pay. Borrowing and liquidations follow US market hours on-chain: they pause while the
exchange is closed, and repaying, adding collateral and vault withdrawals never do.

- Website: https://cirrava.xyz
- App: https://cirrava.xyz/app
- Docs: https://cirrava.xyz/docs
- X: https://x.com/Cirrava

> **Not audited.** The contracts are live on mainnet with real assets and have not been audited.
> One wallet owns every contract. Read the [risks](https://cirrava.xyz/docs/risks) before you deposit.
> HEY Research Lab did a free security review in Nov 2026 (not an audit); its one Low finding is fixed in v2.

## Repository

| Path | What it is |
|---|---|
| [`protocol/contracts`](protocol/contracts) | Solidity contracts (the code deployed on mainnet) |
| [`protocol/test`](protocol/test) | Hardhat tests |
| [`protocol/scripts`](protocol/scripts) | Deploy, verification and read-only inspection scripts |
| [`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json) | Every live mainnet address |
| `index.html`, `docs.html`, [`app/`](app) | The website, docs and dApp served at cirrava.xyz |
| [`deploy/`](deploy) | Static build and nginx config for the site |

## Live contracts (Robinhood Chain mainnet, v2 deployed 27 Nov 2026)

| Contract | Address |
|---|---|
| EarnVault (cvUSDG) | [`0xd1251c9402fDb71C95B766BE425E9a0076de0Ac8`](https://robinhoodchain.blockscout.com/address/0xd1251c9402fDb71C95B766BE425E9a0076de0Ac8) |
| LendingMarket NVDA/USDG | [`0x1B170dD830b046888BF43AAd9fd1F4840cedB13e`](https://robinhoodchain.blockscout.com/address/0x1B170dD830b046888BF43AAd9fd1F4840cedB13e) |
| LendingMarket SPY/USDG | [`0x3A346a9a07F459965199cFcFaf71e100221b211B`](https://robinhoodchain.blockscout.com/address/0x3A346a9a07F459965199cFcFaf71e100221b211B) |
| LendingMarket TSLA/USDG | [`0x48e2F4799Bf02d27Cc65A3B2a412196843d22315`](https://robinhoodchain.blockscout.com/address/0x48e2F4799Bf02d27Cc65A3B2a412196843d22315) |
| LendingMarket AAPL/USDG | [`0xA0c9Faa385b41152d4a510895dd8EDeCFE8395A5`](https://robinhoodchain.blockscout.com/address/0xA0c9Faa385b41152d4a510895dd8EDeCFE8395A5) |
| LendingMarket MSFT/USDG | [`0xDa98311B28afAbC00FCAcDcFe91a1BB09Cee8d09`](https://robinhoodchain.blockscout.com/address/0xDa98311B28afAbC00FCAcDcFe91a1BB09Cee8d09) |
| LendingMarket QQQ/USDG | [`0x6529AD756F6440Ad1d4e28634C8C343BecDF1801`](https://robinhoodchain.blockscout.com/address/0x6529AD756F6440Ad1d4e28634C8C343BecDF1801) |
| LendingMarket GOOGL/USDG | [`0xB429f7bd2b0A44B33547cd006A022912B1291E54`](https://robinhoodchain.blockscout.com/address/0xB429f7bd2b0A44B33547cd006A022912B1291E54) |
| LendingMarket AMZN/USDG | [`0xB5c8F355b5DD08cac975259C833964600F617fed`](https://robinhoodchain.blockscout.com/address/0xB5c8F355b5DD08cac975259C833964600F617fed) |
| LendingMarket NVDA 24/7/USDG | [`0x4535041bCD7350166b7D4AbE80651fFdB67EeB7F`](https://robinhoodchain.blockscout.com/address/0x4535041bCD7350166b7D4AbE80651fFdB67EeB7F) |
| LendingMarket TSLA 24/7/USDG | [`0xE029Ddf8fDf72771D363848F86c0bFF04d7e658f`](https://robinhoodchain.blockscout.com/address/0xE029Ddf8fDf72771D363848F86c0bFF04d7e658f) |
| LendingMarket GOOGL 24/7/USDG | [`0x532e2032b24e19B45E90abaF77Af2BbB09B93366`](https://robinhoodchain.blockscout.com/address/0x532e2032b24e19B45E90abaF77Af2BbB09B93366) |
| MarketCalendar | [`0x13C77954bE518078Bb88a3A144A06246484Db946`](https://robinhoodchain.blockscout.com/address/0x13C77954bE518078Bb88a3A144A06246484Db946) |
| InterestRateModel | [`0x667db67029E681420Ba684a073b7Eb9E52103Cb3`](https://robinhoodchain.blockscout.com/address/0x667db67029E681420Ba684a073b7Eb9E52103Cb3) |
| StockOracle USDG | [`0xB40b5bc73CA6d05Cb4bbEF38c3A66F2B6Ac33C54`](https://robinhoodchain.blockscout.com/address/0xB40b5bc73CA6d05Cb4bbEF38c3A66F2B6Ac33C54) |
| Owner & treasury | [`0xa319B076571a93C345Eb61Ec5131364dE81D0BA1`](https://robinhoodchain.blockscout.com/address/0xa319B076571a93C345Eb61Ec5131364dE81D0BA1) |
| $CIRRAVA token | [`0x0267939aCc8C236e0eB2bd425c026c9180e7446A`](https://robinhoodchain.blockscout.com/address/0x0267939aCc8C236e0eB2bd425c026c9180e7446A) |

**Source verified:** all 26 contracts are an exact match on [Sourcify](https://repo.sourcify.dev/4663/0xd1251c9402fDb71C95B766BE425E9a0076de0Ac8)
(chain 4663). [`protocol/verification`](protocol/verification) has the standard-JSON input and a script that
compares the live bytecode with this source.

Per-market Stock Token, Chainlink feed and oracle addresses are in
[`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json). The retired v1 deployment
(21 Nov 2026, replaced before it held any deposits; every v1 market paused with a cap of 0) is recorded in
[`protocol/deployments/robinhood-v1.json`](protocol/deployments/robinhood-v1.json).

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
