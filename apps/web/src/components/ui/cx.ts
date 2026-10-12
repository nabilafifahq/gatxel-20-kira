/** Gabungkan nama kelas, abaikan nilai kosong. */
export function cx(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ')
}
