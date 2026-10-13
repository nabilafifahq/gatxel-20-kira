'use client'

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ImportActions, ImportDTO, ImportItemDTO, ImportMetaDTO } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { Select, TextField } from '@/components/console/Field'
import { ActionError, InlineAlert } from '@/components/console/Feedback'
import { ConsoleIcon } from '@/components/console/icons'
import { Card } from '@/components/console/Layout'
import { Tag } from '@/components/console/Tag'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * Alat khusus paper lomba di layar Impor: isian data paper (lomba, tahun, bagian, waktu asli, sumber),
 * pemotongan gambar soal dari halaman PDF (tarik kotak atau ketuk dua sudut), dan catatan hasil cek kunci AI.
 */

export const SOURCE_UPLOAD = 'unggahan tutor'

type Form = { competition: string; year: string; section: string; minutes: string; sourceKind: 'upload' | 'url'; url: string }

export function emptyForm(meta?: ImportMetaDTO): Form {
  const src = meta?.source ?? null
  return {
    competition: meta?.competition ?? '',
    year: meta?.year != null ? String(meta.year) : '',
    section: meta?.section ?? '',
    minutes: meta?.originalMinutes != null ? String(meta.originalMinutes) : '',
    sourceKind: src && src !== SOURCE_UPLOAD ? 'url' : 'upload',
    url: src && src !== SOURCE_UPLOAD ? src : '',
  }
}

export function sourceOf(f: Form): string | null {
  return f.sourceKind === 'upload' ? SOURCE_UPLOAD : f.url.trim() || null
}

export type FormErrors = Partial<Record<'year' | 'minutes' | 'section' | 'url', string>>

/** Kembalikan pesan bila isian tidak benar; kosong berarti boleh dikirim. */
export function validateForm(f: Form): FormErrors {
  const e: FormErrors = {}
  if (f.year.trim() && !/^\d{4}$/.test(f.year.trim())) e.year = 'Tahun ditulis empat angka, misalnya 2023.'
  else if (f.year.trim() && (Number(f.year) < 2000 || Number(f.year) > 2100)) e.year = 'Tahun paling awal 2000 dan paling akhir 2100.'
  if (f.minutes.trim() && !/^\d{1,3}$/.test(f.minutes.trim())) e.minutes = 'Waktu asli dalam menit bulat, misalnya 75.'
  else if (f.minutes.trim() && (Number(f.minutes) < 1 || Number(f.minutes) > 300)) e.minutes = 'Waktu asli antara 1 dan 300 menit.'
  if (f.section.length > 20) e.section = 'Bagian paling banyak 20 karakter.'
  if (f.sourceKind === 'url' && f.url.trim() && !/^https:\/\/\S+$/i.test(f.url.trim())) e.url = 'Alamat sumber harus diawali https://.'
  return e
}

export function formToPayload(f: Form): ImportMetaDTO {
  return {
    competition: f.competition || null,
    year: f.year.trim() ? Number(f.year) : null,
    section: f.section.trim() || null,
    originalMinutes: f.minutes.trim() ? Number(f.minutes) : null,
    source: sourceOf(f),
  }
}

