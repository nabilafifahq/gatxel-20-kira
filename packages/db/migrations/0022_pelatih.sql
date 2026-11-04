-- Pelatih Orang Tua: catatan lembar kerja yang dibuat orang tua. Dipakai untuk batas harian per keluarga dan
-- supaya lembar dan kuncinya bisa dibuka ulang dengan isi soal yang sama (seed = id). Tidak menyimpan jawaban anak.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).
CREATE TABLE worksheet (
  id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  created_by uuid,
  subject text NOT NULL,
  skill_id text NOT NULL,
  item_count smallint NOT NULL,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worksheet_subject_ck CHECK (subject IN ('math', 'english', 'science')),
  CONSTRAINT worksheet_count_ck CHECK (item_count BETWEEN 5 AND 20),
  CONSTRAINT worksheet_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT worksheet_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX worksheet_org_day_idx ON worksheet (org_id, day);
--> statement-breakpoint
ALTER TABLE worksheet ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE worksheet FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY worksheet_org ON worksheet USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Hanya orang tua dan tutor yang tertaut ke anak itu; anak sendiri tidak membaca atau menulis lembar.
CREATE POLICY worksheet_adult ON worksheet AS RESTRICTIVE
  USING (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT ON worksheet TO kira_app, kira_worker;
