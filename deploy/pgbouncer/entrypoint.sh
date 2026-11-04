#!/bin/sh
# PgBouncer Kira: mode transaksi, TLS terverifikasi ke Postgres, hanya di jaringan internal.
# Daftar pengguna dibuat dari variabel lingkungan saat kontainer mulai (tidak ada rahasia di image atau repo).
# Tiga role aplikasi (kira_app, kira_auth) lewat sini; worker, migrate, dan backup tersambung langsung ke db.
set -eu
: "${KIRA_APP_PASSWORD:?}" "${KIRA_AUTH_PASSWORD:?}"
dir=/tmp/pgb
mkdir -p "$dir"
umask 077
cat > "$dir/userlist.txt" <<EOL
"kira_app" "${KIRA_APP_PASSWORD}"
"kira_auth" "${KIRA_AUTH_PASSWORD}"
EOL
cat > "$dir/pgbouncer.ini" <<EOL
[databases]
kira = host=db port=5432 dbname=kira

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
unix_socket_dir =
auth_type = scram-sha-256
auth_file = $dir/userlist.txt
pool_mode = transaction
max_client_conn = ${PGB_MAX_CLIENT_CONN:-1500}
default_pool_size = ${PGB_POOL_APP:-30}
min_pool_size = 4
reserve_pool_size = 5
reserve_pool_timeout = 2
max_db_connections = ${PGB_MAX_DB_CONN:-60}
query_wait_timeout = 20
server_idle_timeout = 300
server_lifetime = 3600
server_login_retry = 1
# TLS ke Postgres dengan CA lokal; ke web tanpa TLS (jaringan Docker internal tanpa internet, tidak ada port ke host).
server_tls_sslmode = verify-full
server_tls_ca_file = /certs/ca.crt
server_tls_protocols = secure
client_tls_sslmode = disable
ignore_startup_parameters = extra_float_digits,options
max_prepared_statements = 0
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
stats_users = kira_app

[users]
kira_app = pool_size=${PGB_POOL_APP:-30}
kira_auth = pool_size=${PGB_POOL_AUTH:-15}
EOL
exec /usr/bin/pgbouncer "$dir/pgbouncer.ini"
