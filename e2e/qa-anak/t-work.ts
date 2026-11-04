import { readFileSync, readdirSync } from 'node:fs'
import { OUT, resolveItem, sql } from './lib'
const refs = new Set<string>()
for (const f of readdirSync(OUT)) {
  if (!f.startsWith('qs-')) continue
  for (const l of readFileSync(`${OUT}/${f}`, 'utf8').split('\n')) {
    const m = /((?:gen:)?[mes]\d\.[\w:.-]+)/.exec(l)
    if (m) refs.add(m[1]!)
  }
}
const all = [...refs]
console.log('soal unik dijalani', all.length)
const byGrade: Record<string, string[]> = {}
for (const r of all) { const g = /[mes](\d)\./.exec(r)![1]!; (byGrade[g] ??= []).push(r) }
for (const g of Object.keys(byGrade).sort()) {
  const m = byGrade[g]!.filter((r) => /^(gen:)?m/.test(r))
  const pick = m.filter((_, i) => i % Math.ceil(m.length / 4) === 0).slice(0, 4)
  for (const r of pick) {
    const it = resolveItem(r) as unknown as { type: string; prompt: string; answer: unknown; options?: { text?: string }[]; answers?: unknown; blanks?: unknown; figure?: { alt?: string } }
    const ans = it.options && typeof it.answer === 'number' ? it.options[it.answer]?.text : JSON.stringify(it.answer ?? it.blanks ?? it.answers)
    console.log(`g${g} ${r} [${it.type}] ${it.prompt.replace(/\s+/g, ' ').slice(0, 170)}${it.figure?.alt ? ' {' + it.figure.alt.slice(0, 80) + '}' : ''} => ${String(ans).slice(0, 60)}`)
  }
}
sql.end()
