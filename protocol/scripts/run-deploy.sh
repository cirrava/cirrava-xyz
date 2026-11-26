#!/usr/bin/env bash
# Asks for the deployer private key without showing it, then runs the mainnet deploy script.
#   bash scripts/run-deploy.sh           → checks only (nothing deployed)
#   bash scripts/run-deploy.sh deploy    → real deploy on Robinhood Chain mainnet
# The key lives only inside this process: not on screen, not in shell history, gone when it exits.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Tempel private key wallet deploy (Ctrl+Shift+V atau klik kanan → Paste), lalu Enter."
echo "Tidak ada yang tampil saat menempel — itu normal."
printf "> "
IFS= read -rs KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
KEY="${KEY#0x}"
if ! [[ "$KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Key tidak valid: terbaca ${#KEY} karakter (harus 64 karakter hex)."
  echo "Kalau 0: tempelannya tidak masuk — pakai Ctrl+Shift+V atau klik kanan → Paste."
  echo "Kalau 40: itu alamat wallet, bukan private key."
  exit 1
fi
echo "Key diterima (64 karakter)."
export DEPLOYER_KEY="0x$KEY"
unset KEY

if [ "${1:-}" = "deploy" ]; then
  echo
  echo "Ini DEPLOY SUNGGUHAN ke Robinhood Chain mainnet (memakai ETH untuk gas, tidak bisa dibatalkan)."
  read -rp "Ketik  DEPLOY  untuk lanjut: " ok
  [ "$ok" = "DEPLOY" ] || { echo "Dibatalkan."; exit 1; }
  CONFIRM_MAINNET=yes npx hardhat run scripts/deploy-mainnet.js --network robinhood
else
  npx hardhat run scripts/deploy-mainnet.js --network robinhood
fi
