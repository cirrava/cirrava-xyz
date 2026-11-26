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
};
