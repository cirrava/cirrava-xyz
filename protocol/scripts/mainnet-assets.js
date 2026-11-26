// Robinhood Chain mainnet assets Cirrava uses. Tokens are issued by Robinhood/Paxos and feeds by
// Chainlink — Cirrava deploys none of these. Addresses were taken from public docs and are checked
// on-chain by scripts/verify-mainnet.js before every deploy (symbol, decimals, feed description, freshness).
module.exports = {
  chainId: 4663,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  usdg: { token: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", feed: "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2", decimals: 6 },
  markets: [
    { symbol: "NVDA", name: "NVIDIA", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", ltv: 0.6, lt: 0.65 },
    { symbol: "SPY", name: "SPDR S&P 500 ETF", token: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A", ltv: 0.7, lt: 0.75 },
    { symbol: "TSLA", name: "Tesla", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", feed: "0x4A1166a659A55625345e9515b32adECea5547C38", ltv: 0.45, lt: 0.5 },
    { symbol: "AAPL", name: "Apple", token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0", ltv: 0.6, lt: 0.65 },
  ],
  // Phase 03 markets, added to the live vault by scripts/add-markets.js. Each token shares the official
  // Robinhood Stock Token deployer (0x4783…C046) and beacon implementation with the tokens above; each
  // feed is a Chainlink EACAggregatorProxy from the same deployer and owner as the feeds above.
  newMarkets: [
    { symbol: "MSFT", name: "Microsoft", token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E", ltv: 0.6, lt: 0.65 },
    { symbol: "QQQ", name: "Invesco QQQ", token: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae", ltv: 0.7, lt: 0.75 },
    { symbol: "GOOGL", name: "Alphabet Class A", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b", ltv: 0.6, lt: 0.65 },
    { symbol: "AMZN", name: "Amazon", token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C", ltv: 0.6, lt: 0.65 },
  ],
  // 24/7 markets: same Stock Tokens, priced by Chainlink's "Robinhood X (24/7)" feeds (same deployer and owner
  // as the feeds above). Their oracle has NO exchange calendar: a price counts as fresh while the feed updated
  // within `window` seconds, weekends included; otherwise borrowing and liquidations pause. Off-hours prices are
  // thinner, so LTVs are lower, the liquidation bonus higher and the cap smaller than the regular markets.
  markets247: [
    { symbol: "NVDA", hours: "24/7", name: "NVIDIA", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", feed: "0xFE941871d8c2AC48C70A62f864De47090Ef8171d", ltv: 0.5, lt: 0.55, bonus: 0.075, window: 3 * 3600, cap: "5000" },
    { symbol: "TSLA", hours: "24/7", name: "Tesla", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", feed: "0x39eDf5ef54150A30d2C4F1b982FbB8f93050BC37", ltv: 0.35, lt: 0.4, bonus: 0.075, window: 3 * 3600, cap: "5000" },
    { symbol: "GOOGL", hours: "24/7", name: "Alphabet Class A", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", feed: "0xf7FE6f0Af535f2c1c20Ab6cEB1fa46777c2e1B4E", ltv: 0.5, lt: 0.55, bonus: 0.075, window: 3 * 3600, cap: "5000" },
  ],
};
