import { afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'

/**
 * Audit struktur keamanan database: setiap tabel data di skema public memakai RLS yang DIPAKSA dan punya
 * kebijakan; tabel identitas (skema auth) hanya bisa dibuka role kira_auth; fungsi SECURITY DEFINER
 * mengunci search_path dan tidak bisa dijalankan PUBLIC atau kira_app.
 */
const url = process.env.DATABASE_URL_OWNER
const conn = url ? postgres(url, { max: 1, onnotice: () => {} }) : (null as never)

// Tabel di luar jalur anak/keluarga: pencatat migrasi dan jadwal worker (tidak berisi data anak).
const NO_RLS_PUBLIC = new Set(['kira_migration', 'schedule_state'])

describe.skipIf(!url)('audit RLS dan fungsi', () => {
  afterAll(async () => {
    await conn?.end()
  })

  it('setiap tabel public (selain pengecualian) memakai RLS FORCE dan punya kebijakan', async () => {
    const rows = await conn<{ relname: string; rls: boolean; force: boolean; policies: number }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as force,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')`
    const bad = rows.filter((r) => !NO_RLS_PUBLIC.has(r.relname) && !(r.rls && r.force && r.policies > 0)).map((r) => r.relname)
    expect(bad).toEqual([])
  })

  it('kira_app dan kira_worker tidak bisa memakai skema auth', async () => {
    const [r] = await conn<{ app: boolean; worker: boolean; auth: boolean }[]>`
      select has_schema_privilege('kira_app','auth','usage') as app, has_schema_privilege('kira_worker','auth','usage') as worker,
             has_schema_privilege('kira_auth','auth','usage') as auth`
    expect(r).toEqual({ app: false, worker: false, auth: true })
  })

  it('tidak ada role aplikasi yang superuser atau bypass RLS', async () => {
    const rows = await conn<{ rolname: string }[]>`select rolname from pg_roles where rolname in ('kira_app','kira_auth','kira_worker') and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)`
    expect(rows).toEqual([])
  })

  it('fungsi SECURITY DEFINER: search_path terkunci, tidak bisa dijalankan PUBLIC', async () => {
    const rows = await conn<{ name: string; cfg: string[] | null; pub: boolean; app: boolean }[]>`
      select p.proname as name, p.proconfig as cfg,
             has_function_privilege('public', p.oid, 'execute') as pub,
             has_function_privilege('kira_app', p.oid, 'execute') as app
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ('public', 'auth')`
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.cfg?.some((c) => c.startsWith('search_path=')), `${r.name} tanpa search_path`).toBe(true)
      expect(r.pub, `${r.name} bisa dijalankan PUBLIC`).toBe(false)
      // Hanya kira_org_count (jumlah org untuk /setup) yang boleh dibuka untuk role aplikasi.
      if (r.name !== 'kira_org_count') expect(r.app, `${r.name} bisa dijalankan kira_app`).toBe(false)
    }
  })

  it('audit_log dan consent_event append-only untuk kira_app', async () => {
    const rows = await conn<{ t: string; p: string }[]>`
      select table_name as t, privilege_type as p from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'kira_app' and table_name in ('audit_log','consent_event') and privilege_type in ('UPDATE','DELETE','TRUNCATE')`
    expect(rows).toEqual([])
  })
})
