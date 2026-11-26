#!/usr/bin/env bash
# Pasang / update Cirrava di VPS. Jalankan DI DALAM VPS, dari folder hasil ekstrak paket:
#   sudo bash install.sh                 → pasang/update situs (HTTP)
#   sudo bash install.sh email@kamu.com  → sekalian pasang HTTPS (Let's Encrypt)
# Aman untuk situs lain di VPS yang sama: hanya menambah server block cirrava.xyz,
# dan semua perubahan nginx dites dulu — kalau gagal, dikembalikan seperti semula.
set -euo pipefail

EMAIL="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WEBROOT=/var/www/cirrava
CONF=/etc/nginx/sites-available/cirrava.xyz
LINK=/etc/nginx/sites-enabled/cirrava.xyz
SNIPPET=/etc/nginx/snippets/cirrava-rpc.conf
ROUTES=/etc/nginx/snippets/cirrava-routes.conf
ZONE=/etc/nginx/conf.d/cirrava-ratelimit.conf

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo:  sudo bash install.sh"; exit 1; }
[ -f "$HERE/site/index.html" ] || { echo "Folder site/ tidak ditemukan di $HERE"; exit 1; }

echo "1/4  Memasang paket yang dibutuhkan (nginx, certbot, rsync)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx rsync >/dev/null

echo "2/4  Menyalin situs ke $WEBROOT…"
mkdir -p "$WEBROOT"
rsync -a --delete "$HERE/site/" "$WEBROOT/"
chown -R www-data:www-data "$WEBROOT"

echo "3/4  Konfigurasi nginx untuk cirrava.xyz…"
BK="$(mktemp -d)"
for f in "$CONF" "$SNIPPET" "$ROUTES" "$ZONE"; do
  if [ -f "$f" ]; then cp "$f" "$BK/$(basename "$f")"; fi
done
had_link=0
if [ -L "$LINK" ]; then had_link=1; fi
restore() {
  echo "!!   Konfigurasi gagal dites. Mengembalikan seperti semula supaya situs lain tetap aman."
  for f in "$CONF" "$SNIPPET" "$ROUTES" "$ZONE"; do
    if [ -f "$BK/$(basename "$f")" ]; then cp "$BK/$(basename "$f")" "$f"; else rm -f "$f"; fi
  done
  if [ "$had_link" -ne 1 ]; then rm -f "$LINK"; fi
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx; fi
  exit 1
}

mkdir -p /etc/nginx/snippets
cp "$HERE/nginx/cirrava-rpc.conf" "$SNIPPET"
cp "$HERE/nginx/cirrava-routes.conf" "$ROUTES"
cp "$HERE/nginx/cirrava-ratelimit.conf" "$ZONE"
if [ -f "$CONF" ] && grep -q "listen 443" "$CONF"; then
  echo "     Konfigurasi HTTPS sudah ada — dipertahankan."
  # add each snippet right after the site's root line (the HTTPS block certbot created), once
  for inc in "$SNIPPET" "$ROUTES"; do
    if ! grep -qF "include $inc;" "$CONF"; then
      sed -i "s#^\([[:space:]]*\)root /var/www/cirrava;#&\n\1include $inc;#" "$CONF"
      echo "     Ditambahkan: $(basename "$inc")"
    fi
  done
else
  cp "$HERE/nginx/cirrava.xyz.conf" "$CONF"
fi
ln -sf "$CONF" "$LINK"
if ! nginx -t 2>/tmp/cirrava-nginx-test.log; then cat /tmp/cirrava-nginx-test.log; restore; fi
systemctl reload nginx
rm -rf "$BK"

echo "4/4  HTTPS…"
if grep -q "listen 443" "$CONF"; then
  echo "     Sudah aktif."
elif [ -n "$EMAIL" ]; then
  certbot --nginx -d cirrava.xyz -d www.cirrava.xyz --redirect --agree-tos -m "$EMAIL" -n
else
  echo "     Belum dipasang. Jalankan lagi dengan email:  sudo bash install.sh email@kamu.com"
fi

echo
echo "Selesai. Cek: curl -I https://cirrava.xyz"
