/** Aturan password akun dewasa, dipakai di browser dan di server. Pemilik memilih aturan ini untuk pilot. */
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

export const PASSWORD_RULES = [
  { key: 'length', label: 'Minimal 12 karakter', test: (p: string) => [...p].length >= PASSWORD_MIN },
  { key: 'upper', label: 'Ada huruf kapital (A sampai Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'Ada angka (0 sampai 9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'symbol', label: 'Ada simbol, misalnya ! @ # $ % &', test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const

const MESSAGES: Record<(typeof PASSWORD_RULES)[number]['key'], string> = {
  length: 'Password paling sedikit 12 karakter.',
  upper: 'Tambahkan paling sedikit satu huruf kapital.',
  number: 'Tambahkan paling sedikit satu angka.',
  symbol: 'Tambahkan paling sedikit satu simbol, misalnya ! @ # $ % &.',
}

/** Pesan untuk syarat pertama yang belum terpenuhi, atau null bila semua terpenuhi. */
export function passwordRuleProblem(password: string): string | null {
  const missing = PASSWORD_RULES.find((r) => !r.test(password))
  return missing ? MESSAGES[missing.key] : null
}
