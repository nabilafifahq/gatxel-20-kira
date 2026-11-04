import type { ConsoleIconName } from '@/components/console/icons'

/** Isi halaman Bantuan yang dipakai formulir di browser dan pemeriksaan di server. */

export const SUPPORT_CATEGORIES = [
  { id: 'bug', label: 'Masalah atau bug', tag: 'Bug', icon: 'alert' },
  { id: 'saran', label: 'Saran dan perbaikan', tag: 'Saran', icon: 'sparkle' },
  { id: 'koreksi', label: 'Koreksi soal atau materi', tag: 'Koreksi', icon: 'edit' },
  { id: 'kemitraan', label: 'Kemitraan dengan Gatxel', tag: 'Kemitraan', icon: 'userPlus' },
  { id: 'lainnya', label: 'Lainnya', tag: 'Lainnya', icon: 'more' },
] as const satisfies readonly { id: string; label: string; tag: string; icon: ConsoleIconName }[]

export type SupportCategoryId = (typeof SUPPORT_CATEGORIES)[number]['id']
export const SUPPORT_CATEGORY_IDS = SUPPORT_CATEGORIES.map((c) => c.id) as [SupportCategoryId, ...SupportCategoryId[]]

export const SUBJECT_MIN = 3
export const SUBJECT_MAX = 120
export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 4000
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.pdf,.mp4,image/png,image/jpeg,application/pdf,video/mp4'
export const ATTACHMENT_TYPE_MESSAGE = 'Lampiran hanya boleh berupa PNG, JPG, PDF, atau MP4.'
export const ATTACHMENT_SIZE_MESSAGE = 'Lampiran terlalu besar. Ukuran paling besar 5 MB.'

const WHATSAPP_NUMBER = '6287794551486'
export const WHATSAPP_DISPLAY = '0877 9455 1486'
const whatsappUrl = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
export const WHATSAPP_HELP_URL = whatsappUrl('Halo tim Gatxel, saya pengguna Kira dan butuh bantuan. Email akun saya: ... Yang terjadi: ...')
export const WHATSAPP_PARTNER_URL = whatsappUrl('Halo Gatxel, saya tertarik bermitra untuk Kira. Nama saya: ... Lembaga: ... Yang ingin saya bahas: ...')

const ROLE_LABELS = { tutor: 'tutor', guardian: 'orang tua' } as const
export const roleLabel = (role: 'tutor' | 'guardian'): string => ROLE_LABELS[role]

/**
 * Halaman asal yang boleh ikut terkirim: path saja, tanpa query. Bagian panjang (token di tautan konfirmasi atau reset)
 * diganti supaya tidak pernah masuk email. Selain path di dalam Kira, hasilnya kosong.
 */
export function safePagePath(raw: string | null | undefined): string {
  if (!raw) return ''
  const path = (raw.split(/[?#]/)[0] ?? '').trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 200 || !/^[A-Za-z0-9/_.-]*$/.test(path)) return ''
  return path
    .split('/')
    .map((seg) => (seg.length >= 20 ? '[kode]' : seg))
    .join('/')
}
