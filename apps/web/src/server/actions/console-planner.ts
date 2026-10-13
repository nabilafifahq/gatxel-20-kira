'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { ENGLISH_SKILL_KINDS, SESSION_TYPES } from '@kira/core'
import { isIsoDate } from '@kira/core/time'
import type { ActionResult, DayTemplateId, UpsertSlotInput } from '@/lib/dto'
import { requireTutor } from '../auth/actor'
import { runAction } from '../errors'
import { applySuggestions, copyWeek, deleteSlot, moveSlot, publishWeek, setDayTemplate, setRestDay, upsertSlot } from '../dal/console-planner'
import { PER_QUESTION_MAX, PER_QUESTION_MIN, QUESTION_COUNT_MAX, QUESTION_COUNT_MIN } from '../dal/planner-logic'

/** T03 Perencana mingguan. Setiap action memeriksa sesi tutor sendiri; kepemilikan diperiksa DAL lewat RLS. */

const isoDate = z.string().max(10).refine((v) => isIsoDate(v), 'Tanggal tidak valid. Muat ulang halaman rencana.')
const subject = z.enum(['math', 'english', 'science'])
const mode = z.enum(['belajar', 'latihan', 'tes', 'kertas'])

const upsertSchema = z
  .object({
    learnerId: z.string().uuid(),
    slotId: z.string().uuid().optional(),
    date: isoDate,
    subject,
    session: z.enum(SESSION_TYPES),
    required: z.boolean(),
    skillId: z
      .string()
      .max(80)
      .regex(/^[mes][1-6]\.[a-z0-9-]+$/, 'Pilih satu skill dari daftar.')
      .nullable(),
    mode,
    questionCount: z
      .number()
      .int(`Jumlah soal harus angka bulat ${QUESTION_COUNT_MIN} sampai ${QUESTION_COUNT_MAX}.`)
      .min(QUESTION_COUNT_MIN, `Jumlah soal paling sedikit ${QUESTION_COUNT_MIN}.`)
      .max(QUESTION_COUNT_MAX, `Jumlah soal paling banyak ${QUESTION_COUNT_MAX}.`),
    paperKind: z.enum(['mini', 'full']).nullable(),
    config: z
      .object({
        presetId: z.string().max(60).regex(/^[a-z0-9-]+$/).optional(),
        task: z.enum(ENGLISH_SKILL_KINDS).optional(),
        perQuestionSec: z.number().int().min(PER_QUESTION_MIN).max(PER_QUESTION_MAX).optional(),
      })
      .strict()
      .nullable(),
  })
  .strict()

export async function upsertSlotAction(input: UpsertSlotInput): Promise<ActionResult> {
  return runAction('upsertSlot', async () => {
    const actor = await requireTutor()
    const data = upsertSchema.parse(input)
    await upsertSlot(actor, data)
    refresh()
    return undefined
  })
}

export async function moveSlotAction(input: { slotId: string; date: string }): Promise<ActionResult> {
  return runAction('moveSlot', async () => {
    const actor = await requireTutor()
    const data = z.object({ slotId: z.string().uuid(), date: isoDate }).strict().parse(input)
    await moveSlot(actor, data)
    refresh()
    return undefined
  })
}

export async function deleteSlotAction(slotId: string): Promise<ActionResult> {
  return runAction('deleteSlot', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(slotId)
    await deleteSlot(actor, id)
    refresh()
    return undefined
  })
}

export async function setRestDayAction(input: { learnerId: string; date: string; rest: boolean }): Promise<ActionResult> {
  return runAction('setRestDay', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), date: isoDate, rest: z.boolean() }).strict().parse(input)
    await setRestDay(actor, data)
    refresh()
    return undefined
  })
}

export async function applySuggestionsAction(input: { learnerId: string; weekStart: string; ids: string[] }): Promise<ActionResult> {
  return runAction('applySuggestions', async () => {
    const actor = await requireTutor()
    const data = z
      .object({
        learnerId: z.string().uuid(),
        weekStart: isoDate,
        ids: z.array(z.string().min(1).max(120)).min(1, 'Pilih minimal satu usulan.').max(30),
      })
      .strict()
      .parse(input)
    await applySuggestions(actor, data)
    refresh()
    return undefined
  })
}

export async function publishWeekAction(input: { learnerId: string; weekStart: string }): Promise<ActionResult> {
  return runAction('publishWeek', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), weekStart: isoDate }).strict().parse(input)
    await publishWeek(actor, data)
    refresh()
    return undefined
  })
}

export async function setDayTemplateAction(input: { learnerId: string; date: string; template: DayTemplateId }): Promise<ActionResult> {
  return runAction('setDayTemplate', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), date: isoDate, template: z.enum(['school', 'saturday', 'light']) }).strict().parse(input)
    await setDayTemplate(actor, data)
    refresh()
    return undefined
  })
}

export async function copyWeekAction(input: { learnerId: string; fromWeekStart: string; toWeekStart: string }): Promise<ActionResult<{ copied: number; skipped: number }>> {
  return runAction('copyWeek', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), fromWeekStart: isoDate, toWeekStart: isoDate }).strict().parse(input)
    const result = await copyWeek(actor, data)
    refresh()
    return result
  })
}
