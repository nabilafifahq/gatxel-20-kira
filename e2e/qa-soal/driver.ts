import { chromium, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import postgres from 'postgres'
import { cellMatches, checkAnswer, keyOf } from '../../packages/content/src/check'
import { analysePegs, fitsSlot, fittingOrientations, fractionBarOk, geoOk, PIECE_NAME, tangramScore, type BarState, type Peg } from '../../packages/content/src/manip'
import type { Item } from '../../packages/content/src/schema'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3173'
export const sql = postgres(process.env.DATABASE_URL_OWNER ?? 'postgres://kira_owner:devpass@127.0.0.1:54479/kira', { max: 3, onnotice: () => {} })

export const PHONE = { width: 375, height: 700 }
export const TABLET = { width: 800, height: 1100 }

export type Issue = { kind: string; detail: string }

export async function ids() {
  const [o] = await sql`select id from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`
  const learners = await sql`select user_id, name from learner_profile where org_id = ${o!.id}`
  return { org: o!.id as string, aisha: learners.find((l) => l.name === 'Aisha')!.user_id as string, raka: learners.find((l) => l.name === 'Raka')!.user_id as string }
}

export async function login(ctx: BrowserContext, name: 'Aisha' | 'Raka' = 'Raka'): Promise<Page> {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/masuk?next=${encodeURIComponent('/perangkat')}`)
  await page.getByLabel('Email').first().fill('tutor@contoh.test')
  await page.getByLabel('Password', { exact: true }).fill('kira-tutor-contoh-2026')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 30000 })
  await page.goto(`${BASE}/perangkat`)
  await page.getByLabel('Nama tablet').fill(`QA ${Date.now()}`)
  await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 })
  await page.getByRole('link', { name: new RegExp(`^${name}, Grade`) }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
  const pin = name === 'Aisha' ? ['Sun', 'Moon', 'Star', 'Cat'] : ['Tree', 'Apple', 'Boat', 'Ball']
  for (const p of pin) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 30000 })
  return page
}

export async function makeAttempt(learner: { org: string; id: string }, refs: { ref: string; difficulty: number }[], subject: string, opts: { mode?: string; timeLimitS?: number | null } = {}): Promise<string> {
  const items = refs.map((r, i) => ({ ref: r.ref, section: 'core', position: i + 1, difficulty: r.difficulty }))
  const rows = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
    values (${learner.org}, ${learner.id}, 'test', ${opts.mode ?? 'latihan'}, ${subject}, 'QA', ${sql.json(items)}, ${opts.timeLimitS ?? null}) returning id`
  return rows[0]!.id as string
}

const A = (p: Page) => p.locator('section[aria-label="Your answer"]')
const Q = (p: Page) => p.locator('section[aria-label="Question"]')
const T = 8000

async function tapExact(scope: Locator, name: string, nth = 0) {
  await scope.getByRole('button', { name, exact: true }).nth(nth).click({ timeout: T })
}

async function tapOption(group: Locator, label: string) {
  const btns = group.locator('button')
  const n = await btns.count()
  const want = label.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < n; i++) {
    const al = (await btns.nth(i).getAttribute('aria-label')) ?? ''
    if (al.replace(/^[A-F], /, '').replace(/\s+/g, ' ').trim() === want) {
      await btns.nth(i).click({ timeout: T })
      return
    }
  }
  throw new Error(`opsi tidak ketemu: ${label}`)
}

const optLabel = (o: { text?: string; figure?: unknown }) => o.text ?? ((o.figure as { alt?: string } | undefined)?.alt ?? '')

async function typeNumber(scope: Locator, s: string) {
  for (const ch of s) {
    if (ch === '-') continue
    await tapExact(scope, ch === '.' || ch === ',' ? 'Decimal point' : ch)
  }
  if (s.startsWith('-')) await tapExact(scope, 'Minus sign')
}

