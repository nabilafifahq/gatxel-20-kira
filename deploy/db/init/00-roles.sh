#!/bin/sh
# Dijalankan sekali oleh image postgres saat folder data masih kosong.
# Membuat database kira dan empat role dengan password dari variabel lingkungan.
set -eu
: "${KIRA_OWNER_PASSWORD:?wajib diisi}"
: "${KIRA_APP_PASSWORD:?wajib diisi}"
: "${KIRA_AUTH_PASSWORD:?wajib diisi}"
: "${KIRA_WORKER_PASSWORD:?wajib diisi}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$KIRA_OWNER_PASSWORD" -v app_pw="$KIRA_APP_PASSWORD" \
  -v auth_pw="$KIRA_AUTH_PASSWORD" -v worker_pw="$KIRA_WORKER_PASSWORD" <<'EOSQL'
CREATE ROLE kira_owner LOGIN BYPASSRLS PASSWORD :'owner_pw';
CREATE ROLE kira_app LOGIN NOBYPASSRLS PASSWORD :'app_pw' CONNECTION LIMIT 40;
CREATE ROLE kira_auth LOGIN NOBYPASSRLS PASSWORD :'auth_pw' CONNECTION LIMIT 20;
CREATE ROLE kira_worker LOGIN NOBYPASSRLS PASSWORD :'worker_pw' CONNECTION LIMIT 10;
CREATE DATABASE kira OWNER kira_owner ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE kira FROM PUBLIC;
GRANT CONNECT ON DATABASE kira TO kira_app, kira_auth, kira_worker;
\connect kira
ALTER SCHEMA public OWNER TO kira_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
EOSQL
