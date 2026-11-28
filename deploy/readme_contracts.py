"""Rewrites the contract tables in README.md and protocol/verification/README.md from the deployment record
(protocol/deployments/robinhood.json), and leaves protocol/verification/standard-input.json alone.

  python deploy/readme_contracts.py
"""
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
dep = json.loads((ROOT / "protocol" / "deployments" / "robinhood.json").read_text(encoding="utf-8"))
v1 = json.loads((ROOT / "protocol" / "deployments" / "robinhood-v1.json").read_text(encoding="utf-8"))
gov = json.loads((ROOT / "protocol" / "deployments" / "governance.json").read_text(encoding="utf-8"))
ex = dep["explorer"]
CIRRAVA = "0x0267939aCc8C236e0eB2bd425c026c9180e7446A"
d = date.fromisoformat(dep["deployedAt"][:10])
v2_date = f"{d.day} {d:%b %Y}"


def label(m):
    return m["symbol"] + (" 24/7" if m.get("hours") == "24/7" else "")


def link(addr):
    return f"[`{addr}`]({ex}/address/{addr})"


def between(text, start, end, new):
    i, j = text.index(start), text.index(end)
    return text[:i] + new + text[j:]


# ---- README.md
rows = [("EarnVault (cvUSDG)", dep["vault"])]
rows += [(f"LendingMarket {label(m)}/USDG", m["market"]) for m in dep["markets"]]
rows += [("MarketCalendar", dep["calendar"]), ("InterestRateModel", dep["irm"]), ("StockOracle USDG", dep["usdg"]["oracle"]),
         ("Owner: CirravaTimelock (48h)", gov["timelock"]), (f"Cirrava Safe ({gov['threshold']} of {len(gov['owners'])}): proposer, pauser, treasury", gov["safe"]),
         ("$CIRRAVA token", CIRRAVA)]
n_contracts = 4 + 2 * len(dep["markets"])  # calendar, irm, vault, usdg oracle + oracle/market per market
live = f"""## Live contracts (Robinhood Chain mainnet, v2 deployed {v2_date})

| Contract | Address |
|---|---|
""" + "\n".join(f"| {n} | {link(a)} |" for n, a in rows) + f"""

**Source verified:** all {n_contracts} contracts are an exact match on [Sourcify](https://repo.sourcify.dev/4663/{dep["vault"]})
(chain 4663). [`protocol/verification`](protocol/verification) has the standard-JSON input and a script that
compares the live bytecode with this source.

Per-market Stock Token, Chainlink feed and oracle addresses are in
[`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json). The retired v1 deployment
(21 Nov 2026, replaced before it held any deposits; every v1 market paused with a cap of 0) is recorded in
[`protocol/deployments/robinhood-v1.json`](protocol/deployments/robinhood-v1.json).

"""
p = ROOT / "README.md"
s = p.read_text(encoding="utf-8").replace("\r\n", "\n")
s = between(s, "## Live contracts", "## Build and test the contracts", live)
s = s.replace(
    "> One wallet owns every contract. Read the [risks](https://cirrava.xyz/docs#risks) before you deposit.",
    "> Every contract is owned by a 48-hour timelock controlled by the Cirrava Safe multisig. Read the [risks](https://cirrava.xyz/docs/risks) before you deposit.\n"
    "> HEY Research Lab did a free security review in Nov 2026 (not an audit); its one Low finding is fixed in v2.",
)
p.write_text(s, encoding="utf-8", newline="\n")

# ---- protocol/verification/README.md
vrows = [("MarketCalendar", dep["calendar"]), ("InterestRateModel", dep["irm"]), ("EarnVault", dep["vault"]),
         ("StockOracle USDG", dep["usdg"]["oracle"])]
for m in dep["markets"]:
    vrows += [(f"StockOracle {label(m)}", m["oracle"]), (f"LendingMarket {label(m)}", m["market"])]
vrows += [("CirravaTimelock (owner of all of the above)", gov["timelock"])]
table = f"""# Source verification

All {len(vrows)} live Cirrava contracts (v2 and the timelock that owns them) are verified on **Sourcify** as an **exact match** (same source and
compiler metadata), on Robinhood Chain (chain ID 4663):

| Contract | Address | Sourcify |
|---|---|---|
""" + "\n".join(f"| {n} | `{a}` | [view](https://repo.sourcify.dev/4663/{a}) |" for n, a in vrows) + "\n\n"
p = ROOT / "protocol" / "verification" / "README.md"
s = p.read_text(encoding="utf-8").replace("\r\n", "\n")
s = between(s, "# Source verification", "## Check it yourself", table)
p.write_text(s, encoding="utf-8", newline="\n")

# standard-input.json is NOT regenerated here: it must stay the exact compiler input of the deployed build
# (see protocol/verification/README.md). Replace it by hand only after a redeploy, from that build.
print(f"README: {len(rows)} rows | verification: {len(vrows)} contracts")
