-- Kira: pembaruan sumber soal mingguan hanya untuk org yang ditandai (org.settings.weeklySourcing = true).
-- Org yang sudah ada saat migrasi ini jalan (keluarga yang ada) ditandai; keluarga baru dari pendaftaran publik tidak.
-- Tanpa penanda, job mingguan tidak dikalikan per keluarga.

UPDATE org SET settings = settings || '{"weeklySourcing": true}'::jsonb WHERE NOT (settings ? 'weeklySourcing');
--> statement-breakpoint

CREATE OR REPLACE FUNCTION kira_list_sourcing_orgs() RETURNS TABLE(id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM org WHERE settings @> '{"weeklySourcing": true}'::jsonb ORDER BY created_at
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION kira_list_sourcing_orgs() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_list_sourcing_orgs() TO kira_worker;
