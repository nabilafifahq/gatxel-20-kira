import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

/**
 * Migrator sederhana: menjalankan migrations/*.sql berurutan nama, masing-masing dalam satu transaksi.
 * Pernyataan dipisah dengan "--> statement-breakpoint". Dijalankan sebagai kira_owner.
 */
const url = process.env.DATABASE_URL_OWNER
if (!url) {
  console.error('DATABASE_URL_OWNER belum diisi')
  process.exit(1)
}
const dir = process.env.KIRA_MIGRATIONS_DIR ?? join(import.meta.dirname, '..', 'migrations')
const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined
const sql = postgres(url, { max: 1, onnotice: () => {}, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) })

await sql`create table if not exists kira_migration (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`
await sql`revoke all on kira_migration from public`
const applied = new Map((await sql<{ name: string; sha256: string }[]>`select name, sha256 from kira_migration`).map((r) => [r.name, r.sha256]))

const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
let ran = 0
for (const file of files) {
  const body = readFileSync(join(dir, file), 'utf8')
  const hash = createHash('sha256').update(body).digest('hex')
  const prev = applied.get(file)
  if (prev) {
    if (prev !== hash) console.warn(`Peringatan: ${file} berubah setelah dijalankan. Buat migrasi baru, jangan ubah yang lama.`)
    continue
  }
  const statements = body.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
  await sql.begin(async (tx) => {
    for (const st of statements) await tx.unsafe(st)
    await tx`insert into kira_migration (name, sha256) values (${file}, ${hash})`
  })
  console.log(`migrasi ${file} (${statements.length} pernyataan)`)
  ran++
}
console.log(ran === 0 ? 'Database sudah terbaru.' : `${ran} migrasi dijalankan.`)
await sql.end()
