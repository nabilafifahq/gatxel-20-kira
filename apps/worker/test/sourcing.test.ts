import { describe, expect, it } from 'vitest'
import { findContentDir, loadContent } from '@kira/content/load'
import { allowedHosts, sourceSchema } from '@kira/content/sources'
import { buildItem, normalisePrompt, promptHash } from '../src/sourcing/build-item'
import { parseAsdiv, parseAnswer } from '../src/sourcing/datasets/asdiv'
import { parseBebrasTask } from '../src/sourcing/datasets/bebras'
import { needsPicture, noDashes, unsafeForKids } from '../src/sourcing/datasets/common'
import { parseGsm8k } from '../src/sourcing/datasets/gsm8k'
import { OPENTDB_GAP_MS, openTdbUrl, parseOpenTdb } from '../src/sourcing/datasets/opentdb'
import { arcGrade, parseScienceRows } from '../src/sourcing/datasets/science-mcq'
import { parseScienceQa } from '../src/sourcing/datasets/scienceqa'
import { joinBodyQuestion, parseSvamp, svampGrade } from '../src/sourcing/datasets/svamp'
import { mapCandidate, mathTopic, scienceRule } from '../src/sourcing/map'
import { assertAllowedUrl, FetchGuardError, guardedFetch } from '../src/sourcing/net'
import { normalizeTag, pendingFiles } from '../src/sourcing/pdf'
import { chooseForSource, problemsFor, summarise } from '../src/sourcing/run'
import { draftRequest, THIN_ITEMS, thinSkills } from '../src/sourcing/thin'
import type { Candidate } from '../src/sourcing/types'

const content = loadContent(findContentDir()).index
const skillsOf = (s: Candidate['subject'], g: number) => content.skillsByKey.get(`${s}:${g}`) ?? []

const ASDIV = `<?xml version="1.0"?><Machine-Reading-Corpus-File><ProblemSet>
<Problem ID="nluds-0001" Grade="1" Source="http://www.k5learning.com"><Body>Seven red apples and two green apples are in the basket.</Body><Question>How many apples are in the basket?</Question><Solution-Type>Addition</Solution-Type><Answer>9 (apples)</Answer><Formula>7+2=9</Formula></Problem>
<Problem ID="nluds-0002" Grade="3" Source="x"><Body>Sam invited 9 friends, but 6 couldn&apos;t come. Each person eats 2 cupcakes.</Body><Question>How many cupcakes should he buy?</Question><Solution-Type Subtype-1="Subtraction">Multiplication</Solution-Type><Answer>6 (cupcakes)</Answer><Formula>(9-6)*2=6</Formula></Problem>
<Problem ID="nluds-0003" Grade="2" Source="x"><Body>Jane has 3 pens and Tim has 4 pens.</Body><Question>How many pens do they have, and how many each?</Question><Solution-Type>Addition</Solution-Type><Answer>7 ; 3</Answer><Formula>3+4=7</Formula></Problem>
<Problem ID="nluds-0004" Grade="9" Source="x"><Body>Too advanced for this app, really.</Body><Question>How many?</Question><Solution-Type>Addition</Solution-Type><Answer>1</Answer><Formula>1=1</Formula></Problem>
<Problem ID="nluds-0005" Grade="2" Source="x"><Body>A soldier has a gun and 5 bullets in the war.</Body><Question>How many bullets are left after 2 are used?</Question><Solution-Type>Subtraction</Solution-Type><Answer>3</Answer><Formula>5-2=3</Formula></Problem>
</ProblemSet></Machine-Reading-Corpus-File>`

