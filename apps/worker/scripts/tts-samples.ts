/**
 * Cuplikan suara untuk diputuskan pemilik dengan telinga: memilih teks nyata dari konten (soal, pelajaran, cerita, ejaan,
 * soal berangka, pembawa acara kuis, kelas 1 dan kelas 6, dialog dua pembicara) dan membuat satu mp3 tiap cuplikan.
 *
 *   pnpm tts:samples -- --out C:/kw4/samples --url http://127.0.0.1:8000 --token <KIRA_INTERNAL_TOKEN>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { findContentDir, loadContent } from '@kira/content/load'
import { itemSpeechClips, lessonSpeechClips, passageSpeechClips } from '@kira/content/speech'
import { QUIZ_HOST_STREAKS, QUIZ_HOST_INTROS, type TtsClipRequest } from '@kira/core/tts'
import { createTtsClient } from '../src/tts/client'

const { values } = parseArgs({ options: { out: { type: 'string' }, url: { type: 'string', default: 'http://127.0.0.1:8000' }, token: { type: 'string' } } })
const out = values.out ?? 'samples'
const client = createTtsClient(values.url!, values.token ?? process.env.KIRA_INTERNAL_TOKEN ?? '')
const { index } = loadContent(findContentDir())

const items = [...index.items.values()].filter((i) => i.lang === 'en-GB')
const clipsOfItem = (pred: (id: string) => boolean, minChars = 40) =>
  items.filter((i) => pred(i.id)).flatMap((i) => itemSpeechClips(i)).filter((c) => c.style === 'teacher' && c.text.length >= minChars)
const passages = [...index.passages.values()].filter((p) => p.lang === 'en-GB')

const pick = <T>(xs: T[], n: number, from = 0): T[] => xs.slice(from, from + n)

// Soal berangka: ambil klip dari mapel Math yang paling banyak angkanya.
const mathClips = items.filter((i) => i.id.startsWith('m')).flatMap((i) => itemSpeechClips(i)).filter((c) => /\d/.test(c.text) && c.text.length > 30)
const numberHeavy = mathClips.sort((a, b) => (b.text.match(/\d/g)?.length ?? 0) - (a.text.match(/\d/g)?.length ?? 0)).slice(0, 3)

const lessonStep = [...index.lessons.values()].find((l) => l.skill.startsWith('e3'))
const story = passages.find((p) => p.kind === 'story' && p.id.startsWith('e2'))
const dialogue = passages.find((p) => p.kind === 'dialogue' && p.id.startsWith('e1'))

type Sample = { file: string; label: string; clips: TtsClipRequest[] }
const samples: Sample[] = [
  { file: '1-question.mp3', label: 'Pertanyaan soal (kelas 3)', clips: pick(clipsOfItem((id) => id.startsWith('e3')), 3) },
  { file: '2-lesson.mp3', label: 'Pelajaran (kelas 3)', clips: pick(lessonStep ? lessonSpeechClips(lessonStep).filter((c) => c.style === 'teacher') : [], 3) },
  { file: '3-story.mp3', label: 'Cerita (kelas 2)', clips: story ? passageSpeechClips(story).slice(0, 4) : [] },
  {
    file: '4-spelling.mp3',
    label: 'Ejaan: kata dan kalimat contoh (suara dikte)',
    clips: [
      { text: 'necessary', style: 'dictation' },
      { text: 'It is necessary to wear a helmet when you ride a bike.', style: 'dictation' },
      { text: 'beautiful', style: 'dictation' },
      { text: 'The garden looks beautiful in spring.', style: 'dictation' },
    ],
  },
  { file: '5-numbers.mp3', label: 'Soal berangka', clips: [...numberHeavy, { text: 'Shade 3/4 of the shape. It costs Rp 8,000 for 2 kg of rice. What is 3 x 4 + 12?', style: 'teacher' }] },
  {
    file: '6-quiz-host.mp3',
    label: 'Pembawa acara kuis (suara yang sama, lebih cepat)',
    clips: [...QUIZ_HOST_INTROS.slice(0, 2), QUIZ_HOST_STREAKS[3]!, QUIZ_HOST_STREAKS[8]!].map((text) => ({ text, style: 'quizhost' as const })),
  },
  { file: '7-grade1.mp3', label: 'Contoh kelas 1', clips: pick(clipsOfItem((id) => id.startsWith('e1'), 18), 4) },
  { file: '8-grade6.mp3', label: 'Contoh kelas 6', clips: pick(clipsOfItem((id) => id.startsWith('e6'), 60), 3) },
  { file: '9-dialogue-two-speakers.mp3', label: 'Dialog dua pembicara (suara kedua untuk pembicara kedua)', clips: dialogue ? passageSpeechClips(dialogue).slice(0, 6) : [] },
]

await mkdir(out, { recursive: true })
const lines: string[] = ['Cuplikan suara Kira (Kokoro-82M, suara tetap). Satu suara utama: perempuan Inggris Britania.', '']
for (const s of samples) {
  if (s.clips.length === 0) {
    console.warn(`lewati ${s.file}: tidak ada teks`)
    continue
  }
  // Satu berkas = beberapa klip berurutan dengan jeda pendek, supaya pemilik mendengar gaya yang dipakai di aplikasi.
  const bufs: Buffer[] = []
  for (const c of s.clips) {
    const r = await client.synthesize(c.text, c.style)
    if (!r.ok) throw new Error(`gagal membuat ${s.file}: ${r.detail}`)
    bufs.push(r.audio)
  }
  await writeFile(join(out, s.file), Buffer.concat(bufs))
  lines.push(`${s.file}  ${s.label}`, ...s.clips.map((c) => `    [${c.style}] ${c.text}`), '')
  console.log('ditulis', s.file)
}
await writeFile(join(out, 'DAFTAR.txt'), lines.join('\n'))
console.log(`daftar teks: ${join(out, 'DAFTAR.txt')}`)
