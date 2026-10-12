# ADR 0003: Antrean job di tabel Postgres

Status: diterima, 12 Oktober 2026. Menggantikan pg-boss.

## Keputusan

Job disimpan di tabel `job` (kena RLS per org). Aplikasi menulis job lalu memanggil `pg_notify('kira_job', id)`. Worker mendengarkan notifikasi dan juga memeriksa setiap 15 detik, lalu mengambil job lewat fungsi `kira_claim_jobs()` (SECURITY DEFINER, `FOR UPDATE SKIP LOCKED`). Setiap job diproses di dalam `withOrg` milik org job itu. Jadwal berkala (backup, laporan mingguan, retensi) dicatat di tabel `schedule_state` supaya tidak dobel setelah restart.

## Alasan

Volume job keluarga kecil (puluhan per hari). Satu tabel dengan RLS lebih mudah diaudit daripada skema pg-boss, dan aplikasi tidak butuh hak ke skema antrean pihak ketiga.
