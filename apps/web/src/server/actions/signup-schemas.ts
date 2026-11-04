import { z } from 'zod'
import { TERMS_MESSAGE } from '@/lib/required-rules'

/**
 * Skema pendaftaran, dipisah dari berkas 'use server' supaya bisa dites.
 * Syarat dan Ketentuan harus true. Email kabar opsional: tidak dikirim atau bukan true berarti tidak berlangganan.
 */
export const signUpSchema = z
  .object({
    name: z.string().trim().max(120),
    email: z.string().trim().max(200),
    password: z.string().max(128),
    consent: z.literal(true, TERMS_MESSAGE),
    marketing: z.boolean().default(false),
    turnstile: z.string().max(2048).optional(),
  })
  .strict()

/** Konfirmasi email. Isian selain token hanya dipakai di langkah Buat password baru, dan persetujuannya diperiksa di layanan. */
export const verifySignupSchema = z
  .object({
    token: z.string().min(20).max(100),
    name: z.string().trim().max(120).optional(),
    password: z.string().max(128).optional(),
    consent: z.boolean().optional(),
    marketing: z.boolean().optional(),
  })
  .strict()
