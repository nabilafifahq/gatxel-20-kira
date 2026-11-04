// Seed uji beban: membuat N keluarga (1 wali + C anak) di database STAGING saja, lengkap dengan sesi dan perangkat
// yang tokennya diketahui, supaya k6 tidak perlu login untuk setiap skenario. Hasilnya ditulis ke families.json.
// Jalankan di dalam image web staging (punya postgres dan argon2):
//   docker compose -p kirastg --env-file <env.staging> --profile loadtest run --rm --entrypoint node seed /load/seed-load.mjs
// Penjaga: menolak bila KIRA_ORIGIN bukan http://127.0.0.1 atau KIRA_LOADTEST_OK bukan 1. Tidak pernah untuk produksi.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'

// Image standalone Next menyimpan paket di /app/node_modules/.pnpm/<nama>@<versi>/node_modules/<nama> (toko pnpm datar).
const require = createRequire('/app/package.json')
const store = (pkg) => {
  const dir = readdirSync('/app/node_modules/.pnpm').find((d) => d.startsWith(pkg.replace('/', '+') + '@'))
  return `/app/node_modules/.pnpm/${dir}/node_modules/${pkg}`
}
const postgres = (await import(store('postgres') + '/src/index.js')).default
const { hash } = require(store('@node-rs/argon2'))

if (process.env.KIRA_LOADTEST_OK !== '1' || !(process.env.KIRA_ORIGIN ?? '').startsWith('http://127.0.0.1')) {
  console.error('Seed uji beban ditolak: hanya untuk staging (KIRA_LOADTEST_OK=1 dan KIRA_ORIGIN=http://127.0.0.1:...).')
  process.exit(1)
}
const url = process.env.DATABASE_URL_OWNER
if (!url) throw new Error('DATABASE_URL_OWNER belum diisi')
const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined
const sql = postgres(url, { max: 2, onnotice: () => {}, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) })

const N = Number(process.env.FAMILIES ?? 100)
const KIDS = Number(process.env.CHILDREN ?? 2)
const OUT = process.env.OUT ?? '/out/families.json'
const PASSWORD = process.env.LOAD_PASSWORD ?? 'Loadtest-Kira-2026-ok'
const PIN = ['sun', 'moon', 'star', 'cat']
const sha = (s) => createHash('sha256').update(s).digest('hex')
const tok = () => randomBytes(32).toString('hex')
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 }
const TAG = '__LOADTEST__'

if (process.argv.includes('--reset')) {
  const orgs = await sql`select id from org where name like ${'%' + TAG}`
  const ids = orgs.map((o) => o.id)
  if (ids.length) {
    // Tabel anak dihapus lewat cascade; urutan mengikuti seed.ts.
    await sql`delete from auth.session where org_id in ${sql(ids)}`
    await sql`delete from auth.device where org_id in ${sql(ids)}`
    await sql`delete from auth.user_account where org_id in ${sql(ids)}`
    await sql`delete from org where id in ${sql(ids)}`
  }
  console.log(`dihapus ${ids.length} keluarga uji beban`)
  if (!process.argv.includes('--and-create')) process.exit(0)
}

const pwHash = await hash(PASSWORD, ARGON)
const pinHash = await hash('kira-pin:' + PIN.join('-'), ARGON)
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const families = []
const BATCH = 25
for (let start = 0; start < N; start += BATCH) {
  const end = Math.min(N, start + BATCH)
  await sql.begin(async (tx) => {
    for (let i = start; i < end; i++) {
      const orgId = randomUUID()
      const gid = randomUUID()
      const email = `lt${i}@loadtest.test`
      const devTok = tok()
      const gTok = tok()
      const kids = Array.from({ length: KIDS }, (_, k) => ({ id: randomUUID(), name: `Anak${i}-${k}`, grade: 1 + ((i + k * 2) % 6), token: tok() }))
      await tx`insert into org (id, name, settings) values (${orgId}, ${'Keluarga ' + i + ' ' + TAG}, '{}'::jsonb)`
      await tx`insert into auth.user_account (id, org_id, kind, role, email, name, password_hash, password_changed_at) values (${gid}, ${orgId}, 'adult', 'guardian', ${email}, ${'Wali ' + i}, ${pwHash}, now())`
      await tx`insert into member_profile (user_id, org_id, name, role, email) values (${gid}, ${orgId}, ${'Wali ' + i}, 'guardian', ${email})`
      for (const k of kids) {
        await tx`insert into auth.user_account (id, org_id, kind, role, email, name) values (${k.id}, ${orgId}, 'learner', 'learner', null, ${k.name})`
        await tx`insert into auth.learner_secret (user_id, pin_hash) values (${k.id}, ${pinHash})`
        await tx`insert into learner_profile (user_id, org_id, name, avatar, grade, active, rest_weekdays, screen_limit_min) values (${k.id}, ${orgId}, ${k.name}, 'fox', ${k.grade}, true, '{}'::int[], 240)`
        await tx`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${gid}, ${k.id})`
        for (const purpose of ['learning', 'progress-email', 'audio', 'photo', 'ai-drafts']) {
          await tx`insert into consent_event (org_id, learner_id, guardian_id, recorded_by, purpose, granted, notice_version, method) values (${orgId}, ${k.id}, ${gid}, ${gid}, ${purpose}, true, '2026-10-12', 'in-app')`
        }
      }
      const devId = randomUUID()
      await tx`insert into auth.device (id, org_id, name, token_hash, learner_ids, registered_by, expires_at) values (${devId}, ${orgId}, 'Tablet uji', ${sha(devTok)}, ${kids.map((k) => k.id)}, ${gid}, now() + interval '30 days')`
      await tx`insert into auth.session (id, user_id, org_id, kind, expires_at) values (${sha(gTok)}, ${gid}, ${orgId}, 'adult', now() + interval '23 hours')`
      for (const k of kids) {
        await tx`insert into auth.session (id, user_id, org_id, kind, device_id, expires_at) values (${sha(k.token)}, ${k.id}, ${orgId}, 'learner', ${devId}, now() + interval '23 hours')`
      }
      families.push({ i, orgId, email, password: PASSWORD, guardianId: gid, guardianToken: gTok, deviceToken: devTok, pin: PIN, kids })
    }
  })
  console.log(`keluarga ${end}/${N}`)
}
writeFileSync(OUT, JSON.stringify(families))
console.log(`ditulis ${OUT}: ${families.length} keluarga, ${families.length * KIDS} anak (tanggal ${today})`)
await sql.end()
