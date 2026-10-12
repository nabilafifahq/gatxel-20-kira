# ADR 0004: AI lewat Claude Code sekarang, endpoint OpenAI-compatible nanti

Status: diterima, 12 Oktober 2026.

## Keputusan

- Worker memanggil AI lewat antarmuka `AiProvider` dengan dua implementasi:
  - `claude-code`: menjalankan `claude -p` dengan `--output-format json`, `--json-schema`, `--tools Read`, `--permission-prompts none`, `--no-session-persistence`, dan `--strict-mcp-config` di folder sementara. Login memakai `CLAUDE_CODE_OAUTH_TOKEN` hasil `claude setup-token` dari akun Claude Max. Mode `--bare` tidak dipakai karena mode itu hanya membaca `ANTHROPIC_API_KEY`.
  - `openai-compatible`: `POST /chat/completions` dengan `response_format` JSON Schema. Dipakai untuk model lokal Gatxel di ai.gatxel.com atau DeepInfra saat learner bertambah.
- AI hanya ada di konsol tutor: draf soal, varian, terjemahan, hint, rubrik, saran nilai dari foto, dan bantuan impor paket PDF. Semua hasil masuk ke tabel draf dan baru menjadi soal setelah tutor menyetujui.
- Prompt tidak memuat nama, email, atau identitas anak. Foto jawaban dikirim tanpa metadata EXIF.
- Batas bulanan `AI_MONTHLY_JOB_LIMIT` menghentikan job baru, dan setiap job mencatat durasi, model, dan pemakaian token bila tersedia.

## Konsekuensi

Langganan Claude Max dipakai untuk pemakaian pribadi keluarga. Kalau Kira dibuka untuk orang lain, provider harus pindah ke API berbayar atau model lokal karena ketentuan langganan.
