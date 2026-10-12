'use client'

import { useId, useState } from 'react'
import { jakartaDate } from '@kira/core/time'
import type { CompetitionCalendarActions, CompetitionCalendarDTO, CompetitionRow, Subject } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog } from '@/components/console/Dialog'
import { ActionError, EmptyState } from '@/components/console/Feedback'
import { Checkbox, Select, TextField } from '@/components/console/Field'
import { dateId, daysUntil, SUBJECT_LABEL, SUBJECTS } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill, Section, SectionHeading } from '@/components/console/Layout'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T08 Kalender lomba (papan KalenderLomba): garis waktu per bulan, tabel lomba dengan
 * status pendaftaran yang bisa diubah langsung, form tambah dan ubah lomba, dan katalog.
 * Tanggal perkiraan selalu ditandai; hitung mundur di layar learner hanya untuk tanggal pasti.
 */

export type CompetitionCalendarScreenProps = { data: CompetitionCalendarDTO; actions: CompetitionCalendarActions }

const STATUS_LABEL: Record<CompetitionRow['status'], string> = {
  'not-open': 'Belum dibuka',
  'not-registered': 'Belum daftar',
  registered: 'Terdaftar',
  done: 'Selesai',
  skip: 'Tidak ikut',
  check: 'Perlu konfirmasi',
}

type Form = {
  eventId?: string
  competitionId: string
  name: string
  subjects: Subject[]
  date: string
  dateIsEstimate: boolean
  registrationClose: string
  presetId: string
  link: string
  learnerIds: string[]
}

const EMPTY: Form = { competitionId: '', name: '', subjects: ['math'], date: '', dateIsEstimate: true, registrationClose: '', presetId: '', link: '', learnerIds: [] }

function StatusCell({ row, onChange }: { row: CompetitionRow; onChange: (s: CompetitionRow['status']) => Promise<boolean> }) {
  const id = useId()
  const [value, setValue] = useState(row.status)
  const [busy, setBusy] = useState(false)
  return (
    <div className="relative w-[190px]">
      <label htmlFor={`st-${id}`} className="visually-hidden">
        Status pendaftaran {row.name}
      </label>
      <select
        id={`st-${id}`}
        value={value}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value as CompetitionRow['status']
          const prev = value
          setValue(next)
          setBusy(true)
          const ok = await onChange(next)
          setBusy(false)
          if (!ok) setValue(prev)
        }}
        className={cx(
          'h-10 w-full cursor-pointer appearance-none rounded-control border-2 bg-surface pr-8 pl-2.5 text-body text-fg hover:border-fg',
          value === 'check' ? 'border-warn font-bold' : 'border-border',
        )}
      >
        {(Object.keys(STATUS_LABEL) as CompetitionRow['status'][]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ConsoleIcon name="chevronDown" size={14} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" />
    </div>
  )
}