export function PaperMetaFields({
  form,
  onChange,
  errors,
  competitions,
  idPrefix,
}: {
  form: Form
  onChange: (next: Form) => void
  errors: FormErrors
  competitions: ImportDTO['competitions']
  idPrefix: string
}) {
  const set = (patch: Partial<Form>) => onChange({ ...form, ...patch })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Select
          label="Lomba"
          value={form.competition}
          onChange={(e) => set({ competition: e.target.value })}
          options={[{ value: '', label: 'Bukan paper lomba atau belum tahu' }, ...competitions.map((c) => ({ value: c.id, label: c.name }))]}
          fieldClassName="min-w-[220px] flex-[1_1_220px]"
        />
        <TextField
          id={`${idPrefix}-tahun`}
          label="Tahun"
          inputMode="numeric"
          value={form.year}
          maxLength={4}
          error={errors.year}
          onChange={(e) => set({ year: e.target.value })}
          autoComplete="off"
          fieldClassName="max-w-[120px]"
        />
        <TextField
          id={`${idPrefix}-bagian`}
          label="Bagian"
          hint="A, B, C, atau Penuh."
          value={form.section}
          maxLength={20}
          error={errors.section}
          onChange={(e) => set({ section: e.target.value })}
          autoComplete="off"
          fieldClassName="max-w-[160px]"
        />
        <TextField
          id={`${idPrefix}-menit`}
          label="Waktu asli (menit)"
          inputMode="numeric"
          value={form.minutes}
          maxLength={3}
          error={errors.minutes}
          onChange={(e) => set({ minutes: e.target.value })}
          autoComplete="off"
          fieldClassName="max-w-[160px]"
        />
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-small font-bold">Sumber</legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-body">
            <input type="radio" name={`${idPrefix}-sumber`} checked={form.sourceKind === 'upload'} onChange={() => set({ sourceKind: 'upload' })} className="size-5 accent-fg" />
            Unggahan tutor
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-body">
            <input type="radio" name={`${idPrefix}-sumber`} checked={form.sourceKind === 'url'} onChange={() => set({ sourceKind: 'url' })} className="size-5 accent-fg" />
            Alamat sumber
          </label>
        </div>
        {form.sourceKind === 'url' ? (
          <TextField
            id={`${idPrefix}-url`}
            label="Alamat sumber"
            hint="Alamat halaman unduhan resmi, diawali https://."
            value={form.url}
            maxLength={300}
            error={errors.url}
            onChange={(e) => set({ url: e.target.value })}
            autoComplete="off"
          />
        ) : null}
      </fieldset>
      <p className="m-0 text-small text-fg-muted">
        Data paper dipakai untuk memilih paper harian: bagian yang belum dikerjakan, lomba bergiliran, tahun 2021 ke atas lebih dulu, dan paper penuh di hari Sabtu.
      </p>
    </div>
  )
}

