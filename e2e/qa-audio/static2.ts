// Cakupan statis layar selain soal: langkah pelajaran (Inggris dan Indonesia), kartu, kamus, buku, cerita, dan album.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { EN_VER, ID_VER, ROOT, clipKey, heldSet, idOf, isHeld, man } from './lib'
import { isClipText, splitClipText } from '../../packages/core/src/tts'
import { dictionaryWordClips, type DictFile } from '../../packages/core/src/dictionary'
import { STORY } from '../../packages/core/src/world/story'
import { CARDS } from '../../packages/core/src/world/cards'
import { chapterSentences } from '../../packages/content/src/books'

const has = (t: string, s: string, v = EN_VER) => splitClipText(t).filter(isClipText).every((c) => man.has(clipKey(c, s, v)))
const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith('.json') ? [join(d, f)] : []))
const out: Record<string, unknown> = {}
const held = heldSet()

const lessons = { steps: 0, enMissing: [] as string[], idTranslated: 0, idHeld: 0, idVoiced: 0, idMissing: [] as string[], noTranslation: 0 }
for (const f of files(join(ROOT, 'content/lessons'))) {
  const j = JSON.parse(readFileSync(f, 'utf8'))
  for (const s of j.steps) {
    lessons.steps++
    if (!has(s.say, 'teacher')) lessons.enMissing.push(`${j.skill}: ${s.say}`)
    const id = idOf(s.say)
    if (!id) {
      lessons.noTranslation++
      continue
    }
    lessons.idTranslated++
    if (isHeld(id, held)) lessons.idHeld++
    else if (has(id, 'indonesian', ID_VER)) lessons.idVoiced++
    else lessons.idMissing.push(`${j.skill}: ${id}`)
  }
}
out.lessons = { ...lessons, enMissing: lessons.enMissing.slice(0, 5), enMissingN: lessons.enMissing.length, idMissing: lessons.idMissing.slice(0, 5), idMissingN: lessons.idMissing.length }

const cards = { cards: 0, missing: [] as string[] }
for (const f of files(join(ROOT, 'content/flashcards'))) {
  const j = JSON.parse(readFileSync(f, 'utf8'))
  for (const c of j.cards ?? []) {
    cards.cards++
    if (c.say ? !has(c.say, 'teacher') : !(has(c.back, 'teacher') || has(c.front, 'teacher'))) cards.missing.push(`${c.id}: ${c.say ?? c.front}`)
  }
}
out.flashcards = { cards: cards.cards, missingN: cards.missing.length, missing: cards.missing.slice(0, 5) }

const dict = JSON.parse(readFileSync(join(ROOT, 'content/dictionary/en-id.json'), 'utf8')) as Pick<DictFile, 'entries' | 'forms'>
const dictClips = dictionaryWordClips(dict)
const dictN = dictClips.length
const dictMissing = dictClips.filter((c) => !man.has(clipKey(c.text, c.style, EN_VER))).map((c) => c.text)
out.dictionary = { words: dictN, missingN: dictMissing.length, missing: dictMissing.slice(0, 10) }

const books = { sentences: 0, missing: [] as string[] }
for (const f of files(join(ROOT, 'content/books'))) {
  const j = JSON.parse(readFileSync(f, 'utf8'))
  for (const ch of j.chapters ?? []) {
    for (const s of chapterSentences(ch)) {
      books.sentences++
      if (!has(s.text, 'teacher')) books.missing.push(`${j.id}: ${s.text}`)
    }
  }
}
out.books = { sentences: books.sentences, missingN: books.missing.length, missing: books.missing.slice(0, 6) }

const story = { pages: 0, missing: [] as string[] }
for (const c of STORY) {
  for (const p of c.pages) {
    story.pages++
    if (!has(p.text, 'teacher')) story.missing.push(p.text)
  }
}
out.story = { pages: story.pages, missingN: story.missing.length, missing: story.missing.slice(0, 4) }

const album = { cards: 0, missing: [] as string[] }
for (const c of CARDS) {
  if (!c.fact) continue
  album.cards++
  const t = `${c.name}. ${c.fact}`
  if (!has(t, 'teacher')) album.missing.push(t)
}
out.album = { cards: album.cards, missingN: album.missing.length, missing: album.missing.slice(0, 4) }
console.log(JSON.stringify(out, null, 1))
