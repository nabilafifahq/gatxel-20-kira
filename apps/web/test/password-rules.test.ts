import { beforeAll, describe, expect, it } from 'vitest'
import { passwordProblem as browserProblem } from '@/components/console/PasswordField'
import { PASSWORD_MIN, PASSWORD_RULES, passwordRuleProblem } from '@/lib/password-rules'
import { passwordProblem as serverProblem } from '@/server/auth/password'

const STRONG = 'Abcdefghijk1!'

describe('aturan password', () => {
  beforeAll(() => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = 'postgres://uji:uji@127.0.0.1:1/uji'
    process.env.DATABASE_URL_AUTH = 'postgres://uji:uji@127.0.0.1:1/uji'
    process.env.KIRA_SECRET = 'uji-aturan-password-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_HIBP = 'off'
  })

  it('13 karakter dengan huruf kapital, angka, dan simbol diterima; 12 karakter ditolak', () => {
    expect(PASSWORD_MIN).toBe(13)
    expect([...STRONG]).toHaveLength(13)
    expect(passwordRuleProblem(STRONG)).toBeNull()
    expect(passwordRuleProblem('Abcdefghij1!')).toBe('Password paling sedikit 13 karakter.')
  })

  it.each([
    ['huruf kapital', 'abcdefghijk1!', /huruf kapital/],
    ['angka', 'Abcdefghijkl!', /satu angka/],
    ['simbol', 'Abcdefghijkl1', /satu simbol/],
  ])('tanpa %s ditolak dengan pesan yang tepat', (_label, password, message) => {
    expect(passwordRuleProblem(password)).toMatch(message)
  })

  it('spasi tidak dihitung sebagai simbol, dan panjang dihitung per karakter', () => {
    expect(passwordRuleProblem('Abcdefghijk1 ')).toMatch(/satu simbol/)
    expect(passwordRuleProblem(`A1${'😀'.repeat(10)}`)).toMatch(/13 karakter/)
    expect(passwordRuleProblem(`A1${'😀'.repeat(11)}`)).toBeNull()
  })

  it('setiap syarat di daftar centang terpenuhi oleh password yang diterima', () => {
    for (const rule of PASSWORD_RULES) expect(rule.test(STRONG), rule.key).toBe(true)
    for (const rule of PASSWORD_RULES) expect(rule.test(''), rule.key).toBe(false)
  })

  it('browser dan server memberi pesan yang sama untuk password yang melanggar syarat', async () => {
    for (const password of ['Pendek-1!', 'abcdefghijk1!', 'Abcdefghijkl!', 'Abcdefghijkl1']) {
      expect(browserProblem(password)).toBe(await serverProblem(password, {}))
    }
    expect(browserProblem(STRONG)).toBeNull()
    expect(await serverProblem(STRONG, {})).toBeNull()
  })

  it('server juga menolak password yang terlalu panjang atau memuat bagian awal email', async () => {
    expect(await serverProblem(`${STRONG}${'a'.repeat(116)}`, {})).toMatch(/128 karakter/)
    expect(await serverProblem('Bu.Ani-kalimat-2026!', { email: 'bu.ani@gmail.com' })).toMatch(/alamat email/)
  })
})
