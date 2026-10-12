import 'server-only'
import { addDays, jakartaDate, weekStart as mondayOf, type IsoDate } from '@kira/core/time'
import type { ConsoleShell, FamilyHomeDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { inOrg } from '../db'
import { thisWeekStart } from './console-common'
import { shellIn } from './console-shell'
import { loadLearner } from './learner-core'
import { weekSummaryDTO } from './week-summary'

/**
 * G01 Ringkasan minggu untuk orang tua. RLS membatasi orang tua ke anak yang tertaut;
 * tutor melihat semua learner. Minggu dipilih lewat ?minggu= (tanggal apa pun di minggu itu).
 */

export type WeekNav = { monday: IsoDate; prevWeekHref: string | null; nextWeekHref: string | null }

/**
 * Minggu yang ditampilkan dan tautan sebelum/sesudah. Batas: minggu learner mulai belajar dan
 * minggu ini. Learner yang belum pernah belajar hanya punya minggu ini.
 */
export function familyWeekNav(input: { param: IsoDate | null; today: IsoDate; startedOn: IsoDate | null; learnerId: string; basePath?: string }): WeekNav {
  const current = thisWeekStart(input.today)
  const first = input.startedOn ? mondayOf(input.startedOn) : current
  const floor = first > current ? current : first
  let monday = input.param ? mondayOf(input.param) : current
  if (monday > current) monday = current
  if (monday < floor) monday = floor
  const href = (m: IsoDate) => `${input.basePath ?? '/keluarga'}?learner=${encodeURIComponent(input.learnerId)}&minggu=${m}`
  return {
    monday,
    prevWeekHref: monday > floor ? href(addDays(monday, -7)) : null,
    nextWeekHref: monday < current ? href(addDays(monday, 7)) : null,
  }
}

/** Data halaman Ringkasan. `home` null bila akun ini belum tertaut ke learner mana pun. */
export async function familyHomeDTO(actor: Actor, learnerParam: string | null, weekParam: IsoDate | null): Promise<{ shell: ConsoleShell; home: FamilyHomeDTO | null }> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner, learners } = await shellIn(tx, actor, learnerParam)
    if (!learner) return { shell, home: null }
    const row = await loadLearner(tx, learner.id)
    const nav = familyWeekNav({ param: weekParam, today, startedOn: row.startedOn, learnerId: learner.id })
    const summary = await weekSummaryDTO(tx, learner.id, nav.monday, { today })
    return {
      shell,
      home: {
        shell,
        learners: learners.map((l) => ({ id: l.id, name: l.name })),
        selectedLearnerId: learner.id,
        summary,
        prevWeekHref: nav.prevWeekHref,
        nextWeekHref: nav.nextWeekHref,
      },
    }
  })
}