describe('net: unduhan yang dijaga', () => {
  it('hanya https, hanya host yang diizinkan, tanpa kredensial', () => {
    expect(() => assertAllowedUrl('http://opentdb.com/api.php', ['opentdb.com'])).toThrow(FetchGuardError)
    expect(() => assertAllowedUrl('https://evil.example/api.php', ['opentdb.com'])).toThrow(/tidak ada di daftar host/)
    expect(() => assertAllowedUrl('https://user:pw@opentdb.com/api.php', ['opentdb.com'])).toThrow(/kredensial/)
    expect(() => assertAllowedUrl('bukan alamat', ['opentdb.com'])).toThrow(/tidak valid/)
    expect(assertAllowedUrl('https://opentdb.com/api.php?amount=1', ['opentdb.com']).hostname).toBe('opentdb.com')
  })

  it('batas ukuran, kode galat, pengalihan ditolak', async () => {
    const opts = { allowedHosts: ['a.example'], maxBytes: 10 }
    const big = (async () => new Response('x'.repeat(50))) as typeof fetch
    await expect(guardedFetch('https://a.example/f', { ...opts, fetchImpl: big })).rejects.toThrow(/melewati batas|terlalu besar/)
    const bad = (async () => new Response('no', { status: 404 })) as typeof fetch
    await expect(guardedFetch('https://a.example/f', { ...opts, fetchImpl: bad })).rejects.toThrow(/kode 404/)
    const ok = (async () => new Response('halo')) as typeof fetch
    expect((await guardedFetch('https://a.example/f', { ...opts, fetchImpl: ok })).toString()).toBe('halo')
    let seen: RequestInit | undefined
    const spy = (async (_u: unknown, init?: RequestInit) => ((seen = init), new Response('ok'))) as typeof fetch
    await guardedFetch('https://a.example/f', { ...opts, fetchImpl: spy })
    expect(seen?.redirect).toBe('error')
  })

  it('host sumber dihitung dari registri', () => {
    const s = sourceSchema.parse({
      id: 'x', name: 'X', site: 'https://x.example', subjects: ['math'], grades: [2], license: 'official-free', attribution: 'Penyelenggara X.', format: 'pdf', access: 'auto',
      fetch: { kind: 'official-pdf', files: [{ url: 'https://files.x.example/a.pdf', title: 'A', grade: 2 }, { url: 'https://files.x.example/b.pdf', title: 'B', grade: 3, year: 2023 }] },
    })
    expect(allowedHosts(s)).toEqual(['files.x.example'])
  })
})

describe('penyaring teks', () => {
  it('kata tidak pantas untuk anak SD dan soal bergantung gambar disaring', () => {
    expect(unsafeForKids('A soldier fired a gun in the war')).toBe(true)
    expect(unsafeForKids('Tom has 5 apples and eats 2')).toBe(false)
    expect(unsafeForKids('He drank beer')).toBe(true)
    expect(needsPicture('Look at the diagram below')).toBe(true)
    expect(needsPicture('How many legs do 3 dogs have?')).toBe(false)
  })

  it('tanda pisah panjang dibuang', () => {
    expect(noDashes(`a ${String.fromCharCode(0x2014)} b`)).toBe('a, b')
  })
})

describe('ASDiv', () => {
  const r = parseAsdiv(ASDIV)
  it('membaca soal bersatu jawaban angka dan melewati jawaban ganda, kelas di luar rentang, dan kata tidak pantas', () => {
    expect(r.rawCount).toBe(5)
    expect(r.rows.map((x) => x?.externalId ?? null)).toEqual(['nluds-0001', 'nluds-0002', null, null, null])
  })
  it('isi soal: teks, jawaban, satuan, langkah, kelas, dan petunjuk topik', () => {
    expect(r.rows[0]).toMatchObject({ grade: 1, type: 'numeric', answer: 9, unit: 'apples', topicHint: 'Addition', difficulty: 1 })
    expect(r.rows[0]!.prompt).toBe('Seven red apples and two green apples are in the basket. How many apples are in the basket?')
    expect(r.rows[0]!.steps).toEqual(['Write the number sentence: 7+2=9'])
    expect(r.rows[1]!.prompt).toContain("couldn't")
    expect(r.rows[1]).toMatchObject({ grade: 3, topicHint: 'Multiplication' })
  })
  it('parseAnswer', () => {
    expect(parseAnswer('9 (apples)')).toMatchObject({ value: 9, unit: 'apples', decimal: false })
    expect(parseAnswer('2.5')).toMatchObject({ value: 2.5, decimal: true })
    expect(parseAnswer('3 ; 2')).toBeNull()
    expect(parseAnswer('1/2')).toBeNull()
    expect(parseAnswer('-4')).toBeNull()
  })
})

