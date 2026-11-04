import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ACCESSORY_IDS, ALL_ITEMS, ARENA_BADGES, BADGES, BOSSES, CARD_SETS, CHEST_ACCESSORIES, CHEST_BACKGROUNDS, CHEST_STICKERS, PET_KIND_IDS, TREATS } from '@kira/core'
import { dictFor, htmlLang, parseUiLang, tOf } from '@/lib/i18n'
import { en, id } from '@/lib/i18n/dict'

/**
 * Kamus antarmuka anak. TypeScript sudah menolak kunci yang hilang; tes ini menjaga hal yang tidak terlihat oleh tipe:
 * nilai kosong, jumlah parameter fungsi, dan aturan teks (tanpa tanda pisah, tanpa kata terlarang, sapaan kamu).
 */

type Node = string | ((...args: never[]) => string) | { [key: string]: Node }

/** Parameter teks atau angka: coba angka, lalu teks, lalu nilai pilihan seperti jenis operasi (add). */
function callSample(fn: (...args: never[]) => string, sample: number): string {
  for (const value of [sample, String(sample), 'add']) {
    try {
      return String(fn(...(Array.from({ length: fn.length }, () => value) as never[])))
    } catch {
      // nilai contoh berikutnya
    }
  }
  throw new Error('Fungsi kamus tidak bisa dipanggil dengan nilai contoh')
}

/** Semua daun kamus: [jalur, nilai teks]. Fungsi dipanggil dengan angka dan nama contoh. */
function leaves(node: Node, path = ''): { path: string; text: string; arity: number | null }[] {
  if (typeof node === 'string') return [{ path, text: node, arity: null }]
  if (typeof node === 'function') {
    const out: { path: string; text: string; arity: number | null }[] = []
    // Nilai 1 dan 3 mengenai kedua cabang jamak bahasa Inggris. Parameter teks tetap sah sebagai angka di template.
    for (const sample of [1, 3]) {
      out.push({ path, text: callSample(node, sample), arity: node.length })
    }
    return out
  }
  return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
}

const EN = leaves(en as unknown as Node)
const ID = leaves(id as unknown as Node)

