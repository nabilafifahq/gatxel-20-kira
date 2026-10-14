/**
 * DTO untuk peti hadiah harian dan pilihan suara (gerak). File terpisah supaya perubahan di dto.ts tetap kecil.
 * Teks learner berbahasa Inggris (en-GB) dan memakai "earned", tidak pernah "unlock".
 */

export type ChestRewardDTO = {
  kind: 'sticker' | 'background' | 'accessory'
  id: string
  label: string
  /** Hadiah ini baru dimiliki hari ini (bukan ulangan). */
  isNew: boolean
}

export type ChestDTO = {
  state: 'locked' | 'ready' | 'opened'
  /** Baris di bawah peti, misalnya "2 more sessions to open your chest". */
  line: string
  /** Hadiah hari ini bila peti sudah dibuka. */
  reward: ChestRewardDTO | null
  /** Sudah dipakai di avatar? Untuk tombol "Wear it". */
  equipped: boolean
}

export type SoundPolicyDTO = { sfx: boolean; music: boolean }

export type CollectionDTO = {
  stickers: { id: string; label: string; owned: boolean }[]
  backgrounds: { id: string; label: string; owned: boolean; equipped: boolean }[]
  accessories: { id: string; label: string; owned: boolean; equipped: boolean }[]
}