describe('GSM8K', () => {
  const line = (question: string, answer: string) => JSON.stringify({ question, answer })
  const jsonl = [
    line('Tom has 5 apples. He buys 3 more apples. How many apples does Tom have now?', 'Tom has 5+3=<<5+3=8>>8 apples.\n#### 8'),
    line('A shop sells 4 bags with 6 sweets in each bag, and 3 sweets are eaten. How many sweets are left?', 'There are 4*6=<<4*6=24>>24 sweets.\n24-3=<<24-3=21>>21 left.\n#### 21'),
    line('A farm sells 5000 eggs. How many is that in all if it sells 2000 more?', '5000+2000=<<5000+2000=7000>>7000\n#### 7000'),
    line('Sam makes 20% more money each week than before. How much does he make now?', 'a\nb\nc\nd\n#### 12'),
    line('A very long problem that has far too many steps to be easy for a primary school child, so it is skipped.', 'one\ntwo\nthree\nfour\n#### 9'),
  ].join('\n')
  it('hanya soal mudah: sedikit langkah, bilangan kecil, jawaban bulat', () => {
    const r = parseGsm8k(jsonl)
    expect(r.rows.map((x) => x?.answer ?? null)).toEqual([8, 21, null, null, null])
    expect(r.rows[0]).toMatchObject({ grade: 3, type: 'numeric', difficulty: 2, steps: ['Tom has 5+3=8 apples.'] })
    expect(r.rows[1]).toMatchObject({ grade: 3, difficulty: 3 })
    expect(r.rows[1]!.steps).toHaveLength(2)
  })
})

describe('SVAMP', () => {
  it('menggabung Body dan Question dengan benar', () => {
    expect(joinBodyQuestion('Tom has 5 apples.', 'How many apples are left?')).toBe('Tom has 5 apples. How many apples are left?')
    expect(joinBodyQuestion('Each pack costs 76 dollars. If there is a discount of 25 dollars on each pack', 'How much do you have to pay?')).toBe(
      'Each pack costs 76 dollars. If there is a discount of 25 dollars on each pack, how much do you have to pay?',
    )
    expect(joinBodyQuestion('Bill has 5 apples', 'How many does he have?')).toBe('Bill has 5 apples. How many does he have?')
  })

  it('kelas dari jenis hitungan dan besar bilangan', () => {
    expect(svampGrade('Addition', [3, 5])).toBe(1)
    expect(svampGrade('Subtraction', [76, 25])).toBe(2)
    expect(svampGrade('Addition', [300, 200])).toBe(3)
    expect(svampGrade('Multiplication', [6, 8])).toBe(3)
    expect(svampGrade('Common-Division', [240, 6])).toBe(4)
  })

  it('membaca soal dan menyaring jenis, jawaban negatif, dan bilangan besar', () => {
    const data = [
      { ID: 'a-1', Body: 'Each pack of dvds costs 76 dollars. If there is a discount of 25 dollars on each pack', Question: 'How much do you have to pay to buy each pack?', Equation: '( 76.0 - 25.0 )', Answer: 51, Type: 'Subtraction' },
      { ID: 'a-2', Body: 'There are 5 boxes with 4 pens in each box.', Question: 'How many pens are there?', Equation: '( 5.0 * 4.0 )', Answer: 20, Type: 'Multiplication' },
      { ID: 'a-3', Body: 'Tom had 3 apples.', Question: 'How many more does he need for 10?', Equation: '( 3.0 - 10.0 )', Answer: -7, Type: 'Subtraction' },
      { ID: 'a-4', Body: 'A bank has 5000 coins and 2 boxes.', Question: 'How many coins in total?', Equation: '', Answer: 5002, Type: 'Addition' },
      { ID: 'a-5', Body: 'A thing with weird type of 3 things.', Question: 'How many things?', Equation: '', Answer: 3, Type: 'Other' },
    ]
    const r = parseSvamp(JSON.stringify(data))
    expect(r.rows.map((x) => x?.externalId ?? null)).toEqual(['svamp-a-1', 'svamp-a-2', null, null, null])
    expect(r.rows[0]).toMatchObject({ grade: 2, answer: 51, topicHint: 'Subtraction', steps: ['Write the number sentence: ( 76 - 25 )'] })
    expect(r.rows[1]).toMatchObject({ grade: 3, answer: 20 })
    expect(parseSvamp('bukan json').rows).toEqual([])
  })
})

