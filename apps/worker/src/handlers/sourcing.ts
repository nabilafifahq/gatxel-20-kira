import { runWeeklySourcing } from '../sourcing/run'
import type { Handler } from './types'

/**
 * Job sourcing.run: pembaruan sumber soal untuk satu org sekarang juga, tanpa menunggu Minggu dini hari.
 * Dijadwalkan perintah admin `sourcing-now`. Memakai kode yang sama dengan jadwal weekly-sourcing, jadi batas
 * AI_WEEKLY_CONTENT_JOBS, aturan lisensi, dan pemeriksaan kunci jawaban tetap berlaku. Hasilnya tercatat di job.result.
 */
export const sourcingRunHandler: Handler = {
  async run(h) {
    const summary = await runWeeklySourcing({ db: h.db, client: h.client, env: h.env, log: h.log, ai: h.ai, onlyOrgIds: [h.org.orgId], now: h.now }, h.now(), h.signal)
    h.log.info('pembaruan sumber soal manual selesai', { orgId: h.org.orgId, summary })
    return { summary }
  },
}
