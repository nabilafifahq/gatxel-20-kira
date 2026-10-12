#!/bin/bash
# Postgres lokal untuk pengembangan dan tes (tanpa Docker), memakai binari PostgreSQL di PATH
# atau di /usr/lib/postgresql/*/bin. Data di .kira-local/pg, port 54329.
# Pemakaian: scripts/dev-db.sh start|stop|reset|env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.kira-local/pg"
PORT="${KIRA_PG_PORT:-54329}"
BIN="$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
PW=devpass
run_as() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

case "${1:-start}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DATA"; [ "$(id -u)" = "0" ] && chown -R postgres "$ROOT/.kira-local"
      run_as "$BIN/initdb -D '$DATA' -U postgres --auth=trust -E UTF8 >/dev/null"
      echo "unix_socket_directories = '$ROOT/.kira-local'" >> "$DATA/postgresql.conf"
    fi
    run_as "$BIN/pg_ctl -D '$DATA' -o '-p $PORT -k $ROOT/.kira-local' -l '$ROOT/.kira-local/pg.log' -w start" >/dev/null || true
    if ! psql -h localhost -p "$PORT" -U postgres -d postgres -tAc "select 1 from pg_roles where rolname='kira_owner'" | grep -q 1; then
      POSTGRES_USER=postgres KIRA_OWNER_PASSWORD=$PW KIRA_APP_PASSWORD=$PW KIRA_AUTH_PASSWORD=$PW KIRA_WORKER_PASSWORD=$PW \
        PGHOST=localhost PGPORT=$PORT sh "$ROOT/deploy/db/init/00-roles.sh"
    fi
    echo "Postgres jalan di port $PORT" ;;
  stop) run_as "$BIN/pg_ctl -D '$DATA' -w stop" ;;
  reset)
    run_as "$BIN/pg_ctl -D '$DATA' -w stop" >/dev/null 2>&1 || true
    rm -rf "$DATA"; "$0" start ;;
  env)
    for r in owner app auth worker; do
      U=$(echo $r | tr a-z A-Z); echo "DATABASE_URL_$U=postgres://kira_$r:$PW@localhost:$PORT/kira"
    done ;;
esac