describe('ARC Easy dan OpenBookQA', () => {
  const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((row, i) => ({ row_idx: i, row })), num_rows_total: 99 })
  const arcRow = (over: Record<string, unknown> = {}) => ({ id: 'MCAS_2009_5_6516', question: 'Which of these is a producer in a food chain?', choices: { text: ['grass', 'rabbit', 'fox', 'eagle'], label: ['A', 'B', 'C', 'D'] }, answerKey: 'A', ...over })

  it('kelas ARC dari kode soal', () => {
    expect(arcGrade('MCAS_2009_5_6516')).toBe(5)
    expect(arcGrade('NYSEDREGENTS_2008_4_26')).toBe(4)
    expect(arcGrade('Mercury_417466')).toBeNull()
    expect(arcGrade('ACTAAP_2007_7_3')).toBeNull()
    expect(arcGrade('NYSEDREGENTS_2008_8_2')).toBeNull()
  })

  it('ARC: soal bagus masuk; kelas tidak dikenal, soal bergambar, dan kunci tak ada disaring', () => {
    const r = parseScienceRows(
      page([arcRow(), arcRow({ id: 'Mercury_1' }), arcRow({ id: 'MCAS_2009_5_2', question: 'Which object is shown in the diagram below?' }), arcRow({ id: 'MCAS_2009_5_3', answerKey: 'Z' })]),
      'arc-easy',
    )
    expect(r.total).toBe(99)
    expect(r.rows.map((x) => x?.externalId ?? null)).toEqual(['arc-easy-MCAS_2009_5_6516', null, null, null])
    expect(r.rows[0]).toMatchObject({ subject: 'science', grade: 5, type: 'mcq', answer: 0, options: ['grass', 'rabbit', 'fox', 'eagle'] })
  })

  it('OpenBookQA: kalimat yang belum selesai diberi pengantar dan dipetakan ke kelas 4', () => {
    const r = parseScienceRows(page([{ id: '1129', question_stem: 'There is most likely going to be fog around:', choices: { text: ['a marsh', 'a tundra', 'the plains', 'a desert'], label: ['A', 'B', 'C', 'D'] }, answerKey: 'A' }]), 'openbookqa')
    expect(r.rows[0]).toMatchObject({ grade: 4, answer: 0, prompt: 'Finish the sentence: There is most likely going to be fog around:' })
  })

  it('JSON rusak tidak melempar', () => {
    expect(parseScienceRows('{{', 'arc-easy')).toEqual({ rows: [], rawCount: 0, total: 0 })
  })
})

describe('ScienceQA', () => {
  const row = (over: Record<string, unknown> = {}) => ({ image: null, question: 'Which of these is a living thing?', choices: ['a rock', 'a tree'], answer: 1, hint: '', task: 'closed choice', grade: 'grade2', subject: 'natural science', topic: 'biology', solution: 'A tree is a living thing. A rock is not.', ...over })
  const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((r, i) => ({ row_idx: i, row: r })), num_rows_total: 4241 })

  it('soal natural science tanpa gambar kelas 1 sampai 6 masuk dengan penjelasan dari penyusun', () => {
    const r = parseScienceQa(page([row(), row({ grade: 'grade1', hint: 'Think about living things.' })]))
    expect(r.total).toBe(4241)
    expect(r.rows[0]).toMatchObject({ grade: 2, answer: 1, explanation: 'A tree is a living thing. A rock is not.', topicHint: 'biology', difficulty: 1 })
    expect(r.rows[1]!.prompt).toBe('Think about living things. Which of these is a living thing?')
  })

  it('soal bergambar, bidang lain, kelas di atas 6, dan jawaban di luar opsi disaring', () => {
    const r = parseScienceQa(page([row({ image: { src: 'x' } }), row({ subject: 'language science' }), row({ grade: 'grade9' }), row({ answer: 5 }), row({ choices: ['same', 'same'] })]))
    expect(r.rows.every((x) => x === null)).toBe(true)
  })
})

