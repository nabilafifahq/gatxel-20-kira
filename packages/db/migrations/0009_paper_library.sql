-- Pustaka paper, paper harian, Buku Salah (dihitung dari response, tanpa tabel), program olimpiade,
-- dan registri sumber soal otomatis. Semua tabel baru: ENABLE dan FORCE RLS, kebijakan org,
-- dan GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

-- ---------------------------------------------------------------------------
-- Metadata paket impor: lomba, tahun, bagian, waktu asli, sumber

ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS competition text;
--> statement-breakpoint
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS year smallint;
--> statement-breakpoint
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS section text;
--> statement-breakpoint
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS original_minutes integer;
--> statement-breakpoint
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS source text;
--> statement-breakpoint
ALTER TABLE import_batch ADD CONSTRAINT import_batch_year_ck CHECK (year IS NULL OR year BETWEEN 2000 AND 2100);
--> statement-breakpoint
ALTER TABLE import_batch ADD CONSTRAINT import_batch_minutes_ck CHECK (original_minutes IS NULL OR original_minutes BETWEEN 1 AND 300);

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Pustaka paper

CREATE TABLE paper_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  import_batch_id uuid,
  origin text NOT NULL DEFAULT 'official',
  competition text,
  year smallint,
  subject text NOT NULL,
  grade smallint NOT NULL,
  section text NOT NULL DEFAULT 'penuh',
  title text NOT NULL,
  minutes integer NOT NULL,
  source text NOT NULL,
  item_refs text[] NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT paper_library_origin_ck CHECK (origin IN ('official', 'kira-made')),
  CONSTRAINT paper_library_subject_ck CHECK (subject IN ('math', 'english', 'science')),
  CONSTRAINT paper_library_grade_ck CHECK (grade BETWEEN 1 AND 6),
  CONSTRAINT paper_library_minutes_ck CHECK (minutes BETWEEN 1 AND 300),
  CONSTRAINT paper_library_year_ck CHECK (year IS NULL OR year BETWEEN 2000 AND 2100),
  CONSTRAINT paper_library_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX paper_library_batch_uq ON paper_library (import_batch_id) WHERE import_batch_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX paper_library_pick_idx ON paper_library (org_id, subject, grade);
--> statement-breakpoint

