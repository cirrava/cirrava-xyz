#!/usr/bin/env bash
# Adds the Phase 03 markets (MSFT, QQQ, GOOGL, AMZN) to the live Cirrava vault.
# Asks for the OWNER wallet's private key without showing it.
#   bash scripts/run-add-markets.sh        → checks only (nothing sent)
#   bash scripts/run-add-markets.sh add    → real transactions on Robinhood Chain mainnet
# The key lives only inside this process: not on screen, not in shell history, gone when it exits.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Tempel private key wallet OWNER (0xa319…0BA1) — Ctrl+Shift+V atau klik kanan → Paste, lalu Enter."
echo "Tidak ada yang tampil saat menempel — itu normal."
printf "> "
IFS= read -rs KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
KEY="${KEY#0x}"
if ! [[ "$KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Key tidak valid: terbaca ${#KEY} karakter (harus 64 karakter hex)."
  exit 1
fi
echo "Key diterima."
export DEPLOYER_KEY="0x$KEY"
unset KEY

if [ "${1:-}" = "add" ]; then
  echo
  echo "Ini TRANSAKSI SUNGGUHAN di Robinhood Chain mainnet (memakai ETH untuk gas, tidak bisa dibatalkan)."
  read -rp "Ketik  ADD  untuk lanjut: " ok
  [ "$ok" = "ADD" ] || { echo "Dibatalkan."; exit 1; }
  CONFIRM_MAINNET=yes npx hardhat run scripts/add-markets.js --network robinhood
else
  npx hardhat run scripts/add-markets.js --network robinhood
fi