describe('Open Trivia DB', () => {
  const enc = encodeURIComponent
  const body = (results: unknown[]) => JSON.stringify({ response_code: 0, results })
  const q = (over: Record<string, unknown> = {}) => ({ type: 'multiple', difficulty: 'easy', category: enc('Animals'), question: enc('What is a baby cat called?'), correct_answer: enc('kitten'), incorrect_answers: [enc('puppy'), enc('cub'), enc('foal')], ...over })

  it('membaca soal mudah dan mengacak opsi dengan tetap (deterministik)', () => {
    const a = parseOpenTdb(body([q()]), 27)
    const b = parseOpenTdb(body([q()]), 27)
    expect(a.rows[0]).toMatchObject({ subject: 'science', type: 'mcq', grade: 3, difficulty: 2, topicHint: 'Animals' })
    expect(a.rows[0]!.options![a.rows[0]!.answer]).toBe('kitten')
    expect(a.rows[0]).toEqual(b.rows[0])
  })

  it('menolak tingkat selain mudah, bukan pilihan ganda, dan kata tidak pantas; kategori tidak dikenal', () => {
    const r = parseOpenTdb(body([q({ difficulty: 'hard' }), q({ type: 'boolean' }), q({ question: enc('Which gun is the fastest?') })]), 27)
    expect(r.rows.every((x) => x === null)).toBe(true)
    expect(parseOpenTdb(body([q()]), 12).rows[0]).toBeNull()
    expect(parseOpenTdb(JSON.stringify({ response_code: 5, results: [] }), 27).rows).toEqual([])
  })

  it('alamat API memakai tingkat mudah, pilihan ganda, dan sandi url3986; jeda mengikuti aturan API', () => {
    const u = openTdbUrl(17, 99)
    expect(u).toContain('amount=50')
    expect(u).toContain('difficulty=easy')
    expect(u).toContain('type=multiple')
    expect(u).toContain('encode=url3986')
    expect(OPENTDB_GAP_MS).toBeGreaterThanOrEqual(5000)
  })
})

describe('Bebras', () => {
  const task = { id: '2023-IN-01', title: 'Beaver bridges', grade: 3, license: 'CC BY-SA 4.0', year: 2023, body: 'Which bridge lets all five beavers cross the river?', options: ['Bridge A', 'Bridge B', 'Bridge C'], answer: 1 }
  it('tugas berlisensi diterima dan dipetakan', () => {
    const r = parseBebrasTask(JSON.stringify(task))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.candidate).toMatchObject({ externalId: 'bebras-2023-IN-01', subject: 'math', grade: 3, answer: 1, topicHint: 'computational thinking' })
  })
  it('tanpa lisensi terbuka, kunci di luar opsi, atau JSON rusak ditolak', () => {
    expect(parseBebrasTask(JSON.stringify({ ...task, license: 'All rights reserved' }))).toMatchObject({ ok: false })
    expect(parseBebrasTask(JSON.stringify({ ...task, license: 'CC BY-NC 4.0' }))).toMatchObject({ ok: false })
    expect(parseBebrasTask(JSON.stringify({ ...task, answer: 4 }))).toMatchObject({ ok: false })
    expect(parseBebrasTask(JSON.stringify({ ...task, extra: 1 }))).toMatchObject({ ok: false })
    expect(parseBebrasTask('rusak')).toMatchObject({ ok: false })
  })
  it('tugas Bebras dipetakan ke skill logika olimpiade grade-nya', () => {
    const r = parseBebrasTask(JSON.stringify(task))
    expect(r.ok && mapCandidate(r.candidate, skillsOf)).toMatchObject({ skillId: 'm3.oly-logic', grade: 3 })
  })
})

