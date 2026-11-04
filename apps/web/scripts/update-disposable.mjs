// Memperbarui snapshot daftar domain email sekali pakai.
// Sumber: https://github.com/disposable-email-domains/disposable-email-domains (CC0 1.0 Universal, domain publik).
// Pemakaian: pnpm --filter @kira/web update-disposable   (dijadwalkan mingguan oleh pemilik server)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const URL_LIST = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf'
const out = fileURLToPath(new URL('../src/server/signup/disposable-snapshot.ts', import.meta.url))

const res = await fetch(URL_LIST, { signal: AbortSignal.timeout(30000) })
if (!res.ok) {
  console.error(`Gagal mengunduh daftar: HTTP ${res.status}`)
  process.exit(1)
}
const domains = [...new Set((await res.text()).split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#') && /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(l)))].sort()
if (domains.length < 1000) {
  console.error(`Daftar terlalu pendek (${domains.length}), snapshot lama dipertahankan.`)
  process.exit(1)
}
const body = `// Snapshot daftar domain email sekali pakai. DIHASILKAN oleh scripts/update-disposable.mjs, jangan diedit tangan.
// Sumber: disposable-email-domains/disposable-email-domains (https://github.com/disposable-email-domains/disposable-email-domains),
// lisensi CC0 1.0 Universal (domain publik), tidak wajib atribusi namun dicantumkan di sini.
// Diambil ${new Date().toISOString().slice(0, 10)}, ${domains.length} domain.
export const DISPOSABLE_SNAPSHOT_DATE = '${new Date().toISOString().slice(0, 10)}'
export const DISPOSABLE_SNAPSHOT: readonly string[] = ${JSON.stringify(domains)}
`
writeFileSync(out, body)
console.log(`Snapshot diperbarui: ${domains.length} domain.`)
