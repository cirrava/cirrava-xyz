"""Local preview server that behaves like the production nginx config:
clean routes (/docs/<section>, /app/<tab>), the /rpc proxy (forwarded to cirrava.xyz/rpc), 404.html.
No security headers, so pages can be framed for layout testing.

  python deploy/dev_server.py [port]      (serves the project folder, default port 5321)
"""
import http.server
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5321
UPSTREAM_RPC = "https://cirrava.xyz/rpc"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == "/docs" or p.startswith("/docs/"):
            path = "/docs.html"
        elif p in ("/terms", "/privacy"):
            path = p + ".html"
        elif p.startswith("/app/") and not Path(ROOT, p.lstrip("/")).is_file():
            path = "/app/index.html"
        return super().translate_path(path)

    def send_error(self, code, message=None, explain=None):
        if code == 404 and (ROOT / "404.html").exists():
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def do_POST(self):
        if self.path.split("?")[0] != "/rpc":
            return self.send_error(405)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        req = urllib.request.Request(UPSTREAM_RPC, data=body, headers={"Content-Type": "application/json", "User-Agent": "cirrava-dev"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # noqa: BLE001
            self.send_error(502, str(e))

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"Cirrava dev server on http://localhost:{PORT}")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
