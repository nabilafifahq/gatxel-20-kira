'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AiDraftDTO, StudioAiActions, StudioAiDTO } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ActionError, EmptyState, InlineAlert, StatusText } from '@/components/console/Feedback'
import { RadioGroup, Select, TextArea, TextField } from '@/components/console/Field'
import { dateTimeId, num, SUBJECT_LABEL } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { SkillPicker } from '@/components/console/SkillPicker'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'
import { wordDiff, type DiffPart } from '@/components/console/wordDiff'
import { ItemStatic } from '@/components/print/ItemStatic'

/**
 * T11 Studio AI (papan StudioAi, StudioAiBatas): minta draf ke worker AI, pantau job,
 * tinjau draf dengan perbandingan berdampingan dan edit JSON, lalu setujui atau tolak.
 * Draf tidak pernah dipakai sebelum disetujui tutor. Prompt tidak memuat data anak.
 */

export type StudioAiScreenProps = { data: StudioAiDTO; actions: StudioAiActions }

type Kind = 'items' | 'variants' | 'hints' | 'translate' | 'rubric'

const KIND_LABEL: Record<Kind, string> = {
  items: 'Soal baru',
  variants: 'Varian dari soal yang ada',
  hints: 'Hint bertingkat',
  translate: 'Terjemahan',
  rubric: 'Rubrik penilaian',
}

const DRAFT_KIND: Record<string, string> = {
  items: 'Soal baru',
  item: 'Soal baru',
  variants: 'Varian',
  variant: 'Varian',
  hints: 'Hint',
  translate: 'Terjemahan',
  rubric: 'Rubrik',
  grade: 'Saran nilai',
  import: 'Baca PDF impor',
  test: 'Tes koneksi',
  mcp: 'Draf dari Claude (MCP)',
}

/** Ref soal di Bank soal: m2.oly-patterns.003, org:<uuid>, atau gen:<skill>:<level>:<seed>. */
const ITEM_REF = /^[a-z0-9][a-z0-9.:_-]{2,199}$/i

const JOB_STATUS = {
  queued: { tone: 'muted' as const, icon: 'clock' as const, label: 'Menunggu antrean' },
  running: { tone: 'info' as const, icon: 'sync' as const, label: 'Berjalan' },
  done: { tone: 'success' as const, icon: 'checkCircle' as const, label: 'Selesai' },
  failed: { tone: 'danger' as const, icon: 'alert' as const, label: 'Gagal' },
}

function Marked({ parts, side }: { parts: DiffPart[]; side: 'left' | 'right' }) {
  return (
    <>
      {parts.map((p, i) =>
        p.mark === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : side === 'right' ? (
          <ins key={i} className="rounded-sm bg-science-50 px-0.5 no-underline">
            {p.text}
          </ins>
        ) : (
          <del key={i} className="rounded-sm bg-danger-50 px-0.5">
            {p.text}
          </del>
        ),
      )}
    </>
  )
}

function draftStatus(d: AiDraftDTO): { label: string; tone: 'neutral' | 'success' | 'danger' | 'warn' } {
  if (d.status === 'approved') return { label: 'Disetujui', tone: 'success' }
  if (d.status === 'rejected') return { label: 'Ditolak', tone: 'neutral' }
  if (d.problems.length) return { label: 'Perlu dicek', tone: 'danger' }
  return { label: 'Menunggu tinjau', tone: 'neutral' }
}

