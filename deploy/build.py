"""Builds dist/ — exactly the files the public server needs.

  python deploy/build.py

- Leaves out protocol/ (contracts, node_modules), editor/agent folders and art/paintings.js
  (the 1.8 MB embedded copy only matters when the page is opened straight from disk).
- Ships app/deployment.js only when it points at a public chain; a localhost deployment would
  make visitors' browsers try to reach their own 127.0.0.1, so the app shows "not live yet" instead.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

FILES = ["index.html", "docs.html", "404.html", "terms.html", "privacy.html", "robots.txt", "sitemap.xml",
         "art/monet-impression-sunrise.jpg", "art/turner-fighting-temeraire.jpg",
         "app/index.html", "app/app.js",
         "art/tokens/nvda.svg", "art/tokens/spy.svg", "art/tokens/tsla.svg", "art/tokens/aapl.svg", "art/tokens/msft.svg", "art/tokens/qqq.svg", "art/tokens/googl.svg", "art/tokens/amzn.svg",
         "art/tokens/usdg.png", "art/tokens/robinhood-token.png",
         "favicon.ico", "favicon.svg", "favicon-32.png", "apple-touch-icon.png",
         "icon-192.png", "icon-512.png", "site.webmanifest", "og.png"]


def optimise_jpg(src: Path, dst: Path, width=1400, quality=80):
    """Shrink paintings for the web (originals stay untouched); falls back to a plain copy."""
    try:
        from PIL import Image
    except ImportError:
        shutil.copy2(src, dst)
        return
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)


def public_deployment():
    f = ROOT / "app" / "deployment.js"
    if not f.exists():
        return False
    m = re.search(r"window\.CIRRAVA_DEPLOYMENT\s*=\s*(\{.*\});", f.read_text(encoding="utf-8"), re.S)
    if not m:
        return False
    dep = json.loads(m.group(1))
    return dep.get("chainId") not in (31337, 1337) and "127.0.0.1" not in dep.get("rpcUrl", "") and "localhost" not in dep.get("rpcUrl", "")


def main():
    # empty dist/ but keep the folder itself (a preview server may be serving from it)
    DIST.mkdir(exist_ok=True)
    for p in DIST.iterdir():
        shutil.rmtree(p) if p.is_dir() else p.unlink()
    for rel in FILES:
        src, dst = ROOT / rel, DIST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if rel.startswith("art/") and rel.endswith(".jpg"):
            optimise_jpg(src, dst)
        else:
            shutil.copy2(src, dst)

    idx = DIST / "index.html"
    idx.write_text(idx.read_text(encoding="utf-8").replace('<script src="art/paintings.js"></script>\n', ""), encoding="utf-8")

    ship_dep = public_deployment()
    app = DIST / "app" / "index.html"
    if ship_dep:
        shutil.copy2(ROOT / "app" / "deployment.js", DIST / "app" / "deployment.js")
    else:
        app.write_text(app.read_text(encoding="utf-8").replace('<script src="deployment.js"></script>\n', ""), encoding="utf-8")

    # cache-busting: JS is cached for an hour, so stamp each reference with a hash of the file's content
    import hashlib
    html = app.read_text(encoding="utf-8")
    for js in ("app.js", "deployment.js"):
        f = DIST / "app" / js
        if f.exists():
            v = hashlib.sha256(f.read_bytes()).hexdigest()[:10]
            html = html.replace(f'src="{js}"', f'src="{js}?v={v}"')
    app.write_text(html, encoding="utf-8")

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print(f"dist/ ready: {sum(1 for p in DIST.rglob('*') if p.is_file())} files, {total / 1e6:.2f} MB")
    print("app: " + ("live deployment included" if ship_dep else "no public deployment -> shows 'not live yet'"))


if __name__ == "__main__":
    main()
