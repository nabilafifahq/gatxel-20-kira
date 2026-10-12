// __GTX_SEED__
import type { AiDraftDTO, StudioAiDTO } from '@/lib/dto'
import type { ClientItem } from '@kira/content/present'
import { ITEM_ARRAY, shell, wib } from './console-shared'

const ORIGINAL: ClientItem = {
  ref: 'KRA-M-0413',
  type: 'mcq',
  skill: 'm2-time',
  difficulty: 3,
  prompt: 'Rani mulai membaca pukul 07.15. Ia membaca selama 30 menit. Pukul berapa Rani selesai membaca?',
  lang: 'id',
  options: [
    { i: 0, text: '07.45' },
    { i: 1, text: '08.15' },
    { i: 2, text: '08.00' },
    { i: 3, text: '07.30' },
  ],
  expectedSeconds: 75,
}

const VARIANT: ClientItem = {
  ...ORIGINAL,
  ref: 'draft-1',
  prompt: 'Dodi mulai menggambar pukul 08.20. Ia menggambar selama 25 menit. Pukul berapa Dodi selesai menggambar?',
  options: [
    { i: 0, text: '08.45' },
    { i: 1, text: '08.35' },
    { i: 2, text: '08.40' },
    { i: 3, text: '08.50' },
  ],
}

const NEW_BAD: ClientItem = {
  ...ITEM_ARRAY,
  ref: 'draft-4',
  prompt: 'There are 3 rows of stars. Each row has 5 stars. How many stars are there?',
  figure: { kind: 'array', rows: 3, cols: 5, icon: 'star', alt: '3 rows of 5 stars.' },
  options: [
    { i: 0, text: '8' },
    { i: 1, text: '12' },
    { i: 2, text: '15' },
    { i: 3, text: '35' },
  ],
}

const drafts: AiDraftDTO[] = [
  {
    id: 'dr-1',
    jobId: 'job-118',
    kind: 'variants',
    status: 'pending',
    createdAt: wib('2026-10-12', '20:14'),
    item: VARIANT,
    json: JSON.stringify(
      {
        id: 'm2-time-v-0007',
        type: 'mcq',
        skill: 'm2-time',
        difficulty: 3,
        lang: 'id',
        prompt: VARIANT.prompt,
        options: [{ text: '08.45' }, { text: '08.35', why: 'Hanya menambah 15 menit.' }, { text: '08.40' }, { text: '08.50' }],
        answer: 0,
        explanation: '08.20 ditambah 25 menit adalah 08.45.',
      },
      null,
      2,
    ),
    problems: [],
    compareTo: { ref: 'KRA-M-0413', item: ORIGINAL },
  },
  {
    id: 'dr-4',
    jobId: 'job-117',
    kind: 'items',
    status: 'pending',
    createdAt: wib('2026-10-12', '19:52'),
    item: NEW_BAD,
    json: JSON.stringify(
      { id: 'm2-arrays-n-0031', type: 'mcq', skill: 'm2-arrays', difficulty: 2, lang: 'en-GB', prompt: NEW_BAD.prompt, options: [{ text: '8' }, { text: '12' }, { text: '15' }, { text: '35' }], answer: 1 },
      null,
      2,
    ),
    problems: ['Kunci tidak cocok. Hitung ulang memberi 15, draf menulis 12.'],
    compareTo: { ref: 'KRA-M-0398', item: ITEM_ARRAY },
  },
  {
    id: 'dr-5',
    jobId: 'job-116',
    kind: 'rubric',
    status: 'pending',
    createdAt: wib('2026-10-11', '16:30'),
    item: null,
    json: JSON.stringify({ item: 'KRA-E-0302', rubric: { criteria: [{ label: 'Uses the past tense', points: 2 }, { label: 'Full sentences', points: 1 }] } }, null, 2),
    problems: [],
    compareTo: null,
  },
  {
    id: 'dr-0',
    jobId: 'job-110',
    kind: 'translate',
    status: 'approved',
    createdAt: wib('2026-10-09', '21:05'),
    item: { ...ITEM_ARRAY, ref: 'draft-0', lang: 'id', prompt: 'Ada 4 baris apel. Setiap baris berisi 5 apel. Berapa banyak apelnya?' },
    json: '{}',
    problems: [],
    compareTo: { ref: 'KRA-M-0398', item: ITEM_ARRAY },
  },
]

export const studioAi: StudioAiDTO = {
  shell,
  provider: { name: 'Claude Code (langganan)', ready: true, detail: 'Token terhubung, model claude-sonnet-5-5.' },
  usage: { used: 37, limit: 400 },
  jobs: [
    { id: 'job-118', kind: 'variants', status: 'done', createdAt: wib('2026-10-12', '20:10'), summary: '5 varian Waktu dan jam dari KRA-M-0413', error: null },
    { id: 'job-119', kind: 'hints', status: 'running', createdAt: wib('2026-10-12', '20:31'), summary: '3 hint untuk KRA-M-0398', error: null },
    { id: 'job-117', kind: 'items', status: 'done', createdAt: wib('2026-10-12', '19:45'), summary: '5 soal baru Arrays, 1 perlu dicek', error: null },
    { id: 'job-115', kind: 'translate', status: 'failed', createdAt: wib('2026-10-11', '09:12'), summary: 'Terjemahan 10 soal Science', error: 'Waktu habis setelah 10 menit. Kode referensi KRA-AI-0311.' },
  ],
  drafts,
  skills: [
    { id: 'm2-time', subject: 'math', grade: 2, title: 'Waktu dan jam' },
    { id: 'm2-arrays', subject: 'math', grade: 2, title: 'Arrays' },
    { id: 'm2-patterns', subject: 'math', grade: 2, title: 'Pola bilangan' },
    { id: 'e2-plural', subject: 'english', grade: 2, title: 'Plural tak beraturan' },
    { id: 'e2-past-ed', subject: 'english', grade: 2, title: 'Past tense -ed' },
    { id: 's2-habitats', subject: 'science', grade: 2, title: 'Habitat' },
  ],
}

export const studioAiLimited: StudioAiDTO = { ...studioAi, usage: { used: 400, limit: 400 } }
export const studioAiNotReady: StudioAiDTO = {
  ...studioAi,
  provider: { name: 'Claude Code (langganan)', ready: false, detail: 'CLAUDE_CODE_OAUTH_TOKEN belum diisi di server. Jalankan claude setup-token di komputer yang login ke akun Claude, lalu isi tokennya.' },
}