const wrongNumber = (ans: number, tol: number, alt: number[] = []): number => {
  for (const d of [1, 2, 3, 5, 7, 11, 13, 100]) {
    const c = ans + tol + d
    if (![ans, ...alt].some((x) => Math.abs(x - c) <= tol)) return c
  }
  return ans + 1000
}

/** Ketuk titik yang benar-benar mengenai elemen SVG (titik tengah kotak batas segitiga bisa jatuh di luar bentuk). */
async function tapSvg(page: Page, loc: Locator) {
  await loc.scrollIntoViewIfNeeded({ timeout: T })
  const pt = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect()
    for (let fy = 0.5; fy > 0.02; fy -= 0.08) {
      for (let fx = 0.5; fx > 0.02; fx -= 0.08) {
        for (const [ax, ay] of [[fx, fy], [1 - fx, fy], [fx, 1 - fy], [1 - fx, 1 - fy]] as const) {
          const x = r.left + r.width * ax
          const y = r.top + r.height * ay
          const hit = document.elementFromPoint(x, y)
          if (hit === el || (hit && el.contains(hit))) return { x, y }
        }
      }
    }
    return null
  })
  if (!pt) throw new Error('elemen SVG tidak bisa diketuk (tertutup elemen lain)')
  await page.mouse.click(pt.x, pt.y)
}

async function answerNumeric(it: { answer: number; tolerance: number; acceptAlt?: number[] }, correct: boolean, scope: Locator) {
  await typeNumber(scope, String(correct ? it.answer : wrongNumber(it.answer, it.tolerance, it.acceptAlt)))
}

export type AnswerOpts = { issues: Issue[] }

