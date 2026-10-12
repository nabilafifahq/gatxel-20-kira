-- Kira: hak akses role, Row Level Security, dan fungsi SECURITY DEFINER.
-- Role dibuat oleh skrip init database (deploy/db/init/00-roles.sh) sebelum migrasi:
--   kira_owner  pemilik skema, BYPASSRLS, hanya untuk migrasi dan fungsi definer
--   kira_app    aplikasi web, kena RLS, tanpa akses skema auth
--   kira_auth   modul auth, hanya skema auth
--   kira_worker worker, kena RLS, mengambil job lewat fungsi definer

-- ---------------------------------------------------------------------------
-- Konteks per transaksi

CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.role', true), ''), 'none')
$$;
--> statement-breakpoint
-- Tutor melihat semua learner di org. Learner hanya dirinya. Orang tua hanya anak yang tertaut.
-- Peran worker hanya berlaku untuk koneksi role kira_worker.
CREATE OR REPLACE FUNCTION app_can_see_learner(lid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE app_role()
    WHEN 'tutor' THEN true
    WHEN 'worker' THEN current_user = 'kira_worker'
    WHEN 'learner' THEN lid = app_user_id()
    WHEN 'guardian' THEN EXISTS (
      SELECT 1 FROM guardian_link g WHERE g.guardian_id = app_user_id() AND g.learner_id = lid
    )
    ELSE false
  END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_role() = 'tutor' OR (app_role() = 'worker' AND current_user = 'kira_worker')
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Foreign key ke org dan learner (integritas data)

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'member_profile','learner_profile','guardian_link','consent_event','deletion_request','skill_state',
    'plan_week','plan_slot','rest_day','paper','quest','attempt','response','review_card','xp_event',
    'day_record','badge_award','media','note','problem_report','competition_event','org_item','ai_job',
    'ai_draft','import_batch','job','outbox_email','week_report','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE', t, t || '_org_fk');
  END LOOP;
  FOREACH t IN ARRAY ARRAY[
    'skill_state','plan_week','plan_slot','rest_day','quest','attempt','response','review_card','xp_event',
    'day_record','badge_award','note','week_report','consent_event','deletion_request'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE', t, t || '_learner_fk');
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE guardian_link ADD CONSTRAINT guardian_link_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE guardian_link ADD CONSTRAINT guardian_link_guardian_fk FOREIGN KEY (guardian_id) REFERENCES member_profile(user_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE learner_profile ADD CONSTRAINT learner_grade_ck CHECK (grade BETWEEN 1 AND 6);
--> statement-breakpoint
ALTER TABLE learner_profile ADD CONSTRAINT learner_limit_ck CHECK (screen_limit_min BETWEEN 10 AND 240);
--> statement-breakpoint
ALTER TABLE response ADD CONSTRAINT response_status_ck CHECK (status IN ('correct','wrong','blank','pending'));
--> statement-breakpoint
ALTER TABLE attempt ADD CONSTRAINT attempt_status_ck CHECK (status IN ('in_progress','submitted','needs_grading','graded'));
--> statement-breakpoint
ALTER TABLE consent_event ADD CONSTRAINT consent_purpose_ck CHECK (purpose IN ('learning','progress-email','audio','photo','ai-drafts'));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS: ENABLE dan FORCE di semua tabel tenant, kebijakan org

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'member_profile','learner_profile','guardian_link','consent_event','deletion_request','skill_state',
    'plan_week','plan_slot','rest_day','paper','quest','attempt','response','review_card','xp_event',
    'day_record','badge_award','media','note','problem_report','competition_event','org_item','ai_job',
    'ai_draft','import_batch','job','outbox_email','week_report','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id())', t || '_org', t);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE org ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE org FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY org_self ON org USING (id = app_org_id()) WITH CHECK (id = app_org_id());
--> statement-breakpoint

-- Pembatas per learner (RESTRICTIVE, digabung AND dengan kebijakan org)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'skill_state','plan_week','plan_slot','rest_day','quest','attempt','response','review_card','xp_event',
    'day_record','badge_award','week_report'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (app_can_see_learner(learner_id)) WITH CHECK (app_can_see_learner(learner_id))', t || '_learner', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY learner_profile_scope ON learner_profile AS RESTRICTIVE
  USING (app_can_see_learner(user_id)) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY note_scope ON note AS RESTRICTIVE
  USING (app_role() <> 'learner' AND app_can_see_learner(learner_id)) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY consent_scope ON consent_event AS RESTRICTIVE
  USING (app_role() <> 'learner' AND app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY deletion_scope ON deletion_request AS RESTRICTIVE
  USING (app_role() <> 'learner' AND app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian', 'worker') AND app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY guardian_link_scope ON guardian_link AS RESTRICTIVE
  USING (app_role() IN ('tutor', 'worker') OR guardian_id = app_user_id() OR learner_id = app_user_id())
  WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY member_profile_scope ON member_profile AS RESTRICTIVE
  USING (app_role() IN ('tutor', 'worker', 'guardian'))
  WITH CHECK (app_is_staff() OR user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY media_scope ON media AS RESTRICTIVE
  USING (learner_id IS NULL AND app_role() IN ('tutor', 'worker') OR learner_id IS NOT NULL AND app_can_see_learner(learner_id))
  WITH CHECK (learner_id IS NULL AND app_is_staff() OR learner_id IS NOT NULL AND app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY problem_report_scope ON problem_report AS RESTRICTIVE
  USING (app_role() IN ('tutor', 'worker') OR reporter_id = app_user_id())
  WITH CHECK (reporter_id = app_user_id() OR app_is_staff());
--> statement-breakpoint
-- Soal privat org: semua peran boleh membaca (dipakai di quest), hanya tutor dan worker menulis.
CREATE POLICY org_item_insert ON org_item AS RESTRICTIVE FOR INSERT WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY org_item_update ON org_item AS RESTRICTIVE FOR UPDATE USING (app_is_staff()) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY org_item_delete ON org_item AS RESTRICTIVE FOR DELETE USING (app_is_staff());
--> statement-breakpoint
-- Tabel khusus tutor dan worker
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_job','ai_draft','import_batch','outbox_email','paper','competition_event'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (app_is_staff() OR (%L = ANY(ARRAY[''paper'',''competition_event'']) AND app_role() IN (''learner'',''guardian''))) WITH CHECK (app_is_staff())', t || '_staff', t, t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Job: semua peran boleh membuat job untuk org-nya (misalnya laporan), hanya staf yang membaca semua.
CREATE POLICY job_scope ON job AS RESTRICTIVE
  USING (app_is_staff() OR created_by = app_user_id())
  WITH CHECK (app_is_staff() OR created_by = app_user_id());
--> statement-breakpoint
CREATE POLICY audit_scope ON audit_log AS RESTRICTIVE
  USING (app_is_staff()) WITH CHECK (true);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hak akses

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO kira_app, kira_worker, kira_auth;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kira_app, kira_worker;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kira_app, kira_worker;
--> statement-breakpoint
REVOKE ALL ON schedule_state FROM kira_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON consent_event, audit_log FROM kira_app, kira_worker;
--> statement-breakpoint
GRANT USAGE ON SCHEMA auth TO kira_auth;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO kira_auth;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO kira_auth;
--> statement-breakpoint
-- kira_auth tidak menyentuh tabel publik kecuali lewat aplikasi.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kira_auth;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Fungsi SECURITY DEFINER (pemilik kira_owner, BYPASSRLS). Sempit dan berparameter.

CREATE OR REPLACE FUNCTION kira_org_count() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::int FROM org
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kira_list_orgs() RETURNS TABLE(id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM org ORDER BY created_at
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kira_claim_jobs(p_kinds text[], p_limit integer)
RETURNS TABLE(id uuid, org_id uuid, kind text, payload jsonb, attempts integer, created_by uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Job yang macet lebih dari 20 menit dikembalikan ke antrean.
  UPDATE job j SET status = 'queued', locked_at = NULL
    WHERE j.status = 'running' AND j.locked_at < now() - interval '20 minutes';
  RETURN QUERY
  UPDATE job j SET status = 'running', locked_at = now(), attempts = j.attempts + 1
  WHERE j.id IN (
    SELECT q.id FROM job q
    WHERE q.status = 'queued' AND q.run_after <= now() AND (p_kinds IS NULL OR q.kind = ANY(p_kinds))
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 20))
  )
  RETURNING j.id, j.org_id, j.kind, j.payload, j.attempts, j.created_by;
END $$;
--> statement-breakpoint
-- Hapus semua data satu learner (permintaan hapus akun). Mengembalikan path berkas untuk dihapus worker.
CREATE OR REPLACE FUNCTION kira_delete_learner(p_org uuid, p_learner uuid) RETURNS TABLE(path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learner_profile WHERE user_id = p_learner AND org_id = p_org) THEN
    RAISE EXCEPTION 'learner tidak ditemukan';
  END IF;
  RETURN QUERY SELECT m.path FROM media m WHERE m.org_id = p_org AND m.learner_id = p_learner;
  DELETE FROM media WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM problem_report WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM learner_profile WHERE user_id = p_learner AND org_id = p_org; -- cascade ke data belajar
  UPDATE auth.device SET learner_ids = array_remove(learner_ids, p_learner) WHERE org_id = p_org;
  DELETE FROM auth.user_account WHERE id = p_learner AND org_id = p_org;
  INSERT INTO audit_log(org_id, actor_kind, action, target) VALUES (p_org, 'worker', 'learner.deleted', p_learner::text);
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kira_org_count(), kira_list_orgs(), kira_claim_jobs(text[], integer), kira_delete_learner(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_org_count() TO kira_app, kira_worker, kira_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_list_orgs(), kira_claim_jobs(text[], integer), kira_delete_learner(uuid, uuid) TO kira_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON schedule_state TO kira_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kira_app, kira_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kira_app, kira_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kira_auth;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA auth GRANT USAGE, SELECT ON SEQUENCES TO kira_auth;
