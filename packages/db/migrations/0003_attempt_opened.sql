-- Waktu learner pertama kali membuka attempt di runner. Quest harian dibuat saat Today dimuat,
-- jadi jam tes berwaktu dihitung dari opened_at, bukan dari started_at (waktu attempt dibuat).
ALTER TABLE attempt ADD COLUMN IF NOT EXISTS opened_at timestamptz;
