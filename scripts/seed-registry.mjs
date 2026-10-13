#!/usr/bin/env node
// Menyemai content/sources/registry.json dari hasil riset bank soal (JSON yang disusun agen riset).
//
// Pemakaian: node scripts/seed-registry.mjs <bank-soal.json> [--write]
// Tanpa --write hanya mencetak ringkasan. Sumber yang sudah ada di registri (dataset terbuka) dipertahankan;
// entri riset ditambahkan atau diperbarui menurut id. Hanya unduhan gratis resmi berbahasa Inggris dengan daftar
// berkas yang sudah dicek (AUTO_FILES di bawah) yang diberi access "auto". Sisanya "listed" (dicatat),
// "manual-upload" (berbayar), atau tetap "unknown" sampai lisensinya dicek.

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

const SUBJECT_MAP = { math: 'math', logic: 'math', ct: 'math', english: 'english', science: 'science', 'general-knowledge': 'science' }
const IKMC = 'https://ikmc.kangaroo.org.pk/uploads/ikmc/documents/'
const SOF = 'https://sofworld.org/download/file/fid/'

/** Berkas yang URL-nya sudah dicek (HTTP 200, application/pdf) pada 2026-10-13. Kunci IKMC ada di PDF terpisah. */
const AUTO_FILES = {
  'ikmc-pakistan-past-papers': {
    competition: 'ikmc',
    subject: 'math',
    maxPerRun: 2,
    files: [
      { url: `${IKMC}8-PreEcolier_compressed.pdf`, title: 'IKMC 2023 Pre-Ecolier', grade: 2, year: 2023 },
      { url: `${IKMC}0-Ecolier_compressed.pdf`, title: 'IKMC 2023 Ecolier', grade: 3, year: 2023 },
      { url: `${IKMC}1-PreEcolier.pdf`, title: 'IKMC 2022 Pre-Ecolier', grade: 2, year: 2022 },
      { url: `${IKMC}1-Ecolier.pdf`, title: 'IKMC 2022 Ecolier', grade: 3, year: 2022 },
      { url: `${IKMC}c-PreEcolier_IKMC21.pdf`, title: 'IKMC 2021 Pre-Ecolier', grade: 2, year: 2021 },
      { url: `${IKMC}f-Ecolier_IKMC21.pdf`, title: 'IKMC 2021 Ecolier', grade: 3, year: 2021 },
    ],
    extraNote: 'Kunci jawaban ada di PDF terpisah (Answer Key), jadi AI mengerjakan soal dua kali dan mengusulkan kunci; tutor tetap memilih kuncinya.',
  },
  'sof-imo-sample-papers': {
    competition: 'sof-imo',
    subject: 'math',
    maxPerRun: 2,
    files: [1, 2, 3].map((g) => ({ url: `${SOF}${73710 + g}`, title: `SOF IMO sample paper class ${g}`, grade: g, year: 2026, section: 'penuh' })),
  },
  'sof-ieo-sample-papers': {
    competition: 'sof-ieo',
    subject: 'english',
    maxPerRun: 2,
    files: [
      { url: `${SOF}73653`, title: 'SOF IEO sample paper class 1', grade: 1, year: 2026, section: 'penuh' },
      { url: `${SOF}73656`, title: 'SOF IEO sample paper class 2', grade: 2, year: 2026, section: 'penuh' },
      { url: `${SOF}73658`, title: 'SOF IEO sample paper class 3', grade: 3, year: 2026, section: 'penuh' },
    ],
  },
  'sof-nso-iso-sample-papers': {
    competition: 'sof-iso',
    subject: 'science',
    maxPerRun: 2,
    files: [
      { url: `${SOF}73689`, title: 'SOF ISO sample paper class 1', grade: 1, year: 2026, section: 'penuh' },
      { url: `${SOF}73690`, title: 'SOF ISO sample paper class 2', grade: 2, year: 2026, section: 'penuh' },
      { url: `${SOF}73691`, title: 'SOF ISO sample paper class 3', grade: 3, year: 2026, section: 'penuh' },
    ],
  },
}

const dashless = (s) => String(s ?? '').replace(/[–—]/g, ', ').replace(/\s+/g, ' ').trim()
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 3).trimEnd()}...`)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function toSource(e) {
  const id = slug(e.id)
  const subjects = [...new Set((e.subjects ?? []).map((s) => SUBJECT_MAP[s]).filter(Boolean))]
  const grades = (e.grades ?? []).filter((g) => g >= 1 && g <= 6)
  const auto = AUTO_FILES[e.id]
  const paid = e.access === 'purchase'
  const licenseId = auto ? 'official-free' : paid ? 'paid' : e.access === 'official-free' ? 'official-free' : 'unknown'
  const hint = e.fetchHint ? ` Petunjuk ambil: ${dashless(e.fetchHint)}` : ''
  const notes = cut(dashless(`${e.notes ?? ''}${auto?.extraNote ? ` ${auto.extraNote}` : ''}${auto ? '' : hint}`), 400)
  const base = {
    id,
    name: cut(dashless(e.name), 80),
    site: e.url,
    subjects: subjects.length ? subjects : ['math'],
    grades: grades.length ? grades : [2],
    years: cut(dashless(e.years ?? 'semua'), 30),
    license: licenseId,
    licenseNote: cut(dashless(e.license), 300),
    attribution: cut(dashless(e.organizer ?? e.name), 240),
    format: 'pdf',
    access: auto ? 'auto' : paid ? 'manual-upload' : 'listed',
    ...(auto ? { competition: auto.competition } : {}),
    ...(notes ? { notes } : {}),
  }
  if (auto) {
    return { ...base, subjects: [auto.subject], fetch: { kind: 'official-pdf', files: auto.files }, maxPerRun: auto.maxPerRun }
  }
  return base
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const byId = new Map(registry.sources.map((s) => [s.id, s]))
let added = 0
let updated = 0
for (const e of entries) {
  const s = toSource(e)
  if (byId.has(s.id)) updated++
  else added++
  byId.set(s.id, s)
}
registry.sources = [...byId.values()]
registry.updated = new Date().toISOString().slice(0, 10)

const out = JSON.stringify(registry, null, 2) + '\n'
console.log(`riset: ${entries.length} entri, ${added} baru, ${updated} diperbarui, total ${registry.sources.length} sumber`)
console.log(`otomatis: ${registry.sources.filter((s) => s.access === 'auto').map((s) => s.id).join(', ')}`)
if (write) {
  writeFileSync(registryPath, out)
  console.log('registry.json ditulis')
} else {
  console.log('Tambah --write untuk menulis registry.json')
}
