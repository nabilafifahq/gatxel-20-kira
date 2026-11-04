import type { LearnerShell } from './dto'

/** DTO Kira World (en-GB untuk layar anak). Tidak memuat kunci apa pun yang perlu dirahasiakan. */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type StarsDTO = { balance: number; earned: number }
export type WorldSessionGain = { stars: number; cards: string[] }

export type PetView = { kind: string; name: string; hearts: number; stage: 1 | 2 | 3; costume: string | null; home: string }

export type PetDTO = {
  shell: LearnerShell
  stars: StarsDTO
  state: 'egg' | 'ready' | 'hatched'
  hatchAt: number
  pet: PetView | null
  next: { stage: 2 | 3; left: number } | null
  greeting: string
  homes: { id: string; name: string }[]
  costumes: { id: string; name: string }[]
}

export type ShopItemDTO = { id: string; kind: 'petcostume' | 'pethome' | 'outfit' | 'frame' | 'backdrop'; name: string; price: number; owned: boolean; equipped: boolean }
export type ShopDTO = { shell: LearnerShell; stars: StarsDTO; items: ShopItemDTO[]; petHatched: boolean; petKind: string | null }

export type CardDTO = {
  id: string
  no: number
  name: string
  rarity: Rarity
  art: string
  set: string
  tone: 'math' | 'english' | 'science' | 'mental' | 'knowledge' | 'warn'
  owned: boolean
  fact: string | null
  hint: string
  progress: number
  /** Angka kemajuan yang sama dengan syarat kartu. Kosong untuk kartu ya-atau-belum. */
  count: { have: number; need: number; unit: 'percent' | 'count' } | null
  isNew: boolean
}
export type AlbumDTO = {
  shell: LearnerShell
  total: number
  owned: number
  rarities: { rarity: Rarity; owned: number; total: number }[]
  sets: { id: string; name: string; blurb: string; earnedBy: string; complete: boolean; reward: string; rare: boolean; cards: CardDTO[] }[]
}

/** Satu kartu ringkas untuk momen hadiah. */
export type CardMiniDTO = { id: string; no: number; name: string; rarity: Rarity; art: string; fact: string }

export type StoryDTO = {
  shell: LearnerShell
  title: string
  goalDays: number
  thisWeekDays: number
  open: number
  chapters: {
    n: number
    title: string
    isOpen: boolean
    /** Sudah pernah ditandai selesai. */
    done: boolean
    /** Besar cahaya Lumi di bab ini. */
    glow: number
    pages: {
      text: string
      scene: string
      cx: number
      cy?: number
      zoom: number
      lx: number
      ly: number
      pip: { x: number; y: number }
      kira: { x: number; y: number; flip?: boolean; read?: boolean; worry?: boolean }
      show: readonly string[]
    }[]
    /** Sobekan surat bab ini. Kosong untuk bab yang belum terbuka. */
    scrap: string | null
    wonder: string
    tease: string
  }[]
}

export type BossRowDTO = {
  id: string
  name: string
  epithet: string
  personality: string
  level: 1 | 2 | 3
  weakness: string
  intro: string
  questions: number
  winAt: number
  /** Sudah datang: bisa dilawan. */
  open: boolean
  wins: number
  /** Kartu langka yang belum dimiliki dari lawan ini. */
  prize: { id: string; name: string; rarity: Rarity; art: string } | null
}

export type BossDTO = {
  shell: LearnerShell
  week: string
  wonThisWeek: boolean
  winStars: number
  bosses: BossRowDTO[]
  /** Lawan yang disorot saat layar dibuka. */
  spotlight: string | null
  /** Hari belajar lagi sampai lawan berikutnya datang. Kosong bila semua sudah datang. */
  nextIn: number | null
  beaten: number
  /** Batas layar hari ini habis: ronde baru ditolak server, jadi tombol mulai diganti pesan istirahat. */
  limitReached: boolean
}

export type BossResultDTO = {
  shell: LearnerShell
  submitted: boolean
  correct: number
  total: number
  winAt: number
  won: boolean
  stars: number
  boss: { id: string; name: string; defeat: string; rematch: string }
  card: { id: string; no: number; name: string; rarity: Rarity; art: string; fact: string } | null
}

export type MedalDTO = { id: string; title: string; medal: 'gold' | 'silver' | 'bronze' | 'honour' | 'participant'; earnedOn: string }
export type TrophyDTO = {
  shell: LearnerShell
  learnerName: string
  badgeCount: number
  bestStreak: number
  currentStreak: number
  milestones: { days: 7 | 30 | 100; reached: boolean; certificate: boolean }[]
  bossWins: number
  bossesBeaten: { id: string; name: string; wins: number }[]
  setsComplete: { id: string; name: string }[]
  medals: MedalDTO[]
}

export type WorldHubDTO = {
  shell: LearnerShell
  stars: StarsDTO
  pet: (PetView & { greeting: string }) | null
  petState: 'egg' | 'ready' | 'hatched'
  hatchAt: number
  cards: { owned: number; total: number }
  story: { open: number; total: number }
  boss: { wonThisWeek: boolean; beaten: number; total: number }
}

export type WorldPeekDTO = {
  stars: StarsDTO
  pet: { kind: string; name: string; stage: 1 | 2 | 3; costume: string | null; greeting: string } | null
  canHatch: boolean
}
