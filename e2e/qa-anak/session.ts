// Menjalani satu sesi di runner sungguhan: benar, salah, salah dua kali, pembahasan, soal serupa; bandingkan penilaian layar dengan kunci.
import { appendFileSync } from 'node:fs'
import { answer as answerEn, layoutProbe as probeEn, sheetProbe as sheetEn, type Issue } from '../qa-soal/driver'
import { answer as answerId, layoutProbe as probeId, sheetProbe as sheetId } from './driver-id'
import { OUT, resolveItem, say, sql, type Family, type Item, type Page } from './lib'

export type QRow = { n: number; ref: string; type: string; plan: string; shown: string; ok: boolean; prompt: string }
export type SessionResult = { rows: QRow[]; issues: Issue[]; driverGaps: string[]; dupes: string[]; types: Record<string, number>; finalUrl: string }

export const STR = {
  en: { q: 'Question', a: 'Your answer', check: 'Check', correct: 'Correct', notYet: 'Not yet', tryAgain: 'Try again', next: 'Next', finish: 'Finish', watch: /Watch how it works/, like: /Try one like it/, close: 'Close', of: /Question (\d+) of (\d+)/, skip: 'Skip this one', done: /Quest done/ },
  id: { q: 'Soal', a: 'Jawabanmu', check: 'Periksa', correct: 'Benar', notYet: 'Belum tepat', tryAgain: 'Coba lagi', next: 'Lanjut', finish: 'Selesai', watch: /Lihat caranya/, like: /Coba soal serupa/, close: 'Tutup', of: /Soal (\d+) dari (\d+)/, skip: 'Lewati soal ini', done: /Misi selesai/ },
}

export const textOf = (it: Item): string => {
  const a = it as unknown as { prompt?: string; options?: { text?: string }[]; listenText?: string; word?: string }
  return `${(a.prompt ?? '').trim()} | ${(a.options ?? []).map((o) => o.text ?? '').join(' / ')} | ${a.listenText ?? ''}${a.word ?? ''}`
}

/** Tampilan soal utuh tanpa pengenal: dua soal kembar hanya bila semua yang dilihat anak sama. */
export const canonOf = (it: Item): string => {
  const { id: _i, skill: _s, difficulty: _d, solution: _o, hints: _h, tags: _t, source: _r, ...rest } = it as unknown as Record<string, unknown>
  return JSON.stringify(rest).toLowerCase().replace(/\s+/g, ' ')
}

export async function attemptItems(id: string): Promise<{ ref: string; position: number; section: string }[]> {
  const [a] = await sql`select items from attempt where id = ${id}`
  return ((a?.items ?? []) as { ref: string; position: number; section: string }[]).slice().sort((x, y) => x.position - y.position)
}

export function dupeCheck(list: { ref: string }[]): string[] {
  const seen = new Map<string, string>()
  const out: string[] = []
  for (const { ref } of list) {
    const it = resolveItem(ref)
    if (!it) continue
    const k = canonOf(it)
    if (seen.has(k)) out.push(`${seen.get(k)} = ${ref}: ${textOf(it).slice(0, 80)}`)
    else seen.set(k, ref)
  }
  return out
}

