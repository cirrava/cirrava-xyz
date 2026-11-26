"""Builds cirrava-site.tar.gz: the site, its nginx config and install.sh, ready to upload to the VPS.

  python deploy/package.py
"""
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "cirrava-site.tar.gz"


def add(tar, src: Path, arc: str, mode=None):
    info = tar.gettarinfo(str(src), arcname=arc)
    if mode is not None:
        info.mode = mode
    if src.is_file():
        data = src.read_bytes()
        if src.suffix in (".sh", ".conf"):
            data = data.replace(b"\r\n", b"\n")  # Windows line endings break bash/nginx
        info.size = len(data)
        import io
        tar.addfile(info, io.BytesIO(data))
    else:
        tar.addfile(info)


def main():
    subprocess.run([sys.executable, str(ROOT / "deploy" / "build.py")], check=True)
    with tarfile.open(OUT, "w:gz") as tar:
        add(tar, ROOT / "deploy" / "install.sh", "cirrava/install.sh", 0o755)
        for conf in ("cirrava.xyz.conf", "cirrava-rpc.conf", "cirrava-routes.conf", "cirrava-ratelimit.conf"):
            add(tar, ROOT / "deploy" / "nginx" / conf, f"cirrava/nginx/{conf}", 0o644)
        for p in sorted((ROOT / "dist").rglob("*")):
            if p.is_file():
                add(tar, p, "cirrava/site/" + p.relative_to(ROOT / "dist").as_posix(), 0o644)
    print(f"{OUT.name}: {OUT.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
