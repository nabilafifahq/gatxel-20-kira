'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addDays } from '@kira/core/time'
import { Avatar } from '@kira/figures'
import type { LearnerDetailActions, LearnerDetailDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ArenaReport } from '@/components/console/ArenaReport'
import { ActionError, EmptyState } from '@/components/console/Feedback'
import { TextArea } from '@/components/console/Field'
import { dateId, dateTimeId, num, shortDateId, SUBJECT_LABEL, SUBJECTS } from '@/components/console/format'
import { StarGlyph } from '@/components/console/icons'
import { Card, Section, SectionHeading, SubjectChip } from '@/components/console/Layout'
import { cellKey, LEVEL_WORD, levelOf, MasteryHeatmap, weekRange } from '@/components/console/MasteryHeatmap'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T02 Detail learner (papan DetailLearner, MasteryHeatmap): peta penguasaan skill
 * per minggu dengan panel rincian, riwayat attempt dengan saring mapel, dan catatan tutor.
 */

export type LearnerDetailScreenProps = { data: LearnerDetailDTO; actions: LearnerDetailActions }

const STATUS_LINE: Record<ReturnType<typeof levelOf>, string> = {
  mastered: 'Dikuasai. Skill ini sudah pindah ke review berjarak.',
  review: 'Review. Satu sesi latihan tambahan minggu ini membantu menjaga skill ini.',
  reteach: 'Ajar ulang. Perencana mengusulkan pelajaran dan latihan mode Belajar.',
  empty: 'Belum ada soal skill ini di minggu tersebut.',
}

type HeatGroups = LearnerDetailDTO['heatmap']

function firstSelection(weeks: LearnerDetailDTO['weeks'], groups: HeatGroups): string | null {
  // Pilih sel ajar ulang terbaru, kalau tidak ada sel terakhir skill pertama.
  const last = weeks.length - 1
  for (const g of groups) {
    for (const s of g.skills) {
      const c = s.cells[last]
      if (c && levelOf(c) === 'reteach') return cellKey(s.id, last)
    }
  }
  const s0 = groups[0]?.skills[0]
  return s0 ? cellKey(s0.id, Math.max(0, last)) : null
}

/** Skill yang punya jawaban di jendela peta atau sudah punya bintang. */
function practicedOnly(groups: HeatGroups): HeatGroups {
  return groups
    .map((g) => ({ ...g, skills: g.skills.filter((s) => s.stars > 0 || s.cells.some((c) => c.answers > 0)) }))
    .filter((g) => g.skills.length > 0)
}

function skillCount(groups: HeatGroups): number {
  return groups.reduce((n, g) => n + g.skills.length, 0)
}

