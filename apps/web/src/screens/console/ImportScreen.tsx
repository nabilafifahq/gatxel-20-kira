'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import type { ImportActions, ImportDTO, ImportItemDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink, buttonClass, IconButton } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { Dialog } from '@/components/console/Dialog'
import { Checkbox, FieldError, RadioGroup, Select, TextArea, TextField } from '@/components/console/Field'
import { ActionError, EmptyState, InlineAlert, StatusText } from '@/components/console/Feedback'
import { dateId, SUBJECT_LABEL, timeId } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Card, PageHeader, Pill, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction, type ActionFailure } from '@/components/console/useAction'
import { emptyForm, FigureCropper, FigureThumb, formToPayload, KeyCheckNote, PaperMetaCard, PaperMetaFields, validateForm, type FormErrors } from './ImportPaperTools'

/**
 * T12 Impor paket resmi (papan ImporPaket). Tutor mengunggah PDF paket latihan
 * milik keluarga, Kira membaca soal dan tabel kunci, lalu setiap soal dicek di
 * samping gambar halaman PDF sebelum masuk Bank soal sebagai sumber resmi.
 * Paket dipilih lewat parameter URL `paket`. Tanpa paket terpilih: formulir unggah
 * dan daftar paket.
 */

export type ImportScreenProps = { data: ImportDTO; actions: ImportActions }

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
/**
 * Batas unggah PDF 60 MB, sama dengan server (limitFor('pdf')). Server Action menerima paling banyak
 * 61 MB (experimental.serverActions.bodySizeLimit di next.config.ts), cukup untuk berkas dan kolom
 * formulir lain.
 */
const MAX_PDF_MB = 60
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024 - 64 * 1024
/** Sama dengan itemSchema: teks soal 900 karakter, opsi 160 karakter. */
const PROMPT_MAX = 900
const OPTION_MAX = 160

const STATUS_LABEL: Record<ImportItemDTO['status'], string> = {
  ok: 'Lolos',
  'key-mismatch': 'Kunci tidak cocok',
  'leftover-key-text': 'Sisa teks kunci',
  'broken-fraction': 'Pecahan rusak',
  'needs-check': 'Perlu dicek',
}

const BATCH_STATUS: Record<ImportDTO['batches'][number]['status'], { label: string; tone: 'neutral' | 'success' | 'warn' | 'danger' | 'math' }> = {
  uploaded: { label: 'Diunggah', tone: 'neutral' },
  parsing: { label: 'Sedang dibaca', tone: 'math' },
  review: { label: 'Perlu dicek', tone: 'warn' },
  done: { label: 'Selesai', tone: 'success' },
  failed: { label: 'Gagal dibaca', tone: 'danger' },
}

