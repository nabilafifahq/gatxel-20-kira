import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { allowedHosts, type Source } from '@kira/content/sources'
import type { Logger } from '../log'
import { parseAsdiv } from './datasets/asdiv'
import { parseBebrasTask } from './datasets/bebras'
import { parseBlimp } from './datasets/blimp'
import { parseQasc } from './datasets/qasc'
import { parseSciq } from './datasets/sciq'
import { parseTabmwp } from './datasets/tabmwp'
import { parseGsm8k } from './datasets/gsm8k'
import { OPENTDB_CATEGORIES, OPENTDB_GAP_MS, openTdbUrl, parseOpenTdb } from './datasets/opentdb'
import { parseScienceQa } from './datasets/scienceqa'
import { parseScienceRows } from './datasets/science-mcq'
import { parseSvamp } from './datasets/svamp'
import { fetchText } from './net'
import type { Candidate } from './types'

/**
 * Mengambil dan membaca satu sumber dataset menjadi Candidate. Setiap kali hanya satu jendela baris dari
 * penanda lanjut (cursor), supaya pembaruan mingguan membaca bagian baru dataset besar dan tidak mengulang yang sama.
 */

export type CollectDeps = {
  dataDir: string
  log: Logger
  signal: AbortSignal
  fetchImpl?: typeof fetch
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
}

export type Collected = {
  candidates: Candidate[]
  /** Penanda lanjut berikutnya (disimpan di source_state.cursor). */
  nextCursor: number
  /** Catatan singkat untuk hasil jadwal. */
  note: string
}

/** Jumlah baris mentah yang diperiksa per soal yang dibutuhkan; sisanya disaring (terlalu sulit, bergambar, dan sebagainya). */
export const WINDOW_FACTOR = 8
const MAX_TEXT_BYTES = 12 * 1024 * 1024
const HF_PAGE = 100
const HF_MAX_PAGES = 3

