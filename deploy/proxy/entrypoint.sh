#!/bin/sh
# Tulis daftar replika web dari KIRA_WEB_REPLICAS lalu jalankan Caddy.
# Nama kontainer replika: <proyek>-web-<n> (Docker Compose), bisa dijangkau lewat DNS jaringan internal.
set -eu
: "${KIRA_PROJECT:?}"
n="${KIRA_WEB_REPLICAS:-4}"
line="to"
i=1
while [ "$i" -le "$n" ]; do
  line="$line ${KIRA_PROJECT}-web-$i:3000"
  i=$((i + 1))
done
echo "$line" > /tmp/upstreams.caddy
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
