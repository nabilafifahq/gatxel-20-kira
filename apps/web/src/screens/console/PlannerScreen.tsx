'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { jakartaDate } from '@kira/core/time'
import type { PlanSlotDTO, PlannerActions, PlannerDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog, Dialog } from '@/components/console/Dialog'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { RadioGroup, TextField } from '@/components/console/Field'
import { SUBJECT_LABEL, SUBJECTS } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill, Section, SectionHeading, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { SkillPicker } from '@/components/console/SkillPicker'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'
import { MODE_LABEL, WeekPlannerGrid } from '@/components/console/WeekPlannerGrid'

/**
 * T03 Perencana mingguan (papan Perencana, WeekPlannerGrid): grid 7 hari kali 3 mapel,
 * dialog tambah dan ubah slot dengan pemilih skill, pindah slot lewat pilihan hari
 * (tanpa seret), hari istirahat, usulan dengan alasan, peringatan batas waktu layar, terbitkan.
 * Perubahan yang berhasil langsung tampil di layar; data server menggantikannya saat halaman diperbarui.
 * Minggu yang sudah terbit tetap terbit saat diubah. Slot paper (skillId null) dibuat Penyusun paper:
 * di sini hanya bisa dipindah atau dihapus. Hari yang sudah lewat tidak bisa diubah.
 */

export type PlannerScreenProps = { data: PlannerDTO; actions: PlannerActions }

type SlotForm = {
  slotId?: string
  date: string
  subject: Subject
  kind: 'quest' | 'bonus'
  skillId: string | null
  mode: PlanSlotDTO['mode']
  questionCount: string
}

/** Batas yang sama dengan server (upsertSlot). */
const COUNT_MIN = 4
const COUNT_MAX = 30

/** Sama dengan estimateMinutes di @kira/core: 1,5 menit per soal, dibulatkan ke 5 menit. */
function estimateMinutes(count: number): number {
  return Math.max(5, Math.round((count * 1.5) / 5) * 5)
}

