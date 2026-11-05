import { passwordInputProblem } from './password-rules'

/**
 * Aturan isian wajib yang dipakai form orang tua. Satu sumber untuk dua hal: tombol tampak abu-abu selama masih
 * ada masalah, dan pesan yang muncul di samping tiap isian saat tombol diketuk. Server tetap memeriksa ulang.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const TERMS_MESSAGE = 'Centang persetujuan Syarat dan Ketentuan untuk melanjutkan.'
export const GUARDIAN_CONSENT_MESSAGE = 'Centang persetujuan orang tua atau wali untuk menambahkan anak.'
export const WAITLIST_CONSENT_MESSAGE = 'Centang persetujuan supaya kami boleh mengirim kabar.'
export const CAPTCHA_MESSAGE = 'Selesaikan pemeriksaan keamanan dulu.'

export type Problems<K extends string> = Partial<Record<K, string>>

/** True bila tidak ada isian wajib yang bermasalah. */
export const isComplete = (problems: Problems<string>): boolean => Object.values(problems).every((m) => !m)

function emailProblem(raw: string): string | null {
  const email = raw.trim()
  if (!email) return 'Isi email Anda.'
  if (!EMAIL_RE.test(email)) return 'Tulis alamat email lengkap, dengan @ dan nama domain.'
  return null
}

function collect<K extends string>(entries: [K, string | null | false][]): Problems<K> {
  const out: Problems<K> = {}
  for (const [key, message] of entries) if (message) out[key] = message
  return out
}

export type SignupField = 'name' | 'email' | 'password' | 'consent' | 'captcha'

export function signupProblems(v: { name: string; email: string; password: string; consent: boolean; captchaNeeded: boolean }): Problems<SignupField> {
  return collect<SignupField>([
    ['name', v.name.trim().length < 2 && 'Tulis nama Anda, paling sedikit 2 huruf.'],
    ['email', emailProblem(v.email)],
    ['password', passwordInputProblem(v.password)],
    ['consent', !v.consent && TERMS_MESSAGE],
    ['captcha', v.captchaNeeded && CAPTCHA_MESSAGE],
  ])
}

export type ReplacementField = 'name' | 'password' | 'consent'

/** Langkah Buat password baru: pemegang tautan mengisi semuanya sendiri, tidak ada yang dibawa dari pendaftaran. */
export function replacementProblems(v: { name: string; password: string; consent: boolean }): Problems<ReplacementField> {
  return collect<ReplacementField>([
    ['name', v.name.trim().length < 2 && 'Tulis nama Anda, paling sedikit 2 huruf.'],
    ['password', passwordInputProblem(v.password)],
    ['consent', !v.consent && TERMS_MESSAGE],
  ])
}

export type GoogleConsentField = 'consent' | 'captcha'

export function googleConsentProblems(v: { consent: boolean; captchaNeeded: boolean }): Problems<GoogleConsentField> {
  return collect<GoogleConsentField>([
    ['consent', !v.consent && TERMS_MESSAGE],
    ['captcha', v.captchaNeeded && CAPTCHA_MESSAGE],
  ])
}

export type WaitlistField = 'email' | 'consent' | 'captcha'

export function waitlistProblems(v: { email: string; consent: boolean; captchaNeeded: boolean }): Problems<WaitlistField> {
  return collect<WaitlistField>([
    ['email', emailProblem(v.email)],
    ['consent', !v.consent && WAITLIST_CONSENT_MESSAGE],
    ['captcha', v.captchaNeeded && CAPTCHA_MESSAGE],
  ])
}

export type AddChildField = 'name' | 'pin' | 'consent'

/** `pinProblem` dihitung pemanggil dengan pinProblem() milik PinChooser, supaya aturan PIN tetap di satu tempat. */
export function addChildProblems(v: { name: string; pinProblem: string | null; consent: boolean }): Problems<AddChildField> {
  return collect<AddChildField>([
    ['name', !v.name.trim() && 'Isi nama panggilan anak.'],
    ['pin', v.pinProblem],
    ['consent', !v.consent && GUARDIAN_CONSENT_MESSAGE],
  ])
}