/** Data paper pada paket yang sedang dicek; disimpan lewat updateImportMeta. */
export function PaperMetaCard({ batchId, meta, competitions, actions }: { batchId: string; meta: ImportMetaDTO; competitions: ImportDTO['competitions']; actions: ImportActions }) {
  const toast = useToast()
  const save = useAction(actions.updateImportMeta)
  const auto = useId()
  const prefix = `meta${auto.replace(/:/g, '')}`
  const [form, setForm] = useState(() => emptyForm(meta))
  const [errors, setErrors] = useState<FormErrors>({})
  const [open, setOpen] = useState(false)
  const filled = Boolean(meta.competition || meta.year || meta.section)

  async function submit() {
    const next = validateForm(form)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const r = await save.run({ batchId, ...formToPayload(form) })
    if (r.ok) {
      toast({ tone: 'success', title: 'Data paper tersimpan.', body: 'Pustaka paper ikut diperbarui bila soalnya sudah disetujui.' })
      setOpen(false)
    }
  }

  return (
    <Card as="section" aria-label="Data paper" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-body font-bold">Data paper</h2>
        {filled ? (
          <>
            {meta.competition ? <Tag>{competitions.find((c) => c.id === meta.competition)?.name ?? meta.competition}</Tag> : null}
            {meta.year ? <Tag>{meta.year}</Tag> : null}
            {meta.section ? <Tag>{meta.section === 'penuh' ? 'Paper penuh' : `Bagian ${meta.section}`}</Tag> : null}
            {meta.originalMinutes ? <Tag>{meta.originalMinutes} menit</Tag> : null}
            <Tag>{meta.source ?? SOURCE_UPLOAD}</Tag>
          </>
        ) : (
          <span className="text-small text-fg-muted">Belum diisi, jadi paket ini belum masuk pustaka paper.</span>
        )}
        <Button variant="quiet" size="S" icon="edit" className="ml-auto" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Tutup' : 'Isi atau ubah'}
        </Button>
      </div>
      {open ? (
        <>
          <PaperMetaFields form={form} onChange={setForm} errors={errors} competitions={competitions} idPrefix={prefix} />
          <ActionError error={save.error} />
          <div>
            <Button variant="primary" loading={save.pending} onClick={submit}>
              Simpan data paper
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Potong gambar soal

type Rect = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const spanOf = (a: Pt, b: Pt): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
/** Geseran di bawah ini dianggap ketukan, bukan tarikan. */
const TAP_SLACK = 0.012

/**
 * Pemotong gambar: tarik kotak di halaman, atau ketuk dua sudut (cocok di layar sentuh). Kotak bisa diatur
 * dengan angka persen juga. Gambar dipotong server dari halaman PDF dan dipasang ke satu soal.
 */
export function FigureCropper({
  batchId,
  pageUrl,
  pageNumber,
  pageAlt,
  items,
  actions,
  onClose,
}: {
  batchId: string
  pageUrl: string
  pageNumber: number
  pageAlt: string
  items: ImportItemDTO[]
  actions: ImportActions
  onClose: () => void
}) {
  const toast = useToast()
  const attach = useAction(actions.attachFigure)
  const auto = useId()
  const fid = `potong${auto.replace(/:/g, '')}`
  const boxRef = useRef<HTMLDivElement>(null)
  const start = useRef<Pt | null>(null)
  const moved = useRef(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [anchor, setAnchor] = useState<Pt | null>(null)
  const [target, setTarget] = useState(() => (items[0] ? String(items[0].index) : ''))
  const [alt, setAlt] = useState('')
  const [altError, setAltError] = useState<string | null>(null)
  const [manual, setManual] = useState(false)

  const point = (e: ReactPointerEvent): Pt => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }
  }

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = point(e)
    moved.current = false
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const p = point(e)
    if (Math.abs(p.x - start.current.x) > TAP_SLACK || Math.abs(p.y - start.current.y) > TAP_SLACK) moved.current = true
    if (moved.current) {
      setAnchor(null)
      setRect(spanOf(start.current, p))
    }
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const p = point(e)
    if (!moved.current) {
      // Ketukan: sudut pertama, lalu sudut kedua.
      if (anchor) {
        setRect(spanOf(anchor, p))
        setAnchor(null)
      } else {
        setAnchor(p)
        setRect(null)
      }
    }
    start.current = null
  }

  function setField(key: keyof Rect, value: string) {
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n)) return
    const base = rect ?? { x: 0.1, y: 0.1, w: 0.4, h: 0.3 }
    const v = clamp01(n / 100)
    const next = { ...base, [key]: v }
    next.w = Math.min(next.w, 1 - next.x)
    next.h = Math.min(next.h, 1 - next.y)
    setRect(next)
  }

  async function save() {
    if (!rect || rect.w < 0.02 || rect.h < 0.02) {
      toast({ tone: 'info', title: 'Tarik atau ketuk dua sudut dulu.', body: 'Kotak potong harus menutup seluruh gambar soal.' })
      return
    }
    if (target === '') return
    if (alt.trim().length < 8) {
      setAltError('Tulis teks pengganti gambar minimal 8 karakter, misalnya "Deret kotak berwarna dengan satu kotak kosong."')
      document.getElementById(`${fid}-alt`)?.focus()
      return
    }
    setAltError(null)
    const r = await attach.run({ batchId, index: Number(target), page: pageNumber, rect, alt: alt.trim() })
    if (r.ok) {
      const it = items.find((i) => String(i.index) === target)
      toast({ tone: 'success', title: `Gambar terpasang ke soal ${it?.number ?? ''}.`.replace(' .', '.') })
      setRect(null)
      setAnchor(null)
      setAlt('')
    }
  }

  return (
    <section aria-labelledby={`${fid}-judul`} className="flex flex-col gap-3 rounded-card border-2 border-fg bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 id={`${fid}-judul`} className="m-0 text-body font-bold">
          Potong gambar soal
        </h3>
        <Button variant="quiet" size="S" className="ml-auto" onClick={onClose}>
          Selesai
        </Button>
      </div>
      <p className="m-0 text-small text-fg-muted">
        Tarik kotak di halaman, atau ketuk dua sudut gambar. Gambar dipotong dari halaman PDF dan dipasang ke satu soal.
        {anchor ? ' Sudut pertama sudah ditandai: ketuk sudut yang berseberangan.' : ''}
      </p>
      <div
        ref={boxRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        className="relative aspect-[210/297] cursor-crosshair touch-none overflow-hidden rounded-sm border border-border bg-white select-none"
      >
        {/* Gambar halaman dari server (render PDF), sama dengan penampil di atas. */}
        <img src={pageUrl} alt={pageAlt} draggable={false} className="pointer-events-none block size-full object-contain" />
        {rect ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-accent bg-accent/15"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
          />
        ) : null}
        {anchor ? (
          <div aria-hidden="true" className="pointer-events-none absolute size-4 -translate-1/2 rounded-pill border-2 border-white bg-accent" style={{ left: pct(anchor.x), top: pct(anchor.y) }} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="quiet" size="S" onClick={() => setManual((v) => !v)} aria-expanded={manual}>
          {manual ? 'Tutup pengaturan angka' : 'Atur kotak dengan angka'}
        </Button>
        {rect ? (
          <Button variant="quiet" size="S" onClick={() => (setRect(null), setAnchor(null))}>
            Hapus kotak
          </Button>
        ) : null}
      </div>
      {manual ? (
        <div className="flex flex-wrap gap-3">
          {(
            [
              ['x', 'Kiri (persen)'],
              ['y', 'Atas (persen)'],
              ['w', 'Lebar (persen)'],
              ['h', 'Tinggi (persen)'],
            ] as const
          ).map(([k, label]) => (
            <TextField
              key={k}
              id={`${fid}-${k}`}
              label={label}
              inputMode="decimal"
              value={rect ? String(Math.round(rect[k] * 1000) / 10) : ''}
              onChange={(e) => setField(k, e.target.value)}
              autoComplete="off"
              fieldClassName="max-w-[140px]"
            />
          ))}
        </div>
      ) : null}
      {items.length === 0 ? (
        <InlineAlert tone="warn" title="Tidak ada soal di halaman ini.">
          Pindah ke halaman yang berisi soal bergambar.
        </InlineAlert>
      ) : (
        <>
          <Select
            label="Pasang ke soal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={items.map((i) => ({ value: String(i.index), label: `Soal ${i.number}${i.figure ? ' (ganti gambar)' : ''}` }))}
            fieldClassName="max-w-[260px]"
          />
          <TextField
            id={`${fid}-alt`}
            label="Teks pengganti gambar"
            hint="Satu kalimat yang menjelaskan isi gambar untuk anak yang tidak melihatnya."
            value={alt}
            maxLength={400}
            error={altError ?? undefined}
            onChange={(e) => {
              setAlt(e.target.value)
              setAltError(null)
            }}
            autoComplete="off"
          />
          <ActionError error={attach.error} />
          <div>
            <Button variant="primary" icon="check" loading={attach.pending} onClick={save}>
              Simpan gambar ke soal
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Catatan di kartu soal

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Ringkas hasil cek kunci AI untuk satu soal. */
export function KeyCheckNote({ item: it }: { item: ImportItemDTO }) {
  if (!it.keyCheck || it.keyCheck === 'skipped') return null
  const ai = it.aiAnswer != null ? LETTERS[it.aiAnswer] : null
  const text =
    it.keyCheck === 'agree'
      ? `Kunci sama dengan jawaban AI${ai ? ` (${ai})` : ''}.`
      : it.keyCheck === 'disagree'
        ? `Kunci di PDF berbeda dengan jawaban AI${ai ? ` (AI memilih ${ai})` : ''}. Hitung sendiri sebelum menyetujui.`
        : `PDF ini tidak punya kunci. AI mengerjakan dua kali dengan cara berbeda dan memilih ${ai ?? 'satu opsi'} kedua kali. Pilih kunci sendiri setelah mengecek.`
  const good = it.keyCheck === 'agree'
  return (
    <p className="m-0 flex items-start gap-2 text-small">
      <ConsoleIcon name={good ? 'check' : 'alert'} size={16} strokeWidth={good ? 3 : 2.5} className={cx('mt-0.5 flex-none', good ? 'text-success' : 'text-warn')} />
      <span className={good ? 'text-fg-muted' : 'font-semibold'}>{text}</span>
    </p>
  )
}

export function FigureThumb({ item: it, onRemove, busy }: { item: ImportItemDTO; onRemove?: () => void; busy?: boolean }) {
  if (!it.figure) return null
  return (
    <div className="flex flex-wrap items-start gap-3">
      <img src={it.figure.url} alt={it.figure.alt} className="max-h-40 max-w-full rounded-sm border border-border bg-white object-contain" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-small text-fg-muted">Gambar terpasang. Tampil di atas soal untuk Syakira.</span>
        {onRemove && !it.approved ? (
          <Button variant="quiet" size="S" onClick={onRemove} loading={busy}>
            Lepas gambar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
