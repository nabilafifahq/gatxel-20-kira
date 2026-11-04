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
--> statement-breakpoint

-- Kartu belajar (Flashcards): keadaan FSRS per anak per kartu. Dek ada di content/flashcards (atau dek pribadi dari kamus),
-- jadi tabel ini hanya menyimpan jadwal ulang. Satu baris per anak, dek, dan kartu.
CREATE TABLE flashcard_state (
  learner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  deck_id text NOT NULL,
  card_id text NOT NULL,
  card jsonb NOT NULL,
  due_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_state_pk PRIMARY KEY (learner_id, deck_id, card_id),
  CONSTRAINT flashcard_state_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT flashcard_state_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX flashcard_state_due_idx ON flashcard_state (learner_id, due_at);
--> statement-breakpoint
CREATE INDEX flashcard_state_org_idx ON flashcard_state (org_id);
--> statement-breakpoint
ALTER TABLE flashcard_state ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE flashcard_state FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY flashcard_state_org ON flashcard_state USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
CREATE POLICY flashcard_state_learner ON flashcard_state AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON flashcard_state TO kira_app, kira_worker;
