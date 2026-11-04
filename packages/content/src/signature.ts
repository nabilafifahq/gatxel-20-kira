import { keyOf } from './check'
import { presentItem } from './present'
import type { Item, Passage } from './schema'

/**
 * Tanda pengenal soal untuk aturan "tidak ada dua soal yang sama dalam satu set".
 *
 * - `displaySignature`: apa yang benar-benar dilihat anak (soal, gambar, pilihan tanpa urutan, bacaan), dinormalisasi.
 *   Id, skill, tingkat, petunjuk, dan pembahasan tidak ikut. Dua ref berbeda dengan tanda sama adalah soal yang sama.
 * - `operandSignature`: untuk soal hitung, angka dalam soal diurutkan, jadi 3 + 5 dan 5 + 3 dianggap sama.
 * - `twinKey`: kerangka soal (angka disamarkan) beserta jawabannya. Sama berarti hampir kembar, dihindari bila bank cukup.
 */

const STOP = new Set(['the', 'a', 'an'])
const NUM = /-?\d+(?:[.,]\d+)?/g

export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,:/%=<>+*-]/gu, ' ')
    .replace(/[.,:;!?'"()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(' ')
}

const DROP = new Set(['ref', 'skill', 'difficulty', 'expectedSeconds', 'points', 'hints', 'reveal', 'key'])

function canon(v: unknown, key = ''): unknown {
  if (Array.isArray(v)) {
    const arr = v.map((x) => canon(x))
    // Pilihan (objek dengan teks atau gambar) tidak dihitung menurut urutan, dan indeks tampilnya tidak ikut.
    if (key === 'options' || key === 'matchRight' || key === 'sortItems') {
      return arr.map((x) => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x as object).filter(([k]) => k !== 'i')) : x)).map((x) => JSON.stringify(x)).sort()
    }
    return arr
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter((k) => !DROP.has(k)).sort().map((k) => [k, canon((v as Record<string, unknown>)[k], k)]))
  return typeof v === 'string' ? normText(v) : v
}

export function displaySignature(item: Item, passage?: Passage): string {
  const c = presentItem(item, { seed: 'sig', includeKey: false, includeHints: false, ...(passage ? { passage } : {}) })
  return JSON.stringify(canon(c))
}

/** Soal hitung: angka dalam teks soal diurutkan dan operatornya dipertahankan, jadi operan yang sama dianggap soal yang sama. */
export function operandSignature(item: Item, passage?: Passage): string {
  const nums = (item.prompt.match(NUM) ?? []).map((n) => Number(n.replace(',', '.'))).sort((a, b) => a - b)
  const c = presentItem(item, { seed: 'sig', includeKey: false, includeHints: false, ...(passage ? { passage } : {}) }) as Record<string, unknown>
  const masked = { ...c, prompt: normText(String(c.prompt)).replace(NUM, '#') }
  return JSON.stringify([nums, canon(masked)])
}

/** Kerangka soal tanpa angka beserta kunci jawabannya. */
export function twinKey(item: Item): string {
  return JSON.stringify([item.skill, item.difficulty, item.type, normText(item.prompt).replace(NUM, '#'), keyOf(item)])
}

/** Isi soal yang sama walau pasangan atau urutan tampil berbeda: pasangan tanpa arah, daftar urutan, dan kelompok. */
function semanticKey(item: Item): string | null {
  switch (item.type) {
    case 'match':
      return JSON.stringify(['match', normText(item.prompt), item.pairs.map((p) => [normText(p[0]), normText(p[1])].sort()).sort()])
    case 'order':
      return JSON.stringify(['order', normText(item.prompt), item.items.map(normText).sort()])
    case 'sort':
      return JSON.stringify(['sort', normText(item.prompt), item.groups.map(normText), item.items.map((i) => [normText(i.text), i.group]).sort()])
    default:
      return null
  }
}

/** Semua tanda yang dipakai penjaga: dua soal bentrok bila salah satunya sama. */
export function clashKeys(item: Item, passage?: Passage): string[] {
  const keys = [displaySignature(item, passage)]
  const sem = semanticKey(item)
  if (sem) keys.push('sem:' + sem)
  if (item.id.startsWith('gen:')) keys.push('op:' + operandSignature(item, passage))
  return keys
}
