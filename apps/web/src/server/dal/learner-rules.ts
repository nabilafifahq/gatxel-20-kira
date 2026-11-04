import 'server-only'
import { eq } from 'drizzle-orm'
import { DEFAULT_PRESET, effectiveRules, type DayPreset, type DayRules } from '@kira/core'
import { tables } from '@kira/db'
import type { Tx } from '../db'

const { dayRules } = tables

/**
 * Aturan hari bawaan satu learner: preset tersimpan dan aturan lengkap. Learner tanpa baris memakai Seimbang
 * (Latihan wajib, Tes dan Paper opsional), jadi learner baru langsung mendapat hari yang tidak terlalu panjang.
 */
export async function dayRulesFor(tx: Tx, learnerId: string): Promise<{ preset: DayPreset; rules: DayRules }> {
  const [row] = await tx.select({ preset: dayRules.preset, rules: dayRules.rules }).from(dayRules).where(eq(dayRules.learnerId, learnerId)).limit(1)
  const preset = row?.preset ?? DEFAULT_PRESET
  return { preset, rules: effectiveRules(preset, row?.rules) }
}