export async function answer(page: Page, item: Item, correct: boolean, o: AnswerOpts): Promise<void> {
  const a = A(page)
  switch (item.type) {
    case 'mcq':
    case 'listen': {
      const idx = correct ? item.answer : item.options.findIndex((_, i) => i !== item.answer)
      await tapOption(a.getByRole('group', { name: 'Answers' }), optLabel(item.options[idx]!))
      return
    }
    case 'multi': {
      const want = new Set(item.answers)
      const others = item.options.map((_, i) => i).filter((i) => !want.has(i))
      const picks = correct ? item.answers : [...item.answers.slice(0, -1), others[0]!]
      for (const i of picks) await tapOption(a.getByRole('group', { name: 'Answers' }), optLabel(item.options[i]!))
      return
    }
    case 'numeric':
      return answerNumeric(item, correct, a)
    case 'text': {
      const total = item.blanks.length
      const boxes = page.getByRole('textbox', total > 1 ? { name: /^(Gap \d+ of \d+)$/ } : { name: 'Your answer' })
      const n = await boxes.count()
      if (n !== total) o.issues.push({ kind: 'text-inputs', detail: `${n} kotak untuk ${total} isian` })
      for (let i = 0; i < n; i++) {
        await boxes.nth(i).click({ timeout: T })
        await boxes.nth(i).fill(correct ? item.blanks[i]!.answers[0]! : 'zzzq')
      }
      return
    }
    case 'order': {
      const n = item.items.length
      const ords = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
      const seq = correct ? item.items.map((_, i) => i) : item.items.map((_, i) => (i + 1) % n)
      for (let k = 0; k < n; k++) {
        await a.getByRole('button', { name: `Card ${item.items[seq[k]!]}`, exact: true }).first().click({ timeout: T })
        await a.getByRole('button', { name: new RegExp(`^${ords[k]}, empty`) }).click({ timeout: T })
      }
      return
    }
    case 'match': {
      const n = item.pairs.length
      for (let l = 0; l < n; l++) {
        const r = correct ? l : (l + 1) % n
        const grid = a.locator('.grid div.contents')
        await grid.nth(l).locator('button').first().click({ timeout: T })
        const rights = grid.locator('button:nth-child(2)')
        const count = await rights.count()
        let done = false
        for (let i = 0; i < count; i++) {
          const al = (await rights.nth(i).getAttribute('aria-label')) ?? ''
          if (al.replace(/, matched$/, '') === item.pairs[r]![1]) {
            await rights.nth(i).click({ timeout: T })
            done = true
            break
          }
        }
        if (!done) throw new Error(`kanan tidak ketemu ${item.pairs[r]![1]}`)
      }
      return
    }
    case 'sort': {
      const g = item.groups.length
      for (const c of item.items) {
        const dest = correct ? c.group : (c.group + 1) % g
        await a.locator('section[aria-label="Cards to sort"]').getByRole('button', { name: c.text, exact: true }).first().click({ timeout: T })
        await a.getByRole('button', { name: `Put ${c.text} in ${item.groups[dest]}`, exact: true }).click({ timeout: T })
      }
      return
    }
    case 'numberline': {
      const off = Math.floor(item.tolerance / item.step) + 1
      const target = correct ? item.answer : item.answer + off * item.step <= item.max ? item.answer + off * item.step : item.answer - off * item.step
      const svg = a.locator('[role=slider] svg')
      await svg.scrollIntoViewIfNeeded()
      const box = (await svg.boundingBox())!
      const W = 600
      const PAD = 36
      const x = box.x + ((PAD + ((target - item.min) / (item.max - item.min)) * (W - 2 * PAD)) / W) * box.width
      await page.mouse.click(x, box.y + box.height * 0.55)
      return
    }
    case 'clock': {
      const hh = (item.answer.h % 12) + (correct ? 0 : 1)
      const mm = item.answer.m
      const step = item.stepMinutes
      if (hh === 0 && mm === 0) {
        await tapExact(a, 'Hour forward')
        await tapExact(a, 'Hour back')
      } else {
        for (let i = 0; i < hh; i++) await tapExact(a, 'Hour forward')
        for (let i = 0; i < mm / step; i++) await tapExact(a, `Minutes forward by ${step}`)
      }
      return
    }
    case 'fraction': {
      const want = (item.answer.num * item.parts) / item.answer.den
      const n = correct ? want : want + 1 <= item.parts ? want + 1 : want - 1
      for (let k = 0; k < n; k++) await tapSvg(page, a.getByRole('button', { name: `Part ${k + 1} of ${item.parts}`, exact: true }))
      return
    }
    case 'story': {
      for (let k = 0; k < item.parts.length; k++) {
        const part = item.parts[k]!
        await a.getByRole('tab', { name: new RegExp(`^Question ${k + 1}`) }).click({ timeout: T })
        const panel = a.getByRole('tabpanel')
        if (part.type === 'mcq') {
          const idx = correct ? part.answer : part.options.findIndex((_, i) => i !== part.answer)
          await tapOption(panel.getByRole('group', { name: 'Answers' }), optLabel(part.options[idx]!))
        } else if (part.type === 'numeric') {
          await answerNumeric(part, correct, panel)
        } else {
          const box = panel.getByRole('textbox')
          const c = await box.count()
          if (c !== 1) throw new Error(`bagian cerita isian punya ${c} kotak: ${part.prompt}`)
          await box.fill(correct ? part.answers[0]! : 'zzzq')
        }
      }
      return
    }
    case 'tiles': {
      const words = item.answer.split(/\s+/).filter(Boolean)
      const seq = correct ? words : [...words.slice(1), words[0]!]
      const cards = a.getByRole('group', { name: 'Word cards' })
      for (const w of seq) await cards.getByRole('button', { name: w, exact: true }).first().click({ timeout: T })
      return
    }
    case 'spell': {
      const w = correct ? item.word : `${item.word.slice(0, -1)}${item.word.endsWith('z') ? 'q' : 'z'}`
      const keys = a.getByRole('group', { name: 'Letters' })
      for (const ch of w.toLowerCase()) await keys.getByRole('button', { name: ch === '-' ? 'Hyphen' : ch === "'" ? 'Apostrophe' : ch, exact: true }).first().click({ timeout: T })
      return
    }
    case 'cloze': {
      const n = item.gaps.length
      const sel = Q(page).getByRole('combobox')
      const c = await sel.count()
      if (c !== n) o.issues.push({ kind: 'cloze-selects', detail: `${c} pilihan untuk ${n} celah` })
      for (let i = 0; i < c; i++) {
        const g = item.gaps[i]!
        const idx = correct ? g.answer : g.options.findIndex((_, k) => k !== g.answer)
        await sel.nth(i).selectOption({ label: g.options[idx]! }, { timeout: T })
      }
      return
    }
    case 'hotspot': {
      const want = new Set(item.answers)
      const wrong = item.regions.map((_, i) => i).filter((i) => !want.has(i))
      const picks = correct ? item.answers : [...item.answers.slice(0, -1), wrong[0]!]
      const group = a.getByRole('group', { name: 'Places in the picture' })
      for (const i of picks) {
        const btn = group.getByRole('button', { name: item.regions[i]!.label, exact: true })
        try {
          await btn.click({ timeout: 4000 })
        } catch (e) {
          o.issues.push({ kind: 'hotspot-covered', detail: `${item.regions[i]!.label}: ${String(e).slice(0, 80)}` })
          await tapSvg(page, btn)
        }
      }
      return
    }
    case 'label': {
      const n = item.spots.length
      const seq = correct ? item.labels : [...item.labels.slice(1), item.labels[0]!]
      for (let s = 0; s < n; s++) {
        await a.getByRole('group', { name: 'Labels' }).getByRole('button', { name: seq[s]!, exact: true }).first().click({ timeout: T })
        const pin = a.getByRole('group', { name: 'Places to label' }).getByRole('button', { name: `Place ${s + 1}, empty`, exact: true })
        try {
          await pin.click({ timeout: 3000 })
        } catch {
          o.issues.push({ kind: 'label-pin-covered', detail: `titik ${s + 1}` })
          await a.getByRole('button', { name: `Place ${s + 1}, empty`, exact: true }).last().click({ timeout: T })
        }
      }
      return
    }
    case 'table': {
      for (let b = 0; b < item.blanks.length; b++) {
        const bl = item.blanks[b]!
        const head = item.head[bl.col] ?? 'Column'
        await a.getByRole('button', { name: `${head}, row ${bl.row + 1}: empty` }).first().click({ timeout: T })
        const numeric = bl.answers.every((x) => /^-?[\d.,/ ]+$/.test(x))
        const extra = new Set(bl.answers.join('').split('').filter((c) => (numeric ? !/[A-Za-z0-9]/.test(c) : !/[A-Za-z]/.test(c))))
        const typeable = (s: string) => [...s.toLowerCase()].every((c) => (numeric ? /[0-9]/.test(c) : /[a-z]/.test(c)) || extra.has(c))
        const good = bl.answers.find(typeable)
        if (correct && good === undefined) {
          o.issues.push({ kind: 'table-untypeable', detail: `${JSON.stringify(bl.answers)} tidak bisa diketik` })
          throw new Error('jawaban tabel tidak bisa diketik')
        }
        const val = correct ? good! : numeric ? (bl.answers.some((x) => cellMatches('9', x)) ? '8' : '9') : bl.answers.some((x) => cellMatches('z', x)) ? 'y' : 'z'
        const keys = a.getByRole('group', { name: numeric ? 'Numbers' : 'Letters' })
        for (const ch of val.toLowerCase()) await keys.getByRole('button', { name: ch === ' ' ? 'Space' : ch === '-' ? 'Hyphen' : ch === "'" ? 'Apostrophe' : ch === '.' ? 'Point' : ch, exact: true }).first().click({ timeout: T })
      }
      return
    }
    case 'grid': {
      const size = item.size
      const given = item.given.flat()
      const filled = item.filled.flat()
      const first = filled.find((_, i) => given[i] === 0)!
      for (let i = 0; i < given.length; i++) {
        if (given[i] !== 0) continue
        const r = Math.floor(i / size)
        const c = i % size
        await a.getByRole('button', { name: new RegExp(`^Row ${r + 1}, column ${c + 1}:`) }).click({ timeout: T })
        await tapExact(a.getByRole('group', { name: 'Numbers' }), String(correct ? filled[i] : first))
      }
      return
    }
    case 'blocks': {
      let tgt = { ...item.target }
      if (!correct) tgt = { ...tgt, o: tgt.o < 30 ? tgt.o + 1 : tgt.o - 1 }
      const names = { h: 'hundred', t: 'ten', o: 'one' } as const
      let touched = false
      for (const p of ['h', 't', 'o'] as const) {
        const diff = tgt[p] - item.start[p]
        for (let i = 0; i < Math.abs(diff); i++) {
          touched = true
          await tapExact(a, diff > 0 ? `Add one ${names[p]}` : `Take away one ${names[p]}`)
        }
      }
      if (!touched) {
        await tapExact(a, 'Add one one')
        await tapExact(a, 'Take away one one')
      }
      return
    }
    case 'fractionbar': {
      const key = keyOf(item) as Extract<ReturnType<typeof keyOf>, { type: 'fractionbar' }>
      // Cari susunan yang benar atau salah dengan menjelajah semua pilihan.
      const options = item.rows.map((row) => {
        const dens = row.den !== undefined ? [row.den] : item.splits
        const out: BarState[] = []
        for (const den of dens) for (let s = 0; s <= den; s++) if (row.locked === undefined || s === row.locked) out.push({ den, shaded: s })
        return out
      })
      let combos: BarState[][] = [[]]
      for (const opts of options) combos = combos.flatMap((c) => opts.map((x) => [...c, x]))
      const pick = combos.find((c) => fractionBarOk(key, c) === correct && (correct || c.some((b, i) => item.rows[i]!.locked === undefined && b.shaded > 0)))
      if (!pick) throw new Error('tidak ada susunan batang')
      for (let i = 0; i < pick.length; i++) {
        const row = item.rows[i]!
        const bar = pick[i]!
        const sec = a.locator(`section[aria-label="Bar ${i + 1}"]`)
        if (row.den === undefined) await sec.getByRole('radiogroup').getByRole('radio', { name: String(bar.den), exact: true }).click({ timeout: T })
        if (row.locked === undefined && bar.shaded > 0) await sec.getByRole('button', { name: new RegExp(`^Part ${bar.shaded} of ${bar.den}(,|$)`) }).click({ timeout: T })
      }
      return
    }
    case 'barmodel': {
      const bars = correct ? item.bars : item.bars.map((b, i) => (i === 0 ? { ...b, units: b.units + (b.units > 1 ? -1 : 1) } : b))
      for (let i = 0; i < bars.length; i++) {
        await a.getByRole('button', { name: 'Add bar' }).click({ timeout: T })
        await a.getByRole('radiogroup', { name: `Label for bar ${i + 1}` }).getByRole('radio', { name: bars[i]!.label, exact: true }).click({ timeout: T })
        const b = bars[i]!
        for (let u = 1; u < b.units; u++) await tapExact(a, `More units in bar ${i + 1}`)
        if (b.units < 1) await tapExact(a, `Fewer units in bar ${i + 1}`)
      }
      if (item.unitValue !== undefined) {
        const has10 = await a.getByRole('button', { name: 'More value by 10', exact: true }).count()
        let v = item.unitValue
        if (has10) {
          while (v >= 10) {
            await tapExact(a, 'More value by 10')
            v -= 10
          }
        }
        for (let k = 0; k < v; k++) await tapExact(a, 'More value by 1')
      }
      return
    }
    case 'tangram': {
      const used = new Set<number>()
      const placed: [number, number, 0 | 1][] = []
      for (let s = 0; s < item.slots.length; s++) {
        let chosen = -1
        let orient = { rot: 0, flip: false }
        for (let p = 0; p < item.pieces.length; p++) {
          if (used.has(p)) continue
          const fits = fittingOrientations(item.pieces[p]!, item.slots[s]!)
          if (correct ? fits[0] : true) {
            chosen = p
            orient = correct ? fits[0]! : { rot: 0, flip: false }
            break
          }
        }
        if (chosen < 0) throw new Error('keping habis')
        used.add(chosen)
        placed.push([chosen, orient.rot, orient.flip ? 1 : 0])
      }
      if (!correct && tangramScore({ pieces: item.pieces, slots: item.slots }, placed).all) {
        // Semua kebetulan pas: ganti arah keping pertama sampai tidak pas.
        const pl = placed[0]!
        let changed = false
        for (const rot of [1, 2, 3]) {
          if (!fitsSlot(item.pieces[pl[0]]!, rot, false, item.slots[0]!)) {
            pl[1] = rot
            changed = true
            break
          }
        }
        if (!changed) o.issues.push({ kind: 'tangram-no-wrong', detail: 'semua arah pas' })
      }
      const tray = a.getByRole('group', { name: 'Tray of pieces' })
      for (let s = 0; s < placed.length; s++) {
        const [p, rot, flip] = placed[s]!
        const name = PIECE_NAME[item.pieces[p]!]
        await tray.getByRole('button', { name: new RegExp(`^${name}`) }).first().click({ timeout: T })
        for (let r = 0; r < rot; r++) await tapExact(a, 'Turn')
        if (flip) await tapExact(a, 'Flip')
        await tapSvg(page, a.getByRole('button', { name: new RegExp(`^Place ${s + 1} of ${item.slots.length}`) }))
      }
      return
    }
    case 'geoboard': {
      let pegs: Peg[] = item.example as Peg[]
      if (!correct) {
        const candidates: Peg[][] = []
        for (let w = 1; w < item.size; w++) {
          for (let h = 1; h < item.size; h++) {
            candidates.push([[0, 0], [w, 0], [w, h], [0, h]])
            candidates.push([[0, 0], [w, 0], [0, h]])
          }
        }
        const bad = candidates.find((c) => analysePegs(c).ok && !geoOk(item.rule, analysePegs(c)))
        if (!bad) throw new Error('tidak ada bentuk salah')
        pegs = bad
      }
      const peg = (x: number, y: number) => a.getByRole('button', { name: new RegExp(`^Peg column ${x + 1}, row ${y + 1}(,|$)`) })
      for (const [x, y] of pegs) await peg(x, y).click({ timeout: T })
      await peg(pegs[0]![0], pegs[0]![1]).click({ timeout: T })
      return
    }
    case 'write': {
      const words = Array.from({ length: Math.max(item.minWords ?? 3, 3) }, () => 'kitten').join(' ')
      await a.getByRole('textbox').first().fill(words)
      return
    }
    default:
      throw new Error(`jenis ${item.type} perlu alur khusus`)
  }
}

