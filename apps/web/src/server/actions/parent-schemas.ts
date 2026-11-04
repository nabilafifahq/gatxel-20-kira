import { z } from 'zod'
import { FEATURE_KEYS } from '@kira/core/features'
import { SKILL_ID } from '@kira/content/schema'
import { AVATARS, PIN_PICTURES } from '@kira/figures/spec'
import { UI_LANGS } from '@/lib/i18n/lang'

/**
 * Skema Zod strict untuk setiap aksi dashboard orang tua. Dipisah dari berkas 'use server' supaya bisa dites.
 * Setiap objek `.strict()`: kolom tak dikenal ditolak, jadi orang tua tidak bisa menyelipkan org atau peran.
 */

const id = z.string().uuid('Anak tidak valid. Muat ulang halaman.')
const subject = z.enum(['math', 'english', 'science'])
const coreSession = z.enum(['latihan', 'tes', 'paper'])
const level = z.enum(['off', 'optional', 'required'])
const sessionRules = z.object({ latihan: level, tes: level, paper: level }).strict()
const subjectRules = z.object({ math: sessionRules, english: sessionRules, science: sessionRules }).strict()
const name = z.string().trim().min(1, 'Isi nama anak.').max(40, 'Nama paling banyak 40 karakter.')
const grade = z.number().int('Pilih kelas 1 sampai 6.').min(1, 'Pilih kelas 1 sampai 6.').max(6, 'Pilih kelas 1 sampai 6.')
const pin = z.array(z.enum(PIN_PICTURES)).length(4, 'Pilih 4 gambar untuk PIN.')

const featureMap = z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.boolean().optional()])) as Record<(typeof FEATURE_KEYS)[number], z.ZodOptional<z.ZodBoolean>>).strict()

export const parentSchemas = {
  features: z.object({ learnerId: id, features: featureMap }).strict(),
  dayRules: z
    .object({
      learnerId: id,
      preset: z.enum(['penuh', 'seimbang', 'ringan', 'kustom']),
      rules: z.object({ '1': subjectRules, '2': subjectRules, '3': subjectRules, '4': subjectRules, '5': subjectRules, '6': subjectRules }).strict().nullable(),
    })
    .strict(),
  resetStreak: z.object({ learnerId: id, confirmName: z.string().trim().min(1, 'Ketik nama anak untuk mengonfirmasi.').max(80) }).strict(),
  quest: z.object({ questId: z.string().uuid('Sesi tidak valid. Muat ulang halaman.') }).strict(),
  sessionRequired: z.object({ questId: z.string().uuid('Sesi tidak valid. Muat ulang halaman.'), required: z.boolean() }).strict(),
  sessionTarget: z.object({ learnerId: id, subject, session: coreSession }).strict(),
  sessionSkill: z.object({ questId: z.string().uuid('Sesi tidak valid. Muat ulang halaman.'), skillId: z.string().max(80).regex(SKILL_ID, 'Pilih pelajaran dari daftar.') }).strict(),
  questionCount: z.object({ questId: z.string().uuid('Sesi tidak valid. Muat ulang halaman.'), questionCount: z.number().int().min(5, 'Paling sedikit 5 soal.').max(30, 'Paling banyak 30 soal.') }).strict(),
  limits: z
    .object({
      learnerId: id,
      screenLimitMin: z.number().int().min(15, 'Batas paling sedikit 15 menit.').max(180, 'Batas paling lama 180 menit.'),
      restWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    })
    .strict(),
  sound: z.object({ learnerId: id, soundEnabled: z.boolean(), musicEnabled: z.boolean() }).strict(),
  pin: z.object({ learnerId: id, pin }).strict(),
  unlock: z.object({ learnerId: id }).strict(),
  edit: z.object({ learnerId: id, name, grade, avatar: z.enum(AVATARS) }).strict(),
  addChild: z.object({ name, grade, avatar: z.enum(AVATARS), pin, uiLang: z.enum(UI_LANGS).optional() }).strict(),
  uiLang: z.object({ learnerId: id, uiLang: z.enum(UI_LANGS), uiLangSwitch: z.boolean() }).strict(),
  markWork: z.object({ responseId: z.string().uuid(), verdict: z.enum(['good', 'again']), feedback: z.string().trim().max(500, 'Catatan paling panjang 500 karakter.') }).strict(),
}
