// Price keeper: pushes REAL market prices into the test feeds, with the real trade timestamp.
// Outside US market hours the last trade is Friday's close, so the contracts correctly see
// MarketClosed and pause borrowing/liquidations — exactly what would happen on mainnet.
//   npx hardhat run scripts/keeper.js --network localhost
// Optional: KEEPER_INTERVAL=30 (seconds), KEEPER_ONCE=1 (single run)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { quotes } = require("./lib/prices");

const P8 = (x) => ethers.parseUnits(Number(x).toFixed(8), 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const interval = Number(process.env.KEEPER_INTERVAL || 30) * 1000;
  const feed = (addr) => ethers.getContractAt("MockAggregator", addr);
  const usdgFeed = await feed(dep.usdg.feed);
  const feeds = await Promise.all(dep.markets.map((m) => feed(m.feed)));
  console.log(`Keeper on ${network.name}: ${dep.markets.map((m) => m.symbol).join(", ")} every ${interval / 1000}s`);

  for (;;) {
    try {
      const chainNow = (await ethers.provider.getBlock("latest")).timestamp;
      const live = await quotes(dep.markets.map((m) => m.yahoo));
      for (let i = 0; i < dep.markets.length; i++) {
        const m = dep.markets[i];
        const q = live[m.yahoo];
        const t = Math.min(q.time, chainNow);
        const last = Number(await feeds[i].updatedAt());
        if (t > last) {
          await (await feeds[i].push(P8(q.price), t)).wait();
          console.log(`${new Date().toISOString()}  ${m.symbol} $${q.price} @ ${new Date(t * 1000).toISOString()}`);
        }
      }
      // USDG is a 24/7 dollar stablecoin: refresh its $1.00 heartbeat every 30 minutes
      if (chainNow - Number(await usdgFeed.updatedAt()) > 1800) await (await usdgFeed.push(P8(1), chainNow)).wait();
    } catch (e) {
      console.error(`${new Date().toISOString()}  keeper error: ${e.message}`);
    }
    if (process.env.KEEPER_ONCE === "1") break;
    await sleep(interval);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
