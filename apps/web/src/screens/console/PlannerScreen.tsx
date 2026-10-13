'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { sessionMinutes, type SessionType } from '@kira/core'
import { addDays, jakartaDate } from '@kira/core/time'
import type { DayTemplateId, PlanSlotConfig, PlanSlotDTO, PlannerActions, PlannerDTO, PlannerDay, Subject, UpsertSlotInput } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog, Dialog } from '@/components/console/Dialog'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { RadioGroup, Select, TextField } from '@/components/console/Field'
import { SUBJECT_LABEL, SUBJECTS } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill, Section, SectionHeading, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { SkillPicker } from '@/components/console/SkillPicker'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'
import { MODE_LABEL, SESSION_LABEL, WeekPlannerGrid, slotChip } from '@/components/console/WeekPlannerGrid'

/**
 * T03 Perencana mingguan (papan Perencana, WeekPlannerGrid): grid 7 hari kali 3 mapel dengan sesi wajib
 * (Latihan, Tes, Paper) dan sesi opsional, template hari (Hari sekolah, Sabtu paper penuh, Hari ringan),
 * meteran batas waktu layar, salin minggu, dialog tambah dan ubah slot, pindah slot lewat pilihan hari
 * (tanpa seret), hari istirahat, usulan dengan alasan, dan terbitkan.
 * Perubahan yang berhasil langsung tampil di layar; data server menggantikannya saat halaman diperbarui.
 * Minggu yang sudah terbit tetap terbit saat diubah. Slot paper dari Penyusun paper hanya bisa dipindah atau dihapus.
 * Hari yang sudah lewat tidak bisa diubah.
 */

export type PlannerScreenProps = { data: PlannerDTO; actions: PlannerActions }

type SlotForm = {
  slotId?: string
  /** Dibuka dari sesi otomatis template: menyimpan membuat slot yang menggantikannya. */
  fromAuto: boolean
  date: string
  subject: Subject
  session: SessionType
  required: boolean
  skillId: string | null
  /** Tes tanpa skill sendiri memakai skill Latihan hari itu. */
  sameAsLatihan: boolean
  questionCount: string
  perQuestionSec: string
  paperKind: 'mini' | 'full'
  presetId: string
  task: NonNullable<PlanSlotConfig['task']>
}

type FormErrors = { skill?: string; count?: string; perQuestion?: string; preset?: string; session?: string }

/** Batas yang sama dengan server (normaliseSlot). */
const COUNT_MIN = 4
const COUNT_MAX = 30
const PER_MIN = 30
const PER_MAX = 180

const CORE_SESSIONS: SessionType[] = ['latihan', 'tes', 'paper']

const SESSION_OPTIONS: { value: SessionType; label: string }[] = [
  { value: 'latihan', label: 'Latihan: 10 soal mudah, tanpa waktu' },
  { value: 'tes', label: 'Tes: 8 soal sedang sampai sulit, dengan waktu' },
  { value: 'paper', label: 'Paper: gaya lomba, mini atau penuh, dengan waktu' },
  { value: 'lesson', label: 'Pelajaran: satu skill' },
  { value: 'simulation', label: 'Simulasi lomba: salah satu preset' },
  { value: 'esmo', label: 'Paket ESMO' },
  { value: 'review', label: 'Ulang kartu (Buku Koreksi)' },
  { value: 'quick-maths', label: 'Tantangan Hitung Cepat' },
  { value: 'knowledge', label: 'Kuis Pengetahuan' },
  { value: 'english-skill', label: 'Tugas English: listening, reading, writing, speaking' },
  { value: 'reading', label: 'Membaca: latihan bacaan English' },
]

const TASK_LABEL: Record<NonNullable<PlanSlotConfig['task']>, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' }

const TEMPLATE_OPTIONS: { value: DayTemplateId; label: string; description: string }[] = [
  { value: 'school', label: 'Hari sekolah', description: '9 sesi wajib: Latihan, Tes, dan Paper mini untuk tiap mapel.' },
  { value: 'saturday', label: 'Sabtu paper penuh', description: '9 sesi wajib. Satu mapel bergiliran mengerjakan paper penuh dengan waktu asli lomba, dua mapel lain paper mini.' },
  { value: 'light', label: 'Hari ringan', description: 'Hanya satu Latihan per mapel (3 sesi wajib). Untuk hari sakit atau hari sekolah yang berat; streak tetap terjaga.' },
]

