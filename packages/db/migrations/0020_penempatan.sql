-- Tes penempatan: tes adaptif pendek per mapel setelah onboarding. Satu baris per percobaan.
-- Status: ready (menunggu anak memulai), in_progress, done, skipped (dilewati; boleh dimulai lagi oleh orang tua).
-- Learner yang sudah ada tidak mendapat baris, jadi tidak ditanya kecuali orang tua atau tutor memulainya.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).
CREATE TABLE placement_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  origin text NOT NULL DEFAULT 'auto',
  start_grade smallint NOT NULL,
  theta real NOT NULL DEFAULT 0,
  -- Jawaban sejauh ini: [{ref, skillId, grade, group, difficulty, b, correct, unsure, thetaAfter}]
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Soal yang sedang ditampilkan (supaya muat ulang halaman tidak mengganti soal): {ref}
  current jsonb,
  -- Hasil akhir (ringkasan per kelompok strand, kelas perkiraan, kekuatan, fokus)
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT placement_run_subject_ck CHECK (subject IN ('math', 'english', 'science')),
  CONSTRAINT placement_run_status_ck CHECK (status IN ('ready', 'in_progress', 'done', 'skipped')),
  CONSTRAINT placement_run_origin_ck CHECK (origin IN ('auto', 'parent', 'tutor')),
  CONSTRAINT placement_run_grade_ck CHECK (start_grade BETWEEN 1 AND 6),
  CONSTRAINT placement_run_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT placement_run_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
-- Paling banyak satu percobaan terbuka per learner dan mapel.
CREATE UNIQUE INDEX placement_run_open_uq ON placement_run (learner_id, subject) WHERE status IN ('ready', 'in_progress');
--> statement-breakpoint
CREATE INDEX placement_run_learner_idx ON placement_run (learner_id, subject, finished_at DESC);
--> statement-breakpoint
ALTER TABLE placement_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE placement_run FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY placement_run_org ON placement_run USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Anak dan orang tua yang tertaut boleh membaca. Anak menulis jawabannya sendiri; orang tua hanya boleh meminta tes
-- baru (baris ready) dan tidak mengubah baris yang sudah ada.
CREATE POLICY placement_run_read ON placement_run AS RESTRICTIVE FOR SELECT USING (app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY placement_run_insert ON placement_run AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_can_see_learner(learner_id) AND (app_role() <> 'guardian' OR (status = 'ready' AND origin = 'parent')));
--> statement-breakpoint
CREATE POLICY placement_run_update ON placement_run AS RESTRICTIVE FOR UPDATE
  USING (app_role() <> 'guardian' AND app_can_see_learner(learner_id))
  WITH CHECK (app_role() <> 'guardian' AND app_can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY placement_run_delete ON placement_run AS RESTRICTIVE FOR DELETE
  USING (app_is_staff());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON placement_run TO kira_app;
--> statement-breakpoint
GRANT SELECT ON placement_run TO kira_worker;
