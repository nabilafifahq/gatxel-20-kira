'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { jakartaDate } from '@kira/core/time'
import type { PaperBuilderActions, PaperBuilderDTO, PaperDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink, IconButton } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog, Dialog } from '@/components/console/Dialog'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { Checkbox, RadioGroup, Select, TextField } from '@/components/console/Field'
import { FilterChips } from '@/components/console/FilterChips'
import { dateId, SUBJECT_BG, SUBJECT_BORDER, SUBJECT_LABEL, SUBJECT_TEXT, SUBJECTS } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill } from '@/components/console/Layout'
import { CONSOLE_ROUTES, PRINT_ROUTES } from '@/components/console/routes'
import { SOURCE_LABEL, TYPE_LABEL } from '@/components/console/labels'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T04 Penyusun paper (papan PenyusunPaper): pilih soal dari bank dengan filter,
 * daftar berurutan dengan tombol naik, turun, dan hapus, pratinjau kertas, tautan
 * cetak paper dan kunci, serta memberikan paper ke learner.
 * Kolam soal dikirim per mapel dan grade: mengganti mapel atau grade memuat kolam baru lewat
 * parameter URL `mapel` dan `grade`. Paper tersimpan dibuka lewat `paper`.
 */

export type PaperBuilderScreenProps = {
  data: PaperBuilderDTO
  actions: PaperBuilderActions
}

type PoolItem = PaperBuilderDTO['items'][number]

const MODE_LABEL: Record<PaperDTO['mode'], string> = { latihan: 'Latihan', tes: 'Tes', kertas: 'Kertas' }

function secondsLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} detik`
  return s ? `${m} menit ${s} detik` : `${m} menit`
}

export function PaperBuilderScreen({ data, actions }: PaperBuilderScreenProps) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [poolPending, startPool] = useTransition()
  const paper = data.paper
  const [paperId, setPaperId] = useState<string | null>(paper?.id ?? null)
  const [title, setTitle] = useState(paper?.title ?? '')
  const [subject, setSubject] = useState<Subject>(data.items[0]?.subject ?? paper?.subject ?? 'math')
  const [grade, setGrade] = useState(String(data.items[0]?.grade ?? paper?.grade ?? 2))
  const [minutes, setMinutes] = useState(String(paper?.minutes ?? 15))
  const [mode, setMode] = useState<PaperDTO['mode']>(paper?.mode ?? 'kertas')
  const [refs, setRefs] = useState<string[]>(paper?.itemRefs ?? data.draftRefs ?? [])
  const [dirty, setDirty] = useState(!paper && Boolean(data.draftRefs?.length))
  const [errors, setErrors] = useState<{ title?: string; minutes?: string; items?: string }>({})

  // Soal yang pernah dimuat (kolam mapel atau grade lain, hasil isi otomatis) tetap dikenal,
  // supaya daftar Isi paper tetap lengkap setelah kolam berganti.
  const [known, setKnown] = useState(() => new Map(data.items.map((i) => [i.ref, i])))
  const [knownSrc, setKnownSrc] = useState(data.items)
  if (knownSrc !== data.items) {
    setKnownSrc(data.items)
    setKnown((m) => {
      const n = new Map(m)
      for (const i of data.items) n.set(i.ref, i)
      return n
    })
  }

  // Paper lain dibuka dari daftar Paper tersimpan (?paper= berganti): isi formulir mengikuti paper itu.
  const [srcPaperId, setSrcPaperId] = useState(paper?.id ?? null)
  if ((paper?.id ?? null) !== srcPaperId) {
    setSrcPaperId(paper?.id ?? null)
    if (paper && paper.id !== paperId) {
      setPaperId(paper.id)
      setTitle(paper.title)
      setSubject(paper.subject)
      setGrade(String(paper.grade))
      setMinutes(String(paper.minutes))
      setMode(paper.mode)
      setRefs(paper.itemRefs)
      setDirty(false)
      setErrors({})
    }
  }

  // Filter bank soal
  const [skill, setSkill] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')

  const [autoOpen, setAutoOpen] = useState(false)
  const [autoSkills, setAutoSkills] = useState<string[]>([])
  const [autoCount, setAutoCount] = useState('10')
  const [autoMin, setAutoMin] = useState('1')
  const [autoMax, setAutoMax] = useState('4')
  const [autoError, setAutoError] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignLearner, setAssignLearner] = useState(data.shell.currentLearnerId ?? data.shell.learners[0]?.id ?? '')
  const [assignDate, setAssignDate] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useAction(actions.savePaper)
  const generate = useAction(actions.generatePaper)
  const assign = useAction(actions.assignPaper)
  const remove = useAction(actions.deletePaper)

  const byRef = known
  const subjectItems = data.items.filter((i) => i.subject === subject && String(i.grade) === grade)

  /** Muat kolam soal mapel dan grade lain dari server; isi formulir tetap. */
  function loadPool(nextSubject: Subject, nextGrade: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('mapel', nextSubject)
    p.set('grade', nextGrade)
    p.delete('tambah')
    if (paperId) p.set('paper', paperId)
    startPool(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }))
  }

  /** Alamat halaman ikut paper yang sedang dibuka, tanpa memuat ulang data. */
  function syncPaperParam(id: string | null) {
    const p = new URLSearchParams(window.location.search)
    if (id) p.set('paper', id)
    else p.delete('paper')
    p.delete('tambah')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }
  const skills = Array.from(new Map(subjectItems.map((i) => [i.skillId, i.skillTitle])).entries()).sort((a, b) => a[1].localeCompare(b[1]))
  const types = Array.from(new Set(subjectItems.map((i) => i.type)))
  const pool = subjectItems.filter(
    (i) =>
      (!skill || i.skillId === skill) &&
      (!type || i.type === type) &&
      (!q.trim() || i.promptPreview.toLowerCase().includes(q.trim().toLowerCase()) || i.ref.toLowerCase().includes(q.trim().toLowerCase())),
  )
  const chips = [
    ...(skill ? [{ key: 'skill', label: `Skill: ${skills.find((s) => s[0] === skill)?.[1] ?? skill}`, onRemove: () => setSkill('') }] : []),
    ...(type ? [{ key: 'type', label: `Tipe: ${TYPE_LABEL[type] ?? type}`, onRemove: () => setType('') }] : []),
    ...(q.trim() ? [{ key: 'q', label: `Cari: ${q.trim()}`, onRemove: () => setQ('') }] : []),
  ]

  const chosen = refs.map((r) => byRef.get(r)).filter((x): x is PoolItem => Boolean(x))
  const totalSec = chosen.reduce((a, i) => a + i.preview.expectedSeconds, 0)
  const avgDiff = chosen.length ? chosen.reduce((a, i) => a + i.difficulty, 0) / chosen.length : 0
  const limitSec = Number(minutes) * 60
  const fits = chosen.length > 0 && (!Number.isFinite(limitSec) || limitSec <= 0 || totalSec <= limitSec)

  function change(fn: () => void) {
    fn()
    setDirty(true)
  }
  function moveRef(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= refs.length) return
    change(() =>
      setRefs((a) => {
        const n = a.slice()
        const t = n[i]!
        n[i] = n[j]!
        n[j] = t
        return n
      }),
    )
  }

  async function doSave() {
    const e: typeof errors = {}
    const m = Number(minutes)
    if (!title.trim()) e.title = 'Isi judul paper dulu.'
    if (!Number.isInteger(m) || m < 5 || m > 120) e.minutes = `Waktu harus 5 sampai 120 menit.${minutes.trim() ? ` Isian sekarang: ${minutes.trim()}.` : ''}`
    if (refs.length === 0) e.items = 'Paper belum berisi soal. Tambahkan paling sedikit satu soal dari bank soal.'
    setErrors(e)
    if (e.title || e.minutes || e.items) return
    const r = await save.run({ paperId: paperId ?? undefined, title: title.trim(), subject, grade: Number(grade), minutes: m, mode, itemRefs: refs })
    if (r.ok) {
      if (r.data.paperId !== paperId) syncPaperParam(r.data.paperId)
      setPaperId(r.data.paperId)
      setDirty(false)
      toast({ tone: 'success', title: 'Paper tersimpan.', body: 'Tautan cetak paper dan kunci sudah bisa dipakai.' })
    }
  }

  async function doGenerate() {
    const count = Number(autoCount)
    const lo = Number(autoMin)
    const hi = Number(autoMax)
    if (!Number.isInteger(count) || count < 1 || count > 60) {
      setAutoError(`Jumlah soal harus 1 sampai 60. Isian sekarang: ${autoCount || 'kosong'}.`)
      return
    }
    if (lo > hi) {
      setAutoError(`Kesulitan terendah (${lo}) lebih besar dari tertinggi (${hi}). Tukar keduanya.`)
      return
    }
    setAutoError(null)
    const r = await generate.run({ subject, grade: Number(grade), skillIds: autoSkills, count, difficulty: [lo, hi] })
    if (r.ok) {
      const picked = r.data.items ?? []
      if (picked.length) {
        setKnown((m) => {
          const n = new Map(m)
          for (const i of picked) n.set(i.ref, i)
          return n
        })
      }
      change(() => setRefs(r.data.itemRefs))
      setAutoOpen(false)
      const got = r.data.itemRefs.length
      toast(
        got < count
          ? { tone: 'success', title: `${got} dari ${count} soal dipilih otomatis.`, body: `Soal yang cocok di bank hanya ${got}. Periksa urutannya, lalu simpan paper.` }
          : { tone: 'success', title: `${got} soal dipilih otomatis.`, body: 'Periksa urutannya, lalu simpan paper.' },
      )
    }
  }

  async function doAssign() {
    if (!paperId) return
    if (!assignDate) {
      setAssignError('Pilih tanggal paper dikerjakan.')
      return
    }
    setAssignError(null)
    const r = await assign.run({ paperId, learnerId: assignLearner, date: assignDate })
    if (r.ok) {
      setAssignOpen(false)
      const who = data.shell.learners.find((l) => l.id === assignLearner)?.name ?? 'learner'
      toast({
        tone: 'success',
        title: `Paper masuk rencana ${who}, ${dateId(assignDate, true)}.`,
        body: mode === 'kertas' ? 'Lembar jawaban (LJK) siap dicetak di Input LJK.' : 'Paper ini menjadi sesi Paper hari itu di tablet bila rencana minggu itu sudah terbit.',
      })
    }
  }

  async function doDelete() {
    if (!paperId) return
    const r = await remove.run(paperId)
    if (r.ok) {
      syncPaperParam(null)
      setConfirmDelete(false)
      setPaperId(null)
      setRefs([])
      setTitle('')
      toast({ tone: 'success', title: 'Paper dihapus.' })
    }
  }

  const code = paperId ? (paper?.id === paperId ? paper.code : data.papers.find((p) => p.id === paperId)?.code ?? 'Paper baru') : null

  return (
    <ConsoleShell shell={data.shell} active="paper">
      <nav aria-label="Jejak" className="-mb-4 flex flex-wrap items-center gap-2 text-small text-fg-muted">
        <Link href={CONSOLE_ROUTES.bank} className="font-semibold">
          Bank soal
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Susun paper</span>
      </nav>

      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-h1 font-bold max-sm:text-h2">{code ? `Susun paper ${code}` : 'Paper baru'}</h1>
            <span role="status">{dirty || !paperId ? <Pill>Draf, belum disimpan</Pill> : <Pill tone="success">Tersimpan</Pill>}</span>
          </div>
          <p className="m-0 text-body text-fg-muted">
            {SUBJECT_LABEL[subject]}, Grade {grade}. Mode {MODE_LABEL[mode]}, {minutes || '?'} menit.
            {paper?.presetId ? ` Preset ${data.presets.find((p) => p.id === paper.presetId)?.title ?? paper.presetId}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {paperId ? (
            <Button variant="quiet" icon="trash" tone="danger" onClick={() => setConfirmDelete(true)}>
              Hapus paper
            </Button>
          ) : null}
          <Button variant="secondary" disabled={!paperId || dirty} onClick={() => setAssignOpen(true)} aria-describedby={!paperId || dirty ? 'perlu-simpan' : undefined}>
            Masukkan ke rencana
          </Button>
          <Button variant="primary" onClick={doSave} loading={save.pending}>
            Simpan paper
          </Button>
        </div>
      </header>
      {!paperId || dirty ? (
        <p id="perlu-simpan" className="-mt-5 mb-0 text-small text-fg-muted">
          Simpan paper dulu sebelum dicetak atau dimasukkan ke rencana.
        </p>
      ) : null}
      <ActionError error={save.error} />

      <div className="flex flex-wrap items-start gap-6">
        {/* Bank soal */}
        <section aria-labelledby="pilih-soal" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-card border border-divider bg-surface p-5 max-sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pilih-soal" className="m-0 mr-auto text-h3 font-bold">
              Pilih dari bank soal
            </h2>
            <Button variant="secondary" size="S" icon="wand" onClick={() => setAutoOpen(true)}>
              Isi otomatis
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RadioGroup
              name="mapel-paper"
              legend="Mapel"
              value={subject}
              onChange={(v) =>
                change(() => {
                  setSubject(v)
                  setSkill('')
                  setType('')
                  loadPool(v, grade)
                })
              }
              options={SUBJECTS.map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))}
              layout="row"
              className="sm:col-span-2"
            />
            <Select
              label="Grade"
              value={grade}
              onChange={(e) => {
                const g = e.target.value
                change(() => {
                  setGrade(g)
                  setSkill('')
                  loadPool(subject, g)
                })
              }}
              options={[1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
            />
            <Select
              label={skill ? 'Skill (1)' : 'Skill'}
              value={skill}
              active={Boolean(skill)}
              onChange={(e) => setSkill(e.target.value)}
              options={[{ value: '', label: 'Semua skill' }, ...skills.map(([id, t]) => ({ value: id, label: t }))]}
            />
            <Select
              label={type ? 'Tipe (1)' : 'Tipe'}
              value={type}
              active={Boolean(type)}
              onChange={(e) => setType(e.target.value)}
              options={[{ value: '', label: 'Semua tipe' }, ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))]}
            />
            <TextField label="Cari" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Teks soal atau ID" autoComplete="off" />
          </div>
          <div className="flex flex-wrap items-center gap-3" aria-busy={poolPending || undefined}>
            <FilterChips resultText={`${pool.length} soal cocok`} chips={chips} onClearAll={() => (setSkill(''), setType(''), setQ(''))} />
            {poolPending ? <span className="text-small text-fg-muted">Memuat soal {SUBJECT_LABEL[subject]} Grade {grade}</span> : null}
          </div>
          {poolPending && subjectItems.length === 0 ? (
            <p className="m-0 rounded-control bg-bg px-3 py-2.5 text-body text-fg-muted">
              Memuat soal {SUBJECT_LABEL[subject]} Grade {grade} dari bank.
            </p>
          ) : subjectItems.length === 0 ? (
            <EmptyState
              compact
              title={`Belum ada soal ${SUBJECT_LABEL[subject]} Grade ${grade} di bank.`}
              body="Impor paket resmi atau minta draf di Studio AI. Soal baru masuk bank setelah ditinjau."
              actions={
                <ButtonLink href={CONSOLE_ROUTES.import} variant="primary">
                  Impor paket resmi
                </ButtonLink>
              }
            />
          ) : pool.length === 0 ? (
            <EmptyState
              compact
              filters={chips.map((c) => c.label)}
              title="Tidak ada soal untuk filter ini."
              actions={
                <Button variant="primary" onClick={() => (setSkill(''), setType(''), setQ(''))}>
                  Hapus semua filter
                </Button>
              }
            />
          ) : (
            <ul aria-label="Soal di bank" tabIndex={0} className="m-0 flex max-h-[880px] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
              {pool.map((it) => {
                const pos = refs.indexOf(it.ref)
                return (
                  <li key={it.ref} className={cx('flex flex-col gap-2 rounded-control border border-divider px-3.5 py-3', pos >= 0 ? 'bg-bg' : 'bg-surface')}>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small">
                      <span className={cx('font-bold tabular', SUBJECT_TEXT[it.subject])}>{it.ref}</span>
                      <span className="font-semibold">{it.skillTitle}</span>
                      <span className="text-fg-muted">Kesulitan {it.difficulty} dari 5</span>
                      <span className="text-fg-muted">{SOURCE_LABEL[it.source]}</span>
                    </div>
                    <p lang={it.preview.lang} className="m-0 font-reading text-body-lg">
                      {it.promptPreview}
                    </p>
                    {pos >= 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-small font-bold text-success">
                        <ConsoleIcon name="check" size={16} strokeWidth={3} />
                        Sudah di paper, nomor {pos + 1}
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="S"
                        className="self-start"
                        aria-label={`Tambah ${it.ref} ke paper`}
                        onClick={() => change(() => setRefs((a) => [...a, it.ref]))}
                      >
                        Tambah ke paper
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Isi paper */}
        <section aria-labelledby="isi-paper" className="flex min-w-0 flex-[1.3_1_400px] flex-col gap-3.5 rounded-card border border-divider bg-surface p-5 max-sm:p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 id="isi-paper" className="m-0 text-h3 font-bold">
              Isi paper
            </h2>
            <span className="ml-auto text-body font-bold tabular">{refs.length} soal</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <TextField label="Judul" value={title} onChange={(e) => change(() => setTitle(e.target.value))} error={errors.title} maxLength={80} autoComplete="off" />
            <TextField
              label="Waktu (menit)"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => change(() => setMinutes(e.target.value))}
              error={errors.minutes}
              autoComplete="off"
            />
          </div>
          <RadioGroup
            name="mode-paper"
            legend="Mode"
            value={mode}
            onChange={(v) => change(() => setMode(v))}
            layout="row"
            options={[
              { value: 'latihan', label: 'Latihan' },
              { value: 'tes', label: 'Tes' },
              { value: 'kertas', label: 'Kertas' },
            ]}
            hint="Tes dan Kertas tidak menampilkan kunci sebelum dikumpulkan."
          />
          <div
            id="status-isi"
            role="status"
            className={cx(
              'flex items-start gap-2.5 rounded-control border-2 px-3.5 py-3 text-body font-semibold',
              fits ? 'border-success bg-success-50' : 'border-warn bg-surface',
            )}
          >
            <ConsoleIcon name={fits ? 'check' : 'infoCircle'} size={20} strokeWidth={fits ? 3 : 2.5} className={cx('mt-0.5', fits ? 'text-success' : 'text-warn')} />
            <span>
              {chosen.length === 0
                ? 'Paper masih kosong. Tambah soal dari bank soal di sebelah kiri.'
                : fits
                  ? `${chosen.length} soal, perkiraan ${secondsLabel(totalSec)} dari ${minutes} menit.`
                  : `Perkiraan ${secondsLabel(totalSec)}, lebih dari ${minutes} menit. Kurangi soal atau tambah waktu.`}
            </span>
          </div>
          {errors.items ? <InlineAlert tone="danger" title={errors.items} /> : null}
          <dl className="m-0 grid grid-cols-2 gap-2.5">
            <div className="rounded-control bg-bg px-3 py-2.5">
              <dt className="text-small text-fg-muted">Perkiraan waktu</dt>
              <dd className="m-0 text-body font-bold tabular">{chosen.length ? secondsLabel(totalSec) : 'belum ada soal'}</dd>
            </div>
            <div className="rounded-control bg-bg px-3 py-2.5">
              <dt className="text-small text-fg-muted">Kesulitan rata-rata</dt>
              <dd className="m-0 text-body font-bold tabular">{chosen.length ? `${avgDiff.toFixed(1).replace('.', ',')} dari 5` : 'belum ada soal'}</dd>
            </div>
          </dl>
          {chosen.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {chosen.map((it, i) => (
                <li key={it.ref} className="flex items-start gap-3 rounded-control border border-divider px-3 py-2.5">
                  <span className={cx('inline-flex h-7 min-w-8 flex-none items-center justify-center rounded-pill px-2 text-small font-bold text-white tabular', SUBJECT_BG[it.subject])}>
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span lang={it.preview.lang} className="font-reading text-body">
                      {it.promptPreview}
                    </span>
                    <span className="text-small text-fg-muted">
                      {it.ref}, {it.skillTitle}, kesulitan {it.difficulty}, sekitar {it.preview.expectedSeconds} detik
                    </span>
                  </div>
                  <div role="group" aria-label={`Atur soal nomor ${i + 1}`} className="flex flex-none gap-1">
                    <IconButton size="S" icon="arrowUp" label={`Pindah soal nomor ${i + 1} ke atas`} disabled={i === 0} onClick={() => moveRef(i, -1)} className="size-9 disabled:opacity-40" />
                    <IconButton
                      size="S"
                      icon="arrowDown"
                      label={`Pindah soal nomor ${i + 1} ke bawah`}
                      disabled={i === chosen.length - 1}
                      onClick={() => moveRef(i, 1)}
                      className="size-9 disabled:opacity-40"
                    />
                    <IconButton
                      size="S"
                      icon="x"
                      label={`Hapus soal nomor ${i + 1} dari paper`}
                      onClick={() => change(() => setRefs((a) => a.filter((r) => r !== it.ref)))}
                      tone="danger"
                      className="size-9"
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="m-0 text-small text-fg-muted">Urutkan dari soal termudah. Tombol panah memindahkan soal satu nomor.</p>
        </section>

        {/* Pratinjau cetak */}
        <aside aria-labelledby="pratinjau" className="flex min-w-0 flex-[0.9_1_280px] flex-col gap-3.5 rounded-card border border-divider bg-surface p-5 max-sm:p-4">
          <h2 id="pratinjau" className="m-0 text-h3 font-bold">
            Pratinjau cetak
          </h2>
          <MiniSheet subject={subject} code={code ?? 'Belum disimpan'} title={title || 'Judul paper'} minutes={minutes} items={chosen.slice(0, 6)} />
          <div className="flex flex-col gap-2">
            {paperId && !dirty ? (
              <>
                <ButtonLink href={PRINT_ROUTES.paper(paperId)} variant="secondary" icon="printer" target="_blank">
                  Cetak paper
                </ButtonLink>
                <ButtonLink href={PRINT_ROUTES.key(paperId)} variant="secondary" icon="printer" target="_blank">
                  Cetak kunci jawaban
                </ButtonLink>
              </>
            ) : (
              <p className="m-0 rounded-control bg-bg px-3 py-2.5 text-small">Simpan paper dulu. Tautan cetak paper dan kunci muncul setelah tersimpan.</p>
            )}
          </div>
          <p className="m-0 text-small text-fg-muted">Versi layar dan versi kertas memakai urutan yang sama, jadi nilai dari LJK bisa dibandingkan dengan nilai di tablet.</p>
        </aside>
      </div>

      {data.papers.length > 0 ? (
        <section aria-labelledby="paper-tersimpan" className="flex flex-col gap-3">
          <h2 id="paper-tersimpan" className="m-0 text-h2 font-bold max-sm:text-h3">
            Paper tersimpan
          </h2>
          <ul className="m-0 list-none overflow-hidden rounded-card border border-divider bg-surface p-0">
            {data.papers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-5 py-3.5 last:border-b-0 max-sm:px-4">
                <span className={cx('inline-flex h-7 items-center rounded-pill border px-2.5 text-small font-bold tabular', SUBJECT_BORDER[p.subject])}>{p.code}</span>
                <span className="min-w-0 flex-[1_1_240px]">
                  <Link href={`${CONSOLE_ROUTES.paper}?paper=${encodeURIComponent(p.id)}`} className="font-bold">
                    {p.title}
                  </Link>
                  <span className="block text-small text-fg-muted">
                    {SUBJECT_LABEL[p.subject]}, Grade {p.grade}, {p.itemRefs.length} soal, {p.minutes} menit, dibuat {dateId(p.createdAt)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ButtonLink href={PRINT_ROUTES.paper(p.id)} variant="secondary" size="S" target="_blank">
                    Paper
                  </ButtonLink>
                  <ButtonLink href={PRINT_ROUTES.key(p.id)} variant="secondary" size="S" target="_blank">
                    Kunci
                  </ButtonLink>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        dismissible={!generate.pending}
        title="Isi paper otomatis"
        description={`Kira memilih soal ${SUBJECT_LABEL[subject]} Grade ${grade} dari bank. Soal yang sudah ada di paper diganti.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAutoOpen(false)} disabled={generate.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={doGenerate} loading={generate.pending}>
              Pilih soal
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 p-0 text-small font-bold">Skill (kosong berarti semua skill)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {skills.map(([id, t]) => (
                <Checkbox
                  key={id}
                  label={t}
                  checked={autoSkills.includes(id)}
                  onChange={(e) => setAutoSkills((a) => (e.target.checked ? [...a, id] : a.filter((x) => x !== id)))}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Jumlah soal" inputMode="numeric" value={autoCount} onChange={(e) => setAutoCount(e.target.value)} autoComplete="off" />
            <Select label="Kesulitan terendah" value={autoMin} onChange={(e) => setAutoMin(e.target.value)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
            <Select label="Kesulitan tertinggi" value={autoMax} onChange={(e) => setAutoMax(e.target.value)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
          </div>
          {autoError ? <InlineAlert tone="danger" title={autoError} /> : null}
          <ActionError error={generate.error} />
        </div>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        dismissible={!assign.pending}
        title="Masukkan ke rencana"
        description={`${title || 'Paper ini'} menggantikan sesi Paper otomatis mapelnya di tanggal yang dipilih (Latihan dan Tes hari itu tetap).`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(false)} disabled={assign.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={doAssign} loading={assign.pending}>
              Masukkan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <RadioGroup
            name="learner-paper"
            legend="Learner"
            value={assignLearner}
            onChange={setAssignLearner}
            options={data.shell.learners.map((l) => ({ value: l.id, label: `${l.name}, Grade ${l.grade}` }))}
          />
          <TextField label="Tanggal" type="date" min={jakartaDate()} value={assignDate} onChange={(e) => setAssignDate(e.target.value)} error={assignError} />
          <ActionError error={assign.error} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Hapus paper ${code ?? ''}?`}
        body="Paper ini hilang dari daftar dan tidak bisa dicetak lagi. Jawaban yang sudah dikumpulkan tetap tersimpan di riwayat."
        confirmLabel="Hapus paper"
        onConfirm={doDelete}
        error={remove.error ? <ActionError error={remove.error} /> : null}
      />
    </ConsoleShell>
  )
}

function MiniSheet({ subject, code, title, minutes, items }: { subject: Subject; code: string; title: string; minutes: string; items: PoolItem[] }) {
  // Lembar A4 (794 x 1123 px) yang diperkecil 30%, dengan ukuran huruf token biasa.
  return (
    <div aria-hidden="true" className="relative h-[337px] w-[238px] flex-none self-center overflow-hidden border border-border bg-white">
      <div className="absolute top-0 left-0 flex h-[1123px] w-[794px] origin-top-left scale-30 flex-col gap-6 px-[60px] py-[52px]">
        <div className={cx('flex items-center gap-4 border-b-4 pb-4', SUBJECT_BORDER[subject])}>
          <span className="font-display text-h1 font-bold">Kira</span>
          <span className="text-h3 font-semibold">{SUBJECT_LABEL[subject]}</span>
          <span className="ml-auto rounded-control border-2 border-fg px-3 font-display text-h2 font-semibold">{code}</span>
        </div>
        <span className="text-h1 font-bold">{title}</span>
        <span className="text-h3 text-fg-muted">{minutes} minutes. Write your answers clearly.</span>
        {items.map((it, i) => (
          <div key={it.ref} className="flex items-start gap-4">
            <span className={cx('inline-flex h-10 min-w-12 flex-none items-center justify-center rounded-pill px-3 text-h3 font-bold text-white', SUBJECT_BG[subject])}>{i + 1}</span>
            <span className="font-reading text-h2">{it.promptPreview}</span>
          </div>
        ))}
        <div className="mt-auto flex justify-between border-t-2 border-border pt-3 text-h3 text-fg-muted">
          <span>{code}</span>
          <span>Page 1</span>
        </div>
      </div>
    </div>
  )
}