function emptyForm(date: string, subject: Subject): SlotForm {
  return {
    fromAuto: false,
    date,
    subject,
    session: 'latihan',
    required: false,
    skillId: null,
    sameAsLatihan: true,
    questionCount: '10',
    perQuestionSec: '75',
    paperKind: 'mini',
    presetId: '',
    task: 'listening',
  }
}

function defaultCount(session: SessionType): string {
  return session === 'tes' ? '8' : '10'
}

export function PlannerScreen({ data, actions }: PlannerScreenProps) {
  const toast = useToast()
  // Salinan lokal yang diganti setiap kali DTO baru datang dari server.
  const [src, setSrc] = useState(data)
  const [slots, setSlots] = useState(data.slots)
  const [restDays, setRestDays] = useState(() => new Set(data.days.filter((d) => d.rest).map((d) => d.date)))
  const [templates, setTemplates] = useState<Record<string, DayTemplateId>>(() => Object.fromEntries(data.days.map((d) => [d.date, d.template])))
  const [status, setStatus] = useState(data.status)
  const [sugState, setSugState] = useState<Record<string, 'open' | 'applied' | 'ignored'>>({})
  if (src !== data) {
    setSrc(data)
    setSlots(data.slots)
    setRestDays(new Set(data.days.filter((d) => d.rest).map((d) => d.date)))
    setTemplates(Object.fromEntries(data.days.map((d) => [d.date, d.template])))
    setStatus(data.status)
    setSugState({})
  }

  const [form, setForm] = useState<SlotForm | null>(null)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [moving, setMoving] = useState<PlanSlotDTO | null>(null)
  const [moveTo, setMoveTo] = useState<string>('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PlanSlotDTO | null>(null)
  const [paperSlot, setPaperSlot] = useState<PlanSlotDTO | null>(null)
  const [restPending, setRestPending] = useState<string | null>(null)
  const [templateDay, setTemplateDay] = useState<PlannerDay | null>(null)
  const [templatePick, setTemplatePick] = useState<DayTemplateId>('school')
  const [copying, setCopying] = useState(false)

  const upsert = useAction(actions.upsertSlot)
  const move = useAction(actions.moveSlot)
  const del = useAction(actions.deleteSlot)
  const rest = useAction(actions.setRestDay)
  const apply = useAction(actions.applySuggestions)
  const publish = useAction(actions.publishWeek)
  const setTemplate = useAction(actions.setDayTemplate)
  const copy = useAction(actions.copyWeek)

  const days = useMemo(
    () =>
      data.days.map((d) => {
        const isRest = restDays.has(d.date)
        const mine = isRest ? [] : slots.filter((s) => s.date === d.date && s.kind !== 'rest')
        const total = mine.reduce((a, s) => a + s.minutes, 0)
        const template = templates[d.date] ?? d.template
        const opt = TEMPLATE_OPTIONS.find((t) => t.value === template)
        return {
          ...d,
          rest: isRest,
          template,
          templateLabel: opt?.label ?? d.templateLabel,
          totalMinutes: total,
          requiredMinutes: mine.filter((s) => s.required).reduce((a, s) => a + s.minutes, 0),
          requiredCount: mine.filter((s) => s.required).length,
          extraCount: mine.filter((s) => !s.required).length,
          overLimit: !isRest && total > data.screenLimitMin,
        }
      }),
    [data.days, data.screenLimitMin, restDays, slots, templates],
  )
  const over = days.filter((d) => d.overLimit)
  const dayLabel = (date: string) => data.days.find((d) => d.date === date)?.label ?? date
  const skillTitle = (id: string | null) => data.skills.find((s) => s.id === id)?.title ?? ''

  /** Hari yang sudah lewat tidak berpengaruh lagi pada sesi; server juga menolaknya. */
  function pastGuard(date: string): boolean {
    if (date >= jakartaDate()) return false
    toast({ tone: 'info', title: `${dayLabel(date)} sudah lewat.`, body: 'Rencana hanya bisa diubah untuk hari ini dan hari berikutnya.' })
    return true
  }

  function openAdd(date: string, subject: Subject) {
    if (pastGuard(date)) return
    setFormErrors({})
    upsert.reset()
    setForm(emptyForm(date, subject))
  }

  function openEdit(slot: PlanSlotDTO) {
    if (slot.fromPaper || slot.mode === 'kertas') {
      // Slot paper: isinya diatur Penyusun paper.
      del.reset()
      setPaperSlot(slot)
      return
    }
    if (pastGuard(slot.date)) return
    setFormErrors({})
    upsert.reset()
    const cfg = slot.config
    setForm({
      ...emptyForm(slot.date, slot.subject),
      ...(slot.auto ? {} : { slotId: slot.id }),
      fromAuto: slot.auto,
      session: slot.session,
      required: slot.required,
      skillId: slot.skillId,
      sameAsLatihan: slot.session === 'tes' ? slot.skillId === null : true,
      questionCount: slot.auto ? defaultCount(slot.session) : String(slot.questionCount),
      perQuestionSec: String(cfg?.perQuestionSec ?? 75),
      paperKind: slot.paperKind ?? 'mini',
      presetId: cfg?.presetId ?? '',
      task: cfg?.task ?? 'listening',
    })
  }

  function setSession(session: SessionType) {
    if (!form) return
    const subject = session === 'quick-maths' ? 'math' : session === 'english-skill' || session === 'reading' ? 'english' : form.subject
    const required = CORE_SESSIONS.includes(session) ? form.required : false
    setForm({
      ...form,
      session,
      subject,
      required,
      skillId: subject === form.subject ? form.skillId : null,
      questionCount: defaultCount(session),
      sameAsLatihan: true,
    })
    setFormErrors({})
  }

  const needsSkill = form ? form.session === 'latihan' || form.session === 'reading' || form.session === 'lesson' || (form.session === 'tes' && !form.sameAsLatihan) : false
  const needsCount = form ? form.session === 'latihan' || form.session === 'tes' || form.session === 'reading' : false

  async function saveSlot() {
    if (!form) return
    const errs: FormErrors = {}
    const count = Number(form.questionCount.trim())
    const per = Number(form.perQuestionSec.trim())
    const skill = needsSkill ? form.skillId : null
    if (needsSkill && !form.skillId) errs.skill = 'Pilih satu skill untuk sesi ini.'
    if (needsCount && (!form.questionCount.trim() || !Number.isInteger(count) || count < COUNT_MIN || count > COUNT_MAX)) {
      errs.count = `Jumlah soal harus angka bulat ${COUNT_MIN} sampai ${COUNT_MAX}.${form.questionCount.trim() ? ` Isian sekarang: ${form.questionCount.trim()}.` : ''}`
    }
    if (form.session === 'tes' && (!Number.isInteger(per) || per < PER_MIN || per > PER_MAX)) errs.perQuestion = `Waktu per soal harus ${PER_MIN} sampai ${PER_MAX} detik.`
    if (form.session === 'simulation' && !form.presetId) errs.preset = 'Pilih satu simulasi lomba.'
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    const core = CORE_SESSIONS.includes(form.session)
    const config: PlanSlotConfig | null =
      form.session === 'simulation'
        ? { presetId: form.presetId }
        : form.session === 'english-skill'
          ? { task: form.task }
          : form.session === 'tes' && per !== 75
            ? { perQuestionSec: per }
            : null
    const input: UpsertSlotInput = {
      learnerId: data.learnerId,
      ...(form.slotId ? { slotId: form.slotId } : {}),
      date: form.date,
      subject: form.subject,
      session: form.session,
      required: core ? form.required : false,
      skillId: skill,
      mode: form.session === 'tes' ? 'tes' : 'latihan',
      questionCount: needsCount ? count : 10,
      paperKind: form.session === 'paper' ? form.paperKind : null,
      config,
    }
    const r = await upsert.run(input)
    if (!r.ok) return
    const presetMinutes = form.session === 'simulation' ? data.presets.find((p) => p.id === form.presetId)?.minutes : undefined
    const minutes = sessionMinutes({ session: form.session, questionCount: needsCount ? count : 10, paper: form.session === 'paper' ? form.paperKind : null, ...(presetMinutes ? { fixedMinutes: presetMinutes } : {}), ...(form.session === 'tes' ? { perQuestionSec: per } : {}) })
    const title =
      form.session === 'paper'
        ? form.paperKind === 'full'
          ? 'Paper penuh gaya lomba'
          : 'Paper mini gaya lomba'
        : form.session === 'simulation'
          ? (data.presets.find((p) => p.id === form.presetId)?.title ?? 'Simulasi lomba')
          : form.session === 'english-skill'
            ? `Tugas English: ${form.task}`
            : skill
              ? skillTitle(skill)
              : form.session === 'tes'
                ? 'Skill sama dengan Latihan'
                : SESSION_LABEL[form.session]
    const next: PlanSlotDTO = {
      id: form.slotId ?? `baru-${Date.now()}`,
      auto: false,
      fromPaper: false,
      date: form.date,
      subject: form.subject,
      kind: 'quest',
      session: form.session,
      required: input.required,
      paperKind: input.paperKind,
      skillId: skill,
      title,
      mode: input.mode,
      minutes,
      questionCount: input.questionCount,
      config,
    }
    setSlots((list) => {
      if (form.slotId) return list.map((s) => (s.id === form.slotId ? next : s))
      // Slot wajib menggantikan sesi dasar template yang sama.
      const idx = next.required ? list.findIndex((s) => s.auto && s.date === next.date && s.subject === next.subject && s.session === next.session) : -1
      return idx >= 0 ? list.map((s, i) => (i === idx ? next : s)) : [...list, next]
    })
    toast({ tone: 'success', title: form.slotId ? 'Sesi diperbarui.' : `${next.title} masuk ke ${dayLabel(form.date)}.` })
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
        auto: false,
        fromPaper: false,
        date: s.date,
        subject: s.subject,
        kind: 'quest' as const,
        session: 'latihan' as const,
        required: true,
        paperKind: null,
        skillId: s.skillId,
        title: s.title,
        mode: 'latihan' as const,
        minutes: sessionMinutes({ session: 'latihan', questionCount: 10 }),
        questionCount: 10,
        config: null,
      }))
    setSlots((list) => {
      const rest0 = list.filter((x) => !added.some((a) => a.id === x.id) && !added.some((a) => x.auto && x.date === a.date && x.subject === a.subject && x.session === 'latihan'))
      return [...rest0, ...added]
    })
    setSugState((st) => ({ ...st, ...Object.fromEntries(ids.map((i) => [i, 'applied' as const])) }))
    toast({ tone: 'success', title: ids.length === 1 ? 'Usulan diterapkan.' : `${ids.length} usulan diterapkan.` })
  }

  async function doPublish() {
    const r = await publish.run({ learnerId: data.learnerId, weekStart: data.weekStart })
    if (!r.ok) return
    setStatus('published')
    toast({ tone: 'success', title: 'Rencana minggu ini sudah terbit.' })
  }

  function openTemplate(date: string) {
    if (pastGuard(date)) return
    const d = days.find((x) => x.date === date)
    if (!d) return
    setTemplate.reset()
    setTemplatePick(d.template)
    setTemplateDay(d)
  }

  async function confirmTemplate() {
    if (!templateDay) return
    const r = await setTemplate.run({ learnerId: data.learnerId, date: templateDay.date, template: templatePick })
    if (!r.ok) return
    setTemplates((t) => ({ ...t, [templateDay.date]: templatePick }))
    toast({ tone: 'success', title: `${dayLabel(templateDay.date)} memakai ${TEMPLATE_OPTIONS.find((t) => t.value === templatePick)?.label}.` })
    setTemplateDay(null)
  }

  const prevWeek = addDays(data.weekStart, -7)
  async function confirmCopy() {
    const r = await copy.run({ learnerId: data.learnerId, fromWeekStart: prevWeek, toWeekStart: data.weekStart })
    if (!r.ok) return
    toast({
      tone: 'success',
      title: `${r.data.copied} sesi disalin dari minggu sebelumnya.`,
      ...(r.data.skipped > 0 ? { body: `${r.data.skipped} dilewati: hari yang sudah lewat, hari istirahat, atau paper kertas.` } : {}),
    })
    setCopying(false)
  }

  const openSugs = data.suggestions.filter((s) => (sugState[s.id] ?? 'open') === 'open')
  const formSkills = form
    ? data.skills.filter((s) => s.subject === form.subject && (form.session !== 'lesson' || s.hasLesson))
    : []
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
  const isCore = form ? CORE_SESSIONS.includes(form.session) : false
  const presetOptions = form ? data.presets.filter((p) => p.subject === form.subject) : []

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
          <Button
            variant="secondary"
            icon="copy"
            onClick={() => {
              copy.reset()
              setCopying(true)
            }}
          >
            Salin minggu lalu
          </Button>
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
            ? 'Sesi di tablet berhenti saat batas tercapai. Pakai template Hari ringan, kurangi sesi opsional, atau pindahkan sesi ke hari lain.'
            : 'Rencana tetap bisa diterbitkan, tapi sesi di tablet berhenti saat batas tercapai.'}
        </InlineAlert>
      ) : null}

      {status === 'published' ? (
        <InlineAlert tone="success" title="Rencana minggu ini sudah terbit." live="status">
          Tablet memakai rencana ini untuk hari yang sesinya belum dibuat. Perubahan berikutnya tetap terbit dan berlaku mulai hari yang belum dimulai. Sesi opsional bisa ditambah kapan saja.
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
          onTemplate={openTemplate}
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
            body="Usulan hanya mengisi Latihan di hari yang masih kosong dan belum lewat: skill di bawah 70%, review yang seminggu tidak dilatih, skill baru berikutnya, dan persiapan lomba. Tes hari itu memakai skill yang sama."
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
        title={form?.slotId ? 'Ubah sesi' : form?.fromAuto ? 'Atur sesi' : 'Tambah sesi'}
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
                  Hapus sesi
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
          <form
            method="post"
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
                onChange={(v) => setForm({ ...form, subject: v, skillId: v === form.subject ? form.skillId : null, presetId: '' })}
                options={SUBJECTS.map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))}
                layout="row"
              />
              {isCore ? (
                <RadioGroup
                  name="wajib"
                  legend="Wajib atau opsional"
                  value={form.required ? 'wajib' : 'opsional'}
                  onChange={(v) => setForm({ ...form, required: v === 'wajib' })}
                  options={[
                    { value: 'wajib', label: 'Sesi wajib', description: 'Dihitung untuk streak. Menggantikan sesi dasar template yang sama.' },
                    { value: 'opsional', label: 'Sesi opsional', description: 'Tambahan, tidak dihitung streak (paling banyak 10 per hari).' },
                  ]}
                />
              ) : (
                <p className="m-0 self-end text-small text-fg-muted">Sesi jenis ini selalu opsional dan tidak dihitung streak.</p>
              )}
            </div>
            <Select
              label="Jenis sesi"
              value={form.session}
              onChange={(e) => setSession(e.target.value as SessionType)}
              options={SESSION_OPTIONS}
              {...(formErrors.session ? { error: formErrors.session } : {})}
            />
            {form.session === 'tes' ? (
              <RadioGroup
                name="tes-skill"
                legend="Skill Tes"
                value={form.sameAsLatihan ? 'sama' : 'lain'}
                onChange={(v) => setForm({ ...form, sameAsLatihan: v === 'sama' })}
                options={[
                  { value: 'sama', label: 'Sama dengan Latihan hari itu', description: 'Soalnya lain dari soal Latihan.' },
                  { value: 'lain', label: 'Pilih skill sendiri' },
                ]}
              />
            ) : null}
            {needsSkill ? (
              <SkillPicker
                skills={formSkills}
                value={form.skillId}
                onChange={(id) => {
                  setForm({ ...form, skillId: id })
                  setFormErrors((e) => ({ ...e, skill: undefined }))
                }}
                error={formErrors.skill ?? null}
                legend={`Skill ${SUBJECT_LABEL[form.subject]}`}
              />
            ) : null}
            {needsCount ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Jumlah soal"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.questionCount}
                  onChange={(e) => {
                    setForm({ ...form, questionCount: e.target.value })
                    setFormErrors((x) => ({ ...x, count: undefined }))
                  }}
                  error={formErrors.count ?? null}
                  hint={
                    form.session === 'tes'
                      ? `Bawaan 8 soal. Waktu ${Math.round((Number(form.questionCount) * Number(form.perQuestionSec)) / 60) || 0} menit.`
                      : `Bawaan 10 soal, sekitar ${sessionMinutes({ session: form.session, questionCount: Number(form.questionCount) || 10 })} menit`
                  }
                />
                {form.session === 'tes' ? (
                  <TextField
                    label="Detik per soal"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.perQuestionSec}
                    onChange={(e) => {
                      setForm({ ...form, perQuestionSec: e.target.value })
                      setFormErrors((x) => ({ ...x, perQuestion: undefined }))
                    }}
                    error={formErrors.perQuestion ?? null}
                    hint={`Bawaan 75 detik. Antara ${PER_MIN} dan ${PER_MAX}.`}
                  />
                ) : null}
              </div>
            ) : null}
            {form.session === 'paper' ? (
              <RadioGroup
                name="paper-jenis"
                legend="Jenis paper"
                value={form.paperKind}
                onChange={(v) => setForm({ ...form, paperKind: v })}
                options={[
                  { value: 'mini', label: 'Paper mini', description: '8 soal dalam 15 menit, dari paper gaya lomba.' },
                  { value: 'full', label: 'Paper penuh', description: 'Jumlah soal dan waktu asli lomba. Cocok untuk hari Sabtu.' },
                ]}
                hint="Paper cetak yang dinilai lewat Input LJK disusun di Penyusun paper."
              />
            ) : null}
            {form.session === 'simulation' ? (
              <Select
                label="Simulasi lomba"
                value={form.presetId}
                onChange={(e) => {
                  setForm({ ...form, presetId: e.target.value })
                  setFormErrors((x) => ({ ...x, preset: undefined }))
                }}
                options={[{ value: '', label: 'Pilih simulasi' }, ...presetOptions.map((p) => ({ value: p.id, label: p.title }))]}
                error={formErrors.preset ?? (presetOptions.length === 0 ? `Belum ada simulasi untuk ${SUBJECT_LABEL[form.subject]}.` : null)}
              />
            ) : null}
            {form.session === 'english-skill' ? (
              <RadioGroup
                name="tugas"
                legend="Jenis tugas"
                value={form.task}
                onChange={(v) => setForm({ ...form, task: v })}
                options={(['listening', 'reading', 'writing', 'speaking'] as const).map((t) => ({ value: t, label: TASK_LABEL[t] }))}
                layout="row"
              />
            ) : null}
            <ActionError error={upsert.error} />
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          </form>
        ) : null}
      </Dialog>

      {/* Template hari */}
      <Dialog
        open={templateDay != null}
        onClose={() => setTemplateDay(null)}
        dismissible={!setTemplate.pending}
        title="Template hari"
        description={templateDay ? `${templateDay.label}. Template menentukan sesi wajib dasar hari itu.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateDay(null)} disabled={setTemplate.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={confirmTemplate} loading={setTemplate.pending}>
              Pakai template
            </Button>
          </>
        }
      >
        {templateDay ? (
          <div className="flex flex-col gap-4">
            <RadioGroup name="template" legend="Template" hideLegend value={templatePick} onChange={setTemplatePick} options={TEMPLATE_OPTIONS} />
            {templateDay.date === jakartaDate() ? (
              <InlineAlert tone="info" live="none">
                Hari ini hanya bisa dijadikan Hari ringan bila sesi hari ini sudah dibuat di tablet. Tes dan Paper yang belum dikerjakan dibuang, dan rencana minggu ini harus sudah terbit.
              </InlineAlert>
            ) : null}
            <ActionError error={setTemplate.error} />
          </div>
        ) : null}
      </Dialog>

      {/* Salin minggu */}
      <ConfirmDialog
        open={copying}
        onClose={() => setCopying(false)}
        title="Salin rencana minggu lalu ke minggu ini?"
        body={`Sesi dan template hari dari minggu sebelumnya disalin ke ${data.weekLabel}. Sesi di minggu ini pada hari yang masih bisa diubah diganti. Hari yang sudah lewat, hari istirahat, dan paper kertas dilewati.`}
        confirmLabel="Salin"
        onConfirm={confirmCopy}
        error={copy.error ? <ActionError error={copy.error} /> : null}
      />

      {/* Pindah slot */}
      <Dialog
        open={moving != null}
        onClose={() => setMoving(null)}
        dismissible={!move.pending}
        title={moving ? `Pindah ${moving.title}` : 'Pindah sesi'}
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
                Hapus sesi
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
              {slotChip(paperSlot)} {paperSlot.questionCount} soal, sekitar {paperSlot.minutes} menit, mode {MODE_LABEL[paperSlot.mode]}
              {paperSlot.required ? ', sesi wajib' : ', sesi opsional'}.
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
        title={deleting ? `Hapus ${deleting.title} dari ${dayLabel(deleting.date)}?` : 'Hapus sesi?'}
        body="Sesi ini hilang dari rencana. Jawaban yang sudah dikerjakan tetap tersimpan di riwayat."
        confirmLabel="Hapus sesi"
        onConfirm={confirmDelete}
        error={del.error ? <ActionError error={del.error} /> : null}
      />
    </ConsoleShell>
  )
}
