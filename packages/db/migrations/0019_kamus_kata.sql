-- Kamus Ketuk: kata yang disimpan anak dari layar soal, pelajaran, dan bacaan. Menjadi dek kartu pribadi saat dijalankan.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).
-- word = bentuk dasar (lemma) huruf kecil seperti di content/dictionary/en-id.json. Hanya kata, tanpa teks soal atau data anak lain.
CREATE TABLE saved_word (
  learner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  word text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_word_pk PRIMARY KEY (learner_id, word),
  CONSTRAINT saved_word_word_ck CHECK (word ~ '^[a-z]+(?:[-'' ][a-z]+)*$' AND length(word) <= 40),
  CONSTRAINT saved_word_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT saved_word_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX saved_word_org_idx ON saved_word (org_id);
--> statement-breakpoint
ALTER TABLE saved_word ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE saved_word FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY saved_word_org ON saved_word USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Anak menyimpan dan menghapus kata miliknya sendiri; tutor dan orang tua yang tertaut boleh melihat dan menghapus.
CREATE POLICY saved_word_learner ON saved_word AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_word TO kira_app, kira_worker;
