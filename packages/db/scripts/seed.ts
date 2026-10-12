import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { hash } from '@node-rs/argon2'
import postgres from 'postgres'

/**
 * Data contoh untuk pengembangan dan tes E2E. Semua nama palsu dan org ditandai __GTX_SEED__.
 * Tidak pernah dijalankan di produksi: butuh KIRA_ALLOW_SEED=1 dan NODE_ENV bukan production.
 *
 * Akun contoh:
 *   tutor@contoh.test / kira-tutor-contoh-2026
 *   mama@contoh.test  / kira-mama-contoh-2026
 *   Aisha (Grade 2) PIN: sun moon star cat
 *   Raka  (Grade 4) PIN: tree apple boat ball
 */
if (process.env.NODE_ENV === 'production' || process.env.KIRA_ALLOW_SEED !== '1') {
  console.error('Seed ditolak. Set KIRA_ALLOW_SEED=1 di lingkungan pengembangan.')
  process.exit(1)
}
const url = process.env.DATABASE_URL_OWNER
if (!url) {
  console.error('DATABASE_URL_OWNER belum diisi')
  process.exit(1)
}
const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined
const sql = postgres(url, { max: 1, onnotice: () => {}, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) })
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as never }

const ORG_NAME = 'Keluarga Contoh __GTX_SEED__'
const existing = await sql`select id from org where name = ${ORG_NAME} limit 1`
if (existing[0] && !process.argv.includes('--reset')) {
  console.log('Data contoh sudah ada. Pakai --reset untuk membuat ulang.')
  await sql.end()
  process.exit(0)
}
if (existing[0]) {
  const orgId = existing[0].id as string
  await sql`delete from auth.session where org_id = ${orgId}`
  await sql`delete from auth.device where org_id = ${orgId}`
  await sql`delete from auth.invite where org_id = ${orgId}`
  await sql`delete from auth.user_account where org_id = ${orgId}`
  await sql`delete from org where id = ${orgId}`
}

const orgId = randomUUID()
const tutorId = randomUUID()
const mamaId = randomUUID()
const aishaId = randomUUID()
const rakaId = randomUUID()
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

await sql.begin(async (tx) => {
  await tx`insert into org (id, name) values (${orgId}, ${ORG_NAME})`
  await tx`insert into auth.user_account (id, org_id, kind, role, email, name, password_hash, password_changed_at) values
    (${tutorId}, ${orgId}, 'adult', 'tutor', 'tutor@contoh.test', 'Tutor Contoh', ${await hash('kira-tutor-contoh-2026', ARGON)}, now()),
    (${mamaId}, ${orgId}, 'adult', 'guardian', 'mama@contoh.test', 'Mama Contoh', ${await hash('kira-mama-contoh-2026', ARGON)}, now())`
  await tx`insert into auth.user_account (id, org_id, kind, role, email, name) values
    (${aishaId}, ${orgId}, 'learner', 'learner', null, 'Aisha'),
    (${rakaId}, ${orgId}, 'learner', 'learner', null, 'Raka')`
  await tx`insert into auth.learner_secret (user_id, pin_hash) values
    (${aishaId}, ${await hash('kira-pin:sun-moon-star-cat', ARGON)}),
    (${rakaId}, ${await hash('kira-pin:tree-apple-boat-ball', ARGON)})`
  await tx`insert into member_profile (user_id, org_id, name, role, email) values
    (${tutorId}, ${orgId}, 'Tutor Contoh', 'tutor', 'tutor@contoh.test'),
    (${mamaId}, ${orgId}, 'Mama Contoh', 'guardian', 'mama@contoh.test')`
  await tx`insert into learner_profile (user_id, org_id, name, avatar, grade, active) values
    (${aishaId}, ${orgId}, 'Aisha', 'fox', 2, true),
    (${rakaId}, ${orgId}, 'Raka', 'cat', 4, true)`
  await tx`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${mamaId}, ${aishaId}), (${orgId}, ${mamaId}, ${rakaId})`
  for (const learner of [aishaId, rakaId]) {
    for (const purpose of ['learning', 'progress-email', 'audio', 'photo', 'ai-drafts']) {
      await tx`insert into consent_event (org_id, learner_id, guardian_id, recorded_by, purpose, granted, notice_version, method)
        values (${orgId}, ${learner}, ${mamaId}, ${mamaId}, ${purpose}, true, '2026-10-12', 'in-app')`
    }
  }
  const inDays = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  await tx`insert into competition_event (org_id, competition_id, name, subjects, date, date_is_estimate, registration_close, preset_id, status, learner_ids) values
    (${orgId}, 'kmnr', 'KMNR', ${['math']}, ${inDays(41)}, false, ${inDays(20)}, 'kmnr-2026', 'not-registered', ${[aishaId]}),
    (${orgId}, 'esmo', 'ESMO 4, final', ${['math', 'english']}, ${inDays(30)}, false, null, 'esmo-math-2026', 'registered', ${[aishaId]}),
    (${orgId}, 'ikmc', 'IKMC Pre-Ecolier', ${['math']}, ${inDays(170)}, true, null, 'ikmc-pre-ecolier-2027', 'not-open', ${[aishaId]})`
})

console.log(`Data contoh dibuat untuk org ${orgId}`)
console.log('Tutor: tutor@contoh.test / kira-tutor-contoh-2026')
console.log('Orang tua: mama@contoh.test / kira-mama-contoh-2026')
console.log('Learner: Aisha (PIN sun moon star cat), Raka (PIN tree apple boat ball)')
await sql.end()