describe('pemetaan ke skill Kira', () => {
  const num = (prompt: string, grade: number, topicHint?: string): Candidate => ({ externalId: 'x', subject: 'math', grade, type: 'numeric', prompt, answer: 1, difficulty: 2, ...(topicHint ? { topicHint } : {}) })
  const sci = (prompt: string, grade: number, options: string[] = ['a', 'b', 'c']): Candidate => ({ externalId: 'x', subject: 'science', grade, type: 'mcq', prompt, options, answer: 0, difficulty: 2 })

  it('topik Math dari kata kunci dan petunjuk sumber', () => {
    expect(mathTopic(num('Mia pays $5 for a book and $3 for a pen. How much in all?', 3))).toBe('money')
    expect(mathTopic(num('Tom has 5 apples and gets 3 more. How many now?', 1, 'Addition'))).toBe('add-sub')
    expect(mathTopic(num('How many cookies does she make in 3 days?', 3, 'Multiplication'))).toBe('multiplication')
    expect(mathTopic(num('The rope is 12 meters long and 5 meters are cut. How long is it now?', 3))).toBe('measure')
    expect(mathTopic(num('Half of the 12 pencils are red. How many are red?', 3))).toBe('fractions')
  })

  it('soal cerita dipetakan ke skill grade yang cocok dan skill itu ada', () => {
    expect(mapCandidate(num('Mia pays $5 for a book and $3 for a pen. How much in all?', 3), skillsOf)).toEqual({ skillId: 'm3.money-rupiah', grade: 3 })
    expect(mapCandidate(num('Tom has 5 apples and gets 3 more. How many now?', 1, 'Addition'), skillsOf)?.skillId).toMatch(/^m1\./)
    const m = mapCandidate(num('A box has 12 pencils. 4 are broken. How many work?', 2, 'Subtraction'), skillsOf)
    expect(m?.skillId).toBe('m2.subtraction')
    expect(content.skills.has(m!.skillId)).toBe(true)
  })

  it('topik Science dipetakan ke strand dan skill di kelasnya', () => {
    expect(scienceRule(sci('Which of these is a producer in a food chain?', 5))?.name).toBe('habitat')
    // Kata di soal lebih berbobot daripada kata di opsi, dan soal tanpa kata kunci tidak dipetakan.
    expect(scienceRule(sci('The sun is responsible for', 4, ['plant growth', 'bone growth', 'muscle growth']))?.name).toBe('space')
    expect(scienceRule(sci('Which characteristic describes a kitten?', 4))).toBeNull()
    expect(mapCandidate(sci('Which characteristic describes a kitten?', 4), skillsOf)).toBeNull()
    expect(mapCandidate(sci('Which of these is a producer in a food chain?', 5, ['grass', 'rabbit', 'fox']), skillsOf)).toEqual({ skillId: 's5.food-chains', grade: 5 })
    expect(mapCandidate(sci('Which material is a good electrical conductor?', 4), skillsOf)?.skillId).toBe('s4.conductors-insulators')
    expect(mapCandidate(sci('What causes day and night on Earth, the Sun or the Moon?', 4), skillsOf)?.skillId).toBe('s4.earth-sun-moon')
  })

  it('tanpa kelas atau tanpa skill di kelas itu hasilnya null', () => {
    expect(mapCandidate({ ...num('x y z', 2), grade: null }, skillsOf)).toBeNull()
    expect(mapCandidate(num('Tom has 5 apples', 2), () => [])).toBeNull()
  })

  it('setiap skill hasil pemetaan ada di konten dan sama mapel dan grade-nya', () => {
    const prompts = ['Tom has 5 apples and eats 2. How many are left?', 'A bus has 40 seats. 4 per row. How many rows?', 'Pay $4 for a pen. How much change from $10?', 'Half of 12 is how many?', 'The room is 8 meters long.']
    for (const g of [1, 2, 3, 4, 5, 6]) {
      for (const p of prompts) {
        const m = mapCandidate(num(p, g), skillsOf)
        expect(m, `${g} ${p}`).not.toBeNull()
        expect(content.skills.get(m!.skillId), m!.skillId).toMatchObject({ subject: 'math', grade: g })
      }
    }
  })
})

