// Gabungkan glosis TSV (lemma, jenis, arti Indonesia, arti English) dengan lemmas.json menjadi content/dictionary/en-id.json.
// Pemakaian: node assemble.mjs <lemmas.json> <folder-tsv> <content/dictionary/en-id.json>
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [lemmasPath, tsvDir, outPath] = process.argv.slice(2)
const lem = JSON.parse(readFileSync(lemmasPath, 'utf8'))
const byWord = new Map(lem.lemmas.map((l) => [l.w, l]))

const entries = {}
const problems = []
for (const f of readdirSync(tsvDir).filter((n) => n.endsWith('.tsv')).sort()) {
  for (const [ln, line] of readFileSync(join(tsvDir, f), 'utf8').split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    const w = cols[0]?.trim()
    if (!w) continue
    if (cols[1]?.trim() === 'SKIP' || cols.length === 2) continue
    if (cols.length < 4) {
      problems.push(`${f}:${ln + 1} kolom kurang: ${w}`)
      continue
    }
    const meta = byWord.get(w)
    if (!meta) {
      problems.push(`${f}:${ln + 1} lemma tidak dikenal: ${w}`)
      continue
    }
    const i = cols[2].split(' ; ').map((s) => s.trim()).filter(Boolean).slice(0, 3)
    const e = cols[3].trim()
    const p = cols[1].trim()
    entries[w] = { i, e, ...(p ? { p } : {}), g: meta.g >= 1 && meta.g <= 6 ? meta.g : 6 }
  }
}
// Perbaikan tangan hasil pemeriksaan sampel (overrides.json) dan pembersihan: arti kedua yang hanya mengulang kata English dibuang.
const overrides = JSON.parse(readFileSync(new URL('./overrides.json', import.meta.url), 'utf8'))
for (const [w, o] of Object.entries(overrides)) if (entries[w]) Object.assign(entries[w], o)
for (const [w, e] of Object.entries(entries)) {
  const kept = e.i.filter((x, k) => k === 0 || x.toLowerCase() !== w)
  e.i = kept.slice(0, 3)
}
const forms = {}
for (const [f, l] of Object.entries(lem.forms)) if (entries[l] && !entries[f]) forms[f] = l
const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
const sortedForms = Object.fromEntries(Object.entries(forms).sort(([a], [b]) => a.localeCompare(b)))
const out = {
  v: 1,
  meta: {
    source: 'Daftar kata dari seluruh konten Kira (soal, pelajaran, bacaan). Bentuk dasar dan bentuk jadian dari data Wiktionary (Wiktextract/Kaikki). Arti Indonesia dan arti English sederhana ditulis untuk anak SD dan diperiksa tim Kira.',
    licence: 'CC BY-SA 4.0 (data bentuk kata dan petunjuk arti turunan dari Wiktionary)',
    attribution: 'Berisi data dari Wiktionary (https://en.wiktionary.org) yang diolah Wiktextract (Tatu Ylonen), disajikan kaikki.org, di bawah lisensi CC BY-SA 4.0 dan GFDL. Kamus Kira dibagikan dengan lisensi yang sama.',
    built: new Date().toISOString().slice(0, 10),
  },
  entries: sorted,
  forms: sortedForms,
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(out, null, 0).replace(/},"/g, '},\n"').replace(/^{"v":1,"meta":/, '{"v":1,\n"meta":'))
const hash = createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 8)
console.log('entries', Object.keys(sorted).length, 'forms', Object.keys(sortedForms).length, 'hash', hash)
if (problems.length) console.log('PROBLEMS', problems.length, '\n' + problems.slice(0, 40).join('\n'))
