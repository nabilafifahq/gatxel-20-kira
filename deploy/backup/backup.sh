#!/bin/sh
# Cadangan database harian (pg_dump format custom) setiap pukul 02.00 WIB.
# Selama pilot: cadangan per jam juga dibuat (BACKUP_HOURLY=on, simpan BACKUP_KEEP_HOURLY, bawaan 48 jam).
# Salinan terenkripsi (AES-256, openssl) ke lokasi kedua bila /offsite terpasang dan BACKUP_PASSPHRASE diisi
# (KIRA_BACKUP_OFFSITE_DIR di host dipasang ke /offsite). Uji pemulihan: /restore-test.sh.
# Simpan 14 cadangan harian dan 8 cadangan mingguan (salinan hari Minggu) di /backups.
# Status terakhir ditulis ke /backups/status.json dan ditampilkan di konsol (Pengaturan).
# Jalankan sekarang juga: docker compose exec backup /backup.sh now
set -eu
: "${DATABASE_URL_OWNER:?wajib diisi}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
export PGSSLMODE="${PGSSLMODE:-verify-full}"
export PGSSLROOTCERT="${PGSSLROOTCERT:-/certs/ca.crt}"
KEEP_HOURLY="${BACKUP_KEEP_HOURLY:-48}"
KEEP_OFFSITE="${BACKUP_KEEP_OFFSITE:-72}"
HOURLY="${BACKUP_HOURLY:-on}"
mkdir -p /backups/daily /backups/weekly /backups/hourly

write_status() {
  printf '{"lastAt":"%s","lastSize":%s,"lastFile":"%s","ok":%s,"error":%s}\n' "$1" "$2" "$3" "$4" "$5" > /backups/status.json.tmp
  mv /backups/status.json.tmp /backups/status.json
}

prune() {
  dir="$1"; keep="$2"
  ls -1t "$dir"/kira-*.dump 2>/dev/null | tail -n +"$((keep + 1))" | while read -r f; do rm -f "$f"; done
}

# Salinan terenkripsi ke lokasi kedua. Gagal di sini tidak menggagalkan cadangan utama, tetapi dicatat.
offsite_copy() {
  src="$1"
  [ -d /offsite ] || return 0
  if [ -z "${BACKUP_PASSPHRASE:-}" ]; then echo "Lokasi kedua terpasang tetapi BACKUP_PASSPHRASE kosong: salinan dilewati." >&2; return 0; fi
  out="/offsite/$(basename "$src").enc"
  if BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$src" -out "$out.part" && mv "$out.part" "$out"; then
    ls -1t /offsite/kira-*.dump.enc 2>/dev/null | tail -n +"$((KEEP_OFFSITE + 1))" | while read -r f; do rm -f "$f"; done
    echo "Salinan terenkripsi: $out"
  else
    rm -f "$out.part"; echo "Salinan ke lokasi kedua gagal." >&2
  fi
}

run_backup() {
  stamp=$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)
  file="/backups/daily/kira-$stamp.dump"
  if pg_dump --format=custom --compress=6 --no-owner --file="$file.part" "$DATABASE_URL_OWNER"; then
    mv "$file.part" "$file"
    size=$(stat -c %s "$file")
    if [ "$(TZ=Asia/Jakarta date +%u)" = "7" ]; then cp "$file" "/backups/weekly/kira-$stamp.dump"; fi
    offsite_copy "$file"
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

# Cadangan per jam: tanpa status.json (itu milik cadangan harian), cukup berkas dan salinan terenkripsi.
run_hourly() {
  stamp=$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)
  file="/backups/hourly/kira-$stamp-h.dump"
  if pg_dump --format=custom --compress=6 --no-owner --file="$file.part" "$DATABASE_URL_OWNER"; then
    mv "$file.part" "$file"
    offsite_copy "$file"
    prune /backups/hourly "$KEEP_HOURLY"
    echo "Cadangan per jam selesai: $(basename "$file")"
  else
    rm -f "$file.part"; echo "Cadangan per jam gagal." >&2
  fi
}

if [ "${1:-}" = "now" ]; then
  run_backup
  exit 0
fi
if [ "${1:-}" = "hourly" ]; then
  run_hourly
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
# Jam: pengulang terpisah di latar belakang.
if [ "$HOURLY" = "on" ]; then
  (
    while true; do
      now=$(date -u +%s)
      sleep $(( 3600 - now % 3600 + 5 ))
      run_hourly || true
    done
  ) &
fi
while true; do
  now=$(date -u +%s)
  # 02.00 WIB = 19.00 UTC hari sebelumnya.
  next=$(( (now / 86400) * 86400 + 19 * 3600 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  sleep $(( next - now ))
  # Jam container di Docker Desktop (WSL2) bisa bangun beberapa detik sebelum jadwal. Tanpa penantian ini
  # putaran berikutnya memilih jadwal yang sama lagi dan cadangan malam itu dibuat dua kali.
  while [ "$(date -u +%s)" -lt "$next" ]; do sleep 1; done
  run_backup || true
done
