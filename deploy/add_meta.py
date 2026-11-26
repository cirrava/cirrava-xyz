"""Inserts favicon, web-manifest and link-preview (Open Graph / Twitter) tags into every page.
Idempotent: replaces its own block between the <!-- meta:start --> / <!-- meta:end --> markers.

  python deploy/add_meta.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://cirrava.xyz"
IMAGE = f"{SITE}/og.png"
IMAGE_ALT = "Cirrava, lending market for Stock Tokens, live on Robinhood Chain"

PAGES = {
    "index.html": ("Cirrava | Lending market for Stock Tokens",
                   "Borrow USDG against NVDA, SPY, TSLA and AAPL Stock Tokens on Robinhood Chain, or lend USDG in the Earn vault. Isolated markets that follow US market hours.",
                   "/"),
    "docs.html": ("Cirrava Docs",
                  "How Cirrava works: isolated Stock Token markets, the USDG Earn vault, market hours, risks and every contract address on Robinhood Chain.",
                  "/docs"),
    "app/index.html": ("Cirrava App | Lend and borrow against Stock Tokens",
                       "Earn on USDG or borrow against NVDA, SPY, TSLA and AAPL Stock Tokens on Robinhood Chain. Live prices, market hours and positions.",
                       "/app/earn"),
    "404.html": ("Page not found | Cirrava", None, None),
}

ICONS = """  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#E0664A">"""


def block(title, desc, path):
    if desc is None:
        return f"<!-- meta:start -->\n{ICONS}\n<!-- meta:end -->"
    t, d, url = html.escape(title, quote=True), html.escape(desc, quote=True), SITE + path
    return f"""<!-- meta:start -->
  <link rel="canonical" href="{url}">
{ICONS}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Cirrava">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{d}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{IMAGE}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{html.escape(IMAGE_ALT, quote=True)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@Cirrava">
  <meta name="twitter:title" content="{t}">
  <meta name="twitter:description" content="{d}">
  <meta name="twitter:image" content="{IMAGE}">
  <meta name="twitter:image:alt" content="{html.escape(IMAGE_ALT, quote=True)}">
<!-- meta:end -->"""


for rel, (title, desc, path) in PAGES.items():
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"\n?<!-- meta:start -->.*?<!-- meta:end -->", "", s, flags=re.S)
    if desc:  # keep the plain description in sync with the preview text
        s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(desc, quote=True)}">', s, count=1)
    anchor = re.search(r'<meta name="description"[^>]*>|<title>[^<]*</title>', s)
    s = s[: anchor.end()] + "\n" + block(title, desc, path) + s[anchor.end():]
    p.write_text(s, encoding="utf-8")
    print(f"{rel:16} ok  ({'full preview' if desc else 'icons only'})")