export function PlannerScreen({ data, actions }: PlannerScreenProps) {
  const toast = useToast()
  // Salinan lokal yang diganti setiap kali DTO baru datang dari server.
  const [src, setSrc] = useState(data)
  const [slots, setSlots] = useState(data.slots)
  const [restDays, setRestDays] = useState(() => new Set(data.days.filter((d) => d.rest).map((d) => d.date)))
  const [status, setStatus] = useState(data.status)
  const [sugState, setSugState] = useState<Record<string, 'open' | 'applied' | 'ignored'>>({})
  if (src !== data) {
    setSrc(data)
    setSlots(data.slots)
    setRestDays(new Set(data.days.filter((d) => d.rest).map((d) => d.date)))
    setStatus(data.status)
    setSugState({})
  }

  const [form, setForm] = useState<SlotForm | null>(null)
  const [formErrors, setFormErrors] = useState<{ skill?: string; count?: string; mode?: string }>({})
  const [moving, setMoving] = useState<PlanSlotDTO | null>(null)
  const [moveTo, setMoveTo] = useState<string>('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PlanSlotDTO | null>(null)
  const [paperSlot, setPaperSlot] = useState<PlanSlotDTO | null>(null)
  const [restPending, setRestPending] = useState<string | null>(null)

  const upsert = useAction(actions.upsertSlot)
  const move = useAction(actions.moveSlot)
  const del = useAction(actions.deleteSlot)
  const rest = useAction(actions.setRestDay)
  const apply = useAction(actions.applySuggestions)
  const publish = useAction(actions.publishWeek)

  const days = useMemo(
    () =>
      data.days.map((d) => {
        const isRest = restDays.has(d.date)
        const total = isRest ? 0 : slots.filter((s) => s.date === d.date && s.kind !== 'rest').reduce((a, s) => a + s.minutes, 0)
        return { ...d, rest: isRest, totalMinutes: total, overLimit: !isRest && total > data.screenLimitMin }
      }),
    [data.days, data.screenLimitMin, restDays, slots],
  )
  const over = days.filter((d) => d.overLimit)
  const dayLabel = (date: string) => data.days.find((d) => d.date === date)?.label ?? date
  const skillTitle = (id: string | null) => data.skills.find((s) => s.id === id)?.title ?? ''

  /** Hari yang sudah lewat tidak berpengaruh lagi pada quest; server juga menolaknya. */
  function pastGuard(date: string): boolean {
    if (date >= jakartaDate()) return false
    toast({ tone: 'info', title: `${dayLabel(date)} sudah lewat.`, body: 'Rencana hanya bisa diubah untuk hari ini dan hari berikutnya.' })
    return true
  }

  function openAdd(date: string, subject: Subject) {
    if (pastGuard(date)) return
    setFormErrors({})
    upsert.reset()
    setForm({ date, subject, kind: 'quest', skillId: null, mode: 'latihan', questionCount: '10' })
  }
  function openEdit(slot: PlanSlotDTO) {
    if (slot.skillId === null) {
      // Slot paper: isinya diatur Penyusun paper.
      del.reset()
      setPaperSlot(slot)
      return
    }
    setFormErrors({})
    upsert.reset()
    setForm({
      slotId: slot.id,
      date: slot.date,
      subject: slot.subject,
      kind: slot.kind === 'bonus' ? 'bonus' : 'quest',
      skillId: slot.skillId,
      mode: slot.mode,
      questionCount: String(slot.questionCount),
    })
  }

  async function saveSlot() {
    if (!form) return
    const errs: { skill?: string; count?: string; mode?: string } = {}
    const count = Number(form.questionCount.trim())
    if (!form.skillId) errs.skill = 'Pilih satu skill untuk slot ini.'
    // Mode Kertas hanya untuk paper (dicetak lalu dinilai lewat Input LJK); slot skill selalu di tablet.
    if (form.mode === 'kertas') errs.mode = 'Mode Kertas hanya untuk paper dari Penyusun paper. Pilih Belajar, Latihan, atau Tes.'
    if (!form.questionCount.trim() || !Number.isInteger(count) || count < COUNT_MIN || count > COUNT_MAX) {
      errs.count = `Jumlah soal harus angka bulat ${COUNT_MIN} sampai ${COUNT_MAX}.${form.questionCount.trim() ? ` Isian sekarang: ${form.questionCount.trim()}.` : ''}`
    }
    setFormErrors(errs)
    if (errs.skill || errs.count || errs.mode || !form.skillId) return
    const r = await upsert.run({
      learnerId: data.learnerId,
      slotId: form.slotId,
      date: form.date,
      subject: form.subject,
      kind: form.kind,
      skillId: form.skillId,
      mode: form.mode,
      questionCount: count,
    })
    if (!r.ok) return
    const next: PlanSlotDTO = {
      id: form.slotId ?? `baru-${Date.now()}`,
      date: form.date,
      subject: form.subject,
      kind: form.kind,
      skillId: form.skillId,
      title: skillTitle(form.skillId),
      mode: form.mode,
      minutes: estimateMinutes(count),
      questionCount: count,
    }
    // Slot quest baru menggantikan slot quest lain di mapel dan hari yang sama (aturan server).
    setSlots((list) =>
      form.slotId
        ? list.map((s) => (s.id === form.slotId ? next : s))
        : [...list.filter((s) => !(next.kind === 'quest' && s.kind === 'quest' && s.date === next.date && s.subject === next.subject)), next],
    )
    toast({ tone: 'success', title: form.slotId ? 'Slot diperbarui.' : `${next.title} masuk ke ${dayLabel(form.date)}.` })
    setForm(null)
  }

  async function confirmMove() {
    if (!moving) return
    if (!moveTo) {
      setMoveError('Pilih hari tujuan dulu.')
      return
    }
    const r = await move.run({ slotId: moving.id, date: moveTo })
    if (!r.ok) return
    setSlots((list) => list.map((s) => (s.id === moving.id ? { ...s, date: moveTo } : s)))
    toast({ tone: 'success', title: `${moving.title} pindah ke ${dayLabel(moveTo)}.` })
    setMoving(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    const r = await del.run(deleting.id)
    if (!r.ok) return
    setSlots((list) => list.filter((s) => s.id !== deleting.id))
    toast({ tone: 'success', title: `${deleting.title} dihapus dari ${dayLabel(deleting.date)}.` })
    setDeleting(null)
    setForm(null)
    setPaperSlot(null)
  }

  async function toggleRest(date: string, makeRest: boolean) {
    if (pastGuard(date)) return
    setRestPending(date)
    const r = await rest.run({ learnerId: data.learnerId, date, rest: makeRest })
    setRestPending(null)
    if (!r.ok) {
      toast({ tone: 'error', title: `${dayLabel(date)} belum berubah.`, body: r.message, reference: r.reference })
      return
    }
    setRestDays((set) => {
      const n = new Set(set)
      if (makeRest) n.add(date)
      else n.delete(date)
      return n
    })
  }

  async function applyIds(ids: string[]) {
    const r = await apply.run({ learnerId: data.learnerId, weekStart: data.weekStart, ids })
    if (!r.ok) return
    const added: PlanSlotDTO[] = data.suggestions
      .filter((s) => ids.includes(s.id))
      .map((s) => ({
        id: `usulan-${s.id}`,
        date: s.date,
        subject: s.subject,
        kind: 'quest' as const,
        skillId: s.skillId,
        title: s.title,
        mode: 'latihan' as const,
        minutes: estimateMinutes(10),
        questionCount: 10,
      }))
    setSlots((list) => [...list.filter((x) => !added.some((a) => a.id === x.id)), ...added])
    setSugState((st) => ({ ...st, ...Object.fromEntries(ids.map((i) => [i, 'applied' as const])) }))
    toast({ tone: 'success', title: ids.length === 1 ? 'Usulan diterapkan.' : `${ids.length} usulan diterapkan.` })
  }

  async function doPublish() {
    const r = await publish.run({ learnerId: data.learnerId, weekStart: data.weekStart })
    if (!r.ok) return
    setStatus('published')
    toast({ tone: 'success', title: 'Rencana minggu ini sudah terbit.' })
  }

  const openSugs = data.suggestions.filter((s) => (sugState[s.id] ?? 'open') === 'open')
  const formSkills = form ? data.skills.filter((s) => s.subject === form.subject) : []
  const today = moving ? jakartaDate() : ''
  const moveOptions = moving
    ? days.map((d) => ({
        value: d.date,
        label: d.label,
        disabled: d.rest || d.date === moving.date || d.date < today,
        description:
          d.date === moving.date
            ? 'Posisi slot sekarang'
            : d.date < today
              ? 'Sudah lewat'
              : d.rest
                ? 'Hari istirahat'
                : `${d.totalMinutes} mnt terisi, jadi ${d.totalMinutes + moving.minutes} mnt${d.totalMinutes + moving.minutes > data.screenLimitMin ? `, lewat batas ${data.screenLimitMin}` : ''}`,
      }))
    : []

  return (
    <ConsoleShell shell={data.shell} active="plan">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Rencana minggu</h1>
            <span role="status">
              {status === 'published' ? (
                <Pill tone="success">
                  <ConsoleIcon name="check" size={14} strokeWidth={3} />
                  Terbit
                </Pill>
              ) : (
                <Pill>Draf</Pill>
              )}
            </span>
          </div>
          <p className="m-0 text-body text-fg-muted">
            {data.weekLabel}. Batas waktu layar dari orang tua {data.screenLimitMin} menit sehari.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Pilih minggu" className="flex gap-2">
            <ButtonLink href={data.prevWeekHref} variant="secondary" icon="chevronLeft" aria-label="Minggu sebelumnya" className="w-11 px-0">
              <span className="visually-hidden">Minggu sebelumnya</span>
            </ButtonLink>
            <ButtonLink href={data.nextWeekHref} variant="secondary" icon="chevronRight" aria-label="Minggu berikutnya" className="w-11 px-0">
              <span className="visually-hidden">Minggu berikutnya</span>
            </ButtonLink>
          </nav>
          <Button variant="primary" onClick={doPublish} loading={publish.pending} disabled={status === 'published'}>
            {status === 'published' ? 'Sudah terbit' : 'Terbitkan'}
          </Button>
        </div>
      </header>

      <ActionError error={publish.error} />

      {over.length > 0 ? (
        <InlineAlert
          tone="warn"
          live="status"
          title={over.map((d) => `${d.label} ${d.totalMinutes} menit`).join(', ') + `, lebih dari batas ${data.screenLimitMin} menit dari orang tua.`}
          action={
            data.suggestions.length > 0 ? (
              <Link href="#usulan" className="font-bold">
                Lihat usulan
              </Link>
            ) : undefined
          }
        >
          {status === 'published'
            ? 'Quest di tablet berhenti saat batas tercapai. Kurangi jumlah soal atau pindahkan slot ke hari lain.'
            : 'Rencana tetap bisa diterbitkan, tapi quest di tablet berhenti saat batas tercapai.'}
        </InlineAlert>
      ) : null}

      {status === 'published' ? (
        <InlineAlert tone="success" title="Rencana minggu ini sudah terbit." live="status">
          Tablet memakai rencana ini untuk hari yang quest-nya belum dibuat. Perubahan berikutnya tetap terbit dan berlaku mulai hari yang belum dimulai.
        </InlineAlert>
      ) : null}

      <section aria-label="Jadwal minggu ini">
        <WeekPlannerGrid
          days={days}
          slots={slots}
          screenLimitMin={data.screenLimitMin}
          onAdd={openAdd}
          onEdit={openEdit}
          onMove={(s) => {
            move.reset()
            setMoving(s)
            setMoveTo('')
            setMoveError(null)
          }}
          onToggleRest={toggleRest}
          restPending={restPending}
        />
      </section>

      <Section labelledBy="usulan-title">
        <span id="usulan" />
        <SectionHeading
          id="usulan-title"
          aside={
            openSugs.length > 1 ? (
              <Button variant="secondary" onClick={() => applyIds(openSugs.map((s) => s.id))} loading={apply.pending}>
                Terapkan semua usulan
              </Button>
            ) : null
          }
        >
          Usulan dari data penguasaan
        </SectionHeading>
        <ActionError error={apply.error} />
        {data.suggestions.length === 0 ? (
          <EmptyState
            compact
            icon="checkCircle"
            title="Tidak ada usulan untuk minggu ini."
            body="Usulan hanya mengisi hari yang masih kosong dan belum lewat: skill di bawah 70%, review yang seminggu tidak dilatih, skill baru berikutnya, dan persiapan lomba."
          />
        ) : (
          <ul className="m-0 list-none overflow-hidden rounded-card border border-divider bg-surface p-0">
            {data.suggestions.map((s) => {
              const st = sugState[s.id] ?? 'open'
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-divider px-5 py-4 last:border-b-0 max-sm:px-4">
                  <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <SubjectChip subject={s.subject} withIcon={false} size="sm" />
                      <span className="text-body font-bold">
                        {s.title}, {dayLabel(s.date)}
                      </span>
                    </span>
                    <span className="text-body text-fg-muted">{s.reason}</span>
                  </div>
                  {st === 'open' ? (
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => applyIds([s.id])} disabled={apply.pending}>
                        Terapkan
                      </Button>
                      <Button variant="quiet" onClick={() => setSugState((x) => ({ ...x, [s.id]: 'ignored' }))}>
                        Abaikan
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span role="status" className={cx('inline-flex items-center gap-1.5 text-body font-bold', st === 'applied' ? 'text-success' : 'text-fg-muted')}>
                        <ConsoleIcon name={st === 'applied' ? 'checkCircle' : 'x'} size={18} strokeWidth={2.5} />
                        {st === 'applied' ? `Diterapkan ke ${dayLabel(s.date)}` : 'Diabaikan'}
                      </span>
                      {st === 'ignored' ? (
                        <Button variant="quiet" onClick={() => setSugState((x) => ({ ...x, [s.id]: 'open' }))}>
                          Batalkan
                        </Button>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* Tambah atau ubah slot */}
      <Dialog
        open={form != null}
        onClose={() => setForm(null)}
        dismissible={!upsert.pending}
        size="lg"
        title={form?.slotId ? 'Ubah slot' : 'Tambah slot'}
        description={form ? `${SUBJECT_LABEL[form.subject]}, ${dayLabel(form.date)}` : undefined}
        footer={
          form ? (
            <>
              {form.slotId ? (
                <Button
                  variant="quiet"
                  icon="trash"
                  tone="danger"
                  className="mr-auto"
                  onClick={() => {
                    const s = slots.find((x) => x.id === form.slotId)
                    if (s) {
                      del.reset()
                      setDeleting(s)
                    }
                  }}
                >
                  Hapus slot
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setForm(null)} disabled={upsert.pending}>
                Batal
              </Button>
              <Button variant="primary" onClick={saveSlot} loading={upsert.pending}>
                {form.slotId ? 'Simpan perubahan' : 'Tambah ke rencana'}
              </Button>
            </>
          ) : null
        }
      >
        {form ? (
          <form method="post"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              void saveSlot()
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <RadioGroup
                name="mapel"
                legend="Mapel"
                value={form.subject}
                onChange={(v) => setForm({ ...form, subject: v, skillId: v === form.subject ? form.skillId : null })}
                options={SUBJECTS.map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))}
                layout="row"
              />
              <RadioGroup
                name="jenis"
                legend="Jenis"
                value={form.kind}
                onChange={(v) => setForm({ ...form, kind: v })}
                options={[
                  { value: 'quest', label: 'Quest wajib' },
                  { value: 'bonus', label: 'Quest bonus', description: 'Opsional, tidak dihitung streak' },
                ]}
              />
            </div>
            <SkillPicker
              skills={formSkills}
              value={form.skillId}
              onChange={(id) => {
                setForm({ ...form, skillId: id })
                setFormErrors((e) => ({ ...e, skill: undefined }))
              }}
              error={formErrors.skill}
              legend={`Skill ${SUBJECT_LABEL[form.subject]}`}
            />
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
              <RadioGroup
                name="mode"
                legend="Mode"
                value={form.mode}
                onChange={(v) => {
                  setForm({ ...form, mode: v })
                  setFormErrors((x) => ({ ...x, mode: undefined }))
                }}
                options={(['belajar', 'latihan', 'tes'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
                layout="row"
                hint="Tes tidak menampilkan kunci sebelum dikumpulkan. Paper untuk dikerjakan di kertas disusun di Penyusun paper."
                error={formErrors.mode}
              />
              <TextField
                label="Jumlah soal"
                inputMode="numeric"
                autoComplete="off"
                value={form.questionCount}
                onChange={(e) => {
                  setForm({ ...form, questionCount: e.target.value })
                  setFormErrors((x) => ({ ...x, count: undefined }))
                }}
                error={formErrors.count}
                hint={
                  Number(form.questionCount) > 0
                    ? `Sekitar ${estimateMinutes(Number(form.questionCount))} menit`
                    : `${COUNT_MIN} sampai ${COUNT_MAX} soal`
                }
              />
            </div>
            <ActionError error={upsert.error} />
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          </form>
        ) : null}
      </Dialog>

      {/* Pindah slot */}
      <Dialog
        open={moving != null}
        onClose={() => setMoving(null)}
        dismissible={!move.pending}
        title={moving ? `Pindah ${moving.title}` : 'Pindah slot'}
        description={moving ? `${SUBJECT_LABEL[moving.subject]}, sekarang di ${dayLabel(moving.date)}. Pilih hari tujuan.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoving(null)} disabled={move.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={confirmMove} loading={move.pending}>
              {moveTo ? `Pindahkan ke ${dayLabel(moveTo)}` : 'Pindahkan'}
            </Button>
          </>
        }
      >
        {moving ? (
          <div className="flex flex-col gap-4">
            <RadioGroup
              name="pindah-ke"
              legend="Hari tujuan"
              hideLegend
              value={moveTo}
              onChange={(v) => {
                setMoveTo(v)
                setMoveError(null)
              }}
              options={moveOptions}
              layout="tiles"
              error={moveError}
            />
            <ActionError error={move.error} />
          </div>
        ) : null}
      </Dialog>

      {/* Slot paper dari Penyusun paper: pindah atau hapus */}
      <Dialog
        open={paperSlot != null}
        onClose={() => setPaperSlot(null)}
        title={paperSlot?.title ?? 'Slot paper'}
        description={paperSlot ? `${SUBJECT_LABEL[paperSlot.subject]}, ${dayLabel(paperSlot.date)}` : undefined}
        footer={
          paperSlot ? (
            <>
              <Button
                variant="quiet"
                icon="trash"
                tone="danger"
                className="mr-auto"
                onClick={() => {
                  del.reset()
                  setDeleting(paperSlot)
                }}
              >
                Hapus slot
              </Button>
              <Button
                variant="secondary"
                icon="move"
                onClick={() => {
                  const s = paperSlot
                  setPaperSlot(null)
                  move.reset()
                  setMoveTo('')
                  setMoveError(null)
                  setMoving(s)
                }}
              >
                Pindah
              </Button>
              <Button variant="primary" onClick={() => setPaperSlot(null)}>
                Tutup
              </Button>
            </>
          ) : null
        }
      >
        {paperSlot ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-body">
              Paper {paperSlot.questionCount} soal, sekitar {paperSlot.minutes} menit, mode {MODE_LABEL[paperSlot.mode]}
              {paperSlot.kind === 'bonus' ? ', sebagai quest bonus' : ''}.
            </p>
            <InlineAlert tone="info" live="none">
              Soal dan waktu paper diubah di{' '}
              <Link href={CONSOLE_ROUTES.paper} className="font-bold">
                Penyusun paper
              </Link>
              . Di rencana, slot paper bisa dipindah ke hari lain atau dihapus.
            </InlineAlert>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Hapus ${deleting.title} dari ${dayLabel(deleting.date)}?` : 'Hapus slot?'}
        body="Slot ini hilang dari rencana. Jawaban yang sudah dikerjakan tetap tersimpan di riwayat."
        confirmLabel="Hapus slot"
        onConfirm={confirmDelete}
        error={del.error ? <ActionError error={del.error} /> : null}
      />
    </ConsoleShell>
  )
}
