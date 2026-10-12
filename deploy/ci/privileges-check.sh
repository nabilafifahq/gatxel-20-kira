#!/bin/sh
# Hak tabel setelah pemulihan cadangan harus sama dengan migrasi: consent_event dan audit_log append-only,
# schedule_state tertutup untuk kira_app, kira_app tetap bisa bekerja, dan tidak ada hak bawaan.
# Dijalankan di dalam container backup: docker compose exec -T backup sh -s < deploy/ci/privileges-check.sh
set -eu
problems=$(psql "$DATABASE_URL_OWNER" -v ON_ERROR_STOP=1 -tA <<'SQL'
select problem from (
  select format('%s punya %s di %s', r, p, t) as problem
  from unnest(array['kira_app', 'kira_worker']) r, unnest(array['consent_event', 'audit_log']) t, unnest(array['UPDATE', 'DELETE']) p
  where has_table_privilege(r, t, p)
  union all
  select 'kira_app bisa membaca schedule_state' where has_table_privilege('kira_app', 'schedule_state', 'SELECT')
  union all
  select 'kira_app tidak bisa membaca attempt' where not has_table_privilege('kira_app', 'attempt', 'SELECT')
  union all
  select 'kira_auth tidak bisa membaca auth.user_account' where not has_table_privilege('kira_auth', 'auth.user_account', 'SELECT')
  union all
  select 'hak bawaan masih ada (' || defaclobjtype::text || ')' from pg_default_acl
) x;
SQL
)
if [ -n "$problems" ]; then
  echo "$problems"
  exit 1
fi
echo "Hak tabel sesuai migrasi."