/** Sisa kunci di akhir teks soal: "#Kunci: B", "Kunci jawaban: B", "Jawaban: B", "Jwb: (B)", "Answer: B". */
const LEFTOVER_RE = /\s*((?:#\s*)?(?:kunci(?:\s*jawaban)?|jawaban|jwb|answer|ans)\s*[:=]?\s*\(?[a-e]\)?\.?)\s*$/i
const BROKEN_FRACTION_RE = /^\s*(\d+)\s+(\d+)\s*$/

function splitLeftover(prompt: string): { text: string; leftover: string | null } {
  const m = LEFTOVER_RE.exec(prompt)
  if (!m || m.index === undefined) return { text: prompt, leftover: null }
  return { text: prompt.slice(0, m.index).trimEnd(), leftover: m[1] ?? null }
}

function fixFractions(options: string[]): string[] {
  return options.map((o) => o.replace(BROKEN_FRACTION_RE, '$1/$2'))
}

function letter(i: number | null): string {
  return i == null ? '' : (LETTERS[i] ?? String(i + 1))
}

function joinNumbers(ns: number[]): string {
  if (ns.length <= 1) return ns.join('')
  return `${ns.slice(0, -1).join(', ')} dan ${ns[ns.length - 1]}`
}

export function ImportScreen({ data, actions }: ImportScreenProps) {
  const sel = data.selected
  const meta = sel ? data.batches.find((b) => b.id === sel.id) : undefined
  return (
    <ConsoleShell shell={data.shell} active="import">
      <div className="flex flex-col gap-6">
        <nav aria-label="Jejak" className="-mb-2 flex flex-wrap items-center gap-2 text-small text-fg-muted">
          <Link href={CONSOLE_ROUTES.bank} className="font-semibold">
            Bank soal
          </Link>
          <span aria-hidden="true">/</span>
          {sel ? (
            <>
              <Link href={CONSOLE_ROUTES.import} className="font-semibold">
                Impor paket resmi
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="min-w-0 truncate">
                {sel.title}
              </span>
            </>
          ) : (
            <span aria-current="page">Impor paket resmi</span>
          )}
        </nav>
        {sel ? (
          <BatchReview key={sel.id} batch={sel} meta={meta} orgName={data.shell.orgName} actions={actions} competitions={data.competitions} />
        ) : (
          <ImportHome batches={data.batches} actions={actions} competitions={data.competitions} />
        )}
      </div>
    </ConsoleShell>
  )
}

// ---------------------------------------------------------------------------
// Tanpa paket terpilih: unggah dan daftar paket

function ImportHome({ batches, actions, competitions }: { batches: ImportDTO['batches']; actions: ImportActions; competitions: ImportDTO['competitions'] }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const parsing = batches.some((b) => b.status === 'parsing' || b.status === 'uploaded')
  return (
    <>
      <PageHeader
        title="Impor paket resmi"
        description="Unggah PDF paket latihan milik keluarga. Kira membaca soal dan tabel kuncinya, lalu setiap soal dicek di sini sebelum masuk Bank soal."
      />
      <div className="flex flex-wrap items-start gap-6">
        <UploadCard actions={actions} competitions={competitions} />
        <section aria-labelledby="paket-heading" className="flex min-w-0 flex-[1.4_1_480px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="paket-heading" className="m-0 text-h2 font-bold max-sm:text-h3">
              Paket yang diunggah
            </h2>
            {parsing ? (
              <Button
                variant="quiet"
                size="S"
                icon="sync"
                loading={refreshing}
                className="ml-auto"
                onClick={() => startRefresh(() => router.refresh())}
              >
                Muat ulang status
              </Button>
            ) : null}
          </div>
          {batches.length === 0 ? (
            <EmptyState
              icon="import"
              compact
              title="Belum ada paket yang diimpor."
              body="Paket yang diunggah tampil di sini bersama statusnya: sedang dibaca, perlu dicek, atau selesai."
            />
          ) : (
            <Card as="section" padding="none" aria-label="Daftar paket" className="px-6 py-2 max-sm:px-4">
              <ul className="m-0 flex list-none flex-col p-0">
                {batches.map((b) => (
                  <BatchRow key={b.id} batch={b} />
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  )
}

function BatchRow({ batch: b }: { batch: ImportDTO['batches'][number] }) {
  const st = BATCH_STATUS[b.status]
  const href = `${CONSOLE_ROUTES.import}?paket=${encodeURIComponent(b.id)}`
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
        <span className="text-body font-bold [overflow-wrap:anywhere]">{b.title}</span>
        <span className="text-small text-fg-muted tabular">
          Diunggah {dateId(b.createdAt)}, pukul {timeId(b.createdAt)}
          {b.itemCount > 0 ? `. ${b.approved} dari ${b.itemCount} soal disetujui` : ''}
        </span>
        {b.status === 'failed' ? (
          <span className="text-small">
            {b.error ? `${b.error} ` : 'PDF ini tidak bisa dibaca. '}Unggah ulang file aslinya, atau ketik soalnya lewat Bank soal.
          </span>
        ) : null}
        {b.status === 'parsing' || b.status === 'uploaded' ? (
          <span className="text-small">Membaca PDF biasanya selesai dalam beberapa menit. Muat ulang status untuk melihat hasilnya.</span>
        ) : null}
      </div>
      <Pill tone={st.tone}>
        {b.status === 'done' ? <ConsoleIcon name="check" size={14} strokeWidth={3} className="text-success" /> : null}
        {b.status === 'failed' ? <ConsoleIcon name="alert" size={14} strokeWidth={2.5} className="text-danger" /> : null}
        {st.label}
      </Pill>
      {b.status === 'review' ? (
        <ButtonLink href={href} variant="primary" size="S">
          Cek soal
        </ButtonLink>
      ) : b.status === 'done' ? (
        <ButtonLink href={href} variant="secondary" size="S">
          Lihat
        </ButtonLink>
      ) : null}
    </li>
  )
}

function UploadCard({ actions, competitions }: { actions: ImportActions; competitions: ImportDTO['competitions'] }) {
  const router = useRouter()
  const upload = useAction(actions.uploadPdf)
  const fileRef = useRef<HTMLInputElement>(null)
  const auto = useId()
  const fileId = `pdf${auto.replace(/:/g, '')}`
  const [subject, setSubject] = useState<Subject>('math')
  const [grade, setGrade] = useState('2')
  const [tags, setTags] = useState('')
  const [owned, setOwned] = useState(false)
  const [fileName, setFileName] = useState('')
  const [errors, setErrors] = useState<{ file?: string; owned?: string; tags?: string }>({})
  const [paper, setPaper] = useState(() => emptyForm())
  const [paperErrors, setPaperErrors] = useState<FormErrors>({})

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0] ?? null
    const next: typeof errors = {}
    if (!file) next.file = 'Pilih file PDF paket dulu.'
    else if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')))
      next.file = `File ${file.name} bukan PDF. Simpan atau ekspor paketnya sebagai PDF, lalu pilih lagi.`
    else if (file.size > MAX_PDF_BYTES)
      next.file = `Ukuran file ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB, batasnya ${MAX_PDF_MB} MB. Pisahkan PDF per bagian, lalu unggah satu per satu.`
    if (tags.length > 120) next.tags = `Label paling banyak 120 karakter, sekarang ${tags.length}.`
    if (!owned) next.owned = 'Centang pernyataan ini dulu. Hanya paket milik keluarga yang boleh diimpor.'
    setErrors(next)
    const pe = validateForm(paper)
    setPaperErrors(pe)
    if (Object.keys(pe).length > 0 && Object.keys(next).length === 0) {
      document.getElementById(pe.year ? 'upload-tahun' : pe.minutes ? 'upload-menit' : pe.section ? 'upload-bagian' : 'upload-url')?.focus()
      return
    }
    if (Object.keys(next).length > 0) {
      const first = next.file ? fileId : next.tags ? 'impor-label' : 'impor-milik'
      document.getElementById(first)?.focus()
      return
    }
    const form = new FormData()
    form.set('file', file as File)
    form.set('subject', subject)
    form.set('grade', grade)
    form.set('tags', tags.trim())
    form.set('owned', 'yes')
    const meta = formToPayload(paper)
    form.set('competition', meta.competition ?? '')
    form.set('year', meta.year != null ? String(meta.year) : '')
    form.set('section', meta.section ?? '')
    form.set('originalMinutes', meta.originalMinutes != null ? String(meta.originalMinutes) : '')
    form.set('source', meta.source ?? '')
    const r = await upload.run(form)
    if (r.ok) router.push(`${CONSOLE_ROUTES.import}?paket=${encodeURIComponent(r.data.batchId)}`)
  }

  return (
    <Card as="section" aria-labelledby="unggah-heading" className="flex flex-[1_1_360px] flex-col gap-4">
      <h2 id="unggah-heading" className="m-0 text-h3 font-bold">
        Unggah PDF paket
      </h2>
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id={`${fileId}-label`} className="text-small font-bold">
            File PDF
          </span>
          {/* Input asli disembunyikan secara visual supaya teks tombolnya berbahasa Indonesia; fokus tampil di label. */}
          <div
            className={cx(
              'relative flex min-w-0 flex-wrap items-center gap-3 rounded-control border-2 border-dashed bg-bg p-3',
              errors.file ? 'border-danger' : 'border-border',
            )}
          >
            <input
              ref={fileRef}
              id={fileId}
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              aria-labelledby={`${fileId}-label ${fileId}-button`}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={[`${fileId}-name`, `${fileId}-hint`, errors.file ? `${fileId}-error` : null].filter(Boolean).join(' ')}
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name ?? '')
                setErrors((x) => ({ ...x, file: undefined }))
              }}
              className="peer visually-hidden"
            />
            <label
              id={`${fileId}-button`}
              htmlFor={fileId}
              className={cx(
                buttonClass('secondary', 'S', 'cursor-pointer'),
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
              )}
            >
              <ConsoleIcon name="upload" size={16} strokeWidth={2.5} />
              Pilih file PDF
            </label>
            <span id={`${fileId}-name`} className={cx('min-w-0 text-body [overflow-wrap:anywhere]', fileName ? 'font-semibold' : 'text-fg-muted')}>
              {fileName || 'Belum ada file dipilih.'}
            </span>
          </div>
          <span id={`${fileId}-hint`} className="text-small text-fg-muted">
            Satu PDF, paling besar {MAX_PDF_MB} MB. Tabel kunci di halaman terakhir ikut dibaca bila ada.
          </span>
          {errors.file ? <FieldError id={`${fileId}-error`}>{errors.file}</FieldError> : null}
        </div>
        <RadioGroup<Subject>
          name="impor-mapel"
          legend="Mapel"
          layout="row"
          value={subject}
          onChange={setSubject}
          options={(['math', 'english', 'science'] as Subject[]).map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))}
        />
        <Select
          label="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          options={[1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
          fieldClassName="max-w-[220px]"
        />
        <TextField
          id="impor-label"
          label="Label (opsional)"
          hint="Pisahkan dengan koma, misalnya ESMO, Level 1."
          value={tags}
          maxLength={200}
          error={errors.tags}
          onChange={(e) => setTags(e.target.value)}
          autoComplete="off"
        />
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-control border border-divider p-4">
          <legend className="px-1 text-small font-bold">Data paper lomba (opsional)</legend>
          <PaperMetaFields form={paper} onChange={setPaper} errors={paperErrors} competitions={competitions} idPrefix="upload" />
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Checkbox
            id="impor-milik"
            checked={owned}
            onChange={(e) => {
              setOwned(e.target.checked)
              setErrors((x) => ({ ...x, owned: undefined }))
            }}
            aria-invalid={errors.owned ? true : undefined}
            label="Paket ini milik keluarga dan hanya dipakai untuk latihan di rumah."
            description="Soal resmi tersimpan sebagai soal privat keluarga dan tidak ikut ekspor."
          />
          {errors.owned ? <FieldError id="impor-milik-error">{errors.owned}</FieldError> : null}
        </div>
        <ActionError error={upload.error} />
        <div>
          <Button type="submit" variant="primary" icon="upload" loading={upload.pending}>
            Unggah dan baca PDF
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Paket terpilih: cek soal satu per satu

type Batch = NonNullable<ImportDTO['selected']>
type Filter = 'cek' | 'lolos' | 'semua'

function BatchReview({
  batch,
  meta,
  orgName,
  actions,
  competitions,
}: {
  batch: Batch
  meta: ImportDTO['batches'][number] | undefined
  orgName: string
  actions: ImportActions
  competitions: ImportDTO['competitions']
}) {
  const toast = useToast()
  const [src, setSrc] = useState(batch)
  const [items, setItems] = useState<ImportItemDTO[]>(batch.items)
  const [edited, setEdited] = useState<Set<number>>(() => new Set())
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())
  const firstCheck = batch.items.find((i) => i.status !== 'ok')
  const [filter, setFilter] = useState<Filter>(firstCheck ? 'cek' : 'semua')
  const pageOf = (it: ImportItemDTO | undefined) => (it?.pageImage ? batch.pages.indexOf(it.pageImage) : -1)
  const [page, setPage] = useState(() => Math.max(0, pageOf(firstCheck)))
  const [editing, setEditing] = useState<ImportItemDTO | null>(null)
  const viewerRef = useRef<HTMLElement>(null)
  const approveAll = useAction(actions.approveImportItems)
  const removeFig = useAction(actions.removeFigure)
  const [cropping, setCropping] = useState(false)

  if (src !== batch) {
    setSrc(batch)
    setItems(batch.items)
  }

  const total = items.length
  const check = items.filter((i) => i.status !== 'ok')
  const passed = items.filter((i) => i.status === 'ok')
  const passedPending = passed.filter((i) => !i.approved)
  const approvedCount = items.filter((i) => i.approved).length
  const hasKeyTable = items.some((i) => i.answerFromKey != null)
  const pageCount = batch.pages.length

  function patch(index: number, change: Partial<ImportItemDTO>) {
    setItems((xs) => xs.map((x) => (x.index === index ? { ...x, ...change } : x)))
  }

  function showPage(it: ImportItemDTO) {
    const p = pageOf(it)
    if (p < 0) return
    setPage(p)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      viewerRef.current?.scrollIntoView({ block: 'start' })
    }
  }

  async function dropFigure(it: ImportItemDTO) {
    const r = await removeFig.run({ batchId: batch.id, index: it.index })
    if (r.ok) patch(it.index, { figure: null })
  }

  async function runApproveAll() {
    const indexes = passedPending.map((i) => i.index)
    if (indexes.length === 0) return
    const r = await approveAll.run({ batchId: batch.id, indexes })
    if (r.ok) {
      setItems((xs) => xs.map((x) => (indexes.includes(x.index) ? { ...x, approved: true } : x)))
      toast({ tone: 'success', title: `${r.data.created} soal masuk Bank soal.`, body: 'Semua soal yang lolos validator sudah disetujui.' })
    }
  }

  if (total === 0) {
    return (
      <>
        <PageHeader title="Impor paket resmi" description={headerLine(batch, meta)} />
        <ParsingState />
      </>
    )
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'cek', label: `Perlu dicek (${check.length})` },
    { id: 'lolos', label: `Lolos (${passed.length})` },
    { id: 'semua', label: `Semua (${total})` },
  ]
  const onPage = items.filter((i) => pageOf(i) === page).map((i) => i.number)

  return (
    <>
      <PageHeader
        title="Impor paket resmi"
        description={headerLine(batch, meta)}
        actions={
          <>
            <ButtonLink href={CONSOLE_ROUTES.import} variant="secondary">
              Kembali ke daftar paket
            </ButtonLink>
            {passed.length > 0 && passedPending.length === 0 ? (
              <StatusText tone="success" className="text-body">
                {passed.length} soal lolos sudah disetujui
              </StatusText>
            ) : passedPending.length > 0 ? (
              <Button variant="primary" loading={approveAll.pending} onClick={runApproveAll}>
                Setujui {passedPending.length} soal yang lolos
              </Button>
            ) : null}
          </>
        }
      />
      <ActionError error={approveAll.error} />

      <PaperMetaCard batchId={batch.id} meta={batch.meta} competitions={competitions} actions={actions} />

      <Card as="section" aria-label="Ringkasan impor" className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectChip subject={batch.subject} size="sm" />
            <Pill>Grade {batch.grade}</Pill>
            {batch.tags.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
          <p className="m-0 text-body">
            {total} soal terbaca dari halaman 1 sampai {pageCount}
            {hasKeyTable ? ', lalu dicocokkan dengan tabel kunci di PDF.' : '. Tabel kunci tidak ditemukan, jadi kunci dipilih per soal.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <SummaryChip tone="success">
              <ConsoleIcon name="check" size={16} strokeWidth={3} className="text-success" />
              {passed.length} lolos validator
            </SummaryChip>
            {check.length > 0 ? (
              <SummaryChip tone="warn">
                <ConsoleIcon name="alert" size={16} strokeWidth={2.5} className="text-warn" />
                {check.length} perlu dicek
              </SummaryChip>
            ) : null}
            <SummaryChip tone="neutral">
              {approvedCount} dari {total} disetujui
            </SummaryChip>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] items-start gap-2.5 text-small text-fg-muted">
          <ConsoleIcon name="lock" size={20} className="mt-px" />
          <span>
            Soal resmi hanya untuk latihan di {orgName} dan tidak ikut ekspor. Studio AI memakainya sebatas acuan gaya.
          </span>
        </div>
      </Card>

      {approvedCount === total ? (
        <InlineAlert
          tone="success"
          title={`Semua ${total} soal sudah masuk Bank soal.`}
          action={
            <ButtonLink href={`${CONSOLE_ROUTES.bank}?sumber=imported`} variant="secondary" size="S">
              Buka Bank soal
            </ButtonLink>
          }
        >
          Soal tampil dengan sumber Impor resmi dan bisa dipakai di paper atau rencana.
        </InlineAlert>
      ) : null}

      <div role="group" aria-label="Saring soal" className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={cx(
                'h-10 cursor-pointer rounded-pill border-2 px-4 text-small font-bold tabular',
                on ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section
          ref={viewerRef}
          aria-labelledby="pdf-heading"
          className="flex min-w-0 flex-[1_1_360px] scroll-mt-20 flex-col gap-3.5 rounded-card border border-divider bg-surface p-5 max-sm:p-4 lg:sticky lg:top-6"
        >
          <div className="flex items-center gap-2">
            <h2 id="pdf-heading" className="m-0 text-body font-bold tabular" aria-live="polite">
              {pageCount > 0 ? `Halaman ${page + 1} dari ${pageCount}` : 'Halaman PDF'}
            </h2>
            {pageCount > 1 ? (
              <div className="ml-auto flex gap-2">
                <IconButton icon="chevronLeft" label="Halaman sebelumnya" size="M" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
                <IconButton
                  icon="chevronRight"
                  label="Halaman berikutnya"
                  size="M"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                />
              </div>
            ) : null}
          </div>
          {pageCount > 0 ? (
            <>
              <div className="aspect-[210/297] overflow-hidden rounded-sm border border-border bg-white">
                {/* Gambar halaman dari server (render PDF), ukuran tetap A4. */}
                <img
                  src={batch.pages[page]}
                  alt={`Halaman ${page + 1} dari ${batch.title}.${onPage.length ? ` Berisi soal ${joinNumbers(onPage)}.` : ''}`}
                  className="block size-full object-contain"
                />
              </div>
              <p className="m-0 text-small text-fg-muted">
                {onPage.length
                  ? `Soal di halaman ini: ${joinNumbers(onPage)}. Bandingkan teks hasil baca di samping dengan halaman ini sebelum menyetujui.`
                  : 'Halaman ini tidak berisi soal yang terbaca, misalnya sampul atau tabel kunci.'}
              </p>
              {cropping ? (
                <FigureCropper
                  key={page}
                  batchId={batch.id}
                  pageUrl={batch.pages[page]!}
                  pageNumber={page + 1}
                  pageAlt={`Halaman ${page + 1} dari ${batch.title}, untuk memotong gambar soal.`}
                  items={items.filter((i) => pageOf(i) === page && !i.approved)}
                  actions={actions}
                  onClose={() => setCropping(false)}
                />
              ) : (
                <div>
                  <Button variant="secondary" size="S" icon="edit" onClick={() => setCropping(true)}>
                    Potong gambar soal
                  </Button>
                </div>
              )}
              <ActionError error={removeFig.error} />
            </>
          ) : (
            <p className="m-0 text-body text-fg-muted">Gambar halaman PDF belum tersedia untuk paket ini.</p>
          )}
        </section>

        <section aria-label="Soal hasil impor" className="flex min-w-0 flex-[1.4_1_520px] flex-col gap-4">
          {filter !== 'lolos' ? (
            check.length === 0 ? (
              filter === 'cek' ? (
                <EmptyState compact icon="checkCircle" title="Tidak ada soal yang perlu dicek." body="Semua soal di paket ini lolos validator. Setujui dari daftar Lolos." />
              ) : null
            ) : (
              check.map((it) =>
                skipped.has(it.index) ? (
                  <SkippedRow key={it.index} item={it} onReopen={() => setSkipped((s) => withOut(s, it.index))} />
                ) : (
                  <CheckArticle
                    key={it.index}
                    batchId={batch.id}
                    item={it}
                    page={pageOf(it)}
                    edited={edited.has(it.index)}
                    actions={actions}
                    onShowPage={() => showPage(it)}
                    onEdit={() => setEditing(it)}
                    onRemoveFigure={() => dropFigure(it)}
                    onSkip={() => setSkipped((s) => new Set(s).add(it.index))}
                    onApproved={(change) => {
                      patch(it.index, { ...change, approved: true })
                      toast({ tone: 'success', title: `Soal ${it.number} masuk Bank soal.` })
                    }}
                  />
                ),
              )
            )
          ) : null}
          {filter !== 'cek' && passed.length > 0 ? (
            <Card as="section" padding="none" aria-label="Soal yang lolos validator" className="px-6 py-2 max-sm:px-4">
              <ul className="m-0 flex list-none flex-col p-0">
                {passed.map((it) => (
                  <PassedRow key={it.index} item={it} onEdit={() => setEditing(it)} onShowPage={() => showPage(it)} hasPage={pageOf(it) >= 0} onRemoveFigure={() => dropFigure(it)} />
                ))}
              </ul>
            </Card>
          ) : null}
          {filter === 'lolos' && passed.length === 0 ? (
            <EmptyState compact icon="alert" title="Belum ada soal yang lolos validator." body="Cek soal di daftar Perlu dicek satu per satu." />
          ) : null}
        </section>
      </div>

      <EditItemDialog
        item={editing}
        batchId={batch.id}
        actions={actions}
        onClose={() => setEditing(null)}
        onSaved={(it, change) => {
          patch(it.index, change)
          setEdited((s) => new Set(s).add(it.index))
          setEditing(null)
          toast({ tone: 'success', title: `Perubahan soal ${it.number} tersimpan.` })
        }}
      />
    </>
  )
}

/** Chip ringkasan 32px (papan ImporPaket): selalu ikon atau angka plus teks. */
function SummaryChip({ tone, children }: { tone: 'success' | 'warn' | 'neutral'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-small font-bold tabular',
        tone === 'success' && 'border-success bg-science-50',
        tone === 'warn' && 'border-warn bg-surface',
        tone === 'neutral' && 'border-border bg-bg',
      )}
    >
      {children}
    </span>
  )
}

