/** Kode keluarga: bentuk dan tampilan. Tanpa ketergantungan server, dipakai di layar anak, layar orang tua, dan tes. */

/** Sama dengan pemeriksaan di migrasi 0031: delapan karakter tanpa 0, O, 1, I, L, dan tanpa huruf vokal. */
export const FAMILY_CODE_RE = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/

/** Huruf kecil, spasi, dan tanda hubung dari ketikan anak atau salinan pesan diabaikan. */
export function normalizeFamilyCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isFamilyCode(code: string): boolean {
  return FAMILY_CODE_RE.test(code)
}

/** ABCD-EFGH, supaya mudah dibacakan. Dipakai juga saat anak mengetik. */
export function formatFamilyCode(code: string): string {
  const clean = normalizeFamilyCode(code).slice(0, 8)
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

export type FamilyChildChoice = { id: string; firstName: string }

/**
 * Nama depan saja. Saudara dengan nama depan sama dibedakan oleh huruf awal kata berikutnya,
 * dan oleh nomor bila huruf itu pun tidak membedakan.
 */
export function firstNameChoices(rows: readonly { id: string; name: string }[]): FamilyChildChoice[] {
  const parts = rows.map((r) => ({ id: r.id, words: r.name.trim().split(/\s+/) }))
  const count = new Map<string, number>()
  for (const p of parts) count.set(p.words[0]!, (count.get(p.words[0]!) ?? 0) + 1)
  const labelled = parts.map((p) => {
    const first = p.words[0]!
    const next = p.words[1]?.[0]
    return { id: p.id, firstName: (count.get(first) ?? 0) > 1 && next ? `${first} ${next.toUpperCase()}.` : first }
  })
  const total = new Map<string, number>()
  for (const l of labelled) total.set(l.firstName, (total.get(l.firstName) ?? 0) + 1)
  const seen = new Map<string, number>()
  return labelled
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id))
    .map((l) => {
      if ((total.get(l.firstName) ?? 0) < 2) return l
      const n = (seen.get(l.firstName) ?? 0) + 1
      seen.set(l.firstName, n)
      return { id: l.id, firstName: `${l.firstName} ${n}` }
    })
}