export function CompetitionCalendarScreen({ data, actions }: CompetitionCalendarScreenProps) {
  const toast = useToast()
  const today = jakartaDate()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<{ name?: string; link?: string; dates?: string }>({})
  const [deleting, setDeleting] = useState<CompetitionRow | null>(null)
  const [rows, setRows] = useState(data.rows)
  const [src, setSrc] = useState(data)
  if (src !== data) {
    setSrc(data)
    setRows(data.rows)
  }
  const save = useAction(actions.saveEvent)
  const status = useAction(actions.setStatus)
  const del = useAction(actions.deleteEvent)

  function openNew(prefill?: Partial<Form>) {
    setErrors({})
    save.reset()
    setForm({ ...EMPTY, learnerIds: data.shell.currentLearnerId ? [data.shell.currentLearnerId] : [], ...prefill })
    setFormOpen(true)
    requestAnimationFrame(() => document.getElementById('form-lomba')?.scrollIntoView({ block: 'start' }))
  }

  function openEdit(r: CompetitionRow) {
    // Id katalog dan preset dari server; tebakan dari nama hanya untuk data lama tanpa id.
    const fromCatalog = r.competitionId !== undefined ? data.catalog.find((c) => c.id === r.competitionId) : data.catalog.find((c) => c.name === r.name)
    const presetId = r.presetId !== undefined ? (r.presetId ?? '') : (data.presets.find((p) => p.title === r.presetLabel)?.id ?? '')
    openNew({
      eventId: r.id,
      competitionId: fromCatalog?.id ?? '',
      name: r.name,
      subjects: SUBJECTS.filter((s) => r.subjectLine.toLowerCase().includes(SUBJECT_LABEL[s].toLowerCase())),
      date: r.date ?? '',
      dateIsEstimate: r.dateIsEstimate,
      registrationClose: r.registrationClose ?? '',
      presetId,
      link: r.link ?? '',
      learnerIds: r.learnerIds,
    })
  }

  async function submit() {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = 'Isi nama lomba dulu.'
    if (form.link.trim() && !/^https:\/\/\S+\.\S+/.test(form.link.trim())) e.link = 'Tautan harus diawali https:// dan berisi alamat situs.'
    if (form.date && form.registrationClose && form.registrationClose > form.date) e.dates = 'Pendaftaran tutup sesudah tanggal lomba. Periksa kedua tanggal.'
    setErrors(e)
    if (e.name || e.link || e.dates) return
    const r = await save.run({
      eventId: form.eventId,
      competitionId: form.competitionId || null,
      name: form.name.trim(),
      subjects: form.subjects,
      date: form.date || null,
      dateIsEstimate: form.dateIsEstimate,
      registrationClose: form.registrationClose || null,
      presetId: form.presetId || null,
      link: form.link.trim() || null,
      learnerIds: form.learnerIds,
    })
    if (r.ok) {
      setFormOpen(false)
      toast({ tone: 'success', title: form.eventId ? `${form.name.trim()} diperbarui.` : `${form.name.trim()} masuk ke kalender.` })
    }
  }

  async function changeStatus(r: CompetitionRow, s: CompetitionRow['status']): Promise<boolean> {
    const res = await status.run({ eventId: r.id, status: s })
    if (res.ok) {
      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status: s } : x)))
      toast({ tone: 'success', title: `Status ${r.name}: ${STATUS_LABEL[s]}.` })
      return true
    }
    toast({ tone: 'error', title: `Status ${r.name} belum berubah.`, body: res.message, reference: res.reference })
    return false
  }

  async function confirmDelete() {
    if (!deleting) return
    const r = await del.run(deleting.id)
    if (r.ok) {
      setRows((list) => list.filter((x) => x.id !== deleting.id))
      toast({ tone: 'success', title: `${deleting.name} dihapus dari kalender.` })
      setDeleting(null)
    }
  }

  return (
    <ConsoleShell shell={data.shell} active="competitions">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Kalender lomba</h1>
          <p className="m-0 text-body text-fg-muted">
            {data.todayLabel}. Tanggal pasti mengikuti juknis tiap lomba; yang belum diumumkan ditandai perkiraan.
          </p>
        </div>
        <Button variant="primary" icon="plus" aria-expanded={formOpen} aria-controls="form-lomba" onClick={() => (formOpen ? setFormOpen(false) : openNew())}>
          Tambah lomba
        </Button>
      </header>

      {formOpen ? (
        <section id="form-lomba" aria-labelledby="judul-form" className="flex flex-col gap-4 rounded-card border-2 border-fg bg-surface px-6 py-5 max-sm:px-4">
          <h2 id="judul-form" className="m-0 text-h3 font-bold">
            {form.eventId ? `Ubah ${form.name}` : 'Lomba baru'}
          </h2>
          <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Dari katalog"
              value={form.competitionId}
              onChange={(e) => {
                const c = data.catalog.find((x) => x.id === e.target.value)
                setForm({ ...form, competitionId: e.target.value, name: c ? c.name : form.name, link: c?.website ?? form.link })
              }}
              options={[{ value: '', label: 'Bukan dari katalog' }, ...data.catalog.map((c) => ({ value: c.id, label: c.verified ? c.name : `${c.name}, belum terverifikasi` }))]}
            />
            <TextField
              label="Nama lomba"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                setErrors((x) => ({ ...x, name: undefined }))
              }}
              error={errors.name}
              placeholder="Contoh: SEAMO 2027"
              autoComplete="off"
              maxLength={80}
            />
            <TextField label="Tanggal lomba" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.dates} />
            <TextField label="Pendaftaran tutup" type="date" value={form.registrationClose} onChange={(e) => setForm({ ...form, registrationClose: e.target.value })} />
            <Select
              label="Preset simulator"
              value={form.presetId}
              onChange={(e) => setForm({ ...form, presetId: e.target.value })}
              options={[{ value: '', label: 'Belum ada preset' }, ...data.presets.map((p) => ({ value: p.id, label: p.verified ? p.title : `${p.title}, belum terverifikasi` }))]}
            />
            <TextField
              label="Tautan pendaftaran"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={form.link}
              onChange={(e) => {
                setForm({ ...form, link: e.target.value })
                setErrors((x) => ({ ...x, link: undefined }))
              }}
              error={errors.link}
              autoComplete="url"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-small font-bold">Mapel</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {SUBJECTS.map((s) => (
                  <Checkbox
                    key={s}
                    label={SUBJECT_LABEL[s]}
                    checked={form.subjects.includes(s)}
                    onChange={(e) => setForm({ ...form, subjects: e.target.checked ? [...form.subjects, s] : form.subjects.filter((x) => x !== s) })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-small font-bold">Learner yang ikut</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {data.shell.learners.map((l) => (
                  <Checkbox
                    key={l.id}
                    label={`${l.name}, Grade ${l.grade}`}
                    checked={form.learnerIds.includes(l.id)}
                    onChange={(e) => setForm({ ...form, learnerIds: e.target.checked ? [...form.learnerIds, l.id] : form.learnerIds.filter((x) => x !== l.id) })}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <Checkbox
            label="Tanggal masih perkiraan"
            description="Hitung mundur tidak tampil di layar learner sampai tanggal pasti diisi."
            checked={form.dateIsEstimate}
            onChange={(e) => setForm({ ...form, dateIsEstimate: e.target.checked })}
          />
          <ActionError error={save.error} />
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={submit} loading={save.pending}>
              {form.eventId ? 'Simpan perubahan' : 'Simpan lomba'}
            </Button>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={save.pending}>
              Batal
            </Button>
          </div>
        </section>
      ) : null}

      <Section labelledBy="garis-waktu">
        <SectionHeading id="garis-waktu">
          {data.months.length ? `${data.months[0]!.name} sampai ${data.months[data.months.length - 1]!.name}` : 'Garis waktu'}
        </SectionHeading>
        {data.months.length === 0 ? (
          <EmptyState compact icon="trophy" title="Belum ada lomba di kalender." body="Tambah lomba dari katalog atau isi sendiri dari juknis penyelenggara." />
        ) : (
          <ol role="list" aria-label="Garis waktu lomba per bulan" tabIndex={0} className="relative m-0 flex list-none gap-3 overflow-x-auto rounded-card border border-divider bg-surface p-4">
            {data.months.map((m) => (
              <li key={m.key} className="flex w-[180px] flex-none flex-col gap-2 border-l-2 border-divider pl-3">
                <span className="text-small font-bold text-fg-muted">{m.name}</span>
                {m.rows.length === 0 ? (
                  <span className="text-small text-fg-muted">Tidak ada lomba</span>
                ) : (
                  m.rows.map((r) => {
                    const row = rows.find((x) => x.id === r.id)
                    return (
                      <span key={r.id} className={cx('flex flex-col rounded-control px-2.5 py-1.5', row?.dateIsEstimate ? 'border-2 border-dashed border-fg bg-math-50' : 'border-2 border-fg bg-surface')}>
                        <span className="text-small font-bold">{r.name}</span>
                        <span className="text-small text-fg-muted">
                          {r.when}
                          {row?.dateIsEstimate ? ', perkiraan' : ''}
                        </span>
                      </span>
                    )
                  })
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-small text-fg-muted">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3.5 w-7 rounded-pill border-2 border-dashed border-fg bg-math-50" />
            Tanggal perkiraan, belum ada juknis
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3.5 w-7 rounded-pill border-2 border-fg bg-surface" />
            Tanggal pasti
          </span>
        </p>
      </Section>

      <Section labelledBy="daftar-lomba">
        <SectionHeading id="daftar-lomba">Lomba dan pendaftaran</SectionHeading>
        {rows.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="Belum ada lomba yang dicatat."
            body="Lomba yang dicatat muncul di sini dengan tanggal tutup pendaftaran dan statusnya."
            actions={
              <Button variant="primary" onClick={() => openNew()}>
                Tambah lomba
              </Button>
            }
          />
        ) : (
          <div role="region" aria-labelledby="lomba-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface">
            <table className="w-full min-w-[960px] border-collapse text-body">
              <caption id="lomba-cap" className="visually-hidden">
                Lomba dan status pendaftaran
              </caption>
              <thead>
                <tr>
                  {['Lomba', 'Tanggal lomba', 'Pendaftaran tutup', 'Status pendaftaran', 'Preset simulator', 'Aksi'].map((h) => (
                    <th key={h} scope="col" className="border-b border-divider px-4 py-3 text-left text-small font-semibold text-fg-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const left = r.registrationClose ? daysUntil(today, r.registrationClose) : null
                  return (
                    <tr key={r.id} className="border-b border-divider align-top last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <span className="flex flex-col">
                          <span className="font-bold">{r.name}</span>
                          <span className="text-small text-fg-muted">{r.subjectLine}</span>
                          {r.learnerIds.length ? (
                            <span className="text-small text-fg-muted">
                              {r.learnerIds.map((id) => data.shell.learners.find((l) => l.id === id)?.name ?? id).join(', ')}
                            </span>
                          ) : null}
                        </span>
                      </th>
                      <td className="px-4 py-3">
                        <span className="flex flex-col items-start gap-1">
                          <span>{r.dateLabel}</span>
                          {r.dateIsEstimate ? <Pill tone="math">Perkiraan</Pill> : null}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.registrationClose ? (
                          <span className="flex flex-col">
                            <span>{dateId(r.registrationClose)}</span>
                            {left != null && left >= 0 && r.status !== 'registered' && r.status !== 'done' && r.status !== 'skip' ? (
                              <span className={cx('text-small font-bold', left <= 7 ? 'text-warn' : 'text-fg-muted')}>
                                {left === 0 ? 'Tutup hari ini' : `${left} hari lagi`}
                              </span>
                            ) : left != null && left < 0 ? (
                              <span className="text-small text-fg-muted">Sudah tutup</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-fg-muted">Belum ada di juknis</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell key={`${r.id}-${r.status}`} row={r} onChange={(s) => changeStatus(r, s)} />
                      </td>
                      <td className="px-4 py-3">
                        {r.presetVerified == null ? (
                          <span className="text-fg-muted">{r.presetLabel || 'Menunggu juknis'}</span>
                        ) : r.presetVerified ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <ConsoleIcon name="checkCircle" size={18} strokeWidth={2.5} className="text-success" />
                            {r.presetLabel}
                          </span>
                        ) : (
                          <span className="flex flex-col">
                            <span>{r.presetLabel}</span>
                            <span className="inline-flex items-center gap-1.5 text-small font-bold text-warn">
                              <ConsoleIcon name="infoCircle" size={16} strokeWidth={2.5} />
                              Belum terverifikasi
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" size="S" icon="edit" onClick={() => openEdit(r)} aria-label={`Ubah ${r.name}`}>
                            Ubah
                          </Button>
                          <Button variant="secondary" size="S" icon="trash" tone="danger" onClick={() => setDeleting(r)} aria-label={`Hapus ${r.name}`}>
                            Hapus
                          </Button>
                          {r.link ? (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 px-1 text-small font-bold">
                              Situs
                              <ConsoleIcon name="external" size={14} strokeWidth={2.5} />
                              <span className="visually-hidden">{r.name}, membuka tab baru</span>
                            </a>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section labelledBy="katalog">
        <SectionHeading id="katalog">Katalog lomba</SectionHeading>
        <p className="-mt-1 mb-0 text-body text-fg-muted">Format terverifikasi berarti cocok dengan juknis resmi atau paket resmi milik keluarga.</p>
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {data.catalog.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-card border border-divider bg-surface px-5 py-4">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-body font-bold">{c.name}</span>
                {c.verified ? (
                  <Pill tone="success">
                    <ConsoleIcon name="check" size={14} strokeWidth={3} />
                    Terverifikasi
                  </Pill>
                ) : (
                  <Pill tone="warn">Belum terverifikasi</Pill>
                )}
              </span>
              <span className="text-small text-fg-muted">{c.organizer}</span>
              <span className="text-body">{c.format}</span>
              <span className="mt-auto flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="S" icon="plus" onClick={() => openNew({ competitionId: c.id, name: c.name, link: c.website ?? '' })}>
                  Catat di kalender
                </Button>
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-small font-bold">
                    Situs resmi
                    <ConsoleIcon name="external" size={14} strokeWidth={2.5} />
                    <span className="visually-hidden">, membuka tab baru</span>
                  </a>
                ) : (
                  <span className="text-small text-fg-muted">Tidak ada situs resmi</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Hapus ${deleting.name} dari kalender?` : 'Hapus lomba?'}
        body="Lomba ini hilang dari kalender dan dari hitung mundur di layar learner. Hasil simulasi yang sudah dikerjakan tetap tersimpan."
        confirmLabel="Hapus lomba"
        onConfirm={confirmDelete}
        error={del.error ? <ActionError error={del.error} /> : null}
      />
    </ConsoleShell>
  )
}
