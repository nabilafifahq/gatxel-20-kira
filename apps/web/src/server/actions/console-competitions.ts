'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { isIsoDate } from '@kira/core/time'
import type { ActionResult, CompetitionRow, Subject } from '@/lib/dto'
import { inOrg } from '../db'
import { invalid, runAction } from '../errors'
import { orgCtx, requireTutor } from '../auth/actor'
import { deleteEventTx, saveEventTx, setEventStatusTx, STATUSES } from '../dal/console-competitions'

const isoDate = z.string().length(10).refine(isIsoDate, 'Tanggal tidak valid.')
const slug = z.string().regex(/^[a-z0-9-]+$/).max(60)

const eventSchema = z
  .object({
    eventId: z.string().uuid().optional(),
    competitionId: slug.nullable(),
    name: z.string().max(200),
    subjects: z.array(z.enum(['math', 'english', 'science'])).max(3),
    date: isoDate.nullable(),
    dateIsEstimate: z.boolean(),
    registrationClose: isoDate.nullable(),
    presetId: slug.nullable(),
    link: z.string().max(2000).nullable(),
    learnerIds: z.array(z.string().uuid()).max(20),
  })
  .strict()

/** Tautan pendaftaran: https, alamat situs yang bisa dibaca, paling panjang 300 karakter. Bukan export: setiap export di berkas ini menjadi endpoint publik. */
function normaliseLink(raw: string | null): string | null {
  const v = raw?.trim() ?? ''
  if (!v) return null
  let ok = v.length <= 300 && v.startsWith('https://')
  if (ok) {
    try {
      const u = new URL(v)
      ok = u.protocol === 'https:' && u.hostname.includes('.')
    } catch {
      ok = false
    }
  }
  if (!ok) throw invalid('Tautan harus diawali https://, berisi alamat situs, dan paling panjang 300 karakter.', { link: 'Tautan https tidak valid.' })
  return v
}

export async function saveEventAction(input: {
  eventId?: string
  competitionId: string | null
  name: string
  subjects: Subject[]
  date: string | null
  dateIsEstimate: boolean
  registrationClose: string | null
  presetId: string | null
  link: string | null
  learnerIds: string[]
}): Promise<ActionResult> {
  return runAction('saveEvent', async () => {
    const actor = await requireTutor()
    const data = eventSchema.parse(input)
    const name = data.name.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 80) throw invalid(`Nama lomba 2 sampai 80 karakter. Sekarang ${name.length}.`, { name: 'Nama lomba 2 sampai 80 karakter.' })
    const subjects = [...new Set(data.subjects)]
    if (subjects.length === 0) throw invalid('Pilih paling sedikit satu mapel untuk lomba ini.', { subjects: 'Pilih mapel.' })
    const link = normaliseLink(data.link)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) =>
      saveEventTx(tx, ctx, {
        eventId: data.eventId,
        competitionId: data.competitionId,
        name,
        subjects,
        date: data.date,
        dateIsEstimate: data.dateIsEstimate,
        registrationClose: data.registrationClose,
        presetId: data.presetId,
        link,
        learnerIds: data.learnerIds,
      }),
    )
    refresh()
    return undefined
  })
}

export async function setEventStatusAction(input: { eventId: string; status: CompetitionRow['status'] }): Promise<ActionResult> {
  return runAction('setEventStatus', async () => {
    const actor = await requireTutor()
    const data = z
      .object({ eventId: z.string().uuid(), status: z.enum(STATUSES as [CompetitionRow['status'], ...CompetitionRow['status'][]]) })
      .strict()
      .parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => setEventStatusTx(tx, ctx, data.eventId, data.status))
    refresh()
    return undefined
  })
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  return runAction('deleteEvent', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(eventId)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => deleteEventTx(tx, ctx, id))
    refresh()
    return undefined
  })
}
