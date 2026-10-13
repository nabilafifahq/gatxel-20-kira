-- Struktur harian baru (rencana Kira Juara, bagian 3 dan 5.2): setiap mapel punya Latihan, Tes, dan Paper
-- (9 sesi wajib per hari) ditambah sampai 10 sesi opsional dari tutor, dan sesi yang sudah selesai bisa diulang.
-- Tidak ada tabel atau sequence baru, jadi tidak ada GRANT baru: kolom baru ikut hak tabelnya (migrasi 0001 dan
-- 0005), dan RLS ENABLE, FORCE, serta kebijakan org dan learner yang ada tetap berlaku untuk tabel-tabel ini.

-- ---------------------------------------------------------------------------
-- quest: jenis sesi, nomor urut, slot rencana asal, dan kind baru "extra" (sesi opsional)

ALTER TABLE quest ADD COLUMN IF NOT EXISTS session text NOT NULL DEFAULT 'latihan';
--> statement-breakpoint
ALTER TABLE quest ADD COLUMN IF NOT EXISTS seq smallint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE quest ADD COLUMN IF NOT EXISTS plan_slot_id uuid;
--> statement-breakpoint
ALTER TABLE quest ADD COLUMN IF NOT EXISTS config jsonb;
--> statement-breakpoint
ALTER TABLE quest ADD CONSTRAINT quest_plan_slot_fk FOREIGN KEY (plan_slot_id) REFERENCES plan_slot(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE quest ADD CONSTRAINT quest_session_ck CHECK (session IN ('latihan','tes','paper','lesson','simulation','esmo','review','quick-maths','knowledge','english-skill','reading'));
--> statement-breakpoint
ALTER TABLE quest ADD CONSTRAINT quest_kind_ck CHECK (kind IN ('daily','bonus','extra'));
--> statement-breakpoint
-- Quest lama: paper tablet menjadi sesi Paper, tes bermapel skill menjadi sesi Tes. RLS dimatikan sementara
-- untuk pemilik tabel di dalam transaksi migrasi ini saja (seperti migrasi 0004).
ALTER TABLE quest NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE quest SET session = 'paper' WHERE paper_id IS NOT NULL;
--> statement-breakpoint
UPDATE quest SET session = 'tes' WHERE paper_id IS NULL AND mode = 'tes';
--> statement-breakpoint
ALTER TABLE quest FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP INDEX IF EXISTS quest_day_uq;
--> statement-breakpoint
CREATE UNIQUE INDEX quest_day_uq ON quest (learner_id, date, subject, kind, session, seq);
--> statement-breakpoint
CREATE UNIQUE INDEX quest_plan_slot_uq ON quest (plan_slot_id) WHERE plan_slot_id IS NOT NULL;

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- plan_slot: banyak slot per mapel per hari, wajib atau opsional

ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS session text NOT NULL DEFAULT 'latihan';
--> statement-breakpoint
ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS paper_kind text;
--> statement-breakpoint
ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS config jsonb;
--> statement-breakpoint
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_session_ck CHECK (session IN ('latihan','tes','paper','lesson','simulation','esmo','review','quick-maths','knowledge','english-skill','reading'));
--> statement-breakpoint
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_paper_kind_ck CHECK (paper_kind IS NULL OR paper_kind IN ('mini','full'));
--> statement-breakpoint
ALTER TABLE plan_slot NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE plan_slot SET session = 'paper' WHERE paper_id IS NOT NULL;
--> statement-breakpoint
UPDATE plan_slot SET session = 'tes' WHERE paper_id IS NULL AND mode = 'tes';
--> statement-breakpoint
UPDATE plan_slot SET required = false WHERE kind = 'bonus';
--> statement-breakpoint
ALTER TABLE plan_slot FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- plan_week: template per hari (school, saturday, light)

ALTER TABLE plan_week ADD COLUMN IF NOT EXISTS day_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- attempt dan response: ulang sesi. Percobaan pertama resmi (retry_of kosong); ulang menunjuk percobaan itu.

ALTER TABLE attempt ADD COLUMN IF NOT EXISTS retry_of uuid;
--> statement-breakpoint
ALTER TABLE attempt ADD COLUMN IF NOT EXISTS retry_no smallint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE attempt ADD COLUMN IF NOT EXISTS preset_id text;
--> statement-breakpoint
ALTER TABLE attempt ADD CONSTRAINT attempt_retry_of_fk FOREIGN KEY (retry_of) REFERENCES attempt(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attempt_retry_idx ON attempt (retry_of) WHERE retry_of IS NOT NULL;
--> statement-breakpoint
ALTER TABLE response ADD COLUMN IF NOT EXISTS retry boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- Hari tanpa catatan butuh 9 sesi wajib (sebelumnya 3 quest).
ALTER TABLE day_record ALTER COLUMN quests_required SET DEFAULT 9;