CREATE TABLE paper_pick (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  date date NOT NULL,
  subject text NOT NULL,
  kind text NOT NULL,
  library_id uuid,
  origin text NOT NULL,
  competition text,
  year smallint,
  title text NOT NULL,
  minutes integer NOT NULL,
  source text NOT NULL,
  item_refs text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_pick_kind_ck CHECK (kind IN ('mini', 'full')),
  CONSTRAINT paper_pick_origin_ck CHECK (origin IN ('official', 'kira-made')),
  CONSTRAINT paper_pick_subject_ck CHECK (subject IN ('math', 'english', 'science')),
  CONSTRAINT paper_pick_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT paper_pick_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX paper_pick_day_uq ON paper_pick (learner_id, date, subject, kind);

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Program persiapan olimpiade

CREATE TABLE program_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  program_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  slot_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_run_status_ck CHECK (status IN ('active', 'cancelled')),
  CONSTRAINT program_run_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT program_run_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX program_run_learner_idx ON program_run (learner_id, status);

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Sumber soal otomatis

CREATE TABLE source_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  source_id text NOT NULL,
  kind text NOT NULL,
  external_id text,
  content_hash text NOT NULL,
  subject text,
  grade smallint,
  skill_id text,
  body jsonb NOT NULL,
  key_origin text NOT NULL DEFAULT 'none',
  verify text NOT NULL DEFAULT 'unverified',
  status text NOT NULL DEFAULT 'fetched',
  org_item_id uuid,
  ai_draft_id uuid,
  import_batch_id uuid,
  license text NOT NULL,
  attribution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_record_kind_ck CHECK (kind IN ('item', 'pdf')),
  CONSTRAINT source_record_key_origin_ck CHECK (key_origin IN ('source', 'ai', 'none')),
  CONSTRAINT source_record_verify_ck CHECK (verify IN ('agree', 'disagree', 'ai-only', 'unverified')),
  CONSTRAINT source_record_status_ck CHECK (status IN ('fetched', 'unmapped', 'published', 'queued', 'rejected', 'imported')),
  CONSTRAINT source_record_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX source_record_hash_uq ON source_record (org_id, content_hash);
--> statement-breakpoint
CREATE INDEX source_record_source_idx ON source_record (org_id, source_id, status);
--> statement-breakpoint

CREATE TABLE source_state (
  org_id uuid NOT NULL,
  source_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  cursor jsonb,
  last_run_at timestamptz,
  last_result text,
  CONSTRAINT source_state_pk PRIMARY KEY (org_id, source_id),
  CONSTRAINT source_state_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE
);

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- RLS: ENABLE dan FORCE, kebijakan org, lalu pembatas per peran

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['paper_library','paper_pick','program_run','source_record','source_state'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id())', t || '_org', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Pustaka paper: semua peran org boleh membaca (pemilih paper harian jalan sebagai learner), hanya staf menulis.
CREATE POLICY paper_library_insert ON paper_library AS RESTRICTIVE FOR INSERT WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY paper_library_update ON paper_library AS RESTRICTIVE FOR UPDATE USING (app_is_staff()) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY paper_library_delete ON paper_library AS RESTRICTIVE FOR DELETE USING (app_is_staff());
--> statement-breakpoint
-- Pilihan paper harian: learner hanya miliknya, orang tua hanya membaca, tutor dan worker semua.
CREATE POLICY paper_pick_learner ON paper_pick AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_role() <> 'guardian' AND app_can_see_learner(learner_id));
--> statement-breakpoint
-- Program: learner dan orang tua boleh membaca program anaknya (pemilih paper mencari minggu simulasi), hanya staf menulis.
CREATE POLICY program_run_read ON program_run AS RESTRICTIVE FOR SELECT USING (app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY program_run_insert ON program_run AS RESTRICTIVE FOR INSERT WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY program_run_update ON program_run AS RESTRICTIVE FOR UPDATE USING (app_is_staff()) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY program_run_delete ON program_run AS RESTRICTIVE FOR DELETE USING (app_is_staff());
--> statement-breakpoint
-- Catatan sumber dan status sumber: khusus tutor dan worker.
CREATE POLICY source_record_staff ON source_record AS RESTRICTIVE USING (app_is_staff()) WITH CHECK (app_is_staff());
--> statement-breakpoint
CREATE POLICY source_state_staff ON source_state AS RESTRICTIVE USING (app_is_staff()) WITH CHECK (app_is_staff());
--> statement-breakpoint

-- Gambar soal hasil potong dari halaman PDF (media jenis figure, milik org): learner dan orang tua boleh melihatnya
-- supaya gambar tampil di soal. Berkas lain tanpa learner tetap hanya untuk tutor dan worker.
DROP POLICY media_scope ON media;
--> statement-breakpoint
CREATE POLICY media_scope ON media AS RESTRICTIVE
  USING (
    learner_id IS NULL AND (app_role() IN ('tutor', 'worker') OR (kind = 'figure' AND app_role() IN ('learner', 'guardian')))
    OR learner_id IS NOT NULL AND app_can_see_learner(learner_id)
  )
  WITH CHECK (learner_id IS NULL AND app_is_staff() OR learner_id IS NOT NULL AND app_can_see_learner(learner_id));

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Hak akses (eksplisit, tanpa hak bawaan)

GRANT SELECT, INSERT, UPDATE, DELETE ON paper_library TO kira_app;
--> statement-breakpoint
GRANT SELECT ON paper_library TO kira_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON paper_pick TO kira_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON program_run TO kira_app;
--> statement-breakpoint
GRANT SELECT, UPDATE ON source_record TO kira_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON source_record TO kira_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON source_state TO kira_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON source_state TO kira_worker;
