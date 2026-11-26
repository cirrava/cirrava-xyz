// Looks up each token's icon on the Robinhood Chain explorer (Blockscout) and downloads it.
//   node scripts/token-icons.js [outDir]
const fs = require("fs");
const path = require("path");
const A = require("./mainnet-assets");

const UA = { "User-Agent": "Mozilla/5.0 (cirrava-site-build)", accept: "application/json" };

(async () => {
  const out = process.argv[2] || path.join(__dirname, "..", "token-icons");
  fs.mkdirSync(out, { recursive: true });
  const tokens = [{ symbol: "USDG", token: A.usdg.token }, ...A.markets];
  for (const t of tokens) {
    try {
      const r = await fetch(`${A.explorer}/api/v2/tokens/${t.token}`, { headers: UA });
      const d = await r.json();
      const url = d.icon_url;
      console.log(`${t.symbol.padEnd(5)} ${r.status} name="${d.name}" icon=${url || "-"}`);
      if (!url) continue;
      const img = await fetch(url, { headers: { "User-Agent": UA["User-Agent"] } });
      const type = img.headers.get("content-type") || "";
      const ext = type.includes("svg") ? "svg" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("jpeg") ? "jpg" : path.extname(new URL(url).pathname).slice(1) || "img";
      const buf = Buffer.from(await img.arrayBuffer());
      fs.writeFileSync(path.join(out, `${t.symbol.toLowerCase()}.${ext}`), buf);
      console.log(`      saved ${t.symbol.toLowerCase()}.${ext} (${buf.length} bytes, ${type})`);
    } catch (e) {
      console.log(`${t.symbol}: ${e.message}`);
    }
  }
})();