function withOut(s: Set<number>, v: number): Set<number> {
  const n = new Set(s)
  n.delete(v)
  return n
}

function headerLine(batch: Batch, meta: ImportDTO['batches'][number] | undefined): string {
  const pages = batch.pages.length ? `, ${batch.pages.length} halaman` : ''
  const when = meta ? ` Diunggah ${dateId(meta.createdAt, true)}, pukul ${timeId(meta.createdAt)}.` : ''
  return `${batch.title}${pages}.${when}`
}

function ParsingState() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <EmptyState
      icon="sync"
      title="PDF sedang dibaca."
      body="Soal tampil di sini setelah Kira selesai membaca semua halaman, biasanya dalam beberapa menit."
      actions={
        <Button variant="secondary" icon="sync" loading={pending} onClick={() => start(() => router.refresh())}>
          Muat ulang status
        </Button>
      }
    />
  )
}

/** Isu per status. DTO hanya memberi status, jadi penjelasannya disusun dari data soal. */
function describeIssue(it: ImportItemDTO, page: number): { title: string; body: string } {
  const lastLetter = letter(it.options.length - 1)
  const where = page >= 0 ? `halaman ${page + 1}` : 'PDF'
  switch (it.status) {
    case 'broken-fraction': {
      const fixed = fixFractions(it.options)
      const list = fixed.map((o, i) => `${letter(i)} ${o}`).join(', ')
      return {
        title: 'Pecahan rusak di opsi jawaban.',
        body: `PDF menyimpan pecahan sebagai dua angka terpisah, jadi 1/4 terbaca "1 4". Perbaikan otomatis: ${list}.${it.answerFromKey != null ? ` Kunci dari tabel: ${letter(it.answerFromKey)}.` : ''}`,
      }
    }
    case 'leftover-key-text': {
      const { leftover } = splitLeftover(it.prompt)
      const match = it.answerFromKey != null && it.answer != null && it.answerFromKey === it.answer
      return {
        title: leftover ? `Teks soal berakhir dengan "${leftover}".` : 'Teks soal memuat sisa teks kunci.',
        body: `Teks ini sisa kunci jawaban di PDF dan dihapus sebelum soal tampil ke learner.${match ? ` Kunci dari tabel juga ${letter(it.answerFromKey)}, jadi keduanya cocok.` : ''}`,
      }
    }
    case 'key-mismatch': {
      if (it.answerFromKey != null && it.answerFromKey >= it.options.length) {
        return {
          title: `Tabel kunci menulis ${letter(it.answerFromKey)} untuk soal ini.`,
          body: `Soal ini hanya punya opsi A sampai ${lastLetter}. Cek ${where}, pilih kunci yang benar, lalu setujui.`,
        }
      }
      if (it.answerFromKey != null && it.answer != null) {
        return {
          title: `Tabel kunci menulis ${letter(it.answerFromKey)}, hasil baca soal menunjuk ${letter(it.answer)}.`,
          body: `Cek ${where}, pilih kunci yang benar, lalu setujui.`,
        }
      }
      return { title: 'Kunci soal ini tidak ditemukan di tabel kunci.', body: `Cek ${where}, pilih kunci yang benar, lalu setujui.` }
    }
    case 'needs-check':
      return {
        title: 'Validator belum yakin dengan hasil baca soal ini.',
        body: `Bandingkan teks dan opsi dengan ${where}. Setujui bila sudah sama, atau perbaiki lewat Edit soal.`,
      }
    default:
      return { title: '', body: '' }
  }
}

