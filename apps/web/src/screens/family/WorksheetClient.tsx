'use client'

import { useMemo, useState } from 'react'
import type { ConsoleShell, Subject } from '@/lib/dto'
import type { WorksheetLength, WorksheetPageDTO } from '@/lib/dto-coach'
import { ChildPicker } from '@/components/coach/ChildPicker'
import { Button, ButtonLink } from '@/components/console/Button'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { RadioGroup, Select } from '@/components/console/Field'
import { Card } from '@/components/console/Layout'
import { useAction } from '@/components/console/useAction'
import { FamilyShell } from '@/components/family/FamilyShell'
import { createWorksheetAction } from '@/server/actions/coach'

/**
 * Lembar kerja: orang tua memilih anak, mapel, skill, dan panjang, lalu membuka lembar A4 dan kuncinya di halaman cetak.
 * Dibuat tanpa layanan luar: cetak lewat peramban ("Simpan sebagai PDF"). Cukup untuk HP: satu kolom, kontrol 44 px.
 */

const SUBJECT_OPTIONS: { value: Subject; label: string }[] = [
  { value: 'math', label: 'Math' },
  { value: 'english', label: 'English' },
  { value: 'science', label: 'Science' },
]

export function WorksheetClient({ shell, data, initialSkill }: { shell: ConsoleShell; data: WorksheetPageDTO; initialSkill: string | null }) {
  const first = data.skills.find((s) => s.id === initialSkill) ?? data.skills[0] ?? null
  const [subject, setSubject] = useState<Subject>(first?.subject ?? 'math')
  const [skillId, setSkillId] = useState<string>(first?.id ?? '')
  const [length, setLength] = useState<WorksheetLength>('medium')
  const [made, setMade] = useState<{ sheetHref: string; keyHref: string } | null>(null)
  const { run, pending, error } = useAction(createWorksheetAction)
  const subjects = useMemo(() => SUBJECT_OPTIONS.filter((o) => data.skills.some((s) => s.subject === o.value)), [data.skills])
  const skills = useMemo(() => data.skills.filter((s) => s.subject === subject), [data.skills, subject])
  const left = Math.max(0, data.limit.perDay - data.limit.usedToday)
  const selected = data.children.find((c) => c.id === data.selectedId) ?? null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.selectedId || !skillId) return
    setMade(null)
    const r = await run({ learnerId: data.selectedId, skillId, length })
    if (r.ok) setMade({ sheetHref: r.data.sheetHref, keyHref: r.data.keyHref })
  }

  return (
    <FamilyShell shell={shell} active="sheet" {...(selected ? { learnerName: selected.name } : {})}>
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h2 font-bold">Lembar kerja</h1>
        <p className="m-0 text-body text-fg-muted">Pilih skill, lalu cetak lembar A4 beserta kunci jawabannya. Soalnya baru dan tidak berulang dalam satu lembar.</p>
      </header>
      {!selected ? (
        <EmptyState
          icon="learners"
          title="Belum ada anak di keluarga ini."
          body="Tambahkan anak lebih dulu, lalu kembali ke sini untuk mencetak lembar kerja."
          actions={
            <ButtonLink href="/keluarga" variant="primary">
              Ke halaman Anak saya
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ChildPicker children={data.children} selectedId={data.selectedId} href={(id) => `/keluarga/lembar?learner=${encodeURIComponent(id)}`} />
          {data.skills.length === 0 ? (
            <EmptyState
              icon="paper"
              title={`Belum ada skill dengan soal cetak untuk kelas ${selected.grade}.`}
              body="Coba lagi nanti, atau buka Pelatih untuk kegiatan 10 menit yang tidak butuh kertas soal."
              actions={
                <ButtonLink href={`/keluarga/pelatih?learner=${encodeURIComponent(selected.id)}`} variant="secondary">
                  Buka Pelatih
                </ButtonLink>
              }
            />
          ) : (
            <Card as="section" aria-labelledby="buat" padding="sm">
              <form onSubmit={submit} className="flex flex-col gap-4">
                <h2 id="buat" className="m-0 text-h3 font-bold">
                  Lembar untuk {selected.name}
                </h2>
                <RadioGroup<Subject>
                  legend="Mapel"
                  name="mapel"
                  value={subject}
                  onChange={(v) => {
                    setSubject(v)
                    setSkillId(data.skills.find((s) => s.subject === v)?.id ?? '')
                    setMade(null)
                  }}
                  options={subjects.map((o) => ({ value: o.value, label: o.label }))}
                  layout="row"
                />
                <Select
                  label="Skill"
                  value={skillId}
                  onChange={(e) => {
                    setSkillId(e.target.value)
                    setMade(null)
                  }}
                  options={skills.map((s) => ({ value: s.id, label: `Kelas ${s.grade}: ${s.titleId}` }))}
                />
                <RadioGroup<WorksheetLength>
                  legend="Panjang lembar"
                  name="panjang"
                  value={length}
                  onChange={(v) => {
                    setLength(v)
                    setMade(null)
                  }}
                  options={data.lengths.map((l) => ({ value: l.id, label: l.label }))}
                  layout="row"
                />
                <p className="m-0 text-small text-fg-muted">
                  Sisa jatah hari ini: {left} dari {data.limit.perDay} lembar untuk keluarga ini. Membuka ulang lembar yang sudah dibuat tidak memakai jatah.
                </p>
                <div>
                  <Button type="submit" variant="primary" loading={pending} disabled={left === 0 || !skillId} icon="printer">
                    Buat lembar kerja
                  </Button>
                </div>
                {left === 0 ? (
                  <InlineAlert tone="warn" title="Jatah hari ini sudah habis." live="none">
                    Coba lagi besok. Lembar yang sudah dibuat bisa dibuka lagi dari tombol di bawah setelah dibuat.
                  </InlineAlert>
                ) : null}
                <ActionError error={error} />
              </form>
            </Card>
          )}
          {made ? (
            <Card as="section" aria-labelledby="siap" padding="sm" className="flex flex-col gap-3">
              <h2 id="siap" className="m-0 text-h3 font-bold">
                Lembar siap
              </h2>
              <p className="m-0 text-body">Buka lembar, lalu tekan Cetak dan pilih printer, atau pilih Simpan sebagai PDF. Kunci jawaban ada di halaman terpisah supaya tidak terlihat anak.</p>
              <div className="flex flex-wrap gap-2.5">
                <ButtonLink href={made.sheetHref} variant="primary" icon="paper" external>
                  Buka lembar untuk anak
                </ButtonLink>
                <ButtonLink href={made.keyHref} variant="secondary" icon="key" external>
                  Buka kunci jawaban
                </ButtonLink>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </FamilyShell>
  )
}
