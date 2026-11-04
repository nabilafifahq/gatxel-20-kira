import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Penjaga transaksi bersarang. Meminta sambungan kedua dari pool saat transaksi terbuka membuat pool saling menunggu:
 * bila semua sambungan dipegang transaksi yang menunggu sambungan kedua, tidak ada yang bisa selesai sampai batas waktu
 * Postgres memutusnya. Di bawah beban itu berarti seluruh situs berhenti.
 *
 * Pool app: dilarang. Di tes melempar (KIRA_TX_GUARD=throw), di produksi menulis peringatan sekali per tempat pemanggilan
 * supaya anak tidak terkena galat karena penjaga ini.
 * Pool auth: hanya dicatat. Tidak bisa saling menunggu, karena pemegang sambungan auth tidak pernah meminta sambungan app.
 */
const held = new AsyncLocalStorage<true>()

type Report = (message: string, meta: { pool: string; where: string }) => void

const seen = new Set<string>()
// eslint-disable-next-line no-console -- penjaga transaksi melapor lewat log JSON satu baris, tanpa memakai server/log
let report: Report = (message, meta) => console.warn(JSON.stringify({ level: 'warn', msg: message, ...meta }))

export function setTxGuardReporter(fn: Report): void {
  report = fn
}

/** Jalankan isi transaksi dengan tanda bahwa satu sambungan sedang dipegang. */
export function runHoldingTx<T>(fn: () => Promise<T>): Promise<T> {
  return held.run(true, fn)
}

export function txHeld(): boolean {
  return held.getStore() === true
}

/** Tempat pemanggil pertama di luar berkas ini dan db.ts, untuk log. */
function callSite(stack: string | undefined): string {
  const lines = (stack ?? '').split('\n').slice(1)
  const line = lines.find((l) => !l.includes('tx-guard') && !/[\\/]db\.ts/.test(l)) ?? lines[0] ?? ''
  return line.trim().slice(0, 200)
}

function guardMode(): 'throw' | 'log' {
  const v = process.env.KIRA_TX_GUARD
  if (v === 'throw' || v === 'log') return v
  return process.env.NODE_ENV === 'test' ? 'throw' : 'log'
}

/** Dipanggil setiap kali pool diambil. Sangat murah bila tidak ada transaksi terbuka. */
export function noteDbAccess(pool: 'app' | 'auth'): void {
  if (held.getStore() !== true) return
  const where = callSite(new Error().stack)
  if (pool === 'app' && guardMode() === 'throw') {
    throw new Error(`Transaksi bersarang: pool ${pool} diminta saat transaksi masih terbuka (${where}). Pakai tx yang sudah ada.`)
  }
  const key = `${pool} ${where}`
  if (seen.has(key)) return
  seen.add(key)
  report('sambungan kedua diminta saat transaksi terbuka', { pool, where })
}
