#!/bin/sh
# Cadangan database harian (pg_dump format custom) setiap pukul 02.00 WIB.
# Simpan 14 cadangan harian dan 8 cadangan mingguan (salinan hari Minggu) di /backups.
# Status terakhir ditulis ke /backups/status.json dan ditampilkan di konsol (Pengaturan).
# Jalankan sekarang juga: docker compose exec backup /backup.sh now
set -eu
: "${DATABASE_URL_OWNER:?wajib diisi}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
export PGSSLMODE=verify-full
export PGSSLROOTCERT=/certs/ca.crt
mkdir -p /backups/daily /backups/weekly

write_status() {
  printf '{"lastAt":"%s","lastSize":%s,"lastFile":"%s","ok":%s,"error":%s}\n' "$1" "$2" "$3" "$4" "$5" > /backups/status.json.tmp
  mv /backups/status.json.tmp /backups/status.json
}

prune() {
  dir="$1"; keep="$2"
  ls -1t "$dir"/kira-*.dump 2>/dev/null | tail -n +"$((keep + 1))" | while read -r f; do rm -f "$f"; done
}

run_backup() {
  stamp=$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)
  file="/backups/daily/kira-$stamp.dump"
  if pg_dump --format=custom --compress=6 --no-owner --file="$file.part" "$DATABASE_URL_OWNER"; then
    mv "$file.part" "$file"
    size=$(stat -c %s "$file")
    if [ "$(TZ=Asia/Jakarta date +%u)" = "7" ]; then cp "$file" "/backups/weekly/kira-$stamp.dump"; fi
    prune /backups/daily "$KEEP_DAILY"
    prune /backups/weekly "$KEEP_WEEKLY"
    write_status "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$size" "$(basename "$file")" true null
    echo "Cadangan selesai: $(basename "$file") ($size byte)"
  else
    rm -f "$file.part"
    write_status "$(date -u +%Y-%m-%dT%H:%M:%SZ)" 0 "" false '"pg_dump gagal, lihat log layanan backup"'
    echo "Cadangan gagal." >&2
  fi
}

if [ "${1:-}" = "now" ]; then
  run_backup
  exit 0
fi

echo "Layanan cadangan aktif: setiap hari 02.00 WIB, simpan $KEEP_DAILY harian dan $KEEP_WEEKLY mingguan."
# Server mati saat jadwal: buat cadangan sekarang bila cadangan terakhir lebih dari 26 jam lalu.
last=$(sed -n 's/.*"lastAt":"\([^"]*\)".*/\1/p' /backups/status.json 2>/dev/null || true)
last_s=$( [ -n "$last" ] && date -u -d "$last" +%s 2>/dev/null || echo 0 )
if [ $(( $(date -u +%s) - last_s )) -gt 93600 ]; then
  sleep 30
  run_backup || true
fi
while true; do
  now=$(date -u +%s)
  # 02.00 WIB = 19.00 UTC hari sebelumnya.
  next=$(( (now / 86400) * 86400 + 19 * 3600 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  sleep $(( next - now ))
  run_backup || true
done
