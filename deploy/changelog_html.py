"""Publishes CHANGELOG.md as the Changelog section of docs.html (/docs/changelog), so the dated
changelog lives on cirrava.xyz itself as well as on GitHub.

  python deploy/changelog_html.py
"""
import html
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
md = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8").replace("\r\n", "\n")
START, END = "<!-- changelog:start -->", "<!-- changelog:end -->"


def inline(text):
    """Escape, then render `code`, **bold**, [text](url) and bare /docs/… paths."""
    out, i = [], 0
    for m in re.finditer(r"\[([^\]]+)\]\(([^)]+)\)", text):
        out.append(("t", text[i:m.start()]))
        out.append(("a", m.group(1), m.group(2)))
        i = m.end()
    out.append(("t", text[i:]))

    def fmt(s):
        s = html.escape(s, quote=False)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
        s = re.sub(r"(?<![\w/.])(/docs/[a-z0-9-]+)", r'<a href="\1">\1</a>', s)
        return s

    res = []
    for part in out:
        if part[0] == "t":
            res.append(fmt(part[1]))
        else:
            label, url = part[1], part[2]
            ext = url.startswith("http") and "cirrava.xyz" not in url
            attrs = ' target="_blank" rel="noopener"' if ext else ""
            res.append(f'<a href="{html.escape(url)}"{attrs}>{fmt(label)}</a>')
    return "".join(res)


entries = []  # (iso date, title, [bullets])
for block in re.split(r"\n(?=## )", md):
    m = re.match(r"## (\d{4}-\d{2}-\d{2}) — (.+)", block)
    if not m:
        continue
    bullets, cur = [], None
    for line in block.split("\n")[1:]:
        if line.startswith("- "):
            cur = line[2:].strip()
            bullets.append(cur)
        elif line.startswith("  ") and bullets:
            bullets[-1] += " " + line.strip()
    entries.append((m.group(1), m.group(2).strip(), bullets))

seen = {}
parts = [START, '  <h2 id="changelog">Changelog</h2>',
         '  <p>Every notable change to Cirrava\'s contracts, app and website, newest first. Dates are UTC. The same log is in the '
         '<a href="https://github.com/cirrava/cirrava-xyz/blob/main/CHANGELOG.md" target="_blank" rel="noopener">repository</a>.</p>']
for iso, title, bullets in entries:
    d = date.fromisoformat(iso)
    slug = "cl-" + iso + "-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:48].strip("-")
    seen[slug] = seen.get(slug, 0) + 1
    if seen[slug] > 1:
        slug += f"-{seen[slug]}"
    lis = "".join(f"<li>{inline(b)}</li>" for b in bullets)
    parts.append(f'  <article class="cl" id="{slug}"><h3><time datetime="{iso}">{d.day} {d:%B %Y}</time> · {inline(title)}</h3><ul>{lis}</ul></article>')
parts.append(END)
block = "\n".join(parts) + "\n\n"

p = ROOT / "docs.html"
s = p.read_text(encoding="utf-8").replace("\r\n", "\n")
if START in s:
    i, j = s.index(START), s.index(END) + len(END)
    while s[j:j + 1] == "\n":
        j += 1
    s = s[:i] + block + s[j:]
else:
    anchor = '  <h2 id="blog">Blog</h2>'
    s = s.replace(anchor, block + anchor, 1)
p.write_text(s, encoding="utf-8", newline="\n")
print(f"changelog: {len(entries)} entries")
