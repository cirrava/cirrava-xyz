// Real market quotes for the keeper and deploy script.
// Source: Yahoo Finance chart endpoint (no key). Returns the last trade price and the
// exchange timestamp of that trade, so on weekends you get Friday's close and Friday's time.

async function quote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (cirrava-keeper)" } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const meta = (await res.json())?.chart?.result?.[0]?.meta;
  if (!meta || !(meta.regularMarketPrice > 0)) throw new Error(`${symbol}: no price`);
  return { symbol, price: meta.regularMarketPrice, time: meta.regularMarketTime, currency: meta.currency };
}

async function quotes(symbols) {
  const out = {};
  for (const s of symbols) out[s] = await quote(s);
  return out;
}

module.exports = { quote, quotes };
