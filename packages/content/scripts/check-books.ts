import { bookWords, checkBooks, loadBooks } from '../src/books'
import { findContentDir } from '../src/load'

/** Pemeriksaan cepat khusus buku: pnpm exec tsx packages/content/scripts/check-books.ts [kelas] */
const dir = findContentDir()
const only = process.argv[2]
const { books } = loadBooks(dir)
const problems = checkBooks(dir).filter((p) => !only || p.file.startsWith(`books/${only}`))
for (const b of books.filter((x) => !only || String(x.grade) === only)) {
  console.log(`${b.id}  ${b.kind}  ${b.chapters.length} bab  ${bookWords(b)} kata  ${b.chapters.reduce((n, c) => n + c.questions.length, 0)} soal`)
}
if (problems.length) {
  console.error(`\n${problems.length} masalah:`)
  for (const p of problems) console.error(`  ${p.file}: ${p.message}`)
  process.exit(1)
}
console.log('buku bersih')
