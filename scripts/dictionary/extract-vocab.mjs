// Ekstrak kosakata dari semua teks bahasa Inggris di content/ (soal, pelajaran, bacaan).
// Keluaran: JSON { tokens: { token: { n, g } } } dengan n = frekuensi, g = kelas terendah yang memuatnya.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const out = process.argv[3] ?? 'vocab-raw.json'
const SKIP_KEYS = new Set(['id', 'skill', 'type', 'tags', 'lang', 'kind', 'figure', 'subject', 'source', 'sourceId', 'strand', 'titleId', 'gen', 'seed'])
const tokens = new Map()

function add(str, grade) {
  const clean = str.normalize('NFC').replace(/[’‘]/g, "'")
  for (const m of clean.matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
    const w = m[0]
    const lower = w.toLowerCase()
    const isCap = w[0] !== lower[0]
    // Posisi awal kalimat tidak bisa membedakan nama; hitung semua huruf kecil, catat kemunculan kapital terpisah.
    const e = tokens.get(lower) ?? { n: 0, cap: 0, g: 9 }
    e.n++
    if (isCap) e.cap++
    if (grade < e.g) e.g = grade
    tokens.set(lower, e)
  }
}
function walk(v, grade, key) {
  if (typeof v === 'string') { if (!SKIP_KEYS.has(key)) add(v, grade); return }
  if (Array.isArray(v)) { for (const x of v) walk(x, grade, key); return }
  if (v && typeof v === 'object') {
    if (v.lang === 'id') return
    for (const [k, x] of Object.entries(v)) { if (!SKIP_KEYS.has(k)) walk(x, grade, k) }
  }
}
function files(dir) {
  const r = []
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) r.push(...files(p)); else if (n.endsWith('.json')) r.push(p) }
  return r
}
for (const sub of ['items', 'lessons', 'passages']) {
  const base = join(root, 'content', sub)
  for (const f of files(base)) {
    const gd = f.split(/[/\\]/).find((p) => /^g[1-6]$/.test(p))
    const grade = gd ? Number(gd[1]) : 6
    try { walk(JSON.parse(readFileSync(f, 'utf8')), grade, '') } catch (e) { console.error('skip', f, e.message) }
  }
}
writeFileSync(out, JSON.stringify(Object.fromEntries([...tokens].sort((a, b) => b[1].n - a[1].n)), null, 0))
console.log('tokens', tokens.size)
