import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN, PASSWORD_RULES, passwordInputProblem, passwordRuleProblem } from '@/lib/password-rules'
import { addChildProblems, GUARDIAN_CONSENT_MESSAGE, isComplete, signupProblems, TERMS_MESSAGE, waitlistProblems, WAITLIST_CONSENT_MESSAGE } from '@/lib/required-rules'
import { signUpSchema } from '@/server/actions/signup-schemas'

const PASSWORD = 'Kalimat-2026!'
const signup = { name: 'Ibu Sari', email: 'sari@gmail.com', password: PASSWORD, consent: true, captchaNeeded: false }

describe('aturan password', () => {
  it('minimal 12 karakter, dengan huruf kapital, angka, dan simbol', () => {
    expect(PASSWORD_MIN).toBe(12)
    expect(PASSWORD_RULES.find((r) => r.key === 'length')?.label).toBe('Minimal 12 karakter')
    expect(passwordRuleProblem('Abcdefgh12!')).toBe('Password paling sedikit 12 karakter.')
    expect(passwordRuleProblem('Abcdefgh123!')).toBeNull()
    expect(passwordRuleProblem('abcdefgh123!')).toMatch(/huruf kapital/)
    expect(passwordRuleProblem('Abcdefghijk!')).toMatch(/angka/)
    expect(passwordRuleProblem('Abcdefgh1234')).toMatch(/simbol/)
    expect(passwordInputProblem('')).toBe('Isi password dulu.')
  })
})

describe('isian wajib', () => {
  it('daftar: lengkap bila semua isian dan persetujuan terpenuhi; email kabar tidak ikut dihitung', () => {
    expect(isComplete(signupProblems(signup))).toBe(true)
  })

  it('daftar: tiap isian yang kurang punya pesan sendiri', () => {
    const p = signupProblems({ name: '', email: '', password: '', consent: false, captchaNeeded: true })
    expect(Object.keys(p).sort()).toEqual(['captcha', 'consent', 'email', 'name', 'password'])
    expect(p.consent).toBe(TERMS_MESSAGE)
    expect(isComplete(p)).toBe(false)
    expect(signupProblems({ ...signup, consent: false })).toEqual({ consent: TERMS_MESSAGE })
    expect(Object.keys(signupProblems({ ...signup, email: 'sari@gmail' }))).toEqual(['email'])
    expect(Object.keys(signupProblems({ ...signup, password: 'Pendek-1!' }))).toEqual(['password'])
    expect(Object.keys(signupProblems({ ...signup, captchaNeeded: true }))).toEqual(['captcha'])
  })

  it('tambah anak: persetujuan orang tua wajib', () => {
    expect(isComplete(addChildProblems({ name: 'Nara', pinProblem: null, consent: true }))).toBe(true)
    expect(addChildProblems({ name: 'Nara', pinProblem: null, consent: false })).toEqual({ consent: GUARDIAN_CONSENT_MESSAGE })
    expect(Object.keys(addChildProblems({ name: ' ', pinProblem: 'Pilih 4 gambar.', consent: true })).sort()).toEqual(['name', 'pin'])
  })

  it('daftar tunggu: email dan persetujuan wajib', () => {
    expect(isComplete(waitlistProblems({ email: 'sari@gmail.com', consent: true, captchaNeeded: false }))).toBe(true)
    expect(waitlistProblems({ email: 'sari@gmail.com', consent: false, captchaNeeded: false })).toEqual({ consent: WAITLIST_CONSENT_MESSAGE })
  })
})

describe('skema pendaftaran di server', () => {
  const ok = { name: 'Ibu Sari', email: 'sari@gmail.com', password: PASSWORD, consent: true }

  it('tanpa persetujuan Syarat dan Ketentuan ditolak', () => {
    const { consent: _omit, ...without } = ok
    expect(() => signUpSchema.parse(without)).toThrow()
    const r = signUpSchema.safeParse({ ...ok, consent: false })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe(TERMS_MESSAGE)
  })

  it('email kabar bawaannya false dan hanya boolean', () => {
    expect(signUpSchema.parse(ok).marketing).toBe(false)
    expect(signUpSchema.parse({ ...ok, marketing: true }).marketing).toBe(true)
    expect(() => signUpSchema.parse({ ...ok, marketing: 'ya' })).toThrow()
  })

  it('kolom tak dikenal ditolak', () => {
    expect(() => signUpSchema.parse({ ...ok, role: 'tutor' })).toThrow()
  })
})
