"""Rewrites every internal link to clean, hash-free paths:
  docs.html#how → /docs/how   app/#earn → /app/earn   docs.html → /docs   index.html / '#' (home) → /
and adds the small router that makes /docs/<section> scroll to its section.
Idempotent. Run after editing pages:  python deploy/clean_urls.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_VIEWS = ("earn", "borrow", "portfolio", "status")


def fix_href(h):
    if h.startswith(("http", "mailto:", "/")):
        return h
    if h in ("#", "#top", "index.html", "./"):
        return "/"
    m = re.fullmatch(r"(?:\./)?app/#(\w+)", h)
    if m and m.group(1) in APP_VIEWS:
        return f"/app/{m.group(1)}"
    if h in ("app/", "app"):
        return "/app/earn"
    m = re.fullmatch(r"docs\.html(?:#([\w-]+))?", h)
    if m:
        return "/docs" + (f"/{m.group(1)}" if m.group(1) and m.group(1) != "top" else "")
    return h


def rewrite_links(text, docs_page=False):
    def repl(m):
        h = m.group(2)
        if docs_page and re.fullmatch(r"#[\w-]+", h):  # in-page anchors inside docs
            h = "/docs" if h == "#top" else "/docs/" + h[1:]
        return f'{m.group(1)}"{fix_href(h)}"'
    text = re.sub(r'(href=)"([^"]*)"', repl, text)
    # links that live inside JS data (feature cards, blog posts)
    text = re.sub(r"href:'([^']*)'", lambda m: f"href:'{fix_href(m.group(1))}'", text)
    return text


DOCS_ROUTER = """<script>
/* Clean section URLs: /docs/<section> scrolls to that section; old #anchors are upgraded. */
(() => {
  const ids = new Set([...document.querySelectorAll("[id]")].map((e) => e.id));
  const show = (id, smooth) => {
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    else if (!id) scrollTo(0, 0);
  };
  const fromPath = () => location.pathname.replace(/\\/+$/, "").split("/docs/")[1] || "";
  const paths = location.protocol.startsWith("http") && location.pathname.startsWith("/docs");
  if (paths && location.hash && ids.has(location.hash.slice(1))) history.replaceState(null, "", "/docs/" + location.hash.slice(1));
  addEventListener("load", () => show(paths ? fromPath() : location.hash.slice(1)));
  addEventListener("popstate", () => show(fromPath(), true));
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="/docs"]');
    if (!a || !paths || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const id = a.getAttribute("href").replace(/^\\/docs\\/?/, "");
    if (id && !ids.has(id)) return;
    e.preventDefault();
    history.pushState(null, "", a.getAttribute("href"));
    show(id, true);
  });
})();
</script>
"""


def main():
    for rel, is_docs in (("index.html", False), ("docs.html", True), ("404.html", False)):
        p = ROOT / rel
        s = rewrite_links(p.read_text(encoding="utf-8"), docs_page=is_docs)
        if is_docs:
            s = re.sub(r"<script>\n/\* Clean section URLs.*?</script>\n", "", s, flags=re.S)
            s = s.replace("</body>", DOCS_ROUTER + "</body>")
        p.write_text(s, encoding="utf-8")
        left = re.findall(r'href="(#[^"]*|[^"/:][^"]*#[^"]*)"', s) + re.findall(r"href:'([^']*#[^']*)'", s)
        print(f"{rel:11} hash links left: {left or 'none'}")


if __name__ == "__main__":
    main()
