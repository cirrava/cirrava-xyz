# Source verification

All 20 live Cirrava contracts are verified on **Sourcify** as an **exact match** (same source and
compiler metadata), on Robinhood Chain (chain ID 4663):

| Contract | Address | Sourcify |
|---|---|---|
| MarketCalendar | `0x13C77954bE518078Bb88a3A144A06246484Db946` | [view](https://repo.sourcify.dev/4663/0x13C77954bE518078Bb88a3A144A06246484Db946) |
| InterestRateModel | `0x667db67029E681420Ba684a073b7Eb9E52103Cb3` | [view](https://repo.sourcify.dev/4663/0x667db67029E681420Ba684a073b7Eb9E52103Cb3) |
| EarnVault | `0xfF2F860F2eBFe6E615f8f27563f2684334D5de24` | [view](https://repo.sourcify.dev/4663/0xfF2F860F2eBFe6E615f8f27563f2684334D5de24) |
| StockOracle USDG | `0xAa2cFF138aeAB9d204eae2406cE1E295deFa22CC` | [view](https://repo.sourcify.dev/4663/0xAa2cFF138aeAB9d204eae2406cE1E295deFa22CC) |
| StockOracle NVDA | `0x14bD0ec2B8A8e4023D6C663ee600c54BC155cB04` | [view](https://repo.sourcify.dev/4663/0x14bD0ec2B8A8e4023D6C663ee600c54BC155cB04) |
| LendingMarket NVDA | `0x95477C96CB4dFA66b2baCA583e09eb676FEe0aE4` | [view](https://repo.sourcify.dev/4663/0x95477C96CB4dFA66b2baCA583e09eb676FEe0aE4) |
| StockOracle SPY | `0x1963ee19E294B9EBc681092aE116EC51e9A7d976` | [view](https://repo.sourcify.dev/4663/0x1963ee19E294B9EBc681092aE116EC51e9A7d976) |
| LendingMarket SPY | `0x13EFa3249eA871B0f3fB014386312061D3248620` | [view](https://repo.sourcify.dev/4663/0x13EFa3249eA871B0f3fB014386312061D3248620) |
| StockOracle TSLA | `0x7db44E20D0624371919535130CEEB8eB9763655B` | [view](https://repo.sourcify.dev/4663/0x7db44E20D0624371919535130CEEB8eB9763655B) |
| LendingMarket TSLA | `0xc28c3C4a75590F22B9C97D550b2AC2Bf28603971` | [view](https://repo.sourcify.dev/4663/0xc28c3C4a75590F22B9C97D550b2AC2Bf28603971) |
| StockOracle AAPL | `0x72AC37a2F20cA55892e8f8fDb4758068F5d12AC8` | [view](https://repo.sourcify.dev/4663/0x72AC37a2F20cA55892e8f8fDb4758068F5d12AC8) |
| LendingMarket AAPL | `0xf8452a202b36dcDBb5da1b45A5fB1b5653295886` | [view](https://repo.sourcify.dev/4663/0xf8452a202b36dcDBb5da1b45A5fB1b5653295886) |
| StockOracle MSFT | `0x95a530eeeBE6BC5D5Bb761656fB8B91cd4Be315c` | [view](https://repo.sourcify.dev/4663/0x95a530eeeBE6BC5D5Bb761656fB8B91cd4Be315c) |
| LendingMarket MSFT | `0xd60213409B692911F34f72FeF15DFa160a3216ec` | [view](https://repo.sourcify.dev/4663/0xd60213409B692911F34f72FeF15DFa160a3216ec) |
| StockOracle QQQ | `0x414fC6b34a47BfDF00ED0C0EAaB57Cde841Dc406` | [view](https://repo.sourcify.dev/4663/0x414fC6b34a47BfDF00ED0C0EAaB57Cde841Dc406) |
| LendingMarket QQQ | `0x5779B8b6D7b8007D85308dE5bcE32481E6fCFf65` | [view](https://repo.sourcify.dev/4663/0x5779B8b6D7b8007D85308dE5bcE32481E6fCFf65) |
| StockOracle GOOGL | `0xe9a85ff6d1fB76Ac2c6a312377F3F89B5FC7CA5C` | [view](https://repo.sourcify.dev/4663/0xe9a85ff6d1fB76Ac2c6a312377F3F89B5FC7CA5C) |
| LendingMarket GOOGL | `0x8E5C541120E2B1F9a908cf21d106Acfd697002E3` | [view](https://repo.sourcify.dev/4663/0x8E5C541120E2B1F9a908cf21d106Acfd697002E3) |
| StockOracle AMZN | `0x917944A698abfa202bDbbce4759ee5Bf8A215D1c` | [view](https://repo.sourcify.dev/4663/0x917944A698abfa202bDbbce4759ee5Bf8A215D1c) |
| LendingMarket AMZN | `0x1Fa8085Cd0685f05B04FD0389E3d0E67bbC4e831` | [view](https://repo.sourcify.dev/4663/0x1Fa8085Cd0685f05B04FD0389E3d0E67bbC4e831) |

## Check it yourself

`standard-input.json` is the exact Solidity standard-JSON input the deployed code was compiled from
(solc `0.8.24+commit.e11b9ed9`, optimizer 200 runs, `viaIR`, `evmVersion: shanghai`).

```bash
cd protocol
npm install --legacy-peer-deps
npx hardhat compile
node scripts/match-bytecode.js      # compares runtime bytecode at every live address with this build
```

`match-bytecode.js` masks immutable values (set by constructors) and compares everything else,
including the metadata hash, so a pass means the live code was built from these exact source files.

To verify on Blockscout manually: **Verify & publish → Solidity (Standard JSON input)**, compiler
`v0.8.24+commit.e11b9ed9`, upload `standard-input.json`, and pick the contract name from the table above.
