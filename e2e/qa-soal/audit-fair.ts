// Audit statis keadilan penilaian dan kelayakan isi: tidak butuh server.
import { checkAnswer, keyOf, normaliseText, parseNumberCandidates, cellMatches } from '../../packages/content/src/check'
import type { Item } from '../../packages/content/src/schema'
import { allItems } from './lib'

const issues: Record<string, string[]> = {}
const add = (k: string, v: string) => {
  ;(issues[k] ??= []).push(v)
}

// Ejaan Inggris dan Amerika yang biasa muncul di SD.
const UK_US: [RegExp, (m: string) => string][] = [
  [/colour/i, (s) => s.replace(/colour/gi, 'color')],
  [/favourite/i, (s) => s.replace(/favourite/gi, 'favorite')],
  [/neighbour/i, (s) => s.replace(/neighbour/gi, 'neighbor')],
  [/centre/i, (s) => s.replace(/centre/gi, 'center')],
  [/metre/i, (s) => s.replace(/metre/gi, 'meter')],
  [/litre/i, (s) => s.replace(/litre/gi, 'liter')],
  [/grey/i, (s) => s.replace(/grey/gi, 'gray')],
  [/fibre/i, (s) => s.replace(/fibre/gi, 'fiber')],
  [/aluminium/i, (s) => s.replace(/aluminium/gi, 'aluminum')],
  [/organise/i, (s) => s.replace(/organise/gi, 'organize')],
  [/realise/i, (s) => s.replace(/realise/gi, 'realize')],
  [/recognise/i, (s) => s.replace(/recognise/gi, 'recognize')],
  [/travell/i, (s) => s.replace(/travell/gi, 'travel')],
  [/harbour/i, (s) => s.replace(/harbour/gi, 'harbor')],
  [/flavour/i, (s) => s.replace(/flavour/gi, 'flavor')],
  [/honour/i, (s) => s.replace(/honour/gi, 'honor')],
  [/humour/i, (s) => s.replace(/humour/gi, 'humor')],
  [/labour/i, (s) => s.replace(/labour/gi, 'labor')],
  [/behaviour/i, (s) => s.replace(/behaviour/gi, 'behavior')],
  [/vapour/i, (s) => s.replace(/vapour/gi, 'vapor')],
  [/mould/i, (s) => s.replace(/mould/gi, 'mold')],
  [/sulphur/i, (s) => s.replace(/sulphur/gi, 'sulfur')],
  [/theatre/i, (s) => s.replace(/theatre/gi, 'theater')],
  [/programme/i, (s) => s.replace(/programme/gi, 'program')],
  [/maths/i, (s) => s.replace(/maths/gi, 'math')],
  [/analyse/i, (s) => s.replace(/analyse/gi, 'analyze')],
  [/practise/i, (s) => s.replace(/practise/gi, 'practice')],
]
// Item yang memang menguji ejaan tidak perlu menerima ejaan lain.
const isSpellingSkill = (it: Item) => /spell|\.ww|homophone/.test(it.skill) || it.skill.startsWith('e') && /spelling/.test(it.tags.join(' '))

function textAnswers(it: Item): { where: string; answers: string[]; caseSensitive: boolean }[] {
  if (it.type === 'text') return it.blanks.map((b, i) => ({ where: `${it.id}#${i}`, answers: b.answers, caseSensitive: b.caseSensitive }))
  if (it.type === 'story') return it.parts.flatMap((p, i) => (p.type === 'text' ? [{ where: `${it.id}/p${i}`, answers: p.answers, caseSensitive: p.caseSensitive }] : []))
  if (it.type === 'table') return it.blanks.map((b, i) => ({ where: `${it.id}#t${i}`, answers: b.answers, caseSensitive: false }))
  return []
}

