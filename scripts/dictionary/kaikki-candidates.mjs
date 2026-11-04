// Baca dump Kaikki (Wiktextract, CC BY-SA 4.0) dan ambil kandidat arti untuk kosakata Kira.
// Pemakaian: node kaikki-candidates.mjs <kaikki.jsonl> <vocab-raw.json> <keluaran.json>
// Dua lintasan: (1) bentuk kata -> lemma untuk token yang ada di konten, (2) arti dan terjemahan Indonesia lemma itu.
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const [dump, vocabPath, outPath] = process.argv.slice(2)
const vocab = JSON.parse(readFileSync(vocabPath, 'utf8'))
const T = new Set(Object.keys(vocab))
const isNameLike = (t) => vocab[t].cap / vocab[t].n >= 0.8

function wordOf(line) {
  const m = /"word": "([^"]*)", "lang": "English"/.exec(line)
  return m ? m[1] : null
}
async function pass(cb) {
  const rl = createInterface({ input: createReadStream(dump), crlfDelay: Infinity })
  for await (const line of rl) { const w = wordOf(line); if (w !== null) cb(w, line) }
}

// Lintasan 1: bentuk -> lemma
const formOf = new Map() // token -> Map(lemma -> tags)
const ownLemma = new Set() // token yang punya entri lemma sendiri (bukan sekadar bentuk)
const L = new Set()
await pass((w, line) => {
  const lw = w.toLowerCase()
  if (!T.has(lw)) return
  if (w !== lw && !isNameLike(lw)) return
  const e = JSON.parse(line)
  if (e.lang_code !== 'en') return
  let own = false
  for (const s of e.senses ?? []) {
    const fo = s.form_of ?? s.alt_of
    if (fo && fo.length && !(s.tags ?? []).includes('misspelling')) {
      const lemma = fo[0].word
      if (lemma && lemma.toLowerCase() === lemma && lemma !== lw) {
        const m = formOf.get(lw) ?? new Map()
        m.set(lemma, [...(m.get(lemma) ?? []), ...(s.tags ?? [])])
        formOf.set(lw, m)
      }
    } else own = true
  }
  if (own) ownLemma.add(lw)
})
for (const t of T) L.add(t)
for (const m of formOf.values()) for (const l of m.keys()) L.add(l)

// Lintasan 2: arti dan terjemahan
const data = new Map()
const SKIP_TAGS = new Set(['obsolete', 'archaic', 'rare', 'dialectal', 'slang', 'vulgar', 'offensive', 'derogatory', 'dated', 'historical', 'nonstandard', 'misspelling', 'euphemistic', 'figuratively'])
await pass((w, line) => {
  const lw = w.toLowerCase()
  if (!L.has(lw)) return
  if (w !== lw && !(T.has(lw) && isNameLike(lw))) return
  const e = JSON.parse(line)
  if (e.lang_code !== 'en') return
  const senses = []
  for (const s of e.senses ?? []) {
    if (s.form_of || s.alt_of) continue
    const tags = [...(s.tags ?? []), ...(s.raw_tags ?? [])]
    if (tags.some((t) => SKIP_TAGS.has(t))) continue
    const g = (s.glosses ?? []).at(-1)
    if (!g) continue
    senses.push({ g, parent: (s.glosses ?? []).length > 1 ? s.glosses[0] : undefined, tags })
    if (senses.length >= 5) break
  }
  const tr = (e.translations ?? []).filter((t) => t.lang_code === 'id' && t.word).map((t) => ({ w: t.word, s: t.sense ?? '' }))
  if (!senses.length && !tr.length) return
  const d = data.get(lw) ?? { pos: [] }
  d.pos.push({ pos: e.pos, senses, tr: tr.slice(0, 12) })
  data.set(lw, d)
})
writeFileSync(outPath, JSON.stringify({
  formOf: Object.fromEntries([...formOf].map(([k, m]) => [k, [...m].map(([l, t]) => ({ l, t: [...new Set(t)] }))])),
  own: [...ownLemma],
  data: Object.fromEntries(data),
}))
console.log('forms', formOf.size, 'lemmas with data', data.size, 'of L', L.size)
