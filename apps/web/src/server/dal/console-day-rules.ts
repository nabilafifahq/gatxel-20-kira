import 'server-only'
import { and, eq, isNull, lt, ne, sql } from 'drizzle-orm'
import { detectPreset, jakartaDate, normaliseRules, type DayPreset } from '@kira/core'
import { tables } from '@kira/db'
import type { DayRulesDTO, PlanChangeResult } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { inOrg } from '../db'
import { auditTx } from '../audit'
import { invalid, notFound } from '../errors'
import { loadLearner, refreshDayRecord, streakFor } from './learner-core'
import { syncTodayIfCreated } from './learner-session'

/**
 * Aturan hari bawaan per learner (Mati, Opsional, Wajib per hari, mapel, dan sesi) dan atur ulang streak.
 * Perubahan aturan langsung dipakai hari ini bila tablet sudah membuat sesi hari ini: sesi yang belum dimulai
 * dibuat, dihapus, atau berganti Wajib atau Opsional; yang sudah dimulai atau selesai dipertahankan.
 */

const { dayRules, learnerProfile, dayRecord, quest } = tables

export async function saveDayRules(actor: Actor, input: { learnerId: string; preset: DayPreset; rules: DayRulesDTO | null }): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  if (input.preset === 'kustom' && !input.rules) throw invalid('Aturan Kustom butuh isian untuk setiap hari, mapel, dan sesi.', { rules: 'Isi aturan.' })
  // Aturan kustom yang sama persis dengan sebuah preset disimpan sebagai preset itu.
  const custom = input.preset === 'kustom' ? normaliseRules(input.rules) : null
  const preset: DayPreset = custom ? detectPreset(custom) : input.preset
  return inOrg(ctx, async (tx) => {
    const [l] = await tx.select({ id: learnerProfile.userId }).from(learnerProfile).where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt))).limit(1)
    if (!l) throw notFound('Learner tidak ditemukan. Muat ulang halaman Pengaturan.')
    const stored = preset === 'kustom' ? custom : null
    await tx
      .insert(dayRules)
      .values({ orgId: ctx.orgId, learnerId: input.learnerId, preset, rules: stored })
      .onConflictDoUpdate({ target: dayRules.learnerId, set: { preset, rules: stored, updatedAt: new Date() } })
    await auditTx(tx, ctx, 'learner.dayrules', input.learnerId, { preset })
    const r = await syncTodayIfCreated(tx, ctx, input.learnerId, today)
    return { today: Boolean(r), published: false, created: r?.created ?? 0, removed: r?.removed ?? 0, regenerated: r?.regenerated ?? 0, kept: r?.kept ?? 0 }
  })
}

/**
 * Atur ulang streak: hapus catatan hari sebelum hari ini (sesi wajib dan selesai per hari), mulai hitungan streak
 * dari hari ini (ini juga mengosongkan pembeku, yang dihitung dari riwayat), lalu hitung ulang hari ini.
 * Menit layar hari ini tetap. XP, lencana, penguasaan skill, jawaban, dan attempt tidak disentuh.
 * Konfirmasi: nama learner diketik persis (huruf besar kecil tidak dibedakan).
 */
export async function resetStreak(actor: Actor, input: { learnerId: string; confirmName: string }): Promise<{ removedDays: number; streakBefore: number }> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const learner = await loadLearner(tx, input.learnerId)
    if (input.confirmName.trim().toLowerCase() !== learner.name.trim().toLowerCase()) {
      throw invalid(`Ketik nama ${learner.name} persis seperti di atas untuk mengonfirmasi.`, { confirmName: 'Nama belum sama.' })
    }
    const before = await streakFor(tx, learner, today)
    const gone = await tx
      .delete(dayRecord)
      .where(and(eq(dayRecord.learnerId, learner.userId), lt(dayRecord.date, today)))
      .returning({ date: dayRecord.date })
    await tx.update(learnerProfile).set({ streakSince: today, updatedAt: new Date() }).where(eq(learnerProfile.userId, learner.userId))
    // Hitung ulang hari ini bila sesinya sudah dibuat (menit layar hari ini tidak diubah).
    const [q] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(quest)
      .where(and(eq(quest.learnerId, learner.userId), eq(quest.date, today), ne(quest.kind, 'bonus')))
    if ((q?.n ?? 0) > 0) await refreshDayRecord(tx, ctx, learner.userId, today)
    await auditTx(tx, ctx, 'learner.streak.reset', learner.userId, { removedDays: gone.length, streakBefore: before.current, since: today })
    return { removedDays: gone.length, streakBefore: before.current }
  })
}
