#!/usr/bin/env node
// GTX-ENG-001 C-04: sentence rhythm check.
//
// Measures burstiness = standard deviation of sentence word count / mean.
// Human prose sits at 0.6 to 1.2. LLM output sits at 0.2 to 0.4.
// No off-the-shelf prose linter checks this, and cadence uniformity is the
// strongest surviving signal of generated text.
//
// Usage:  node burstiness.mjs "content/**/*.md" [--min 0.4] [--json]
//
// Apply to landing page copy, proposals, and blog posts.
// Do NOT apply to reference docs or checklists, where uniform short
// sentences are correct.

import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const minIdx = args.indexOf('--min')
const MIN = minIdx > -1 ? Number(args[minIdx + 1]) : 0.4
const patterns = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min')

if (patterns.length === 0) {
  console.error('usage: node burstiness.mjs "<glob>" [--min 0.4] [--json]')
  process.exit(2)
}

/** Strip markdown that would distort sentence segmentation. */
function stripMarkdown(text) {
  return text
    .replace(/^---[\s\S]*?^---/m, '')       // frontmatter
    .replace(/```[\s\S]*?```/g, '')          // fenced code
    .replace(/`[^`\n]*`/g, '')               // inline code
    .replace(/^\s*\|.*\|\s*$/gm, '')         // tables
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, '')    // headings
    .replace(/^\s*[-*+]\s+/gm, '')           // list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images
    .replace(/^\s*>\s?/gm, '')               // blockquotes
    .replace(/[*_~]/g, '')                   // emphasis
}

/** Naive but adequate sentence split, guarding common abbreviations. */
function sentences(text) {
  return text
    .replace(/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Dr|No|Fig|approx)\./gi, '$1<DOT>')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter(Boolean)
}

function score(text) {
  const sents = sentences(stripMarkdown(text))
  const lengths = sents
    .map((s) => s.split(/\s+/).filter(Boolean).length)
    .filter((n) => n >= 3) // ignore fragments and stray labels

  if (lengths.length < 8) return { n: lengths.length, mean: 0, sd: 0, ratio: null }

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length
  const sd = Math.sqrt(variance)
  return { n: lengths.length, mean, sd, ratio: sd / mean }
}

const files = patterns.flatMap((p) => globSync(p))
const results = []
let failed = 0

for (const file of files) {
  const r = score(readFileSync(file, 'utf8'))
  if (r.ratio === null) {
    results.push({ file, ...r, verdict: 'skipped, under 8 sentences' })
    continue
  }
  const pass = r.ratio >= MIN
  if (!pass) failed++
  results.push({ file, ...r, verdict: pass ? 'pass' : 'FAIL' })
}

if (asJson) {
  console.log(JSON.stringify({ min: MIN, failed, results }, null, 2))
} else {
  for (const r of results) {
    if (r.ratio === null) continue
    const flag = r.verdict === 'FAIL' ? 'FAIL' : 'ok  '
    console.log(
      `${flag}  ${r.ratio.toFixed(2)}  (mean ${r.mean.toFixed(1)} words, sd ${r.sd.toFixed(1)}, n=${r.n})  ${r.file}`,
    )
  }
  if (failed) {
    console.log(
      `\n${failed} file(s) below ${MIN}. GTX-ENG-001 C-04: sentence lengths are too uniform.`,
    )
    console.log('Fix by breaking two long sentences and merging two short ones. Read it aloud.')
  }
}

process.exit(failed > 0 ? 1 : 0)
