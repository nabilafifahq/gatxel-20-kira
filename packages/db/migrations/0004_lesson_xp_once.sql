-- XP pelajaran paling banyak sekali per learner, skill, dan tanggal belajar. Sebelumnya action pelajaran
-- bisa dipanggil berulang untuk menambah XP. Baris ganda lama dihapus dulu supaya indeks unik bisa dibuat;
-- RLS dimatikan sementara untuk pemilik tabel di dalam transaksi migrasi ini saja.
ALTER TABLE xp_event NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DELETE FROM xp_event a USING xp_event b
WHERE a.reason = 'lesson' AND b.reason = 'lesson' AND a.learner_id = b.learner_id AND a.ref = b.ref AND a.date = b.date AND a.id > b.id;
--> statement-breakpoint
ALTER TABLE xp_event FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS xp_event_lesson_once ON xp_event (learner_id, ref, date) WHERE reason = 'lesson';
