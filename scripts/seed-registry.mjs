#!/usr/bin/env node
// Menyemai content/sources/registry.json dari hasil riset bank soal (JSON yang disusun agen riset).
//
// Pemakaian: node scripts/seed-registry.mjs <bank-soal.json> [--write]
// Tanpa --write hanya mencetak ringkasan. Entri riset ditambahkan atau diperbarui menurut id; sumber tulisan tangan
// (dataset terbuka dengan importer) dipertahankan. Hanya sumber dengan importer yang ada, atau daftar berkas PDF yang
// URL-nya sudah dicek, yang diberi access "auto". Sisanya "listed" (dicatat), "manual-upload" (berbayar atau hanya
// untuk peserta), dengan lisensi "unknown" bila belum bisa dipastikan.
//
// Dikecualikan: NRICH (melarang scraping dan pemakaian AI) dan entri tanpa alamat (ESMO, penyelenggara belum diketahui).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const registryPath = join(root, 'content', 'sources', 'registry.json')
const input = process.argv[2]
const write = process.argv.includes('--write')
if (!input) {
  console.error('Pemakaian: node scripts/seed-registry.mjs <bank-soal.json> [--write]')
  process.exit(2)
}

const research = JSON.parse(readFileSync(input, 'utf8'))
const entries = Array.isArray(research) ? research : Object.values(research)

const EXCLUDED = new Set(['nrich-primary'])
/** Entri riset yang sudah punya sumber tulisan tangan dengan importer: entri riset dilewati. */
const HANDWRITTEN = {
  'asdiv-dataset': 'asdiv',
  'gsm8k-dataset': 'gsm8k',
  'ai2-arc-dataset': 'arc-easy',
  'openbookqa-dataset': 'openbookqa',
  'open-trivia-db': 'opentdb',
  'svamp-dataset': 'svamp',
  'scienceqa-dataset': 'scienceqa',
}
/** Sumber awal yang digantikan entri riset yang lebih lengkap. */
const SUPERSEDED = ['kangaroo-ikmc', 'kangaroo-iksc', 'sasmo-papers', 'seamo-papers', 'cambridge-checkpoint-papers']

const SUBJECT_MAP = { math: 'math', logic: 'math', ct: 'math', english: 'english', science: 'science', 'general-knowledge': 'science' }
const COMPETITION = {
  'ikmc-pakistan-past-papers': 'ikmc',
  'ikmc-indonesia-kpm': 'ikmc',
  'sil-pakistan-kangaroo-linguistic-past-papers': 'iklc',
  'iklc-indonesia': 'iklc',
  'iksc-issc-pakistan-past-papers': 'iksc',
  'iksc-indonesia-sips': 'iksc',
  'kmnr-ksnr-kpm': 'kmnr',
  'sasmo-simcc': 'sasmo',
  'seamo-sample-papers': 'seamo',
  'seamo-past-year-book-series': 'seamo',
  'hkimo-ocec': 'hkimo',
  'timo-ocec': 'timo',
  'imso-past-problems': 'imso',
  'cambridge-primary-checkpoint': 'cambridge-checkpoint',
  'osn-sd-ksn-puspresnas': 'osn-sd',
  'sof-imo-sample-papers': 'sof-imo',
  'sof-ieo-sample-papers': 'sof-ieo',
  'sof-nso-iso-sample-papers': 'sof-iso',
}

const IKMC = 'https://ikmc.kangaroo.org.pk/uploads/ikmc/documents/'
const SIL = 'https://sil.kangaroo.org.pk/uploads/sil/documents/'
const SOF = 'https://sofworld.org/download/file/fid/'
const GOV = 'https://assets.publishing.service.gov.uk/media/'
const SEAMO = 'https://seamo.sgp1.digitaloceanspaces.com/images/resources/'
const UKMT = 'https://ukmt.org.uk/wp-content/uploads/'
const BEBRAS = 'https://bebras.or.id/v3/wp-content/uploads/'

/**
 * Berkas yang URL-nya sudah dicek (HTTP 200, application/pdf, di bawah 60 halaman) pada 2026-10-13.
 * Kunci jawaban paper IKMC, IKLC, dan KS1 ada di PDF terpisah, jadi AI mengerjakan soal dua kali dan mengusulkan kunci.
 */