function DraftReview({ d, actions, onDone }: { d: AiDraftDTO; actions: StudioAiActions; onDone: (status: AiDraftDTO['status'], ref?: string) => void }) {
  const toast = useToast()
  const [json, setJson] = useState(d.json)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(d.item == null)
  const approve = useAction(actions.approveDraft)
  const reject = useAction(actions.rejectDraft)
  const diff = useMemo(() => (d.compareTo && d.item ? wordDiff(d.compareTo.item.prompt, d.item.prompt) : null), [d])
  const edited = json !== d.json
  const open = d.status === 'pending'

  async function doApprove() {
    try {
      JSON.parse(json)
    } catch (e) {
      setJsonError(`JSON tidak valid: ${e instanceof Error ? e.message : 'format salah'}. Perbaiki lalu setujui lagi.`)
      setShowJson(true)
      return
    }
    if (d.problems.length && !edited) {
      setJsonError('Draf ini masih punya masalah dari pemeriksaan otomatis. Perbaiki JSON-nya dulu, atau tolak draf ini.')
      setShowJson(true)
      return
    }
    setJsonError(null)
    const r = await approve.run({ draftId: d.id, json })
    if (r.ok) {
      toast({ tone: 'success', title: `Draf disetujui sebagai ${r.data.ref}.`, body: 'Soal masuk bank soal setelah pemeriksaan server.' })
      onDone('approved', r.data.ref)
    }
  }

  async function doReject() {
    const r = await reject.run(d.id)
    if (r.ok) {
      toast({ tone: 'success', title: 'Draf ditolak.' })
      onDone('rejected')
    }
  }

  return (
    <section aria-labelledby="tinjau-draf" className="flex min-w-0 flex-[2_1_480px] flex-col gap-4 rounded-card border border-divider bg-surface p-6 max-sm:p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="tinjau-draf" className="m-0 text-h2 font-bold max-sm:text-h3">
          {DRAFT_KIND[d.kind] ?? d.kind}
          {d.compareTo ? ` dari ${d.compareTo.ref}` : ''}
        </h2>
        <span className="text-body text-fg-muted">
          Dibuat {dateTimeId(d.createdAt)}, job {d.jobId}. {d.item ? `Skill ${d.item.skill}, kesulitan ${d.item.difficulty}.` : ''}
        </span>
      </div>

      {d.item ? (
        <div className="grid gap-4 md:grid-cols-2">
          {d.compareTo ? (
            <div className="flex min-w-0 flex-col gap-2 rounded-control border border-divider p-3.5">
              <span className="text-small font-bold text-fg-muted">Soal asal, {d.compareTo.ref}</span>
              {diff ? (
                <p lang={d.compareTo.item.lang} className="m-0 font-reading text-body-lg">
                  <Marked parts={diff.left} side="left" />
                </p>
              ) : null}
              <ItemStatic item={{ ...d.compareTo.item, prompt: '' }} variant="screen" />
            </div>
          ) : null}
          <div className={cx('flex min-w-0 flex-col gap-2 rounded-control border-2 border-math p-3.5', !d.compareTo && 'md:col-span-2')}>
            <span className="text-small font-bold text-math">Draf</span>
            {diff ? (
              <p lang={d.item.lang} className="m-0 font-reading text-body-lg">
                <Marked parts={diff.right} side="right" />
              </p>
            ) : null}
            <ItemStatic item={diff ? { ...d.item, prompt: '' } : d.item} variant="screen" />
          </div>
        </div>
      ) : (
        <InlineAlert tone="warn" title="Draf ini belum bisa ditampilkan sebagai soal." live="none">
          Isinya berupa rubrik, hint, atau bagian soal lain yang tidak punya tampilan soal. Periksa isinya di JSON di bawah.
        </InlineAlert>
      )}
      {diff ? (
        <p aria-hidden="true" className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-small text-fg-muted">
          <span>
            <ins className="rounded-sm bg-science-50 px-1 text-fg no-underline">teks</ins> baru di draf
          </span>
          <span>
            <del className="rounded-sm bg-danger-50 px-1 text-fg">teks</del> tidak ada lagi di draf
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-body font-bold">Pemeriksaan otomatis</h3>
        {d.problems.length === 0 ? (
          <StatusText tone="success">Tidak ada masalah: kunci, panjang kalimat, dan isi sudah diperiksa.</StatusText>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {d.problems.map((p) => (
              <li key={p} className="flex items-start gap-2 text-body font-bold">
                <ConsoleIcon name="alert" size={18} strokeWidth={2.5} className="mt-0.5 text-danger" />
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>

      <details open={showJson} onToggle={(e) => setShowJson((e.target as HTMLDetailsElement).open)} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body font-bold [&::-webkit-details-marker]:hidden">
          <ConsoleIcon name="chevronDown" size={18} strokeWidth={2.5} className="transition-transform duration-150 ease-kira group-open:rotate-180" />
          Edit JSON draf
          {edited ? <Pill tone="warn">Diubah</Pill> : null}
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          <TextArea
            label="JSON soal"
            hideLabel
            rows={12}
            value={json}
            onChange={(e) => {
              setJson(e.target.value)
              setJsonError(null)
            }}
            spellCheck={false}
            className="text-small leading-5"
            disabled={!open}
          />
          {edited ? (
            <Button variant="quiet" size="S" className="self-start" onClick={() => setJson(d.json)}>
              Kembalikan JSON asli
            </Button>
          ) : null}
        </div>
      </details>
      {jsonError ? <InlineAlert tone="danger" title={jsonError} /> : null}
      <ActionError error={approve.error ?? reject.error} />

      {open ? (
        <div className="flex flex-wrap gap-2.5 border-t border-divider pt-3">
          <Button variant="primary" icon="check" onClick={doApprove} loading={approve.pending} disabled={reject.pending}>
            {edited ? 'Setujui dengan perubahan' : 'Setujui'}
          </Button>
          <Button variant="secondary" tone="danger" icon="x" onClick={doReject} loading={reject.pending} disabled={approve.pending}>
            Tolak
          </Button>
        </div>
      ) : (
        <p className="m-0 border-t border-divider pt-3 text-body">{d.status === 'approved' ? 'Draf ini sudah disetujui dan masuk bank soal.' : 'Draf ini ditolak dan tidak dipakai.'}</p>
      )}
    </section>
  )
}

export function StudioAiScreen({ data, actions }: StudioAiScreenProps) {
  const toast = useToast()
  const limited = data.usage.used >= data.usage.limit
  const ready = data.provider.ready
  const formOff = limited || !ready
  const [kind, setKind] = useState<Kind>('variants')
  const [skillId, setSkillId] = useState<string | null>(data.skills[0]?.id ?? null)
  const [count, setCount] = useState('5')
  const [difficulty, setDifficulty] = useState('2')
  const [itemRef, setItemRef] = useState('')
  const [instructions, setInstructions] = useState('')
  const [errors, setErrors] = useState<{ skill?: string; count?: string; ref?: string; text?: string }>({})
  const request = useAction(actions.requestDrafts)
  const [srcDrafts, setSrcDrafts] = useState(data.drafts)
  const [drafts, setDrafts] = useState(data.drafts)
  const [sel, setSel] = useState<string | null>(data.drafts.find((d) => d.status === 'pending')?.id ?? data.drafts[0]?.id ?? null)
  // Data baru dari server (setelah action atau muat ulang) menggantikan status lokal.
  if (srcDrafts !== data.drafts) {
    setSrcDrafts(data.drafts)
    setDrafts(data.drafts)
  }
  const needsRef = kind === 'variants' || kind === 'hints' || kind === 'translate' || kind === 'rubric'
  const pct = Math.min(100, Math.round((data.usage.used / Math.max(1, data.usage.limit)) * 100))
  const pending = drafts.filter((d) => d.status === 'pending').length
  const current = drafts.find((d) => d.id === sel) ?? null

  async function submit() {
    const e: typeof errors = {}
    const n = Number(count)
    if (!skillId) e.skill = 'Pilih skill dulu.'
    if (!Number.isInteger(n) || n < 1 || n > 10) e.count = `Jumlah draf 1 sampai 10. Isian sekarang: ${count || 'kosong'}.`
    if (needsRef && !ITEM_REF.test(itemRef.trim())) e.ref = 'Tulis ID soal asal dari Bank soal, misalnya m2.oly-patterns.003.'
    if (/@|\b\d{16}\b/.test(instructions)) e.text = 'Instruksi tidak boleh memuat email, NIK, atau data pribadi.'
    setErrors(e)
    if (e.skill || e.count || e.ref || e.text || !skillId) return
    const r = await request.run({ kind, skillId, count: n, difficulty: Number(difficulty), itemRef: needsRef ? itemRef.trim() : undefined, instructions: instructions.trim() })
    if (r.ok) toast({ tone: 'success', title: 'Permintaan masuk antrean.', body: 'Draf muncul di antrean tinjau setelah job selesai.' })
  }

  return (
    <ConsoleShell shell={data.shell} active="studio">
      <nav aria-label="Jejak" className="-mb-4 flex flex-wrap items-center gap-2 text-small text-fg-muted">
        <Link href={CONSOLE_ROUTES.bank} className="font-semibold">
          Bank soal
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Studio AI</span>
      </nav>

      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Studio AI</h1>
          <p className="m-0 text-body text-fg-muted">Claude menulis draf. Draf baru masuk bank soal setelah disetujui tutor.</p>
        </div>
        <div className="flex min-w-[240px] flex-[0_1_320px] flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-small font-semibold">
            <span>Job AI bulan ini</span>
            <span className={cx('tabular', limited ? 'font-bold text-danger' : pct >= 80 ? 'font-bold text-warn' : 'text-fg')}>
              {num(data.usage.used)} dari {num(data.usage.limit)}
            </span>
          </div>
          <div
            role="meter"
            aria-label="Job AI bulan ini"
            aria-valuemin={0}
            aria-valuemax={data.usage.limit}
            aria-valuenow={data.usage.used}
            aria-valuetext={`${data.usage.used} dari ${data.usage.limit} job`}
            className="flex h-3 overflow-hidden rounded-pill bg-divider"
          >
            <span className={cx('h-full', limited ? 'bg-danger' : pct >= 80 ? 'bg-warn' : 'bg-fg')} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-small text-fg-muted">
            {data.provider.name}, {data.provider.ready ? 'siap' : 'belum siap'}
          </span>
        </div>
      </header>

      {limited ? (
        <InlineAlert tone="danger" title="Batas job AI bulan ini tercapai. Permintaan draf baru berhenti sampai tanggal 1 bulan depan." live="status">
          Draf yang sudah ada tetap bisa ditinjau dan disetujui. Batas diubah lewat variabel AI_MONTHLY_JOB_LIMIT oleh pemilik server.
        </InlineAlert>
      ) : null}
      {!ready ? (
        <InlineAlert
          tone="warn"
          title="Claude belum tersambung."
          action={
            <ButtonLink href={CONSOLE_ROUTES.claude} variant="secondary" size="S">
              Buka Koneksi Claude
            </ButtonLink>
          }
        >
          {data.provider.detail}
        </InlineAlert>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <section aria-labelledby="minta-draf" className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-5 max-sm:p-4">
            <h2 id="minta-draf" className="m-0 text-h3 font-bold">
              Minta draf
            </h2>
            <fieldset disabled={formOff} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-60">
              <RadioGroup name="jenis-draf" legend="Jenis draf" value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              <SkillPicker
                skills={data.skills.map((s) => ({ ...s }))}
                value={skillId}
                onChange={(id) => (setSkillId(id), setErrors((x) => ({ ...x, skill: undefined })))}
                error={errors.skill}
                showSubject
              />
              {needsRef ? (
                <TextField
                  label="ID soal asal"
                  value={itemRef}
                  onChange={(e) => (setItemRef(e.target.value), setErrors((x) => ({ ...x, ref: undefined })))}
                  error={errors.ref}
                  hint="Skill draf mengikuti soal asal."
                  placeholder="m2.oly-patterns.003"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Jumlah draf" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} error={errors.count} autoComplete="off" />
                <Select label="Kesulitan" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} dari 5` }))} />
              </div>
              <TextArea
                label="Instruksi tambahan, boleh kosong"
                rows={3}
                maxLength={500}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                error={errors.text}
                hint="Contoh: pakai konteks pasar dan uang rupiah. Jangan tulis nama atau data anak."
              />
            </fieldset>
            <p className="m-0 text-small text-fg-muted">Contoh soal dari bank dikirim tanpa data anak. Hasil masuk antrean tinjau.</p>
            <ActionError error={request.error} />
            <Button variant="primary" onClick={submit} loading={request.pending} disabled={formOff} aria-describedby={formOff ? 'alasan-mati' : undefined}>
              Kirim permintaan
            </Button>
            {formOff ? (
              <span id="alasan-mati" className="text-small text-fg-muted">
                {limited ? 'Formulir mati karena batas job bulan ini tercapai.' : 'Formulir mati sampai Claude tersambung.'}
              </span>
            ) : null}
          </section>

          <section aria-labelledby="job-terakhir" className="flex flex-col gap-2.5">
            <h2 id="job-terakhir" className="m-0 text-h3 font-bold">
              Job terakhir
            </h2>
            {data.jobs.length === 0 ? (
              <p className="m-0 text-body text-fg-muted">Belum ada job.</p>
            ) : (
              <ul className="m-0 list-none rounded-card border border-divider bg-surface px-4 py-0">
                {data.jobs.map((j) => {
                  const st = JOB_STATUS[j.status]
                  return (
                    <li key={j.id} className="flex flex-col gap-1 border-b border-divider py-3 last:border-b-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-small font-bold text-math">{DRAFT_KIND[j.kind] ?? j.kind}</span>
                        <StatusText tone={st.tone} icon={st.icon} className="ml-auto text-small">
                          {st.label}
                        </StatusText>
                      </span>
                      <span className="text-body">{j.summary}</span>
                      <span className="text-small text-fg-muted">{dateTimeId(j.createdAt)}</span>
                      {j.error ? <span className="text-small font-bold text-danger">{j.error}</span> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="antrean" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <h2 id="antrean" className="m-0 text-h3 font-bold">
              Antrean tinjau
            </h2>
            <span className="ml-auto text-body font-bold tabular">{pending} menunggu</span>
          </div>
          {drafts.length === 0 ? (
            <EmptyState compact icon="sparkle" title="Belum ada draf." body="Kirim permintaan lewat formulir Minta draf. Draf muncul di sini setelah job selesai." />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {drafts.map((d) => {
                const st = draftStatus(d)
                const on = d.id === sel
                return (
                  <li key={d.id} className="flex">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSel(d.id)}
                      className={cx(
                        'flex flex-1 cursor-pointer flex-col gap-1 rounded-card bg-surface px-3.5 py-3 text-left text-fg',
                        on ? 'border-3 border-fg' : 'border border-divider hover:border-fg',
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-small font-bold text-math">{DRAFT_KIND[d.kind] ?? d.kind}</span>
                        <Pill tone={st.tone} className="ml-auto">
                          {st.label}
                        </Pill>
                      </span>
                      <span className="line-clamp-2 text-body font-bold">{d.item?.prompt ?? `Draf ${(DRAFT_KIND[d.kind] ?? d.kind).toLowerCase()}`}</span>
                      <span className="text-small text-fg-muted">
                        {d.compareTo ? `Dari ${d.compareTo.ref}, ` : ''}
                        {d.item ? `${SUBJECT_LABEL[(data.skills.find((s) => s.id === d.item?.skill)?.subject ?? 'math')]}, ` : ''}
                        {dateTimeId(d.createdAt)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {current ? (
          <DraftReview
            key={current.id}
            d={current}
            actions={actions}
            onDone={(status) => {
              setDrafts((list) => list.map((x) => (x.id === current.id ? { ...x, status } : x)))
              const next = drafts.find((x) => x.id !== current.id && x.status === 'pending')
              if (next) setSel(next.id)
            }}
          />
        ) : null}
      </div>
    </ConsoleShell>
  )
}