describe('buildItem', () => {
  const c: Candidate = { externalId: 'x', subject: 'math', grade: 3, type: 'numeric', prompt: 'Tom has 5 apples. He buys 3 more. How many apples does he have now?', answer: 8, steps: ['Tom has 5+3=8 apples.', 'So Tom has 8.'], difficulty: 2 }

  it('soal numerik lengkap lolos skema dan pemeriksaan isi, dengan langkah dan tag sumber', () => {
    const r = buildItem(c, { skillId: 'm3.add-sub-mental', grade: 3 }, 'gsm8k')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.item).toMatchObject({ type: 'numeric', skill: 'm3.add-sub-mental', answer: 8, source: 'imported', tags: ['src-gsm8k'], lang: 'en-GB' })
      expect(r.item.hints).toHaveLength(3)
      expect(r.item.solution).toHaveLength(2)
    }
  })

  it('pilihan ganda memakai penjelasan sumber bila ada', () => {
    const m: Candidate = { externalId: 'y', subject: 'science', grade: 4, type: 'mcq', prompt: 'Which one is a living thing?', options: ['a rock', 'a tree'], answer: 1, explanation: 'A tree is a living thing.', difficulty: 2 }
    const r = buildItem(m, { skillId: 's4.habitats', grade: 4 }, 'scienceqa')
    expect(r.ok && r.item.explanation).toBe('A tree is a living thing.')
    const plain = buildItem({ ...m, explanation: undefined } as Candidate, { skillId: 's4.habitats', grade: 4 }, 'scienceqa')
    expect(plain.ok && plain.item.explanation).toBe('The correct answer is "a tree".')
  })

  it('kunci di luar opsi dan teks yang melanggar aturan ditolak', () => {
    const m: Candidate = { externalId: 'y', subject: 'science', grade: 4, type: 'mcq', prompt: 'Which one is a living thing?', options: ['a rock', 'a tree'], answer: 5, difficulty: 2 }
    expect(buildItem(m, { skillId: 's4.habitats', grade: 4 }, 'arc-easy')).toMatchObject({ ok: false })
    expect(buildItem({ ...c, prompt: `Tom has 5 apples ${String.fromCharCode(0x2014)} how many more would make 8 in all?` }, { skillId: 'm3.add-sub-mental', grade: 3 }, 'gsm8k')).toMatchObject({ ok: false })
  })

  it('hash prompt sama untuk soal yang sama walau tanda baca berbeda', () => {
    expect(normalisePrompt('How MANY apples?!')).toBe('how many apples')
    expect(promptHash('How many apples?')).toBe(promptHash('how  many  apples'))
    expect(promptHash('How many apples?')).not.toBe(promptHash('How many pears?'))
  })
})

