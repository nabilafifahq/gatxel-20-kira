#!/usr/bin/env node
// Audit soal kembar di content/items. Soal kembar bila seluruh isinya (prompt, pilihan tanpa urutan, jawaban, gambar,
// bacaan) sama setelah dinormalisasi: huruf kecil, tanpa tanda baca, tanpa kata sandang. Id, petunjuk, penjelasan dan
// alasan pilihan tidak dihitung. Beda angka tetap dianggap soal berbeda. Ada temuan berarti exit code 1.
// Soal generator Math tidak diperiksa di sini. Pemakaian: node scripts/audit-duplicates.mjs [--json]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = process.env.KIRA_CONTENT_DIR && existsSync(process.env.KIRA_CONTENT_DIR) ? process.env.KIRA_CONTENT_DIR : join(root, 'content')

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []))
}

const STOP = new Set(['the', 'a', 'an'])
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,:/%=<>+*-]/gu, ' ')
    .replace(/[.,:;!?'"()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(' ')

// Kunci isi: semua bidang kecuali id, skill, kesulitan, petunjuk, penjelasan, tag, dan alasan pilihan (why).
// Urutan pilihan tidak dihitung. Teks dinormalisasi, jadi beda huruf besar, tanda baca, atau kata sandang tetap kembar.
const SKIP = new Set(['id', 'skill', 'difficulty', 'hints', 'explanation', 'tags', 'why'])
const canon = (v) => {
  if (Array.isArray(v)) {
    const arr = v.map(canon)
    return arr.every((x) => x && typeof x === 'object' && !Array.isArray(x) && 'text' in x) ? arr.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : arr
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter((k) => !SKIP.has(k)).sort().map((k) => [k, canon(v[k])]))
  return typeof v === 'string' ? norm(v) : v
}
const contentKey = (it) => JSON.stringify(canon(Object.fromEntries(Object.entries(it).filter(([k]) => !SKIP.has(k)))))

const items = []
const itemsDir = join(dir, 'items')
for (const f of walk(itemsDir)) {
  const j = JSON.parse(readFileSync(f, 'utf8'))
  for (const it of Array.isArray(j) ? j : j.items ?? []) items.push({ it, file: relative(dir, f) })
}

const problems = []
const group = (keyFn, kind) => {
  const m = new Map()
  for (const x of items) {
    const k = keyFn(x.it)
    if (k === null) continue
    ;(m.get(k) ?? m.set(k, []).get(k)).push(x)
  }
  for (const list of m.values()) if (list.length > 1) problems.push({ kind, ids: list.map((x) => x.it.id), files: [...new Set(list.map((x) => x.file))] })
}
group(contentKey, 'kembar')
// Pilihan ganda dengan prompt sama dan jawaban benar sama dalam satu skill, hanya beda pengecoh.
const correctKey = (it) => {
  if (!Array.isArray(it.options) || !it.prompt) return null
  const ok = it.options.filter((o) => o && typeof o === 'object' && !('why' in o)).map((o) => norm(o.text)).sort()
  return ok.length ? `${it.skill}|${norm(it.prompt)}|${ok.join('|')}` : null
}
group(correctKey, 'prompt-dan-jawaban-sama')
const out = problems

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1))
else {
  console.log(`audit-duplicates: ${items.length} soal tertulis diperiksa`)
  for (const p of out) console.error(`  ${p.kind}: ${p.ids.join(', ')}`)
  console.log(out.length ? `${out.length} kelompok kembar` : 'tidak ada soal kembar')
}
process.exit(out.length ? 1 : 0)
