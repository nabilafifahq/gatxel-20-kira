import { weekday, type IsoDate } from './time'
import { SUBJECTS, type Subject } from './quest'

/**
 * Aturan hari bawaan per learner: untuk setiap hari Senin sampai Sabtu, setiap mapel, dan setiap sesi inti
 * (Latihan, Tes, Paper), tutor memilih Mati (tidak dibuat), Opsional (dibuat, tidak dihitung streak), atau
 * Wajib (dibuat dan dihitung streak). Modul ini murni; DAL menyimpan pilihannya dan composeDay memakainya.
 */

export const RULE_LEVELS = ['off', 'optional', 'required'] as const
export type RuleLevel = (typeof RULE_LEVELS)[number]

export const RULE_SESSIONS = ['latihan', 'tes', 'paper'] as const
export type RuleSession = (typeof RULE_SESSIONS)[number]

/** Hari yang punya aturan: 1 (Senin) sampai 6 (Sabtu). Minggu istirahat; bila dibuka, memakai aturan Sabtu. */
export const RULE_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const

export type SubjectRules = Record<RuleSession, RuleLevel>
export type DayRules = Record<string, Record<Subject, SubjectRules>>

export const DAY_PRESETS = ['penuh', 'seimbang', 'ringan', 'kustom'] as const
export type DayPreset = (typeof DAY_PRESETS)[number]

/** Seimbang jadi bawaan learner baru: hari tidak terlalu panjang, hanya Latihan yang dihitung streak. */
export const DEFAULT_PRESET = 'seimbang' as const satisfies DayPreset

export const PRESET_SESSION_LEVELS: Record<Exclude<DayPreset, 'kustom'>, SubjectRules> = {
  penuh: { latihan: 'required', tes: 'required', paper: 'required' },
  seimbang: { latihan: 'required', tes: 'optional', paper: 'optional' },
  ringan: { latihan: 'required', tes: 'off', paper: 'off' },
}

export function rulesFromLevels(levels: SubjectRules): DayRules {
  const out: DayRules = {}
  for (const d of RULE_WEEKDAYS) {
    out[String(d)] = Object.fromEntries(SUBJECTS.map((s) => [s, { ...levels }])) as Record<Subject, SubjectRules>
  }
  return out
}

/** Aturan lengkap sebuah preset. Kustom tanpa isi memakai Seimbang. */
export function presetRules(preset: DayPreset): DayRules {
  return rulesFromLevels(preset === 'kustom' ? PRESET_SESSION_LEVELS.seimbang : PRESET_SESSION_LEVELS[preset])
}

const isLevel = (v: unknown): v is RuleLevel => typeof v === 'string' && (RULE_LEVELS as readonly string[]).includes(v)

/** Rapikan aturan dari database atau input: sel yang hilang atau salah diisi dari `fallback` (bawaan Seimbang). */
export function normaliseRules(raw: unknown, fallback: DayRules = presetRules('seimbang')): DayRules {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: DayRules = {}
  for (const d of RULE_WEEKDAYS) {
    const day = (src[String(d)] && typeof src[String(d)] === 'object' ? src[String(d)] : {}) as Record<string, unknown>
    const row = {} as Record<Subject, SubjectRules>
    for (const s of SUBJECTS) {
      const cell = (day[s] && typeof day[s] === 'object' ? day[s] : {}) as Record<string, unknown>
      const base = fallback[String(d)]![s]
      row[s] = Object.fromEntries(RULE_SESSIONS.map((k) => [k, isLevel(cell[k]) ? cell[k] : base[k]])) as SubjectRules
    }
    out[String(d)] = row
  }
  return out
}

/** Preset yang sama persis dengan aturan ini, atau 'kustom' bila tidak ada yang cocok. */
export function detectPreset(rules: DayRules): DayPreset {
  for (const p of ['penuh', 'seimbang', 'ringan'] as const) {
    const want = PRESET_SESSION_LEVELS[p]
    const same = RULE_WEEKDAYS.every((d) => SUBJECTS.every((s) => RULE_SESSIONS.every((k) => rules[String(d)]?.[s]?.[k] === want[k])))
    if (same) return p
  }
  return 'kustom'
}

/** Aturan efektif dari preset tersimpan dan aturan kustom (bila ada). */
export function effectiveRules(preset: DayPreset, custom: unknown): DayRules {
  return preset === 'kustom' ? normaliseRules(custom) : presetRules(preset)
}

/** Tingkat satu sesi pada satu tanggal. Minggu memakai aturan Sabtu. */
export function ruleLevel(rules: DayRules, date: IsoDate, subject: Subject, session: RuleSession): RuleLevel {
  const wd = weekday(date)
  const day = rules[String(wd === 0 ? 6 : wd)]
  return day?.[subject]?.[session] ?? PRESET_SESSION_LEVELS[DEFAULT_PRESET][session]
}

export const RULE_LEVEL_LABEL_ID: Record<RuleLevel, string> = { off: 'Mati', optional: 'Opsional', required: 'Wajib' }
export const DAY_PRESET_LABEL_ID: Record<DayPreset, string> = { penuh: 'Penuh', seimbang: 'Seimbang', ringan: 'Ringan', kustom: 'Kustom' }