export function LearnerDetailScreen({ data, actions }: LearnerDetailScreenProps) {
  const toast = useToast()
  const practiced = useMemo(() => practicedOnly(data.heatmap), [data.heatmap])
  // Peta memuat semua skill grade learner; tampilan awal hanya skill yang sudah dilatih.
  const [scope, setScope] = useState<'practiced' | 'all'>('practiced')
  const groups = scope === 'practiced' && practiced.length > 0 ? practiced : data.heatmap
  const [selected, setSelected] = useState<string | null>(() => firstSelection(data.weeks, practiced.length > 0 ? practiced : data.heatmap))
  const [subject, setSubject] = useState<Subject | 'all'>('all')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [notesSrc, setNotesSrc] = useState(data.notes)
  const [notes, setNotes] = useState(data.notes)
  const save = useAction(actions.addNote)
  const { learner } = data
  // Catatan dari server menggantikan salinan lokal setelah halaman diperbarui.
  if (notesSrc !== data.notes) {
    setNotesSrc(data.notes)
    setNotes(data.notes)
  }
  const q = `?learner=${encodeURIComponent(learner.id)}`
  const thisWeek = data.weeks[data.weeks.length - 1]?.weekStart
  const planHref = `${CONSOLE_ROUTES.plan}${q}`
  const nextPlanHref = thisWeek ? `${planHref}&minggu=${addDays(thisWeek, 7)}` : planHref

  const detail = useMemo(() => {
    if (!selected) return null
    const [skillId, w] = selected.split('::') as [string, string]
    const week = Number(w)
    for (const g of data.heatmap) {
      const s = g.skills.find((x) => x.id === skillId)
      if (s) return { subject: g.subject, skill: s, week, cell: s.cells[week], prev: week > 0 ? s.cells[week - 1] : undefined }
    }
    return null
  }, [selected, data.heatmap])

  const attempts = subject === 'all' ? data.attempts : data.attempts.filter((a) => a.subject === subject)
  const hasHeat = data.heatmap.some((g) => g.skills.length > 0)

  async function submitNote() {
    const body = note.trim()
    if (!body) {
      setNoteError('Tulis catatannya dulu, lalu simpan.')
      return
    }
    if (body.length > 2000) {
      setNoteError(`Catatan paling panjang 2.000 karakter. Catatan ini ${num(body.length)} karakter.`)
      return
    }
    const r = await save.run(learner.id, body)
    if (r.ok) {
      // Catatan baru datang dari data server yang dimuat ulang oleh action (refresh), jadi tidak ditambah di sini.
      setNote('')
      toast({ tone: 'success', title: 'Catatan tersimpan.' })
    }
  }

  return (
    <ConsoleShell shell={data.shell} active="learners">
      <nav aria-label="Jejak" className="-mb-4 flex flex-wrap items-center gap-2 text-small text-fg-muted">
        <Link href={CONSOLE_ROUTES.today} className="font-semibold">
          Hari ini
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={CONSOLE_ROUTES.learners} className="font-semibold">
          Learner
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{learner.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <Avatar name={learner.avatar} size={64} title={`Avatar ${learner.name}`} />
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">{learner.name}</h1>
          <p className="m-0 text-body text-fg-muted">
            Grade {learner.grade}, Cambridge Primary Stage {learner.grade}. Belajar di Kira sejak {dateId(learner.since, true)}.
          </p>
          <p className="m-0 text-body text-fg-muted tabular">
            Level {learner.level}, {num(learner.xp)} XP, rantai {learner.streak} hari.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`${CONSOLE_ROUTES.reports}${q}`} variant="secondary">
            Laporan minggu ini
          </ButtonLink>
          <ButtonLink href={nextPlanHref} variant="primary">
            Buka rencana minggu depan
          </ButtonLink>
        </div>
      </header>

      <Section labelledBy="penguasaan">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 id="penguasaan" className="m-0 text-h2 font-bold max-sm:text-h3">
            Penguasaan skill per minggu
          </h2>
          <span className="text-body text-fg-muted">
            Persen jawaban pertama yang benar tanpa hint, per minggu. Warna sel mengikuti status skill di akhir minggu itu. Pilih sel untuk melihat rinciannya.
          </span>
        </div>
        {hasHeat && practiced.length > 0 && skillCount(practiced) < skillCount(data.heatmap) ? (
          <div role="group" aria-label="Skill yang ditampilkan" className="flex flex-wrap gap-1.5">
            {(
              [
                ['practiced', `Sudah dilatih, ${skillCount(practiced)} skill`],
                ['all', `Semua skill, ${skillCount(data.heatmap)}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={cx(
                  'h-9 cursor-pointer rounded-pill border-2 px-3 text-small font-bold text-fg',
                  scope === value ? 'border-fg bg-bg' : 'border-divider bg-surface hover:border-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {hasHeat ? (
          <div className="flex flex-wrap items-start gap-6">
            <Card padding="none" className="flex-[2_1_600px] px-6 py-5 max-sm:px-3 max-sm:py-4">
              <MasteryHeatmap weeks={data.weeks} groups={groups} selected={selected} onSelect={setSelected} learnerName={learner.name} />
            </Card>
            <aside aria-live="polite" aria-label="Rincian sel terpilih" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-divider bg-surface px-6 py-5">
              {detail && detail.cell ? (
                (() => {
                  const lv = levelOf(detail.cell)
                  const wk = data.weeks[detail.week]
                  const acc = detail.cell.accuracy
                  const prevAcc = detail.prev && levelOf(detail.prev) !== 'empty' ? detail.prev.accuracy : null
                  const diff = acc != null && prevAcc != null ? Math.round(acc - prevAcc) : null
                  return (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-small font-semibold text-fg-muted">
                          {wk ? `${wk.label}, ${weekRange(wk.weekStart)}` : ''}
                        </span>
                        <h3 className="m-0 text-h3 font-bold">{detail.skill.title}</h3>
                        <span className="text-small text-fg-muted">{SUBJECT_LABEL[detail.subject]}</span>
                      </div>
                      <p className="m-0 text-body">
                        {lv === 'empty'
                          ? `Tidak ada soal ${detail.skill.title} yang dikerjakan di minggu ini.`
                          : `${Math.round(acc ?? 0)}% benar tanpa hint dari ${num(detail.cell.answers)} jawaban minggu ini.`}
                      </p>
                      <p className={cx('m-0 text-body font-bold', lv === 'reteach' ? 'text-warn' : lv === 'empty' ? 'text-fg-muted' : 'text-fg')}>
                        {STATUS_LINE[lv]}
                      </p>
                      <p className="m-0 flex items-center gap-1 text-body" aria-label={`${detail.skill.stars} dari 3 bintang`}>
                        {[0, 1, 2].map((i) => (
                          <StarGlyph key={i} size={20} filled={i < detail.skill.stars} />
                        ))}
                        <span className="ml-1 text-fg-muted" aria-hidden="true">
                          {detail.skill.stars} dari 3 bintang
                        </span>
                      </p>
                      {diff != null && detail.week > 0 ? (
                        <p className="m-0 text-body text-fg-muted">
                          {diff < 0
                            ? `Turun ${-diff} poin dari ${data.weeks[detail.week - 1]?.label}.`
                            : diff > 0
                              ? `Naik ${diff} poin dari ${data.weeks[detail.week - 1]?.label}.`
                              : `Sama dengan ${data.weeks[detail.week - 1]?.label}.`}
                        </p>
                      ) : null}
                      {lv === 'reteach' || lv === 'review' ? (
                        <ButtonLink href={planHref} variant="primary" className="self-start">
                          {lv === 'reteach' ? 'Tambahkan pelajaran ke rencana' : 'Tambahkan satu sesi latihan'}
                        </ButtonLink>
                      ) : null}
                      <span className="visually-hidden">Status: {LEVEL_WORD[lv]}</span>
                    </>
                  )
                })()
              ) : (
                <p className="m-0 text-body text-fg-muted">Pilih sel di peta untuk melihat rinciannya.</p>
              )}
            </aside>
          </div>
        ) : (
          <EmptyState
            icon="map"
            title="Peta penguasaan masih kosong."
            body={`Peta terisi setelah ${learner.name} menyelesaikan quest pertama. Setiap skill butuh paling sedikit satu jawaban di minggu itu.`}
            actions={
              <ButtonLink href={planHref} variant="primary">
                Susun rencana minggu ini
              </ButtonLink>
            }
          />
        )}
      </Section>

      {data.arena ? <ArenaReport data={data.arena} /> : null}

      <div className="flex flex-wrap items-start gap-6">
        <Section labelledBy="riwayat" className="flex-[2_1_600px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <h2 id="riwayat" className="m-0 text-h2 font-bold max-sm:text-h3">
              Riwayat attempt
            </h2>
            <div role="group" aria-label="Saring mapel" className="flex flex-wrap gap-1.5">
              {(['all', ...SUBJECTS] as const).map((s) => {
                const on = subject === s
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSubject(s)}
                    className={cx(
                      'h-9 cursor-pointer rounded-pill border-2 px-3 text-small font-bold text-fg',
                      on ? 'border-fg bg-bg' : 'border-divider bg-surface hover:border-fg',
                    )}
                  >
                    {s === 'all' ? 'Semua mapel' : SUBJECT_LABEL[s]}
                  </button>
                )
              })}
            </div>
            <span role="status" className="ml-auto text-body font-bold tabular">
              {subject === 'all' ? `${data.attempts.length} attempt` : `${attempts.length} dari ${data.attempts.length} attempt, ${SUBJECT_LABEL[subject]}`}
            </span>
          </div>
          {data.attempts.length === 0 ? (
            <EmptyState compact icon="inbox" title="Belum ada attempt." body="Quest, tes, dan paper yang selesai akan muncul di sini dengan skornya." />
          ) : attempts.length === 0 ? (
            <EmptyState
              compact
              filters={[`Mapel: ${SUBJECT_LABEL[subject as Subject]}`]}
              title={`Tidak ada attempt ${SUBJECT_LABEL[subject as Subject]} di riwayat ini.`}
              actions={
                <Button variant="primary" onClick={() => setSubject('all')}>
                  Tampilkan semua mapel
                </Button>
              }
            />
          ) : (
            <div role="region" aria-labelledby="riwayat-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface">
              <table className="w-full min-w-[600px] border-collapse text-body">
                <caption id="riwayat-cap" className="visually-hidden">
                  Riwayat attempt {learner.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-divider px-4 py-3 text-left text-small font-semibold text-fg-muted">
                      Tanggal
                    </th>
                    <th scope="col" className="border-b border-divider px-4 py-3 text-left text-small font-semibold text-fg-muted">
                      Paper atau quest
                    </th>
                    <th scope="col" className="border-b border-divider px-4 py-3 text-left text-small font-semibold text-fg-muted">
                      Mapel
                    </th>
                    <th scope="col" className="border-b border-divider px-4 py-3 text-right text-small font-semibold text-fg-muted">
                      Skor
                    </th>
                    <th scope="col" className="border-b border-divider px-4 py-3 text-right text-small font-semibold text-fg-muted">
                      Waktu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-b border-divider last:border-b-0 hover:bg-bg">
                      <td className="px-4 py-3 whitespace-nowrap">{shortDateId(a.date)}</td>
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link href={a.href} className="font-bold">
                          {a.title}
                        </Link>
                      </th>
                      <td className="px-4 py-3">
                        <SubjectChip subject={a.subject} withIcon={false} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular">{a.score}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular">{a.minutes} mnt</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section labelledBy="catatan" className="flex-[1_1_320px]">
          <SectionHeading id="catatan">Catatan tutor</SectionHeading>
          <Card padding="none" className="flex flex-col gap-3.5 px-5 py-[18px]">
            <TextArea
              label="Catatan baru"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteError(null)
              }}
              error={noteError}
              hint="Hanya terlihat oleh tutor. Catatan untuk orang tua ditulis di laporan mingguan."
              maxLength={2000}
            />
            <Button variant="secondary" className="self-start" onClick={submitNote} loading={save.pending}>
              Simpan catatan
            </Button>
            <ActionError error={save.error} />
            {notes.length === 0 ? (
              <p className="m-0 border-t border-divider pt-3 text-body text-fg-muted">Belum ada catatan.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {notes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5 border-t border-divider py-3">
                    <span className="text-small font-bold text-fg-muted">
                      {n.date.length > 10 ? dateTimeId(n.date) : dateId(n.date)}, {n.author}
                    </span>
                    <span className="text-body whitespace-pre-line">{n.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      </div>
    </ConsoleShell>
  )
}
