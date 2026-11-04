'use client'

import { useState } from 'react'
import type { ParentPlacementDTO, ParentPlacementSubjectDTO, PlacementResultDTO } from '@/lib/dto-placement'
import { Button } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { ActionError, InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { parentRequestPlacementAction } from '@/server/actions/placement'

/**
 * Tes penempatan untuk orang tua (halaman anak di /keluarga): peta kekuatan per strand, perkiraan tingkat
 * ("sekitar kelas N"), tiga kekuatan, tiga fokus, dan apa yang akan Kira lakukan. Selalu dengan catatan bahwa ini
 * perkiraan dan bukan asesmen Cambridge. Tes ulang boleh sekali sebulan.
 */

const BAR: Record<'kuat' | 'cukup' | 'perlu' | 'belum', { width: string; color: string }> = {
  kuat: { width: '100%', color: 'bg-success' },
  cukup: { width: '66%', color: 'bg-success' },
  perlu: { width: '33%', color: 'bg-warn' },
  belum: { width: '0%', color: 'bg-divider' },
}

const STATE_TEXT: Record<ParentPlacementSubjectDTO['state'], string> = {
  belum: 'Belum dikerjakan',
  siap: 'Menunggu anak memulai',
  berjalan: 'Sedang dikerjakan',
  selesai: 'Selesai',
  dilewati: 'Dilewati',
}

function dateText(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}

function Result({ r, name }: { r: PlacementResultDTO; name: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-h3 font-bold">
          {name} berada {r.levelText} di {r.label}
        </p>
        <p className="m-0 text-body">{r.vsGrade}</p>
        <p className="m-0 text-small text-fg-muted">
          {r.confidenceText} Dikerjakan {dateText(r.finishedAt)}.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="m-0 text-body font-bold">Peta kekuatan per bagian</h4>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {r.groups.map((g) => (
            <li key={g.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-body">{g.label}</span>
                <span className="flex-none text-small text-fg-muted">
                  {g.statusText}
                  {g.asked > 0 ? `, ${g.correct} dari ${g.asked} soal` : ''}
                </span>
              </div>
              <div role="img" aria-label={`${g.label}: ${g.statusText}`} className="flex h-2.5 overflow-hidden rounded-pill bg-divider">
                <span className={cx(BAR[g.status].color)} style={{ width: BAR[g.status].width }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-body font-bold">Yang sudah kuat</h4>
          {r.strengths.length === 0 ? (
            <p className="m-0 text-small text-fg-muted">Belum terlihat jelas dari soal yang keluar. Tes ulang akan membantu.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {r.strengths.map((s) => (
                <li key={s.title} className="text-body">
                  {s.title} <span className="text-small text-fg-muted">(kelas {s.grade})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-body font-bold">Yang akan jadi fokus</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {r.focus.map((s) => (
              <li key={s.title} className="text-body">
                {s.title} <span className="text-small text-fg-muted">(kelas {s.grade})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h4 className="m-0 text-body font-bold">Yang akan Kira lakukan</h4>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          {r.next.map((n) => (
            <li key={n} className="text-body">
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Subject({ s, learnerId, name, onNote }: { s: ParentPlacementSubjectDTO; learnerId: string; name: string; onNote: (n: string) => void }) {
  const ask = useAction(parentRequestPlacementAction)
  const label = s.state === 'selesai' ? 'Siapkan tes ulang' : s.state === 'dilewati' ? 'Siapkan tes lagi' : 'Siapkan tes'
  return (
    <div className="flex flex-col gap-3 rounded-control border border-divider p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 min-w-0 flex-1 text-body-lg font-bold">{s.label}</h3>
        <span className="text-small font-semibold text-fg-muted">{STATE_TEXT[s.state]}</span>
      </div>
      {s.result ? <Result r={s.result} name={name} /> : null}
      {s.canRequest ? (
        <Button
          variant="secondary"
          className="h-12 self-start"
          loading={ask.pending}
          onClick={async () => {
            const r = await ask.run({ learnerId, subject: s.subject })
            if (r.ok) onNote(`Tes ${s.label} siap. ${name} akan melihatnya di layar Hari Ini.`)
          }}
        >
          {label}
        </Button>
      ) : null}
      {s.requestNote ? <span className="text-small text-fg-muted">{s.requestNote}</span> : null}
      <ActionError error={ask.error} />
    </div>
  )
}

export function PlacementSection({ data, learnerId, name }: { data: ParentPlacementDTO; learnerId: string; name: string }) {
  const [note, setNote] = useState<string | null>(null)
  if (!data.enabled) return null
  return (
    <>
      <p className="m-0 text-body">
        Tes singkat (8 sampai 12 soal, sekitar 5 menit per mata pelajaran) membantu Kira memilih soal pertama yang pas untuk {name}. Anak tidak melihat skor, tidak ada jam, dan boleh melewati atau melanjutkan nanti. Hari belajar tetap jalan walau tes belum dikerjakan.
      </p>
      {note ? <InlineAlert tone="success" title={note} /> : null}
      {data.subjects.map((s) => (
        <Subject key={s.subject} s={s} learnerId={learnerId} name={name} onNote={setNote} />
      ))}
      <InlineAlert tone="info" title="Catatan">
        {data.disclaimer}
      </InlineAlert>
    </>
  )
}
