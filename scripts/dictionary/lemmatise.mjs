// Gabungkan token konten dengan kandidat Kaikki menjadi daftar lemma (bentuk dasar) dan peta bentuk -> lemma.
// Pemakaian: node lemmatise.mjs <vocab-raw.json> <cand.json> <keluaran-lemmas.json>
import { readFileSync, writeFileSync } from 'node:fs'

const [vocabPath, candPath, outPath] = process.argv.slice(2)
const vocab = JSON.parse(readFileSync(vocabPath, 'utf8'))
const cand = JSON.parse(readFileSync(candPath, 'utf8'))
const own = new Set(cand.own)
const data = cand.data

const NON_WORD_POS = new Set(['name', 'character', 'symbol', 'abbrev', 'contraction', 'phrase', 'proverb', 'prefix', 'suffix', 'infix', 'letter'])
const INFLECTION_TAGS = ['plural', 'past', 'participle', 'present', 'comparative', 'superlative', 'third-person', 'singular', 'gerund']
/** Kata yang juga bentuk lain tetapi umum sebagai kata sendiri: entri sendiri dipertahankan dengan catatan bentuk. */
const KEEP_OWN = new Set(['saw', 'left', 'found', 'lay', 'wound', 'rose', 'bore', 'fell', 'felt', 'leaves', 'ground', 'rows', 'bound', 'spoke', 'lit', 'ring', 'rung', 'sung', 'sang', 'saws', 'seed', 'rest', 'rise', 'axes', 'bat', 'does', 'might', 'can', 'will', 'wind', 'meter', 'metres'])
const BAD_FORM_TAGS = ['nonstandard', 'dialectal', 'archaic', 'obsolete', 'colloquial', 'dated', 'rare', 'misspelling']

/** Token yang dipakai sebagai nama orang atau tempat di soal. Hari, bulan, planet, dan negara tetap masuk. */
const KEEP_PROPER = new Set(
  'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december indonesia jakarta java sumatra bali borneo sulawesi papua australia asia africa europe america earth mars venus jupiter saturn mercury uranus neptune pluto sun moon arctic antarctica english indonesian komodo celsius fahrenheit'.split(' '),
)
const CONTRACTIONS = {
  "i'm": ['I am', 'saya adalah'], "let's": ['let us'], "don't": ['do not'], "doesn't": ['does not'], "didn't": ['did not'], "isn't": ['is not'],
  "aren't": ['are not'], "wasn't": ['was not'], "weren't": ['were not'], "can't": ['cannot'], "won't": ['will not'], "it's": ['it is'],
  "that's": ['that is'], "he's": ['he is'], "she's": ['she is'], "there's": ['there is'], "what's": ['what is'], "you're": ['you are'],
  "we're": ['we are'], "they're": ['they are'], "i'll": ['I will'], "i've": ['I have'], "you've": ['you have'], "we've": ['we have'],
  "they've": ['they have'], "haven't": ['have not'], "hasn't": ['has not'], "couldn't": ['could not'], "wouldn't": ['would not'],
  "shouldn't": ['should not'], "who's": ['who is'], "here's": ['here is'], "you'll": ['you will'], "we'll": ['we will'], "they'll": ['they will'],
  "he'll": ['he will'], "she'll": ['she will'], "it'll": ['it will'], "i'd": ['I would'], "o'clock": ['of the clock'],
}

function isUsable(lemma) {
  const d = data[lemma]
  if (!d) return false
  return d.pos.some((p) => !NON_WORD_POS.has(p.pos) && p.senses.length > 0)
}

function ruleBase(t) {
  const c = []
  if (t.endsWith('ies')) c.push(t.slice(0, -3) + 'y')
  if (t.endsWith('es')) c.push(t.slice(0, -2))
  if (t.endsWith('s')) c.push(t.slice(0, -1))
  if (t.endsWith('ied')) c.push(t.slice(0, -3) + 'y')
  if (t.endsWith('ed')) c.push(t.slice(0, -2), t.slice(0, -1))
  if (t.endsWith('ing')) c.push(t.slice(0, -3), t.slice(0, -3) + 'e')
  return c.find((b) => b.length > 2 && isUsable(b))
}