export const readCursor = (raw: unknown): number => {
  const n = typeof raw === 'number' ? raw : typeof raw === 'object' && raw !== null && typeof (raw as { at?: unknown }).at === 'number' ? (raw as { at: number }).at : 0
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function present(rows: (Candidate | null)[]): Candidate[] {
  return rows.filter((r): r is Candidate => r !== null)
}

export async function collectSource(source: Source, cursor: number, deps: CollectDeps): Promise<Collected> {
  const f = source.fetch
  if (!f) return { candidates: [], nextCursor: cursor, note: 'tanpa cara ambil' }
  const net = { allowedHosts: allowedHosts(source), maxBytes: MAX_TEXT_BYTES, signal: deps.signal, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) }
  const window = source.maxPerRun * WINDOW_FACTOR

  switch (f.kind) {
    case 'http-text': {
      const texts = await Promise.all(f.urls.map((u) => fetchText(u, net)))
      const parsed =
        source.importer === 'asdiv'
          ? parseAsdiv(texts.join('\n'))
          : source.importer === 'gsm8k'
            ? parseGsm8k(texts.join('\n'))
            : source.importer === 'svamp'
              ? parseSvamp(texts[0] ?? '')
              : source.importer === 'tabmwp'
                ? parseTabmwp(texts[0] ?? '')
                : null
      if (!parsed) return { candidates: [], nextCursor: cursor, note: `importer ${source.importer ?? '-'} tidak membaca teks biasa` }
      const start = cursor >= parsed.rawCount ? 0 : cursor
      const slice = parsed.rows.slice(start, start + window)
      const next = start + window >= parsed.rawCount ? 0 : start + window
      return { candidates: present(slice), nextCursor: next, note: `baris ${start + 1} sampai ${start + slice.length} dari ${parsed.rawCount}` }
    }
    case 'hf-rows': {
      if (source.importer === 'blimp') return collectBlimp(source, f, cursor, net)
      if (source.importer !== 'arc-easy' && source.importer !== 'openbookqa' && source.importer !== 'scienceqa' && source.importer !== 'sciq' && source.importer !== 'qasc') return { candidates: [], nextCursor: cursor, note: 'importer tidak cocok' }
      const out: Candidate[] = []
      let offset = cursor
      let total = Number.POSITIVE_INFINITY
      for (let page = 0; page < HF_MAX_PAGES && offset < total && out.length < source.maxPerRun * 2; page++) {
        const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(f.dataset)}&config=${encodeURIComponent(f.config)}&split=${encodeURIComponent(f.split)}&offset=${offset}&length=${HF_PAGE}`
        const body = await fetchText(url, net)
        const parsed = source.importer === 'scienceqa' ? parseScienceQa(body) : source.importer === 'sciq' ? parseSciq(body) : source.importer === 'qasc' ? parseQasc(body) : parseScienceRows(body, source.importer)
        total = parsed.total || offset + parsed.rawCount
        out.push(...present(parsed.rows))
        offset += parsed.rawCount
        if (parsed.rawCount === 0) break
      }
      return { candidates: out, nextCursor: offset >= total ? 0 : offset, note: `baris sampai ${offset} dari ${Number.isFinite(total) ? total : '?'}` }
    }
    case 'opentdb-api': {
      const out: Candidate[] = []
      const cats = f.categories.filter((c) => OPENTDB_CATEGORIES[c])
      const each = Math.ceil((source.maxPerRun * 2) / Math.max(1, cats.length))
      for (const [i, cat] of cats.entries()) {
        if (i > 0) await deps.sleep(OPENTDB_GAP_MS, deps.signal)
        if (deps.signal.aborted) break
        try {
          out.push(...present(parseOpenTdb(await fetchText(openTdbUrl(cat, each), net), cat).rows))
        } catch (e) {
          deps.log.warn('kategori Open Trivia DB dilewati', { category: cat, error: e instanceof Error ? e.message : 'tidak diketahui' })
        }
      }
      return { candidates: out, nextCursor: 0, note: `${cats.length} kategori` }
    }
    case 'local-dir': {
      const dir = join(deps.dataDir, 'sources', f.dir)
      let names: string[]
      try {
        names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort().slice(0, 200)
      } catch {
        return { candidates: [], nextCursor: 0, note: 'folder sumber belum ada' }
      }
      const out: Candidate[] = []
      let rejected = 0
      for (const name of names) {
        const file = join(dir, name)
        if ((await stat(file)).size > 64 * 1024) continue
        const r = parseBebrasTask(await readFile(file, 'utf8'))
        if (r.ok) out.push(r.candidate)
        else {
          rejected++
          deps.log.warn('tugas Bebras ditolak', { file: name, reason: r.reason })
        }
      }
      return { candidates: out, nextCursor: 0, note: `${names.length} berkas${rejected ? `, ${rejected} ditolak` : ''}` }
    }
    case 'official-pdf':
      return { candidates: [], nextCursor: cursor, note: 'PDF diurus jalur impor' }
  }
}

/**
 * BLiMP: satu konfigurasi per fenomena. Penanda lanjut adalah offset yang sama untuk semua konfigurasi
 * (tiap fenomena punya 1000 pasangan), jadi tiap minggu membaca jendela baru dari setiap fenomena.
 */
async function collectBlimp(source: Source, f: Extract<NonNullable<Source['fetch']>, { kind: 'hf-rows' }>, cursor: number, net: Parameters<typeof fetchText>[1]): Promise<Collected> {
  const configs = f.configs?.length ? f.configs : [f.config]
  const each = Math.min(HF_PAGE, Math.max(5, Math.ceil((source.maxPerRun * 3) / configs.length)))
  const out: Candidate[] = []
  let total = Number.POSITIVE_INFINITY
  for (const config of configs) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(f.dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(f.split)}&offset=${cursor}&length=${each}`
    const parsed = parseBlimp(await fetchText(url, net), config)
    if (parsed.total) total = Math.min(total, parsed.total)
    out.push(...present(parsed.rows))
  }
  const next = cursor + each >= total ? 0 : cursor + each
  return { candidates: out, nextCursor: next, note: `${configs.length} fenomena, baris ${cursor + 1} sampai ${cursor + each}` }
}