function CheckArticle({
  batchId,
  item: it,
  page,
  edited,
  actions,
  onShowPage,
  onEdit,
  onRemoveFigure,
  onSkip,
  onApproved,
}: {
  batchId: string
  item: ImportItemDTO
  page: number
  edited: boolean
  actions: ImportActions
  onShowPage: () => void
  onEdit: () => void
  onRemoveFigure: () => void
  onSkip: () => void
  onApproved: (change: Partial<ImportItemDTO>) => void
}) {
  const auto = useId()
  const keyId = `kunci-${auto.replace(/:/g, '')}`
  const headingId = `soal-${it.index}-judul`
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ActionFailure | null>(null)
  const update = useAction(actions.updateImportItem)
  const approve = useAction(actions.approveImportItems)

  // Kunci usulan AI (PDF tanpa kunci) tidak dipakai otomatis: tutor memilih kunci sendiri.
  const needsKey = !edited && !it.approved && (it.status === 'key-mismatch' || it.answer == null || it.keyCheck === 'ai-only')
  const chosen = needsKey ? (key === '' ? null : Number(key)) : it.answer
  const { text, leftover } = splitLeftover(it.prompt)
  const showLeftover = it.status === 'leftover-key-text' && !edited && !it.approved && leftover
  const issue = describeIssue(it, page)
  const approveLabel = edited
    ? 'Setujui'
    : it.status === 'broken-fraction'
      ? 'Pakai perbaikan lalu setujui'
      : it.status === 'leftover-key-text'
        ? 'Hapus sisa teks lalu setujui'
        : 'Setujui'

  async function run() {
    if (needsKey && chosen == null) {
      setKeyError(`Pilih kunci dulu. Opsi soal ini A sampai ${letter(it.options.length - 1)}.`)
      document.getElementById(keyId)?.focus()
      return
    }
    setPending(true)
    setError(null)
    try {
      let change: Partial<ImportItemDTO> = {}
      if (!edited && (it.status !== 'ok' || needsKey)) {
        const prompt = it.status === 'leftover-key-text' ? text : it.prompt
        const options = it.status === 'broken-fraction' ? fixFractions(it.options) : it.options
        const answer = chosen
        const changed = prompt !== it.prompt || options.some((o, i) => o !== it.options[i]) || answer !== it.answer
        if (changed) {
          const u = await update.run({ batchId, index: it.index, prompt, options, answer })
          if (!u.ok) {
            setError(u)
            return
          }
          change = { prompt, options, answer }
        }
      }
      const r = await approve.run({ batchId, indexes: [it.index] })
      if (!r.ok) {
        setError(r)
        return
      }
      onApproved(change)
    } finally {
      setPending(false)
    }
  }

  return (
    <article
      aria-labelledby={headingId}
      className={cx('flex min-w-0 flex-col gap-3.5 rounded-card border bg-surface p-6 max-sm:p-4', it.approved ? 'border-success' : 'border-divider')}
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <h2 id={headingId} className="m-0 text-h3 font-bold">
          Soal {it.number}
        </h2>
        {it.approved ? (
          <Pill tone="success">
            <ConsoleIcon name="check" size={14} strokeWidth={3} className="text-success" />
            Disetujui
          </Pill>
        ) : (
          <Pill tone="warn">
            <ConsoleIcon name="alert" size={14} strokeWidth={2.5} className="text-warn" />
            {STATUS_LABEL[it.status]}
          </Pill>
        )}
        {edited && !it.approved ? <Pill>Sudah diedit</Pill> : null}
        {page >= 0 ? (
          <Button variant="quiet" size="S" icon="eye" className="ml-auto" onClick={onShowPage} aria-label={`Lihat halaman ${page + 1} untuk soal ${it.number}`}>
            Halaman {page + 1}
          </Button>
        ) : null}
      </header>

      <p lang="id" className="m-0 max-w-[64ch] font-reading text-body-lg">
        {showLeftover ? text : it.prompt}
        {showLeftover ? (
          <mark className="ml-2 rounded-sm border-2 border-warn bg-surface px-1.5 font-body text-body font-bold text-fg">{leftover}</mark>
        ) : null}
      </p>

      <ol aria-label="Opsi jawaban" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-2 p-0">
        {it.options.map((o, i) => {
          const isKey = chosen === i
          return (
            <li
              key={i}
              className={cx(
                'flex min-h-11 items-center gap-2 rounded-control px-2.5 py-1.5',
                isKey ? 'border-2 border-success bg-science-50' : 'border border-divider bg-surface',
              )}
            >
              <span
                className={cx(
                  'inline-flex size-7 flex-none items-center justify-center rounded-pill text-small font-bold',
                  isKey ? 'bg-success text-white' : 'border-2 border-border bg-surface text-fg',
                )}
              >
                {letter(i)}
              </span>
              <span lang="id" className="min-w-0 font-reading text-body-lg [overflow-wrap:anywhere]">
                {o}
              </span>
              {isKey ? <span className="visually-hidden">(kunci)</span> : null}
            </li>
          )
        })}
      </ol>

      <FigureThumb item={it} onRemove={onRemoveFigure} />
      <KeyCheckNote item={it} />

      {it.figureNote ? (
        <p className="m-0 flex items-start gap-2 text-small text-fg-muted">
          <ConsoleIcon name="infoCircle" size={18} className="mt-0.5" />
          <span>{it.figureNote}</span>
        </p>
      ) : null}

      {!it.approved ? (
        <div className="flex items-start gap-2.5 rounded-control border border-divider bg-bg px-4 py-3">
          <ConsoleIcon name="alert" size={22} strokeWidth={2.5} className="mt-0.5 text-warn" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="text-body">{edited ? 'Soal sudah diedit.' : issue.title}</strong>
            <span className="text-body">{edited ? 'Cek sekali lagi dengan halaman PDF, lalu setujui.' : issue.body}</span>
          </div>
        </div>
      ) : null}

      {needsKey ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={keyId} className="text-body font-bold">
              Kunci yang benar
            </label>
            <div className="relative">
              <select
                id={keyId}
                value={key}
                aria-invalid={keyError ? true : undefined}
                aria-describedby={keyError ? `${keyId}-error` : undefined}
                onChange={(e) => {
                  setKey(e.target.value)
                  setKeyError(null)
                }}
                className={cx(
                  'h-11 min-w-40 cursor-pointer appearance-none rounded-control border-2 bg-surface pr-10 pl-3 text-body text-fg',
                  keyError ? 'border-danger' : 'border-border hover:border-fg',
                )}
              >
                <option value="">Pilih kunci</option>
                {it.options.map((_, i) => (
                  <option key={i} value={String(i)}>
                    {letter(i)}
                  </option>
                ))}
              </select>
              <ConsoleIcon name="chevronDown" size={16} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
            </div>
          </div>
          {keyError ? <FieldError id={`${keyId}-error`}>{keyError}</FieldError> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {it.approved ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-body font-bold">
            <ConsoleIcon name="checkCircle" size={20} strokeWidth={2.5} className="text-success" />
            Masuk Bank soal sebagai sumber resmi.
          </span>
        ) : (
          <>
            <Button variant="primary" loading={pending} onClick={run}>
              {approveLabel}
            </Button>
            <Button variant="secondary" icon="edit" onClick={onEdit} disabled={pending}>
              Edit soal
            </Button>
            <Button variant="quiet" onClick={onSkip} disabled={pending}>
              Lewati
            </Button>
          </>
        )}
      </div>
      <ActionError error={error} />
    </article>
  )
}

function SkippedRow({ item, onReopen }: { item: ImportItemDTO; onReopen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-4 max-sm:px-4">
      <span className="min-w-0 flex-[1_1_240px] text-body">
        <strong>Soal {item.number}</strong> dilewati dan belum masuk Bank soal.
      </span>
      <Button variant="secondary" size="S" onClick={onReopen}>
        Buka lagi
      </Button>
    </div>
  )
}

function PassedRow({ item: it, onEdit, onShowPage, hasPage, onRemoveFigure }: { item: ImportItemDTO; onEdit: () => void; onShowPage: () => void; hasPage: boolean; onRemoveFigure: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-divider py-2.5 last:border-b-0">
      <span className="w-16 flex-none text-body font-bold tabular">Soal {it.number}</span>
      <span lang="id" title={it.prompt} className="min-w-0 flex-[1_1_220px] truncate text-body">
        {it.prompt}
      </span>
      <span className="flex-none text-small font-bold tabular">{it.answer != null ? `Kunci ${letter(it.answer)}` : 'Tanpa kunci'}</span>
      {it.keyCheck === 'agree' ? <Pill>Cocok dengan AI</Pill> : null}
      {it.figure ? (
        <span className="inline-flex items-center gap-2">
          <img src={it.figure.url} alt={it.figure.alt} className="h-10 max-w-20 rounded-sm border border-border bg-white object-contain" />
          <Pill>Ada gambar</Pill>
        </span>
      ) : null}
      {it.approved ? (
        <Pill tone="success">
          <ConsoleIcon name="check" size={14} strokeWidth={3} className="text-success" />
          Disetujui
        </Pill>
      ) : (
        <Pill tone="success">Lolos</Pill>
      )}
      <span className="flex flex-none gap-1">
        {hasPage ? <IconButton icon="eye" label={`Lihat halaman soal ${it.number}`} size="S" variant="quiet" onClick={onShowPage} /> : null}
        {!it.approved ? <IconButton icon="edit" label={`Edit soal ${it.number}`} size="S" variant="quiet" onClick={onEdit} /> : null}
        {!it.approved && it.figure ? <IconButton icon="close" label={`Lepas gambar soal ${it.number}`} size="S" variant="quiet" onClick={onRemoveFigure} /> : null}
      </span>
    </li>
  )
}

function EditItemDialog({
  item,
  batchId,
  actions,
  onClose,
  onSaved,
}: {
  item: ImportItemDTO | null
  batchId: string
  actions: ImportActions
  onClose: () => void
  onSaved: (item: ImportItemDTO, change: Partial<ImportItemDTO>) => void
}) {
  const [src, setSrc] = useState<ImportItemDTO | null>(null)
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [answer, setAnswer] = useState('')
  const [errors, setErrors] = useState<{ prompt?: string; options?: Record<number, string>; answer?: string }>({})
  const save = useAction(actions.updateImportItem)

  if (item && item !== src) {
    setSrc(item)
    const clean = item.status === 'leftover-key-text' ? splitLeftover(item.prompt).text : item.prompt
    setPrompt(clean)
    setOptions(item.status === 'broken-fraction' ? fixFractions(item.options) : item.options)
    setAnswer(item.answer != null && item.answer < item.options.length ? String(item.answer) : '')
    setErrors({})
    save.reset()
  }

  async function submit() {
    if (!item) return
    const next: typeof errors = {}
    const p = prompt.trim()
    if (!p) next.prompt = 'Teks soal masih kosong. Salin teks dari halaman PDF.'
    else if (p.length > PROMPT_MAX) next.prompt = `Teks soal paling banyak ${PROMPT_MAX} karakter, sekarang ${p.length}.`
    const optErr: Record<number, string> = {}
    options.forEach((o, i) => {
      if (!o.trim()) optErr[i] = `Opsi ${letter(i)} masih kosong.`
      else if (o.trim().length > OPTION_MAX) optErr[i] = `Opsi ${letter(i)} paling banyak ${OPTION_MAX} karakter, sekarang ${o.trim().length}.`
    })
    if (Object.keys(optErr).length) next.options = optErr
    if (answer === '') next.answer = 'Pilih kunci yang benar.'
    setErrors(next)
    if (next.prompt || next.options || next.answer) return
    const change = { prompt: p, options: options.map((o) => o.trim()), answer: Number(answer) }
    const r = await save.run({ batchId, index: item.index, ...change })
    if (r.ok) onSaved(item, change)
  }

  return (
    <Dialog
      open={item != null}
      onClose={onClose}
      size="lg"
      dismissible={!save.pending}
      title={item ? `Edit soal ${item.number}` : 'Edit soal'}
      description="Samakan teks dan opsi dengan halaman PDF. Perubahan tersimpan di paket impor, belum masuk Bank soal sebelum disetujui."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Batal
          </Button>
          <Button variant="primary" loading={save.pending} onClick={submit}>
            Simpan perubahan
          </Button>
        </>
      }
    >
      {item ? (
        <div className="flex flex-col gap-4">
          <TextArea
            label="Teks soal"
            lang="id"
            rows={4}
            value={prompt}
            error={errors.prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="font-reading text-body-lg"
          />
          <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
            <legend className="mb-1.5 p-0 text-small font-bold">Opsi jawaban</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((o, i) => (
                <TextField
                  key={i}
                  label={`Opsi ${letter(i)}`}
                  lang="id"
                  value={o}
                  error={errors.options?.[i]}
                  onChange={(e) => setOptions((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                  autoComplete="off"
                />
              ))}
            </div>
          </fieldset>
          <Select
            label="Kunci yang benar"
            value={answer}
            error={errors.answer}
            onChange={(e) => setAnswer(e.target.value)}
            fieldClassName="max-w-[220px]"
            options={[{ value: '', label: 'Pilih kunci' }, ...options.map((_, i) => ({ value: String(i), label: letter(i) }))]}
          />
          {item.answerFromKey != null ? (
            <p className="m-0 text-small text-fg-muted">
              Tabel kunci di PDF menulis {letter(item.answerFromKey)}
              {item.answerFromKey >= item.options.length ? ', padahal opsi soal ini hanya sampai ' + letter(item.options.length - 1) : ''}.
            </p>
          ) : null}
          <ActionError error={save.error} />
        </div>
      ) : null}
    </Dialog>
  )
}
