-- Saklar fitur per anak: orang tua memilih mapel dan fitur yang dipakai. Tanpa baris berarti menyala.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).
CREATE TABLE learner_feature (
  learner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  key text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_feature_pk PRIMARY KEY (learner_id, key),
  CONSTRAINT learner_feature_key_ck CHECK (key IN ('math','english','science','olympiad-math','olympiad-english','olympiad-science','drill-math','mental-math','quiz-arena','vocab','flashcards','reading-room','english-skills','paper','kira-world','placement','dictionary','manipulatives')),
  CONSTRAINT learner_feature_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT learner_feature_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX learner_feature_org_idx ON learner_feature (org_id);
--> statement-breakpoint
ALTER TABLE learner_feature ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE learner_feature FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_feature_org ON learner_feature USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Learner membaca saklarnya sendiri; hanya tutor dan orang tua yang tertaut boleh mengubah.
CREATE POLICY learner_feature_learner ON learner_feature AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON learner_feature TO kira_app, kira_worker;