describe('kamus antarmuka anak', () => {
  it('semua kunci Inggris ada di kamus Indonesia, dengan jenis nilai yang sama (teks atau fungsi)', () => {
    // Peta menurut id (lencana, hadiah peti) kosong di kamus Inggris karena teksnya berasal dari @kira/core.
    const kinds = new Map(ID.map((x) => [x.path, x.arity === null ? 'teks' : 'fungsi']))
    for (const x of EN) expect(kinds.get(x.path), x.path).toBe(x.arity === null ? 'teks' : 'fungsi')
  })

  it('teks menurut id untuk data @kira/core lengkap, jadi lencana dan hadiah baru tidak tampil Inggris', () => {
    const missing = (name: string, ids: readonly string[], map: object) => ids.filter((x) => !(x in map)).map((x) => `${name}: ${x}`)
    const s = id.shell
    const w = id.world
    expect([
      ...missing('lencana', [...BADGES.map((b) => b.id), ...ARENA_BADGES.map((b) => b.id)], s.badges),
      ...missing('stiker', CHEST_STICKERS.map((x) => x.id), s.rewards.sticker),
      ...missing('latar', CHEST_BACKGROUNDS.map((x) => x.id), s.rewards.background),
      ...missing('aksesori peti', CHEST_ACCESSORIES.map((x) => x.id), s.rewards.accessory),
      ...missing('aksesori', ACCESSORY_IDS, s.accessories),
      ...missing('barang toko', ALL_ITEMS.map((x) => x.id), w.items),
      ...missing('camilan', TREATS.map((x) => x.id), w.treats),
      ...missing('teman', PET_KIND_IDS, w.petBlurbs),
      ...missing('set kartu', CARD_SETS.map((x) => x.id), w.sets),
      ...missing('keterangan set', CARD_SETS.map((x) => x.id), w.setInfo),
      ...missing('bos', BOSSES.map((x) => x.id), id.bosses),
    ]).toEqual([])
  })

  it('kalimat bos Indonesia sama banyak dengan sumbernya, jadi bossLine berputar sama', () => {
    for (const b of BOSSES) {
      const text = id.bosses[b.id]
      expect(text?.attacks.length, b.id).toBe(b.attacks.length)
      expect(text?.hits.length, b.id).toBe(b.hits.length)
    }
  })

  it('tidak ada nilai kosong atau hasil fungsi yang rusak', () => {
    for (const { path, text } of [...EN, ...ID]) {
      expect(text.trim(), path).not.toBe('')
      expect(text, path).not.toMatch(/undefined|NaN|\[object/)
    }
  })

  it('tanpa em dash dan en dash', () => {
    // gtx-ignore-next-line dash
    for (const { path, text } of [...EN, ...ID]) expect(text, path).not.toMatch(/[–—]/)
  })

  it('kata "unlock" dan padanannya tidak dipakai', () => {
    for (const { path, text } of EN) expect(text, path).not.toMatch(/\bunlock/i)
    for (const { path, text } of ID) expect(text, path).not.toMatch(/\bunlock|buka kunci|membuka kunci|terbuka kunci|dibuka kuncinya|kuncinya terbuka/i)
  })

  it('teks Indonesia menyapa anak dengan kamu, tanpa kata gaul', () => {
    for (const { path, text } of ID) {
      expect(text, path).not.toMatch(/\bAnda\b/)
      expect(text, path).not.toMatch(/\b(gak|nggak|ngga|udah|aja|dong|sih|deh|lho|kok)\b/i)
    }
  })

  it('awalan di- menempel pada kata kerja, dan tempat ditulis terpisah', () => {
    for (const { path, text } of ID) {
      expect(text, path).not.toMatch(/\bdi (kerjakan|pilih|simpan|ketuk|baca|buka|tutup|ulang|jawab|tulis|kumpulkan|dengar|periksa|lewati|mainkan|putar)\b/i)
      expect(text, path).not.toMatch(/\bdi(sini|situ|sana|atas|bawah|dalam|luar|depan|belakang|samping|mana)\b/i)
      expect(text, path).not.toMatch(/\bke(sini|situ|sana|atas|bawah)\b/i)
    }
  })

  it('tidak memuat klaim resmi Cambridge', () => {
    for (const { path, text } of [...EN, ...ID]) expect(text, path).not.toMatch(/cambridge/i)
  })

  it('pembantu bahasa', () => {
    expect(htmlLang('id')).toBe('id')
    expect(htmlLang('en')).toBe('en-GB')
    expect(parseUiLang('en')).toBe('en')
    expect(parseUiLang('id')).toBe('id')
    expect(parseUiLang('fr')).toBe('id')
    expect(dictFor('id')).toBe(id)
    expect(dictFor('en')).toBe(en)
    // Aktor tanpa bahasa hanya ada di fixture tes lama.
    expect(tOf({})).toBe(en)
    expect(tOf({ uiLang: 'id' })).toBe(id)
  })
})

describe('suara hanya untuk isi berbahasa Inggris', () => {
  const SRC = fileURLToPath(new URL('../src', import.meta.url))
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))

  it('tidak ada teks kamus yang dikirim ke text-to-speech', () => {
    // t.x, tr.x, dict.x sebagai isi bacaan. Label tombol (labels=, label=) boleh diterjemahkan.
    const SPOKEN = /(?:\bspeak\(\s*\[?\s*|\btoggle\(\s*\[?\s*|\bhostSay\(\s*|<ReadAloudButton\b[^>]*?\btext=\{\s*|<ListenButton\b[^>]*?\btext=\{\s*)t\.[a-z]/
    const hits = [...files(join(SRC, 'screens/learner')), ...files(join(SRC, 'components/learner')), ...files(join(SRC, 'components/widgets'))].filter((f) => SPOKEN.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
