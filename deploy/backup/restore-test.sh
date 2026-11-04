#!/bin/sh
# Uji pemulihan: pulihkan cadangan terbaru (atau berkas yang disebut) ke server Postgres SEMENTARA di dalam
# container ini (initdb di /tmp, tanpa port jaringan), bandingkan jumlah baris tabel dengan database hidup,
# periksa hak tabel append-only, lalu hapus semuanya. Tidak menyentuh database hidup (hanya dibaca).
# Dari host:  docker compose exec backup /restore-test.sh            (cadangan per jam atau harian terbaru)
#             docker compose exec backup /restore-test.sh /backups/daily/kira-20261105-0200.dump
#             docker compose exec -e BACKUP_PASSPHRASE=... backup /restore-test.sh /offsite/kira-....dump.enc
# Keluar 0 bila semua tabel cocok (cadangan boleh tertinggal beberapa baris dari data hidup, RESTORE_TOLERANCE_PCT).
set -eu
: "${DATABASE_URL_OWNER:?wajib diisi}"
export PGSSLMODE="${PGSSLMODE:-verify-full}"
export PGSSLROOTCERT="${PGSSLROOTCERT:-/certs/ca.crt}"
TOLERANSI="${RESTORE_TOLERANCE_PCT:-5}"
src="${1:-}"
if [ -z "$src" ]; then
  src=$(ls -1t /backups/hourly/kira-*.dump /backups/daily/kira-*.dump 2>/dev/null | head -n 1 || true)
fi
[ -n "$src" ] && [ -f "$src" ] || { echo "Tidak ada cadangan untuk diuji." >&2; exit 2; }

work=$(mktemp -d /tmp/restore-test.XXXXXX)
run_pg() { if [ "$(id -u)" = "0" ]; then gosu postgres "$@"; else "$@"; fi; }
cleanup() { run_pg pg_ctl -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
chmod 755 "$work"; [ "$(id -u)" = "0" ] && chown postgres "$work"

dump="$src"
case "$src" in
  *.enc)
    : "${BACKUP_PASSPHRASE:?wajib diisi untuk berkas .enc}"
    dump="$work/restore.dump"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$src" -out "$dump"
    chmod 644 "$dump"
    ;;
esac

run_pg initdb -D "$work/data" -A trust -U postgres >/dev/null
run_pg pg_ctl -D "$work/data" -w -o "-p 5499 -c listen_addresses= -c unix_socket_directories=$work" -l "$work/pg.log" start >/dev/null
T="psql -h $work -p 5499 -U postgres -qAt"
for r in kira_owner kira_app kira_auth kira_worker; do $T -c "create role $r nologin"; done
$T -c "create database kira owner kira_owner"
pg_restore -h "$work" -p 5499 -U postgres -d kira --exit-on-error "$dump"
echo "Pemulihan berhasil dari $src."

R="psql -h $work -p 5499 -U postgres -d kira -qAt"
tables=$(psql "$DATABASE_URL_OWNER" -qAt -c "select schemaname||'.'||relname from pg_stat_user_tables where schemaname in ('public','auth') order by 1")
bad=0
for t in $tables; do
  live=$(psql "$DATABASE_URL_OWNER" -qAt -c "select count(*) from $t")
  rest=$($R -c "select count(*) from $t" 2>/dev/null || echo MISSING)
  if [ "$rest" = "MISSING" ]; then echo "HILANG  $t"; bad=1; continue; fi
  allowed=$(( live * TOLERANSI / 100 + 5 ))
  diff=$(( live - rest )); [ "$diff" -lt 0 ] && diff=$(( -diff ))
  if [ "$diff" -gt "$allowed" ]; then echo "BEDA    $t hidup=$live pulih=$rest"; bad=1; else echo "cocok   $t hidup=$live pulih=$rest"; fi
done
# Hak tabel ikut pulih: kira_app tidak boleh mengubah audit_log dan consent_event.
n=$($R -c "select count(*) from information_schema.role_table_grants where grantee='kira_app' and table_name in ('audit_log','consent_event') and privilege_type in ('UPDATE','DELETE')")
[ "$n" = "0" ] || { echo "HAK: kira_app punya UPDATE/DELETE pada tabel append-only"; bad=1; }
rls=$($R -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relforcerowsecurity")
echo "Tabel public dengan RLS FORCE setelah pulih: $rls"
if [ "$bad" = "0" ]; then echo "UJI PEMULIHAN LULUS"; else echo "UJI PEMULIHAN GAGAL" >&2; exit 1; fi
