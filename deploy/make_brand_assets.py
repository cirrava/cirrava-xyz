"""Generates Cirrava's favicons, app icons, web manifest and the 1200x630 link-preview image.

  python deploy/make_brand_assets.py <fonts_dir>

<fonts_dir> must contain bodoni.ttf (Bodoni Moda 500) and inter.ttf (Inter Tight 500).
Outputs go to the site root: favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png,
icon-192.png, icon-512.png, site.webmanifest, og.png
"""
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "deploy" / "fonts"
CORAL = (224, 102, 74)
CORAL_LIGHT = (243, 154, 122)
CREAM = (255, 240, 230)
PLUM = (42, 30, 69)


# ---------------------------------------------------------------- the mark (open "C" + dot)
MARK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#E0664A"/>
  <path d="M22.4 10.2A8 8 0 1 0 22.4 21.8" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>
  <circle cx="24" cy="16" r="2.2" fill="#fff"/>
</svg>
"""


def draw_mark(size, bg=True, radius=7 / 32, pad=0.0):
    """Raster version of MARK_SVG, drawn 4x and downsampled for clean edges."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=CORAL + (255,))
    k = S / 32 * (1 - 2 * pad)
    off = S * pad
    cx, cy, r, w = off + 16 * k, off + 16 * k, 8 * k, 4.4 * k
    # arc from the upper-right end, round the left side, to the lower-right end
    a = math.degrees(math.atan2(5.8, 6.4))  # endpoints (22.4, 10.2) and (22.4, 21.8) around (16,16)
    box = [cx - r, cy - r, cx + r, cy + r]
    d.arc(box, start=a, end=360 - a, fill=(255, 255, 255, 255), width=int(round(w)))
    for ang in (a, -a):  # round caps
        x = cx + r * math.cos(math.radians(ang)) - w / 2 * math.cos(math.radians(ang))
        y = cy + r * math.sin(math.radians(ang)) - w / 2 * math.sin(math.radians(ang))
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=(255, 255, 255, 255))
    dot_r = 2.2 * k
    dx, dy = off + 24 * k, off + 16 * k
    d.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- link preview
def puff(r):
    """One cloud puff: bright, fairly solid core with a soft edge (like the site's cloud sprites)."""
    s = int(r * 2)
    p = Image.new("L", (s, s), 0)
    pd = ImageDraw.Draw(p)
    for i in range(int(r), 0, -1):
        t = i / r
        a = 255 if t < 0.62 else int(255 * (1 - (t - 0.62) / 0.38) ** 1.6)
        pd.ellipse([r - i, r - i, r + i, r + i], fill=a)
    return p


def clouds(w, h, seed=7):
    """Cumulus bank in the lower part of the image, puffy tops, warm undersides."""
    rnd = random.Random(seed)
    alpha = Image.new("L", (w, h), 0)
    banks = [(0.08, 0.95, 170, 18), (0.33, 0.9, 190, 22), (0.62, 0.93, 200, 22), (0.92, 0.9, 170, 18), (0.5, 1.02, 300, 26)]
    for bx, by, spread, n in banks:
        for _ in range(n):
            ox = rnd.gauss(0, spread)
            arch = math.exp(-(ox / spread) ** 2)  # taller in the middle of each bank
            r = rnd.uniform(45, 85) * (0.7 + 0.6 * arch)
            x = bx * w + ox
            y = by * h - arch * rnd.uniform(70, 140) + rnd.gauss(0, 12)
            m = Image.new("L", (w, h), 0)
            m.paste(puff(r), (int(x - r), int(y - r)))
            alpha = ImageChops.lighter(alpha, m)  # union of puffs
    alpha = alpha.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.93))
    layer = Image.new("RGBA", (w, h), (255, 245, 238, 255))
    layer.putalpha(alpha)
    # warm shading on the underside
    shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(h):
        t = max(0.0, (y / h - 0.65) / 0.35)
        sd.line([(0, y), (w, y)], fill=(150, 60, 50, int(70 * t)))
    shaded = Image.alpha_composite(layer, Image.composite(shade, Image.new("RGBA", (w, h)), layer.split()[3]))
    return shaded