const AUTO_FILES = {
  'ikmc-pakistan-past-papers': {
    competition: 'ikmc', subject: 'math', maxPerRun: 1,
    extraNote: 'Kunci jawaban ada di PDF terpisah (Answer Key), jadi AI mengerjakan soal dua kali dan mengusulkan kunci; tutor tetap memilih kuncinya.',
    files: [
      { url: `${IKMC}8-PreEcolier_compressed.pdf`, title: 'IKMC 2023 Pre-Ecolier', grade: 2, year: 2023 },
      { url: `${IKMC}0-Ecolier_compressed.pdf`, title: 'IKMC 2023 Ecolier', grade: 3, year: 2023 },
      { url: `${IKMC}1-PreEcolier.pdf`, title: 'IKMC 2022 Pre-Ecolier', grade: 2, year: 2022 },
      { url: `${IKMC}1-Ecolier.pdf`, title: 'IKMC 2022 Ecolier', grade: 3, year: 2022 },
      { url: `${IKMC}c-PreEcolier_IKMC21.pdf`, title: 'IKMC 2021 Pre-Ecolier', grade: 2, year: 2021 },
      { url: `${IKMC}f-Ecolier_IKMC21.pdf`, title: 'IKMC 2021 Ecolier', grade: 3, year: 2021 },
    ],
  },
  'sil-pakistan-kangaroo-linguistic-past-papers': {
    competition: 'iklc', subject: 'english', maxPerRun: 1,
    extraNote: 'Edisi Pakistan dari IKLC (English). Kunci di PDF terpisah. Pre-Ecolier dipetakan ke Grade 2 dan Ecolier ke Grade 3.',
    files: [
      { url: `${SIL}9-PreEcolier.pdf`, title: 'IKLC 2023 Pre-Ecolier', grade: 2, year: 2023 },
      { url: `${SIL}5-Ecolier.pdf`, title: 'IKLC 2023 Ecolier', grade: 3, year: 2023 },
      { url: `${SIL}2-IKLC_2022_PreEcolier_final-com.pdf`, title: 'IKLC 2022 Pre-Ecolier', grade: 2, year: 2022 },
      { url: `${SIL}8-IKLC_2022_Ecolier_final.pdf`, title: 'IKLC 2022 Ecolier', grade: 3, year: 2022 },
      { url: `${SIL}c-PreEcolier.pdf`, title: 'IKLC 2021 Pre-Ecolier', grade: 2, year: 2021 },
      { url: `${SIL}4-Ecolier.pdf`, title: 'IKLC 2021 Ecolier', grade: 3, year: 2021 },
    ],
  },
  'sof-imo-sample-papers': {
    competition: 'sof-imo', subject: 'math', maxPerRun: 1,
    files: [1, 2, 3].map((g) => ({ url: `${SOF}${73710 + g}`, title: `SOF IMO sample paper class ${g}`, grade: g, year: 2026, section: 'penuh' })),
  },
  'sof-ieo-sample-papers': {
    competition: 'sof-ieo', subject: 'english', maxPerRun: 1,
    files: [
      { url: `${SOF}73653`, title: 'SOF IEO sample paper class 1', grade: 1, year: 2026, section: 'penuh' },
      { url: `${SOF}73656`, title: 'SOF IEO sample paper class 2', grade: 2, year: 2026, section: 'penuh' },
      { url: `${SOF}73658`, title: 'SOF IEO sample paper class 3', grade: 3, year: 2026, section: 'penuh' },
    ],
  },
  'sof-nso-iso-sample-papers': {
    competition: 'sof-iso', subject: 'science', maxPerRun: 1,
    files: [
      { url: `${SOF}73689`, title: 'SOF ISO sample paper class 1', grade: 1, year: 2026, section: 'penuh' },
      { url: `${SOF}73690`, title: 'SOF ISO sample paper class 2', grade: 2, year: 2026, section: 'penuh' },
      { url: `${SOF}73691`, title: 'SOF ISO sample paper class 3', grade: 3, year: 2026, section: 'penuh' },
    ],
  },
  'govuk-ks1-maths-tests': {
    subject: 'math', maxPerRun: 1, license: 'ogl-3.0',
    extraNote: 'Hanya Paper 2 (reasoning), Year 2 Inggris. Banyak soal isian, jadi tutor mengecek hasil baca di Impor; kunci di PDF mark scheme terpisah. Paper 1 (hitungan isian) tidak diambil otomatis.',
    files: [
      { url: `${GOV}6a1576120a1a96d9418d284f/2026_KS1_mathematics_Paper2_reasoning.pdf`, title: 'KS1 maths 2026 Paper 2 reasoning', grade: 2, year: 2026, section: 'Paper 2' },
      { url: `${GOV}6835861f3dd61280f46c03aa/2025_KS1_mathematics_Paper2_reasoning.pdf`, title: 'KS1 maths 2025 Paper 2 reasoning', grade: 2, year: 2025, section: 'Paper 2' },
      { url: `${GOV}6655bdc316cf36f4d63ebb13/STA248808e_2024_ks1_mathematics_Paper2_reasoning.pdf`, title: 'KS1 maths 2024 Paper 2 reasoning', grade: 2, year: 2024, section: 'Paper 2' },
    ],
  },
  'seamo-sample-papers': {
    competition: 'seamo', subject: 'math', maxPerRun: 1,
    extraNote: 'Paper A untuk Years 1-2 dan B untuk Years 3-4; satu contoh per jenjang, tanpa tahun.',
    files: [
      { url: `${SEAMO}paper-A.pdf`, title: 'SEAMO sample paper A (Years 1-2)', grade: 2, section: 'A' },
      { url: `${SEAMO}paper-B.pdf`, title: 'SEAMO sample paper B (Years 3-4)', grade: 3, section: 'B' },
    ],
  },
  'ukmt-primary-kangaroo': {
    subject: 'math', maxPerRun: 1,
    extraNote: 'Untuk UK Year 5/6 ke bawah (kelas 4 sampai 6), jadi tantangan untuk kelas 2. Solusi ada di PDF terpisah.',
    files: [
      { url: `${UKMT}2026/04/Primary_Kangaroo_Paper_2026_v2.pdf`, title: 'UKMT Primary Kangaroo 2026', grade: 4, year: 2026 },
      { url: `${UKMT}2025/05/PrimaryKangarooPaper2025v5.pdf`, title: 'UKMT Primary Kangaroo 2025', grade: 4, year: 2025 },
    ],
  },
  'bebras-indonesia-pembahasan-pdf': {
    competition: null, subject: 'math', maxPerRun: 1,
    extraNote: 'Bahasa Indonesia, dengan pembahasan. Kelas hanya perkiraan: buku SD ke Grade 2 dan SiKecil (PAUD/TK) ke Grade 1. Banyak soal bergambar, jadi hasil baca perlu dicek tutor.',
    files: [
      { url: `${BEBRAS}2024/10/Bebras-Indonesia-Book-2020-SD-OK-Okt2024.pdf`, title: 'Bebras Indonesia 2020 SD', grade: 2, year: 2020 },
      { url: `${BEBRAS}2024/10/Bebras-Indonesia-Book-2020-SiKecil-OK-Okt2024.pdf`, title: 'Bebras Indonesia 2020 SiKecil', grade: 1, year: 2020 },
      { url: `${BEBRAS}2018/07/BukuBebras2017_SD.pdf`, title: 'Bebras Indonesia 2017 SD', grade: 2, year: 2017 },
      { url: `${BEBRAS}2019/10/Bebras-Challenge-2016_Siaga.pdf`, title: 'Bebras Indonesia 2016 Siaga', grade: 2, year: 2016 },
    ],
  },
}

