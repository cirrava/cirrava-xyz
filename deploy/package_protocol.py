"""Builds cirrava-protocol.tar.gz: contracts, tests and scripts for running on the VPS.
No node_modules, build output, deployments or secrets.

  python deploy/package_protocol.py
"""
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "protocol"
OUT = ROOT / "cirrava-protocol.tar.gz"
INCLUDE = ["contracts", "scripts", "test", "hardhat.config.js", "package.json", "package-lock.json", "README.md"]


def main():
    with tarfile.open(OUT, "w:gz") as tar:
        for item in INCLUDE:
            p = SRC / item
            files = [p] if p.is_file() else sorted(x for x in p.rglob("*") if x.is_file())
            for f in files:
                data = f.read_bytes()
                if f.suffix in (".js", ".sol", ".json", ".md", ".sh"):
                    data = data.replace(b"\r\n", b"\n")
                info = tarfile.TarInfo("cirrava-protocol/" + f.relative_to(SRC).as_posix())
                info.size, info.mode, info.mtime = len(data), 0o644, int(f.stat().st_mtime)
                tar.addfile(info, io.BytesIO(data))
    print(f"{OUT.name}: {OUT.stat().st_size / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
