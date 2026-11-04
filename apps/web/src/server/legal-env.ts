/** Nilai .env yang kosong dianggap belum diisi. */
export function legalEnv(name: string): string | null {
  const v = process.env[name]?.trim()
  return v ? v : null
}