/** Sumber dataset tambahan dengan importer (tulisan tangan, ditambahkan bila belum ada). */
const EXTRA_SOURCES = [
  {
    id: 'svamp',
    name: 'SVAMP',
    site: 'https://github.com/arkilpatel/SVAMP',
    subjects: ['math'],
    grades: [1, 2, 3, 4],
    years: '2021',
    license: 'mit',
    licenseUrl: 'https://github.com/arkilpatel/SVAMP/blob/main/LICENSE',
    attribution: 'Patel, Bhattamishra, dan Goyal (2021), Are NLP Models really able to Solve Simple Math Word Problems? Lisensi MIT.',
    format: 'json',
    access: 'auto',
    importer: 'svamp',
    fetch: { kind: 'http-text', urls: ['https://raw.githubusercontent.com/arkilpatel/SVAMP/main/SVAMP.json'] },
    maxPerRun: 60,
    notes: 'Soal cerita satu hitungan (tambah, kurang, kali, bagi) sampai kelas 4. Kelas ditebak dari jenis hitungan dan besar bilangan.',
  },
  {
    id: 'scienceqa',
    name: 'ScienceQA',
    site: 'https://huggingface.co/datasets/derek-thomas/ScienceQA',
    subjects: ['science'],
    grades: [1, 2, 3, 4, 5, 6],
    years: '2022',
    license: 'cc-by-nc-sa',
    licenseNote: 'Kartu Hugging Face menulis CC BY-SA 4.0 dan README GitHub menulis CC BY-NC-SA 4.0. Dipakai yang lebih ketat: nonkomersial dan share-alike, hanya di server keluarga ini.',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    attribution: 'Lu dkk. (2022), Learn to Explain: Multimodal Reasoning via Thought Chains for Science Question Answering (ScienceQA).',
    format: 'json',
    access: 'auto',
    importer: 'scienceqa',
    fetch: { kind: 'hf-rows', dataset: 'derek-thomas/ScienceQA', config: 'default', split: 'test' },
    maxPerRun: 60,
    notes: 'Hanya soal natural science tanpa gambar, label kelas 1 sampai 6, dengan penjelasan dari penyusun. Satu-satunya sumber terbuka dengan soal Science kelas 1 dan 2.',
  },
]

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'g')
const dashless = (s) => String(s ?? '').replace(DASHES, ', ').replace(/\s+/g, ' ').trim()
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 3).trimEnd()}...`)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Lisensi dari teks riset. Yang paling membatasi menang bila teks menyebut dua lisensi. */
function licenseOf(e) {
  if (e.access === 'purchase') return 'paid'
  if (e.access === 'participant-only') return 'restricted'
  const t = String(e.license ?? '')
  if (e.id.includes('gutenberg')) return 'public-domain'
  if (e.access === 'open-license') {
    if (/NC-SA/i.test(t)) return 'cc-by-nc-sa'
    if (/\bNC\b|NonCommercial/i.test(t)) return 'cc-by-nc'
    if (/\bSA\b|ShareAlike/i.test(t)) return 'cc-by-sa'
    if (/Open Government Licence|OGL/i.test(t)) return 'ogl-3.0'
    if (/CC0/i.test(t)) return 'cc0'
    if (/Apache/i.test(t)) return 'apache-2.0'
    if (/\bMIT\b/.test(t)) return 'mit'
    if (/CC BY|Creative Commons Attribution/i.test(t)) return 'cc-by'
    return 'unknown'
  }
  if (e.access === 'official-free') return 'official-free'
  return 'unknown'
}

function toSource(e) {
  const id = slug(e.id)
  const subjects = [...new Set((e.subjects ?? []).map((s) => SUBJECT_MAP[s]).filter(Boolean))]
  const grades = (e.grades ?? []).filter((g) => g >= 1 && g <= 6)
  const auto = AUTO_FILES[e.id]
  const license = auto?.license ?? licenseOf(e)
  const hint = e.fetchHint ? ` Petunjuk ambil: ${dashless(e.fetchHint)}` : ''
  const notes = cut(dashless(`${e.notes ?? ''}${auto?.extraNote ? ` ${auto.extraNote}` : ''}${auto ? '' : hint}`), 400)
  const gradeNote = grades.length === 0 ? ' Kelas belum dibaca, jadi diperkirakan kelas 4 sampai 6.' : ''
  const site = e.url.replace(/^http:\/\//, 'https://')
  const base = {
    id,
    name: cut(dashless(e.name), 80),
    site,
    subjects: subjects.length ? subjects : ['math'],
    grades: grades.length ? grades : [4, 5, 6],
    years: cut(dashless(e.years ?? 'semua'), 30),
    license,
    licenseNote: cut(dashless(e.license), 300),
    attribution: cut(dashless(e.organizer ? `${e.organizer}. ${e.name}` : e.name), 240),
    format: ['pdf', 'xml', 'jsonl', 'json', 'html', 'zip'].includes(e.format) ? e.format : 'other',
    access: auto ? 'auto' : e.access === 'purchase' || e.access === 'participant-only' ? 'manual-upload' : 'listed',
    ...(COMPETITION[e.id] ? { competition: COMPETITION[e.id] } : {}),
    ...(notes || gradeNote ? { notes: cut(`${notes}${gradeNote}`.trim(), 400) } : {}),
  }
  if (auto) {
    const { competition, subject, maxPerRun, files } = auto
    const out = { ...base, subjects: [subject], fetch: { kind: 'official-pdf', files }, maxPerRun }
    if (competition) out.competition = competition
    else delete out.competition
    return out
  }
  return base
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const byId = new Map(registry.sources.map((s) => [s.id, s]))
for (const id of SUPERSEDED) byId.delete(id)
for (const s of EXTRA_SOURCES) if (!byId.has(s.id)) byId.set(s.id, s)

let added = 0
let updated = 0
let skipped = 0
for (const e of entries) {
  if (EXCLUDED.has(e.id) || HANDWRITTEN[e.id] || !e.url || !/^https?:\/\//.test(e.url)) {
    skipped++
    continue
  }
  const s = toSource(e)
  if (byId.has(s.id)) updated++
  else added++
  byId.set(s.id, s)
}
registry.sources = [...byId.values()]
registry.updated = new Date().toISOString().slice(0, 10)

const out = JSON.stringify(registry, null, 2) + '\n'
const auto = registry.sources.filter((s) => s.access === 'auto')
console.log(`riset: ${entries.length} entri, ${added} baru, ${updated} diperbarui, ${skipped} dilewati, total ${registry.sources.length} sumber`)
console.log(`otomatis (${auto.length}): ${auto.map((s) => s.id).join(', ')}`)
if (write) {
  writeFileSync(registryPath, out)
  console.log('registry.json ditulis')
} else {
  console.log('Tambah --write untuk menulis registry.json')
}
