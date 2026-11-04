import { beforeAll, describe, expect, it } from 'vitest'
import { passwordProblem as browserProblem } from '@/components/console/PasswordField'
import { PASSWORD_MIN, PASSWORD_RULES, passwordRuleProblem } from '@/lib/password-rules'
import { passwordProblem as serverProblem } from '@/server/auth/password'

const STRONG = 'Abcdefgh123!'

describe('aturan password', () => {
  beforeAll(() => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = 'postgres://uji:uji@127.0.0.1:1/uji'
    process.env.DATABASE_URL_AUTH = 'postgres://uji:uji@127.0.0.1:1/uji'
    process.env.KIRA_SECRET = 'uji-aturan-password-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_HIBP = 'off'
  })

  it('12 karakter dengan huruf kapital, angka, dan simbol diterima; 11 karakter ditolak', () => {
    expect(PASSWORD_MIN).toBe(12)
    expect([...STRONG]).toHaveLength(12)
    expect(passwordRuleProblem(STRONG)).toBeNull()
    expect(passwordRuleProblem('Abcdefgh12!')).toBe('Password paling sedikit 12 karakter.')
  })

  it.each([
    ['huruf kapital', 'abcdefghij1!', /huruf kapital/],
    ['angka', 'Abcdefghijk!', /satu angka/],
    ['simbol', 'Abcdefghijk1', /satu simbol/],
  ])('tanpa %s ditolak dengan pesan yang tepat', (_label, password, message) => {
    expect(passwordRuleProblem(password)).toMatch(message)
  })

  it('spasi tidak dihitung sebagai simbol, dan panjang dihitung per karakter', () => {
    expect(passwordRuleProblem('Abcdefghij1 ')).toMatch(/satu simbol/)
    expect(passwordRuleProblem(`A1${'😀'.repeat(9)}`)).toMatch(/12 karakter/)
    expect(passwordRuleProblem(`A1${'😀'.repeat(10)}`)).toBeNull()
  })

  it('setiap syarat di daftar centang terpenuhi oleh password yang diterima', () => {
    for (const rule of PASSWORD_RULES) expect(rule.test(STRONG), rule.key).toBe(true)
    for (const rule of PASSWORD_RULES) expect(rule.test(''), rule.key).toBe(false)
  })

  it('browser dan server memberi pesan yang sama untuk password yang melanggar syarat', async () => {
    for (const password of ['Pendek-1!', 'abcdefghij1!', 'Abcdefghijk!', 'Abcdefghijk1']) {
      expect(browserProblem(password)).toBe(await serverProblem(password, {}))
    }
    expect(browserProblem(STRONG)).toBeNull()
    expect(await serverProblem(STRONG, {})).toBeNull()
  })

  it('server juga menolak password yang terlalu panjang atau memuat bagian awal email', async () => {
    expect(await serverProblem(`${STRONG}${'a'.repeat(117)}`, {})).toMatch(/128 karakter/)
    expect(await serverProblem('Bu.Ani-kalimat-2026!', { email: 'bu.ani@gmail.com' })).toMatch(/alamat email/)
  })
})
