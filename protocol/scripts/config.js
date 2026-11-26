// Markets Cirrava deploys. `yahoo` is the ticker the keeper reads real prices from.
const MARKETS = [
  { symbol: "NVDA", name: "NVIDIA", yahoo: "NVDA", ltv: 0.6, lt: 0.65 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", yahoo: "SPY", ltv: 0.7, lt: 0.75 },
  { symbol: "TSLA", name: "Tesla", yahoo: "TSLA", ltv: 0.45, lt: 0.5 },
  { symbol: "AAPL", name: "Apple", yahoo: "AAPL", ltv: 0.6, lt: 0.65 },
];

// NYSE full-day closures and 13:00 early closes (New York dates).
const HOLIDAYS = [
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
  "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05",
  "2027-09-06", "2027-11-25", "2027-12-24",
];
const EARLY_CLOSES = ["2026-11-27", "2026-12-24", "2027-11-26"];

const nyDayNumber = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);

module.exports = { MARKETS, HOLIDAYS, EARLY_CLOSES, nyDayNumber };