const EXTRA_WORDS = { cm: 'centimetre (abbreviation)', mm: 'millimetre (abbreviation)', km: 'kilometre (abbreviation)', kg: 'kilogram (abbreviation)', ml: 'millilitre (abbreviation)', tv: 'television (abbreviation)', pm: 'afternoon time (abbreviation)', hcf: 'highest common factor (abbreviation)', lcm: 'lowest common multiple (abbreviation)', okay: 'all right', uk: 'United Kingdom', kilo: 'kilogram' }
const forms = {}
const lemmas = new Map() // lemma -> {n, g, forms:Set}
const skipped = []
const alsoForm = {} // lemma sendiri yang juga bentuk dari lemma lain: {saw: ['see']}
function bump(lemma, n, g, token) {
  const e = lemmas.get(lemma) ?? { n: 0, g: 9, forms: new Set() }
  e.n += n
  e.g = Math.min(e.g, g)
  if (token !== lemma) e.forms.add(token)
  lemmas.set(lemma, e)
}

for (const [rawToken, v] of Object.entries(vocab)) {
  let t = rawToken
  if (/^[a-z]$/.test(t) && t !== 'a' && t !== 'i') continue
  if (CONTRACTIONS[t]) {
    bump(t, v.n, v.g, t)
    continue
  }
  if (t.endsWith("'s")) t = t.slice(0, -2)
  if (t.includes("'")) {
    skipped.push(rawToken)
    continue
  }
  const nameLike = v.cap / v.n >= 0.8
  if (nameLike && !data[t] && !cand.formOf[t] && !KEEP_PROPER.has(t) && !ruleBase(t)) {
    skipped.push(rawToken)
    continue
  }
  let lemma = t
  const fo = cand.formOf[t]
  if (fo) {
    const inflOnly = fo.filter((o) => isUsable(o.l) && o.t.some((x) => INFLECTION_TAGS.includes(x)))
    const compOnly = inflOnly.length > 0 && inflOnly.every((o) => o.t.every((x) => !['plural', 'past', 'participle', 'present', 'third-person', 'gerund', 'singular'].includes(x)))
    let opts = inflOnly
    // Kata yang juga adjektiva/nomina sendiri dan hanya "bentuk perbandingan" kata lain (number dari numb) tetap kata sendiri.
    if (compOnly && own.has(t) && isUsable(t)) opts = []
    // Ejaan Britania dan varian lain (judgement, grandad): dipakai bila token sendiri tidak punya entri.
    if (!opts.length && !isUsable(t)) opts = fo.filter((o) => isUsable(o.l) && !o.t.includes('misspelling'))
    opts = [...opts].sort((x, y) => (vocab[y.l]?.n ?? 0) - (vocab[x.l]?.n ?? 0) || Number(x.t.some((q) => BAD_FORM_TAGS.includes(q))) - Number(y.t.some((q) => BAD_FORM_TAGS.includes(q))))
    if (opts.length) {
      if (KEEP_OWN.has(t) && isUsable(t)) {
        // Kata yang juga bentuk lain (saw, left, found): entri sendiri tetap ada, dengan catatan bentuk.
        alsoForm[t] = opts.map((o) => o.l)
      } else {
        lemma = opts[0].l
      }
    }
  }
  if (lemma === t && !isUsable(t)) {
    const base = ruleBase(t)
    if (base) lemma = base
  }
  if (!isUsable(lemma) && !KEEP_PROPER.has(lemma)) {
    skipped.push(rawToken)
    continue
  }
  if (lemma !== t) forms[t] = lemma
  if (rawToken !== t && rawToken !== lemma) forms[rawToken] = lemma
  bump(lemma, v.n, v.g, t)
}
for (const w of Object.keys(EXTRA_WORDS)) if (vocab[w] && !lemmas.has(w)) bump(w, vocab[w].n, vocab[w].g, w)
const EXTRA_HINT = EXTRA_WORDS
// Lemma yang hanya muncul lewat bentuknya perlu kelas terendah dari bentuk itu, sudah ditangani di bump.

const out = [...lemmas]
  .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
  .map(([w, e]) => {
    const d = data[w]
    const pos = d ? [...new Set(d.pos.map((p) => p.pos))].slice(0, 4) : []
    const first = d?.pos.find((p) => !NON_WORD_POS.has(p.pos))?.senses[0]
    const tr = d ? d.pos.flatMap((p) => p.tr.map((x) => x.w)).slice(0, 4) : []
    return {
      w,
      n: e.n,
      g: e.g,
      forms: [...e.forms].slice(0, 6),
      pos,
      hint: EXTRA_HINT[w] ?? (CONTRACTIONS[w] ? undefined : first ? first.g.slice(0, 70) : undefined),
      also: alsoForm[w],
      tr: tr.length ? tr : undefined,
      contraction: CONTRACTIONS[w] ? CONTRACTIONS[w][0] : undefined,
    }
  })
writeFileSync(outPath, JSON.stringify({ lemmas: out, forms, skipped }))
console.log('lemmas', out.length, 'forms', Object.keys(forms).length, 'skipped', skipped.length, 'alsoForm', Object.keys(alsoForm).length)
