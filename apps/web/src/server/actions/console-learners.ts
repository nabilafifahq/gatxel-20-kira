'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { isIsoDate } from '@kira/core/time'
import { AVATARS, PIN_PICTURES } from '@kira/figures/spec'
import type { ActionResult, AvatarName, PinPicture } from '@/lib/dto'
import { requireTutor } from '../auth/actor'
import { conflict, runAction } from '../errors'
import { CONSENT_PURPOSES } from '../dal/consent'
import { addLearner, OFFLINE_METHODS, recordOfflineConsent, resetPin, unlockLearner, updateLearner } from '../dal/console-learners'

/** T13 Learner dan grade. Argumen action tidak pernah dicatat di log (next.config logging.serverFunctions false). */

const name = z.string().trim().min(1, 'Isi nama tampilan.').max(40, 'Nama tampilan paling banyak 40 karakter.')
const grade = z.number().int('Pilih grade 1 sampai 6.').min(1, 'Pilih grade 1 sampai 6.').max(6, 'Pilih grade 1 sampai 6.')
const avatar = z.enum(AVATARS)
const pin = z.array(z.enum(PIN_PICTURES)).length(4, 'Pilih 4 gambar untuk PIN.')

const addSchema = z
  .object({
    name,
    grade,
    avatar,
    pin,
    guardianEmail: z.string().trim().max(254, 'Email paling panjang 254 karakter.').email('Tulis alamat email lengkap, dengan @ dan nama domain.').nullable(),
  })
  .strict()

export async function addLearnerAction(input: {
  name: string
  grade: number
  avatar: AvatarName
  pin: PinPicture[]
  guardianEmail: string | null
}): Promise<ActionResult<{ learnerId: string; inviteLink: string | null }>> {
  return runAction('addLearner', async () => {
    const actor = await requireTutor()
    const data = addSchema.parse(input)
    const r = await addLearner(actor, data)
    refresh()
    // Learner sudah dibuat, tetapi undangan gagal: laporkan sebagai gagal supaya pesan tampil di dialog.
    if (r.partialFailure) throw conflict(r.partialFailure)
    return { learnerId: r.learnerId, inviteLink: r.inviteLink }
  })
}

export async function updateLearnerAction(input: { learnerId: string; name: string; grade: number; avatar: AvatarName }): Promise<ActionResult> {
  return runAction('updateLearner', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), name, grade, avatar }).strict().parse(input)
    await updateLearner(actor, data)
    refresh()
    return undefined
  })
}

export async function resetPinAction(input: { learnerId: string; pin: PinPicture[] }): Promise<ActionResult> {
  return runAction('resetPin', async () => {
    const actor = await requireTutor()
    const data = z.object({ learnerId: z.string().uuid(), pin }).strict().parse(input)
    await resetPin(actor, data)
    return undefined
  })
}

export async function unlockLearnerAction(learnerId: string): Promise<ActionResult> {
  return runAction('unlockLearner', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(learnerId)
    await unlockLearner(actor, id)
    return undefined
  })
}

export async function recordOfflineConsentAction(input: {
  learnerId: string
  guardianName: string
  method: string
  date: string
  purposes: string[]
}): Promise<ActionResult> {
  return runAction('recordOfflineConsent', async () => {
    const actor = await requireTutor()
    const data = z
      .object({
        learnerId: z.string().uuid(),
        guardianName: z.string().trim().min(1, 'Isi nama orang tua yang memberi persetujuan.').max(80, 'Nama paling banyak 80 karakter.'),
        method: z.enum(OFFLINE_METHODS),
        date: z
          .string()
          .max(10)
          .refine((v) => isIsoDate(v), 'Isi tanggal persetujuan diberikan.'),
        purposes: z
          .array(z.enum(CONSENT_PURPOSES))
          .min(1, 'Pilih minimal satu tujuan.')
          .max(CONSENT_PURPOSES.length)
          .transform((p) => [...new Set(p)]),
      })
      .strict()
      .parse(input)
    await recordOfflineConsent(actor, data)
    refresh()
    return undefined
  })
}