export async function walkSession(page: Page, f: Family, opts: { tag: string; wrongAt?: number[]; wrongTwiceAt?: number[]; maxQ?: number; shots?: boolean }): Promise<SessionResult> {
  const S = STR[f.lang]
  const answer = f.lang === 'id' ? answerId : answerEn
  const probe = f.lang === 'id' ? probeId : probeEn
  const sheet = f.lang === 'id' ? sheetId : sheetEn
  const attemptId = new URL(page.url()).pathname.split('/').pop()!
  const res: SessionResult = { rows: [], issues: [], driverGaps: [], dupes: [], types: {}, finalUrl: '' }
  const wrongAt = new Set(opts.wrongAt ?? [2])
  const wrongTwice = new Set(opts.wrongTwiceAt ?? [3])
  const answerSec = page.locator(`section[aria-label="${S.a}"]`)
  const statusH = page.locator('[role=status] h2')
  res.dupes = dupeCheck(await attemptItems(attemptId))
  let guard = 0
  let done = 0
  // Urutan tampil: soal serupa disisipkan tepat setelah soal yang salah, bukan di akhir.
  let order = (await attemptItems(attemptId)).map((x) => x.ref)
  const logFile = `${OUT}/qs-${opts.tag}.txt`
  while (guard++ < 40) {
    await Promise.race([
      answerSec.first().waitFor({ timeout: 20000 }),
      page.getByText(S.done).first().waitFor({ timeout: 20000 }),
      page.waitForURL((u) => !u.pathname.startsWith('/run/'), { timeout: 20000 }),
    ]).catch(() => {})
    if (!new URL(page.url()).pathname.startsWith('/run/')) break
    if (await page.getByText(S.done).first().isVisible().catch(() => false)) break
    if (!(await answerSec.first().isVisible().catch(() => false))) {
      res.issues.push({ kind: 'no-question', detail: `sesi ${opts.tag} tanpa soal, url ${page.url()}` })
      break
    }
    const label = await page.locator('body').first().textContent()
    const m = S.of.exec(label ?? '')
    const pos = m ? Number(m[1]) : done + 1
    const fresh = (await attemptItems(attemptId)).map((x) => x.ref).filter((r) => !order.includes(r))
    if (fresh.length) order = [...order.slice(0, pos - 1), ...fresh, ...order.slice(pos - 1)]
    const entry = order[pos - 1] ? { ref: order[pos - 1]! } : undefined
    const item = entry ? resolveItem(entry.ref) : null
    if (!item) {
      res.issues.push({ kind: 'no-item', detail: `${entry?.ref}` })
      break
    }
    res.types[item.type] = (res.types[item.type] ?? 0) + 1
    if (['write', 'speak', 'draw', 'photo'].includes(item.type)) res.issues.push({ kind: 'human-item-in-required', detail: `${item.id} ${item.type}` })
    await page.waitForTimeout(150)
    res.issues.push(...(await probe(page)).map((x) => ({ kind: x.kind, detail: `${entry!.ref}: ${x.detail}` })))
    if (opts.shots) await page.screenshot({ path: `${OUT}/${opts.tag}-q${pos}-${item.type}.png` })
    const plan = wrongTwice.has(pos) ? 'wrong2' : wrongAt.has(pos) ? 'wrong1' : 'right'
    const prompt = textOf(item).slice(0, 220)
    const row: QRow = { n: pos, ref: entry!.ref, type: item.type, plan, shown: '', ok: true, prompt }
    const tryAnswer = async (correct: boolean) => {
      await answer(page, item, correct, { issues: res.issues })
    }
    const check = page.getByRole('button', { name: S.check, exact: true })
    try {
      if (plan === 'right') {
        await tryAnswer(true)
        await check.click({ timeout: 8000 })
        await statusH.first().waitFor({ timeout: 15000 })
        row.shown = (await statusH.first().innerText()).trim()
        row.ok = row.shown === S.correct
      } else {
        await tryAnswer(false)
        await check.click({ timeout: 8000 })
        await statusH.first().waitFor({ timeout: 15000 })
        row.shown = (await statusH.first().innerText()).trim()
        row.ok = row.shown === S.notYet
        if (opts.shots) await page.screenshot({ path: `${OUT}/${opts.tag}-q${pos}-wrong.png` })
        res.issues.push(...(await sheet(page)))
        await page.getByRole('button', { name: S.tryAgain, exact: true }).click({ timeout: 8000 })
        await page.waitForTimeout(250)
        if (plan === 'wrong1') {
          await tryAnswer(true)
          await check.click({ timeout: 8000 })
          await statusH.first().waitFor({ timeout: 15000 })
          const second = (await statusH.first().innerText()).trim()
          row.shown += `>${second}`
          row.ok = row.ok && second === S.correct
        } else {
          await tryAnswer(false)
          await check.click({ timeout: 8000 })
          await statusH.first().waitFor({ timeout: 15000 })
          const second = (await statusH.first().innerText()).trim()
          row.shown += `>${second}`
          row.ok = row.ok && second === S.notYet
          await page.waitForTimeout(400)
          if (opts.shots) await page.screenshot({ path: `${OUT}/${opts.tag}-q${pos}-revealed.png`, fullPage: true })
          res.issues.push(...(await sheet(page)))
          // Pembahasan bergerak bila ada, lalu Coba soal serupa.
          const watch = page.getByRole('button', { name: S.watch })
          if (await watch.first().isVisible().catch(() => false)) {
            await watch.first().click()
            const dlg = page.getByRole('dialog')
            await dlg.first().waitFor({ timeout: 15000 }).catch(() => res.issues.push({ kind: 'walkthrough-no-dialog', detail: entry!.ref }))
            await page.waitForTimeout(900)
            if (opts.shots) await page.screenshot({ path: `${OUT}/${opts.tag}-q${pos}-walk.png` })
            const stepTxt = (await dlg.first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)
            appendFileSync(logFile, `   langkah: ${stepTxt}\n`)
            await dlg.getByRole('button', { name: S.close, exact: true }).first().click({ timeout: 8000 }).catch(async () => {
              await page.keyboard.press('Escape')
            })
            await page.waitForTimeout(250)
          }
          const like = page.getByRole('button', { name: S.like })
          if (await like.first().isVisible().catch(() => false)) {
            row.shown += '>like'
            await like.first().click()
            await page.waitForTimeout(800)
          }
        }
      }
    } catch (e) {
      res.driverGaps.push(`${entry!.ref} ${item.type} ${plan}: ${String(e).split('\n')[0]!.slice(0, 140)}`)
      if (opts.shots) await page.screenshot({ path: `${OUT}/${opts.tag}-q${pos}-gap.png` }).catch(() => {})
      const sk = page.getByRole('button', { name: S.skip })
      if (await sk.first().isVisible().catch(() => false)) await sk.first().click()
      else {
        res.finalUrl = page.url()
        return res
      }
    }
    res.rows.push(row)
    appendFileSync(logFile, `${row.ok ? 'OK ' : 'BAD'} ${pos} ${row.ref} ${row.type} ${row.plan} [${row.shown}] ${prompt}\n`)
    if (!row.ok) say(false, `PENILAIAN ${opts.tag} ${row.ref} ${row.type} rencana ${row.plan} tampil ${row.shown}`)
    done++
    if (opts.maxQ && done >= opts.maxQ) break
    await page.waitForTimeout(100)
    // Lanjut bila masih ada lembar umpan balik.
    const nxt = page.locator('[role=status]').getByRole('button', { name: new RegExp(`^(${S.next}|${S.finish})$`) })
    if (await nxt.first().isVisible().catch(() => false)) {
      await page.waitForTimeout(650)
      await nxt.first().click({ timeout: 8000 }).catch(() => {})
    }
    await page.waitForTimeout(200)
  }
  res.finalUrl = page.url()
  return res
}