def og_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), CORAL)
    d = ImageDraw.Draw(img)
    for y in range(H):  # sky: slightly lighter toward the horizon
        t = y / H
        c = tuple(int(CORAL[i] + (CORAL_LIGHT[i] - CORAL[i]) * t * 0.55) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    # soft sun glow behind the title
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W / 2 - 330, 40, W / 2 + 330, 420], fill=(255, 214, 190, 70))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(80)))
    img = Image.alpha_composite(img, clouds(W, H))
    d = ImageDraw.Draw(img)

    serif = ImageFont.truetype(str(FONTS / "bodoni.ttf"), 150)
    serif_sub = ImageFont.truetype(str(FONTS / "bodoni.ttf"), 40)
    sans = ImageFont.truetype(str(FONTS / "inter.ttf"), 24)

    def centered(text, font, y, fill, shadow=True):
        x = (W - d.textlength(text, font=font)) / 2
        if shadow:
            sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(sh).text((x, y + 3), text, font=font, fill=(120, 40, 25, 70))
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
        d.text((x, y), text, font=font, fill=fill)

    centered("Cirrava", serif, 120, (255, 255, 255, 255))
    centered("Lending market for Stock Tokens", serif_sub, 305, (255, 248, 242, 255))

    # pill: what is live
    label = "NVDA  ·  SPY  ·  TSLA  ·  AAPL     Live on Robinhood Chain"
    tw = d.textlength(label, font=sans)
    px, py, ph = (W - tw) / 2 - 28, 392, 54
    pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(pill)
    pdraw.rounded_rectangle([px, py + 6, px + tw + 56, py + ph + 6], radius=ph / 2, fill=(110, 40, 30, 70))
    img.alpha_composite(pill.filter(ImageFilter.GaussianBlur(8)))
    pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle([px, py, px + tw + 56, py + ph], radius=ph / 2,
                                           fill=(214, 92, 66, 245), outline=(255, 255, 255, 170), width=2)
    img.alpha_composite(pill)
    d.text(((W - tw) / 2, py + (ph - 30) / 2), label, font=sans, fill=(255, 255, 255, 255))

    # the site's thin frame + mark + domain
    d.rectangle([18, 18, W - 19, H - 19], outline=(255, 255, 255, 190), width=2)
    img.alpha_composite(draw_mark(64), (48, 46))
    dom = ImageFont.truetype(str(FONTS / "inter.ttf"), 26)
    d.text((W - 48 - d.textlength("cirrava.xyz", font=dom), 64), "cirrava.xyz", font=dom, fill=(255, 255, 255, 235))
    return img.convert("RGB")


def main():
    (ROOT / "favicon.svg").write_text(MARK_SVG, encoding="utf-8")
    draw_mark(32).save(ROOT / "favicon-32.png")
    draw_mark(48).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # iOS draws its own rounded corners: give it a full square
    draw_mark(180, radius=0).save(ROOT / "apple-touch-icon.png")
    draw_mark(192).save(ROOT / "icon-192.png")
    draw_mark(512).save(ROOT / "icon-512.png")
    (ROOT / "site.webmanifest").write_text(json.dumps({
        "name": "Cirrava",
        "short_name": "Cirrava",
        "description": "Lending market for Stock Tokens on Robinhood Chain",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#E0664A",
        "theme_color": "#E0664A",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }, indent=2), encoding="utf-8")
    og_image().save(ROOT / "og.png", optimize=True)
    for f in ["favicon.svg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest", "og.png"]:
        print(f"{f:22} {(ROOT / f).stat().st_size:>8} bytes")


if __name__ == "__main__":
    main()