/** Pemeriksaan tata letak untuk setiap soal: geser samping, gambar terpotong, tabel meluap, target kecil. */
export async function layoutProbe(page: Page): Promise<Issue[]> {
  return page.evaluate(() => {
    const out: { kind: string; detail: string }[] = []
    const de = document.documentElement
    if (de.scrollWidth > window.innerWidth + 1) out.push({ kind: 'page-overflow-x', detail: `${de.scrollWidth} > ${window.innerWidth}` })
    for (const sec of Array.from(document.querySelectorAll('section[aria-label="Question"], section[aria-label="Your answer"]'))) {
      const el = sec as HTMLElement
      if (el.scrollWidth > el.clientWidth + 1) out.push({ kind: 'section-overflow-x', detail: `${el.getAttribute('aria-label')} ${el.scrollWidth} > ${el.clientWidth}` })
    }
    for (const svg of Array.from(document.querySelectorAll('section[aria-label="Question"] svg, section[aria-label="Your answer"] svg'))) {
      const sr = svg.getBoundingClientRect()
      if (sr.width < 60) continue // ikon
      for (const t of Array.from(svg.querySelectorAll('text'))) {
        const r = t.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.left < sr.left - 1.5 || r.right > sr.right + 1.5 || r.top < sr.top - 1.5 || r.bottom > sr.bottom + 1.5) {
          out.push({ kind: 'svg-text-clipped', detail: `"${(t.textContent ?? '').slice(0, 30)}" svg ${Math.round(sr.width)}x${Math.round(sr.height)} text ${Math.round(r.left - sr.left)},${Math.round(r.top - sr.top)} w${Math.round(r.width)}` })
        }
      }
      const labels = Array.from(svg.querySelectorAll('text')).map((t) => ({ s: t.textContent ?? '', r: t.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.s.trim() !== '')
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i]!.r
          const b = labels[j]!.r
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > 3 && oy > 5) out.push({ kind: 'svg-text-overlap', detail: `"${labels[i]!.s.slice(0, 20)}" x "${labels[j]!.s.slice(0, 20)}"` })
        }
      }
      if (sr.right > window.innerWidth + 1) out.push({ kind: 'svg-off-screen', detail: `kanan ${Math.round(sr.right)}` })
    }
    for (const tb of Array.from(document.querySelectorAll('table'))) {
      const box = tb.getBoundingClientRect()
      if (box.right > window.innerWidth + 1) out.push({ kind: 'table-off-screen', detail: `kanan ${Math.round(box.right)}` })
      for (const c of Array.from(tb.querySelectorAll('td,th'))) {
        const el = c as HTMLElement
        if (el.scrollWidth > el.clientWidth + 2) out.push({ kind: 'table-cell-overflow', detail: `"${(el.textContent ?? '').slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}` })
      }
    }
    for (const b of Array.from(document.querySelectorAll('section[aria-label="Your answer"] button:not([disabled])'))) {
      const r = b.getBoundingClientRect()
      if (r.width === 0 || b.closest('svg')) continue
      if (r.height < 43.5 || r.width < 43.5) out.push({ kind: 'small-target', detail: `${(b.getAttribute('aria-label') ?? b.textContent ?? '').slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}` })
      if (r.right > window.innerWidth + 1) out.push({ kind: 'button-off-screen', detail: `${(b.getAttribute('aria-label') ?? b.textContent ?? '').slice(0, 24)}` })
    }
    for (const el of Array.from(document.querySelectorAll('section[aria-label="Question"] p, section[aria-label="Your answer"] button span'))) {
      const h = el as HTMLElement
      if (h.scrollWidth > h.clientWidth + 2 && getComputedStyle(h).display !== 'inline') out.push({ kind: 'text-overflow', detail: (h.textContent ?? '').slice(0, 40) })
    }
    for (const i of Array.from(document.images).filter((x) => x.complete && x.naturalWidth === 0)) out.push({ kind: 'broken-image', detail: i.src })
    return out
  })
}

export async function sheetProbe(page: Page): Promise<Issue[]> {
  return page.evaluate(() => {
    const out: { kind: string; detail: string }[] = []
    for (const s of Array.from(document.querySelectorAll('[role=status]')).filter((x) => x.querySelector('h2'))) {
      const r = s.getBoundingClientRect()
      if (r.top < -1) out.push({ kind: 'sheet-cut-off-top', detail: `top ${Math.round(r.top)}, tinggi ${Math.round(r.height)} layar ${window.innerHeight}` })
      if (r.bottom > window.innerHeight + 1) out.push({ kind: 'sheet-cut-off-bottom', detail: `bottom ${Math.round(r.bottom)} layar ${window.innerHeight}` })
    }
    return out
  })
}

export async function pollStatus(attemptId: string, position: number, attemptNo: number, timeoutMs = 30000): Promise<string | null> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const r = await sql`select status from response where attempt_id = ${attemptId} and position = ${position} and attempt_no = ${attemptNo}`
    if (r[0]) return r[0].status as string
    await new Promise((res) => setTimeout(res, 150))
  }
  return null
}

export function keyStatus(item: Item, ans: unknown) {
  return checkAnswer(keyOf(item), ans)
}

export { chromium }
export type { Browser, BrowserContext, Page }