let totalText = 0
for (const it of allItems()) {
  const key = keyOf(it)
  for (const t of textAnswers(it)) {
    totalText++
    const primary = t.answers[0]!
    if (t.caseSensitive) add('text: caseSensitive=true (huruf besar dihukum)', `${t.where} ${JSON.stringify(t.answers)}`)
    // angka dalam teks: "1/2" vs "0.5", "12 cm" vs "12", "5" vs "five"
    for (const ans of t.answers) {
      const raw = ans.trim()
      const unit = /^(-?[\d.,/]+)\s*([a-zA-Z°%²³]+.*)$/.exec(raw)
      if (unit && !t.answers.some((x) => x.trim() === unit[1])) add('text: angka plus satuan, angka saja tidak diterima', `${t.where} ${JSON.stringify(t.answers)}`)
      if (/^\d+\/\d+$/.test(raw)) {
        const [n, d] = raw.split('/').map(Number)
        const dec = String(n! / d!)
        if (!t.answers.some((x) => x.trim() === dec) && dec.length <= 5 && it.type !== 'table') add('text: pecahan tanpa bentuk desimal yang setara', `${t.where} ${JSON.stringify(t.answers)}`)
      }
      if (/^\d*\.\d+$/.test(raw) && it.type !== 'table') {
        const num = Number(raw)
        for (const [n, d] of [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10]] as const) {
          if (Math.abs(n / d - num) < 1e-9 && !t.answers.includes(`${n}/${d}`)) add('text: desimal tanpa bentuk pecahan yang setara', `${t.where} ${JSON.stringify(t.answers)}`)
        }
      }
      if (/^\d+$/.test(raw) && Number(raw) <= 20 && !t.answers.some((x) => /^[a-z]+$/i.test(x.trim()))) add('text: angka tanpa bentuk kata', `${t.where} ${JSON.stringify(t.answers)}`)
      const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve']
      if (words.includes(raw.toLowerCase()) && !t.answers.some((x) => /^\d+$/.test(x.trim()))) add('text: kata bilangan tanpa bentuk angka', `${t.where} ${JSON.stringify(t.answers)}`)
      // awalan/kata sandang
      if (/^(a|an|the) /i.test(raw) && !t.answers.some((x) => x.trim().toLowerCase() === raw.toLowerCase().replace(/^(a|an|the) /, ''))) add('text: jawaban pakai kata sandang, tanpa sandang ditolak', `${t.where} ${JSON.stringify(t.answers)}`)
      // tanda baca di tengah (koma, apostrof) yang anak mungkin tidak ketik
      if (/[,;:'’-]/.test(raw) && !/^-?\d/.test(raw)) {
        const bare = raw.replace(/[,;:'’-]/g, '').toLowerCase()
        const bare2 = raw.replace(/[,;:'’-]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
        if (!t.answers.some((x) => [bare, bare2].includes(x.trim().toLowerCase()))) add('text: tanda baca wajib di jawaban', `${t.where} ${JSON.stringify(t.answers)}`)
      }
    }
    // ejaan UK/US
    if (!isSpellingSkill(it)) {
      for (const [re, us] of UK_US) {
        for (const ans of t.answers) {
          if (re.test(ans)) {
            const alt = us(ans)
            if (!t.answers.some((x) => normaliseText(x, false) === normaliseText(alt, false))) add('text: ejaan Amerika ditolak', `${t.where} ${JSON.stringify(t.answers)} -> ${alt}`)
          }
        }
      }
    }
    // spasi, kapital: harus lulus lewat pemeriksa
    if (it.type === 'text' && it.blanks.length === 1 && !t.caseSensitive) {
      for (const v of [primary.toUpperCase(), `  ${primary}  `, primary.replace(/ /g, '  '), `${primary}.`]) {
        const r = checkAnswer(key, { texts: [v] })
        if (r.status !== 'correct') add('text: gagal normalisasi', `${t.where} ${JSON.stringify(v)}`)
      }
    }
  }
  // Kartu kembar: susunan benar secara tampilan tapi dinilai salah.
  if (it.type === 'order') {
    const dup = it.items.filter((x, i) => it.items.indexOf(x) !== i)
    if (dup.length) add('order: kartu kembar (tukar kartu kembar dinilai salah)', `${it.id} ${JSON.stringify(dup)}`)
  }
  if (it.type === 'match') {
    const rs = it.pairs.map((p) => p[1])
    const dup = rs.filter((x, i) => rs.indexOf(x) !== i)
    if (dup.length) add('match: kanan kembar (dinilai salah walau tampak benar)', `${it.id} ${JSON.stringify(dup)}`)
    const ls = it.pairs.map((p) => p[0])
    const dupL = ls.filter((x, i) => ls.indexOf(x) !== i)
    if (dupL.length) add('match: kiri kembar', `${it.id} ${JSON.stringify(dupL)}`)
  }
  if (it.type === 'sort') {
    const ts = it.items.map((x) => x.text)
    const dup = ts.filter((x, i) => ts.indexOf(x) !== i)
    if (dup.length) add('sort: kartu kembar', `${it.id} ${JSON.stringify(dup)}`)
    it.items.forEach((x) => {
      if (x.group >= it.groups.length) add('sort: grup di luar batas', `${it.id} ${x.text}`)
    })
    const used = new Set(it.items.map((x) => x.group))
    if (used.size < it.groups.length) add('sort: grup kosong', it.id)
  }
  if (it.type === 'mcq' || it.type === 'multi' || it.type === 'listen') {
    const ts = it.options.map((o) => o.text ?? (o.figure ? JSON.stringify(o.figure) : ''))
    const dup = ts.filter((x, i) => ts.indexOf(x) !== i)
    if (dup.length) add(`${it.type}: opsi kembar`, `${it.id} ${JSON.stringify(dup).slice(0, 80)}`)
    if (it.type !== 'multi' && it.answer >= it.options.length) add('mcq: kunci di luar batas', it.id)
    if (it.type === 'multi' && it.answers.some((a) => a >= it.options.length)) add('multi: kunci di luar batas', it.id)
    if (it.type !== 'multi' && it.options.some((o) => !o.text && !(o.figure as { alt?: string } | undefined)?.alt)) add('opsi gambar tanpa alt', it.id)
  }
  if (it.type === 'cloze') {
    const n = (it.prompt.match(/_{3,}/g) ?? []).length
    if (n !== it.gaps.length) add('cloze: jumlah ___ tidak sama dengan gaps', `${it.id} ${n} vs ${it.gaps.length}`)
    it.gaps.forEach((g, i) => {
      const dup = g.options.filter((x, k) => g.options.indexOf(x) !== k)
      if (dup.length) add('cloze: pilihan kembar', `${it.id}#${i}`)
    })
  }
  if (it.type === 'text') {
    const n = (it.prompt.match(/_{3,}/g) ?? []).length
    if (n > it.blanks.length) add('text: ___ lebih banyak dari blanks', `${it.id} ${n} vs ${it.blanks.length}`)
  }
  if (it.type === 'story') {
    it.parts.forEach((p, k) => {
      if (p.type === 'text' && /_{3,}/.test(p.prompt)) add('story: bagian isian memuat ___ (kotak hilang)', `${it.id}/p${k} ${p.prompt.slice(0, 50)}`)
    })
  }
  if (it.type === 'clock') {
    if (it.answer.m % it.stepMinutes !== 0) add('clock: menit bukan kelipatan langkah', `${it.id} ${it.answer.h}:${it.answer.m} langkah ${it.stepMinutes}`)
    if (it.answer.h === 12 && it.answer.m === 0) add('clock: jawaban sama dengan awal (Check mati sampai disentuh)', it.id)
  }
  if (it.type === 'numberline') {
    const k = (it.answer - it.min) / it.step
    if (Math.abs(k - Math.round(k)) > 1e-6) add('numberline: jawaban bukan kelipatan step', `${it.id} ${it.answer}`)
    if (it.answer > it.max || it.answer < it.min) add('numberline: jawaban di luar garis', it.id)
  }
  if (it.type === 'fraction') {
    const need = (it.answer.num * it.parts) / it.answer.den
    if (!Number.isInteger(need) || need > it.parts) add('fraction: jawaban tidak bisa diarsir', `${it.id} ${it.answer.num}/${it.answer.den} dari ${it.parts}`)
  }
  if (it.type === 'tiles') {
    const bank = it.answer.split(/\s+/)
    for (const alt of it.alternatives) {
      const al = alt.split(/\s+/)
      const pool = [...bank, ...it.distractors]
      for (const w of al) {
        const at = pool.indexOf(w)
        if (at < 0) add('tiles: alternatif memakai kata di luar kartu', `${it.id} "${w}" pada "${alt}"`)
        else pool.splice(at, 1)
      }
    }
  }
  if (it.type === 'table') {
    it.blanks.forEach((b) => {
      const numeric = b.answers.every((a) => /^-?[\d.,/ ]+$/.test(a))
      const extra = new Set(b.answers.join('').split('').filter((c) => !/[A-Za-z0-9]/.test(c)))
      const typeable = (s: string) => [...s.toLowerCase()].every((c) => (numeric ? /[0-9]/.test(c) : /[a-z]/.test(c)) || extra.has(c))
      if (!b.answers.some(typeable)) add('table: jawaban tidak bisa diketik di papan', `${it.id} r${b.row}c${b.col} ${JSON.stringify(b.answers)}`)
      if (b.answers.some((a) => a.length > 16)) add('table: jawaban lebih panjang dari batas 16 huruf papan', `${it.id} ${JSON.stringify(b.answers)}`)
      if (b.row >= it.rows.length || b.col >= it.head.length) add('table: sel di luar tabel', it.id)
      if (b.answers.some((a) => /^\d+$/.test(a)) && !cellMatches(b.answers[0]!, b.answers[0]!)) add('table: sel', it.id)
    })
    it.rows.forEach((r, i) => {
      if (r.length !== it.head.length) add('table: baris tidak sama panjang dengan kepala', `${it.id} baris ${i}: ${r.length} vs ${it.head.length}`)
    })
  }
  if (it.type === 'hotspot') {
    const ls = it.regions.map((r) => r.label)
    const dup = ls.filter((x, i) => ls.indexOf(x) !== i)
    if (dup.length) add('hotspot: label area kembar', `${it.id} ${JSON.stringify(dup)}`)
    for (const r of it.regions) if (r.x + r.w > 100.5 || r.y + r.h > 100.5) add('hotspot: area keluar gambar', `${it.id} ${r.label}`)
    for (let i = 0; i < it.regions.length; i++) {
      for (let j = i + 1; j < it.regions.length; j++) {
        const a = it.regions[i]!
        const b = it.regions[j]!
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ox > 0 && oy > 0 && ox * oy > 0.4 * Math.min(a.w * a.h, b.w * b.h)) add('hotspot: area bertumpuk >40%', `${it.id} ${a.label} x ${b.label}`)
      }
    }
  }
  if (it.type === 'label') {
    if (it.labels.length !== it.spots.length) add('label: jumlah label dan titik beda', it.id)
    const dup = [...it.labels, ...it.extraLabels].filter((x, i, all) => all.indexOf(x) !== i)
    if (dup.length) add('label: label kembar (bank menyembunyikan salinan)', `${it.id} ${JSON.stringify(dup)}`)
  }
  if (it.type === 'numeric') {
    const s = parseNumberCandidates(String(it.answer))
    if (!s.includes(it.answer)) add('numeric: kunci tidak terbaca', `${it.id} ${it.answer}`)
    if (it.unit && /per|\//.test(it.unit) === false && /[a-z]/i.test(it.unit) && /\bin\s+(metres|cm|kg|m\b)/.test(it.prompt) && !it.prompt.includes(it.unit)) add('numeric: satuan beda dengan kalimat soal', `${it.id} ${it.unit}`)
  }
}

console.log('total isian teks', totalText)
for (const [k, v] of Object.entries(issues).sort()) {
  console.log(`\n## ${k}: ${v.length}`)
  console.log(v.slice(0, Number(process.env.QA_MAX ?? 12)).join('\n'))
}