describe('pemilihan dan laporan', () => {
  const prep = (id: string, skill: string) => ({ candidate: { externalId: id } as Candidate, mapping: { skillId: skill, grade: 2 }, item: {} as never, hash: id })

  it('skill paling tipis lebih dulu dan paling banyak PER_SKILL_CAP per skill', () => {
    const many = Array.from({ length: 12 }, (_, i) => prep(`a${String(i).padStart(2, '0')}`, 'm2.thin'))
    const other = [prep('b1', 'm2.fat'), prep('b2', 'm2.fat')]
    const bank = (id: string) => (id === 'm2.thin' ? 2 : 90)
    const chosen = chooseForSource([...other, ...many], 20, bank)
    expect(chosen.filter((p) => p.mapping.skillId === 'm2.thin')).toHaveLength(8)
    expect(chosen[0]!.mapping.skillId).toBe('m2.thin')
    expect(chosen).toHaveLength(10)
    expect(chooseForSource([...many], 3, bank)).toHaveLength(3)
  })

  it('catatan untuk antrean Studio: kunci beda atau AI ragu, lengkap dengan atribusi', () => {
    const s = sourceSchema.parse({ id: 'gsm8k', name: 'GSM8K', site: 'https://x.example', subjects: ['math'], grades: [3], license: 'mit', attribution: 'Cobbe dkk. (2021), OpenAI.', format: 'jsonl', access: 'auto', importer: 'gsm8k', fetch: { kind: 'http-text', urls: ['https://x.example/a.jsonl'] } })
    const num = { type: 'numeric', answer: 8 } as Candidate
    expect(problemsFor(s, num, 'disagree', 9)).toEqual(['Kunci dari GSM8K adalah 8, tetapi AI menjawab 9. Hitung sendiri sebelum menyetujui.', 'Sumber: GSM8K (MIT). Cobbe dkk. (2021), OpenAI.'])
    expect(problemsFor(s, { type: 'mcq', answer: 2 } as Candidate, 'unverified', null)[0]).toMatch(/AI tidak yakin.*\(C\)/)
    expect(problemsFor(s, { type: 'mcq', answer: 2 } as Candidate, 'disagree', 1)[0]).toMatch(/adalah C, tetapi AI menjawab B/)
  })

  it('ringkasan hasil jadwal', () => {
    const r = { orgId: 'o', published: 3, queued: 2, unmapped: 1, duplicates: 4, rejected: 9, pdfs: 1, drafts: 5, aiCalls: 8, notes: ['gsm8k: gagal'] }
    expect(summarise([r], { left: 52, used: 8 }, 60)).toBe('selesai: 3 soal masuk bank, 2 masuk antrean Studio AI, 1 PDF masuk Impor, 5 permintaan draf, 4 dobel dibuang, AI 8 dari 60. gsm8k: gagal')
  })

  it('PDF yang sudah diambil dilewati dan tag lomba dinormalkan', () => {
    const files = [{ url: 'https://x.example/a.pdf', title: 'A', grade: 2 }, { url: 'https://x.example/b.pdf', title: 'B', grade: 2 }]
    expect(pendingFiles(files, new Set(['https://x.example/a.pdf'])).map((f) => f.title)).toEqual(['B'])
    expect(normalizeTag('Sof IMO!')).toBe('sof-imo')
  })
})

describe('skill yang banknya tipis', () => {
  it('diurutkan dari yang paling tipis, melewati skill generator dan skill yang baru diminta', () => {
    const skip = new Set<string>()
    const all = thinSkills(content, [2], new Map(), skip, 100)
    expect(all.length).toBeGreaterThan(0)
    for (const t of all) {
      expect(t.skill.generator).toBe(false)
      expect(t.skill.grade).toBe(2)
      expect(t.bank).toBeLessThan(THIN_ITEMS)
    }
    expect(all.map((t) => t.bank)).toEqual([...all.map((t) => t.bank)].sort((a, b) => a - b))
    const first = all[0]!.skill.id
    skip.add(first)
    expect(thinSkills(content, [2], new Map(), skip, 100).some((t) => t.skill.id === first)).toBe(false)
    expect(thinSkills(content, [2], new Map(), new Set(), 3)).toHaveLength(3)
    expect(thinSkills(content, [2], new Map(), new Set(), 0)).toEqual([])
  })

  it('soal org ikut dihitung sehingga skill yang sudah cukup tidak diminta', () => {
    const t = thinSkills(content, [2], new Map(), new Set(), 100)[0]!
    const enough = new Map([[t.skill.id, THIN_ITEMS]])
    expect(thinSkills(content, [2], enough, new Set(), 100).some((x) => x.skill.id === t.skill.id)).toBe(false)
  })

  it('permintaan draf memuat skill, contoh, dan petunjuk gaya lomba tanpa data anak', () => {
    const t = thinSkills(content, [2], new Map(), new Set(), 1)[0]!
    const req = draftRequest(content, t.skill)
    expect(req).toMatchObject({ kind: 'items', count: 5, difficulty: 3, skill: { id: t.skill.id, grade: 2 } })
    expect(req.instructions).toMatch(/contest-style/)
    expect(req.examples.length).toBeLessThanOrEqual(3)
    expect(JSON.stringify(req)).not.toMatch(/@/)
  })
})
