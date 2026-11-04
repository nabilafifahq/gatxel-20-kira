import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * support_ticket di Postgres sungguhan: RLS, hak role yang sempit, batasan CR dan LF, retensi, dan jalur DAL yang
 * menulis pesan serta emailnya dalam satu transaksi. Butuh DATABASE_URL_OWNER, _APP, _AUTH, _WORKER dan migrasi.
 */
const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP, auth: process.env.DATABASE_URL_AUTH, worker: process.env.DATABASE_URL_WORKER }
const ready = Object.values(urls).every(Boolean)
const conn = (u: string | undefined) => postgres(u!, { max: 2, onnotice: () => {} })

describe.skipIf(!ready)('support_ticket', () => {
  const owner = ready ? conn(urls.owner) : (null as never)
  const app = ready ? conn(urls.app) : (null as never)
  const authDb = ready ? conn(urls.auth) : (null as never)
  const worker = ready ? conn(urls.worker) : (null as never)
  const run = randomUUID().slice(0, 8)
  const ref = (n: string) => `KR-T${run}${n}`
  let support: typeof import('@/server/dal/support')
  let dbm: typeof import('@/server/db')

  const insert = (db: postgres.Sql, reference: string, over: Partial<{ subject: string; email: string }> = {}) =>
    db`insert into support_ticket (reference, category, subject, message, sender_email) values (${reference}, 'bug', ${over.subject ?? 'Subjek uji'}, 'Isi pesan uji yang cukup panjang', ${over.email ?? 'ortu@example.com'})`

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'https://kira.test'
    process.env.DATABASE_URL_APP = urls.app!
    process.env.DATABASE_URL_AUTH = urls.auth!
    process.env.KIRA_SECRET = 'uji-pesan-bantuan-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '/tmp/kira-uji'
    process.env.KIRA_SUPPORT_EMAIL = 'tim.a@gatxel.test, tim.b@gatxel.test'
    support = await import('@/server/dal/support')
    dbm = await import('@/server/db')
  })

  afterAll(async () => {
    await owner`delete from support_ticket where reference like ${`KR-T${run}%`}`
    await owner`delete from public_mail where subject like ${`%KR-T${run}%`}`
    await Promise.all([owner.end(), app.end(), authDb.end(), worker.end()])
    await (dbm as unknown as { closeDb?: () => Promise<void> })?.closeDb?.()
  })

  it('RLS aktif dan dipaksa', async () => {
    const [t] = await owner`select relrowsecurity as on, relforcerowsecurity as forced from pg_class where oid = 'public.support_ticket'::regclass`
    expect(t).toMatchObject({ on: true, forced: true })
  })

  it('hak role sesuai migrasi: kira_app hanya INSERT, role lain tidak punya hak', async () => {
    const [p] = await owner`
      select has_table_privilege('kira_app', 'support_ticket', 'INSERT') as app_insert,
             has_table_privilege('kira_app', 'support_ticket', 'SELECT') as app_select,
             has_table_privilege('kira_app', 'support_ticket', 'UPDATE') as app_update,
             has_table_privilege('kira_app', 'support_ticket', 'DELETE') as app_delete,
             has_table_privilege('kira_worker', 'support_ticket', 'SELECT') as worker_select,
             has_table_privilege('kira_worker', 'support_ticket', 'INSERT') as worker_insert,
             has_table_privilege('kira_auth', 'support_ticket', 'SELECT') as auth_select,
             has_table_privilege('kira_auth', 'support_ticket', 'INSERT') as auth_insert`
    expect(p).toEqual({ app_insert: true, app_select: false, app_update: false, app_delete: false, worker_select: false, worker_insert: false, auth_select: false, auth_insert: false })
  })

  it('kira_app bisa menambah, tetapi tidak bisa membaca, mengubah, atau menghapus', async () => {
    await insert(app, ref('a'))
    await expect(app`select * from support_ticket`).rejects.toThrow(/permission denied/)
    await expect(app`update support_ticket set subject = 'x'`).rejects.toThrow(/permission denied/)
    await expect(app`delete from support_ticket`).rejects.toThrow(/permission denied/)
    await expect(worker`select * from support_ticket`).rejects.toThrow(/permission denied/)
    await expect(authDb`select * from support_ticket`).rejects.toThrow(/permission denied/)
    const [row] = await owner`select reference from support_ticket where reference = ${ref('a')}`
    expect(row?.reference).toBe(ref('a'))
  })

  it('kira_app tetap tidak bisa membaca kotak keluar publik', async () => {
    await expect(app`select * from public_mail`).rejects.toThrow(/permission denied/)
  })

  it('CR dan LF ditolak di subjek dan alamat, juga di tingkat database', async () => {
    await expect(insert(app, ref('b'), { subject: 'Halo\r\nBcc: x@y.z' })).rejects.toThrow(/check constraint/)
    await expect(insert(app, ref('c'), { email: 'a@b.c\r\nBcc: x@y.z' })).rejects.toThrow(/check constraint/)
    await expect(insert(app, ref('d'), { email: 'a b@c.d' })).rejects.toThrow(/check constraint/)
  })

  it('nomor referensi unik', async () => {
    await insert(app, ref('u'))
    await expect(insert(app, ref('u'))).rejects.toThrow(/unique/)
  })

  it('kategori di luar daftar ditolak', async () => {
    await expect(app`insert into support_ticket (reference, category, subject, message, sender_email) values (${ref('k')}, 'palsu', 'Subjek', 'Isi', 'a@b.c')`).rejects.toThrow(/check constraint/)
  })

  it('retensi: pesan lebih tua dari 12 bulan dihapus kira_purge_public lewat kira_worker', async () => {
    await owner`insert into support_ticket (reference, category, subject, message, sender_email, created_at) values (${ref('lama')}, 'bug', 'Lama', 'Isi lama', 'a@b.c', now() - interval '13 months')`
    await owner`insert into support_ticket (reference, category, subject, message, sender_email, created_at) values (${ref('baru')}, 'bug', 'Baru', 'Isi baru', 'a@b.c', now() - interval '11 months')`
    await worker`select kira_purge_public()`
    const rows = await owner`select reference from support_ticket where reference in (${ref('lama')}, ${ref('baru')})`
    expect(rows.map((r) => r.reference)).toEqual([ref('baru')])
  })

  it('akun yang dihapus tidak meninggalkan id, pesan tetap ada', async () => {
    const reference = ref('akun')
    const orgId = randomUUID()
    await owner`insert into org (id, name) values (${orgId}, ${`Uji Bantuan ${run}`})`
    const [user] = await owner<{ id: string }[]>`insert into auth.user_account (org_id, kind, role, email, email_norm, name, password_hash) values (${orgId}, 'adult', 'guardian', ${`bantuan.${run}@uji.test`}, ${`bantuan.${run}@uji.test`}, 'Uji', 'x') returning id`
    await app`insert into support_ticket (reference, category, subject, message, sender_email, account_id, account_role) values (${reference}, 'saran', 'Subjek', 'Isi', ${`bantuan.${run}@uji.test`}, ${user!.id}, 'guardian')`
    await owner`delete from auth.user_account where id = ${user!.id}`
    await owner`delete from org where id = ${orgId}`
    const [row] = await owner`select account_id from support_ticket where reference = ${reference}`
    expect(row?.account_id).toBeNull()
  })

  it('DAL menulis pesan, email ke tim, dan balasan otomatis dalam satu transaksi', async () => {
    const reference = ref('dal')
    const out = await support.createSupportTicket({
      reference,
      category: 'bug',
      subject: 'Tombol rusak',
      message: 'Tombol simpan tidak merespons <script>alert(1)</script>',
      senderEmail: `pengirim.${run}@uji.test`,
      account: null,
      userAgent: 'Agen uji',
      screen: '390x844',
      appVersion: '0.1.0',
      pageFrom: '/keluarga',
      ipHash: 'hash',
      attachment: { path: '2026-11/abc.png', name: 'foto.png', mime: 'image/png', bytes: 123 },
      sendConfirmation: true,
    })
    expect(out.mailedTeam).toBe(true)
    const [ticket] = await owner`select * from support_ticket where reference = ${reference}`
    expect(ticket).toMatchObject({ category: 'bug', subject: 'Tombol rusak', sender_email: `pengirim.${run}@uji.test`, attachment_name: 'foto.png', attachment_bytes: 123, screen: '390x844' })
    const mails = await owner`select to_addr, subject, reply_to, kind, attachment_path, text, html from public_mail where subject like ${`%${reference}%`} order by kind`
    expect(mails.map((m) => m.kind)).toEqual(['support-confirm', 'support-ticket'])
    const [confirm, team] = mails
    expect(team).toMatchObject({ to_addr: 'tim.a@gatxel.test, tim.b@gatxel.test', reply_to: `pengirim.${run}@uji.test`, attachment_path: '2026-11/abc.png' })
    expect(team!.subject).toBe(`[Kira][Bug] Tombol rusak (${reference})`)
    expect(team!.html).not.toContain('<script>')
    expect(confirm).toMatchObject({ to_addr: `pengirim.${run}@uji.test`, reply_to: null, attachment_path: null })
    expect(confirm!.text).not.toContain('Tombol')
    expect(confirm!.text).not.toContain('merespons')
    expect(confirm!.html).not.toContain('merespons')
  })

  it('bila penulisan email gagal, pesan ikut batal', async () => {
    const reference = ref('batal')
    await expect(
      support.createSupportTicket({
        reference,
        category: 'bug',
        subject: 'Tombol rusak',
        message: 'x'.repeat(6000),
        senderEmail: 'a@uji.test',
        account: null,
        userAgent: '',
        screen: '',
        appVersion: '0.1.0',
        pageFrom: '',
        ipHash: 'hash',
        attachment: null,
        sendConfirmation: true,
      }),
    ).rejects.toThrow()
    expect(await owner`select 1 from support_ticket where reference = ${reference}`).toHaveLength(0)
    expect(await owner`select 1 from public_mail where subject like ${`%${reference}%`}`).toHaveLength(0)
  })
})
