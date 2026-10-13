import type { ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import type { ArenaRewardDTO } from '@/lib/dto-arena'
import type { LearnerShell } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { BadgeMedal } from '@/components/learner/BadgeTile'
import { XpPill } from '@/components/learner/XpPill'
import { XpTrackBars } from './XpTrackBars'
import { TRACK_TONE } from './tone'

/**
 * Hadiah akhir ronde: XP, naik level, lencana baru, aksesori baru, dan bar XP jalur ini.
 * Semua teks sudah disusun server (en-GB).
 */
export function RewardPanel({ reward, track, shell }: { reward: ArenaRewardDTO; track: 'hitung' | 'pengetahuan'; shell: LearnerShell }): ReactElement {
  const tone = TRACK_TONE[track]
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reward.xp > 0 ? <XpPill xp={reward.xp} size="L" /> : <span className="text-body-lg text-fg-muted">No XP this time.</span>}
        <span className={cx('text-body font-bold', tone.text)}>{reward.trackLabel}</span>
      </div>
      {reward.xpNote ? (
        <p role="note" className="m-0 max-w-[480px] text-center text-body text-fg-muted">
          {reward.xpNote}
        </p>
      ) : null}
      {reward.levelUp ? (
        <p role="status" className={cx('m-0 rounded-card border-2 px-5 py-3 text-center text-h3 font-bold', tone.border, tone.tint, tone.text)}>
          {reward.levelUp.label}
        </p>
      ) : null}
      {reward.badges.length > 0 ? (
        <section aria-label="New badges" className="flex w-full flex-col items-center gap-2">
          <h3 className="m-0 text-h3 font-bold">{reward.badges.length === 1 ? 'New badge' : 'New badges'}</h3>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0">
            {reward.badges.map((b) => (
              <li key={b.id} className="flex w-32 flex-col items-center gap-1.5 text-center">
                <BadgeMedal id={b.id} title={b.title} size="L" glyph={b.glyph} />
                <span className="text-body leading-5 font-bold">{b.title}</span>
                <span className="text-body leading-5 text-fg-muted">{b.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {reward.accessories.length > 0 ? (
        <section aria-label="New accessories" className="flex flex-col items-center gap-2">
          <h3 className="m-0 text-h3 font-bold">{reward.accessories.length === 1 ? 'New accessory' : 'New accessories'}</h3>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0">
            {reward.accessories.map((a) => (
              <li key={a.id} className="flex flex-col items-center gap-1">
                <Avatar name={shell.avatar} accessory={a.id} size={72} />
                <span className="text-body font-bold">{a.label}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-body text-fg-muted">You can wear it from the Me screen.</p>
        </section>
      ) : null}
      <XpTrackBars tracks={reward.tracks} only={track} className="w-full max-w-[420px]" />
    </div>
  )
}
