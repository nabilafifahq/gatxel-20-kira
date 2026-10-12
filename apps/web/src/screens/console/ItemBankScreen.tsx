'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useEffect, useRef, useState, useTransition } from 'react'
import type { BankItemRow, ItemBankDTO, Subject } from '@/lib/dto'
import { ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { DataTable, type Column } from '@/components/console/DataTable'
import { EmptyState } from '@/components/console/Feedback'
import { Select, TextField } from '@/components/console/Field'
import { FilterChips } from '@/components/console/FilterChips'
import { num, pct, SUBJECT_LABEL, SUBJECT_TEXT, SUBJECTS } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { SOURCE_LABEL, typeLabel, TYPE_LABEL } from '@/components/console/labels'
import { PageHeader, Pill, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { ItemStatic } from '@/components/print/ItemStatic'

/**
 * T07 Bank soal (papan BankSoal, BankSoalKosong, DataTable). Filter tinggal di parameter URL:
 * mapel, grade, skill, tipe, kesulitan, sumber, q, halaman, dan soal (pratinjau).
 * Filter aktif tampil tiga kali: di kontrol, sebagai jumlah di label, dan sebagai chip
 * yang bisa dihapus di atas hasil, ditambah jumlah hasil dan Hapus semua filter.
 */

export type ItemBankScreenProps = { data: ItemBankDTO }

type Filters = ItemBankDTO['filters']

const PARAM: Record<keyof Filters, string> = {
  subject: 'mapel',
  grade: 'grade',
  skillId: 'skill',
  type: 'tipe',
  difficulty: 'kesulitan',
  source: 'sumber',
  q: 'q',
}

/** Ref panjang (gen:m6.decimals-multiply-divide:1) boleh turun baris setelah titik, titik dua, atau tanda hubung. */
function RefText({ value }: { value: string }) {
  const parts = value.split(/(?<=[.:-])/)
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  )
}

function toQuery(f: Filters, extra: Record<string, string | null> = {}): string {
  const p = new URLSearchParams()
  ;(Object.keys(PARAM) as (keyof Filters)[]).forEach((k) => {
    const v = f[k]
    if (v != null && v !== '') p.set(PARAM[k], String(v))
  })
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : '?'
}

export function ItemBankScreen({ data }: ItemBankScreenProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const f = data.filters
  const [q, setQ] = useState(f.q)
  const lastQ = useRef(f.q)

  // Kotak cari: kirim setelah berhenti mengetik 350ms.
  useEffect(() => {
    if (q === lastQ.current) return
    const h = window.setTimeout(() => {
      lastQ.current = q
      start(() => router.replace(`${pathname}${toQuery({ ...f, q })}`, { scroll: false }))
    }, 350)
    return () => window.clearTimeout(h)
  }, [q, f, pathname, router])

  useEffect(() => {
    lastQ.current = f.q
    setQ(f.q)
  }, [f.q])

  function go(next: Partial<Filters>) {
    start(() => router.replace(`${pathname}${toQuery({ ...f, ...next })}`, { scroll: false }))
  }

  const skillTitle = (id: string | null) => data.facets.skills.find((s) => s.id === id)?.title ?? id ?? ''
  const chips: { key: keyof Filters; label: string }[] = [
    ...(f.subject ? [{ key: 'subject' as const, label: `Mapel: ${SUBJECT_LABEL[f.subject]}` }] : []),
    ...(f.grade ? [{ key: 'grade' as const, label: `Grade: ${f.grade}` }] : []),
    ...(f.skillId ? [{ key: 'skillId' as const, label: `Skill: ${skillTitle(f.skillId)}` }] : []),
    ...(f.type ? [{ key: 'type' as const, label: `Tipe: ${typeLabel(f.type)}` }] : []),
    ...(f.difficulty ? [{ key: 'difficulty' as const, label: `Kesulitan: ${f.difficulty}` }] : []),
    ...(f.source ? [{ key: 'source' as const, label: `Sumber: ${SOURCE_LABEL[f.source as BankItemRow['source']] ?? f.source}` }] : []),
    ...(f.q ? [{ key: 'q' as const, label: `Cari: ${f.q}` }] : []),
  ]
  const clearAll = () => go({ subject: null, grade: null, skillId: null, type: null, difficulty: null, source: null, q: '' })
  const filtered = chips.length > 0
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const skills = data.facets.skills.filter((s) => (!f.subject || s.subject === f.subject) && (!f.grade || s.grade === f.grade))

  const columns: Column<BankItemRow>[] = [
    {
      key: 'soal',
      header: 'Soal',
      rowHeader: true,
      className: 'min-w-[240px]',
      cell: (r) => (
        <Link
          href={toQuery(f, { soal: r.ref, halaman: data.page > 1 ? String(data.page) : null })}
          scroll={false}
          aria-current={data.preview?.row.ref === r.ref ? 'true' : undefined}
          className="flex max-w-[460px] flex-col items-start gap-0.5 text-left font-normal text-fg no-underline hover:text-fg"
        >
          <span className={cx('text-small font-bold tabular', SUBJECT_TEXT[r.subject])}>
            <RefText value={r.ref} />
          </span>
          <span className="line-clamp-2 text-body underline decoration-divider decoration-2 underline-offset-3">{r.promptPreview}</span>
        </Link>
      ),
    },
    {
      key: 'skill',
      header: 'Skill dan tipe',
      cell: (r) => (
        <span className="flex flex-col">
          <span className="text-body">{r.skillTitle}</span>
          <span className="text-small text-fg-muted">
            {typeLabel(r.type)}, {SOURCE_LABEL[r.source]}
          </span>
        </span>
      ),
    },
    { key: 'kesulitan', header: 'Kesulitan', align: 'right', cell: (r) => <span className="whitespace-nowrap">{r.difficulty} dari 5</span>, hideBelow: 'md' },
    { key: 'akurasi', header: 'Akurasi', align: 'right', cell: (r) => <span className={r.accuracy == null ? 'text-fg-muted' : undefined}>{pct(r.accuracy)}</span> },
    { key: 'dipakai', header: 'Dipakai', align: 'right', cell: (r) => num(r.attempts) },
    {
      key: 'laporan',
      header: 'Laporan',
      align: 'right',
      cell: (r) =>
        r.reports > 0 ? (
          <span className="inline-flex items-center gap-1 font-bold text-warn">
            <ConsoleIcon name="alert" size={16} strokeWidth={2.5} />
            {r.reports}
          </span>
        ) : (
          <span className="text-fg-muted">0</span>
        ),
    },
  ]

  const p = data.preview
  return (
    <ConsoleShell shell={data.shell} active="bank">
      <PageHeader
        title="Bank soal"
        description={`${num(data.total)} soal${filtered ? ' sesuai filter' : ''}, dari Kira, paket resmi, tutor, dan Studio AI.`}
        actions={
          <>
            <ButtonLink href={CONSOLE_ROUTES.import} variant="secondary" icon="import">
              Impor paket resmi
            </ButtonLink>
            {data.shell.aiEnabled ? (
              <ButtonLink href={CONSOLE_ROUTES.studio} variant="secondary" icon="sparkle">
                Studio AI
              </ButtonLink>
            ) : null}
            <ButtonLink href={CONSOLE_ROUTES.paper} variant="primary" icon="paper">
              Susun paper
            </ButtonLink>
          </>
        }
      />

      <section aria-label="Filter" className="grid gap-4 rounded-card border border-divider bg-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 max-sm:px-4">
        <TextField
          label={f.q ? 'Cari teks soal (1)' : 'Cari teks soal'}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Contoh: katak, pukul, kubus"
          autoComplete="off"
          fieldClassName="sm:col-span-2 lg:col-span-4"
          className={f.q ? 'border-fg' : undefined}
        />
        <Select
          label={f.subject ? 'Mapel (1)' : 'Mapel'}
          active={Boolean(f.subject)}
          value={f.subject ?? ''}
          onChange={(e) => go({ subject: (e.target.value || null) as Subject | null, skillId: null })}
          options={[{ value: '', label: 'Semua mapel' }, ...SUBJECTS.map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))]}
        />
        <Select
          label={f.grade ? 'Grade (1)' : 'Grade'}
          active={Boolean(f.grade)}
          value={f.grade ? String(f.grade) : ''}
          onChange={(e) => go({ grade: e.target.value ? Number(e.target.value) : null, skillId: null })}
          options={[{ value: '', label: 'Semua grade' }, ...[1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `Grade ${g}` }))]}
        />
        <Select
          label={f.skillId ? 'Skill (1)' : 'Skill'}
          active={Boolean(f.skillId)}
          value={f.skillId ?? ''}
          onChange={(e) => go({ skillId: e.target.value || null })}
          options={[{ value: '', label: 'Semua skill' }, ...skills.map((s) => ({ value: s.id, label: `${s.title}, ${SUBJECT_LABEL[s.subject]} ${s.grade}` }))]}
        />
        <Select
          label={f.type ? 'Tipe (1)' : 'Tipe'}
          active={Boolean(f.type)}
          value={f.type ?? ''}
          onChange={(e) => go({ type: e.target.value || null })}
          options={[{ value: '', label: 'Semua tipe' }, ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
        />
        <Select
          label={f.difficulty ? 'Kesulitan (1)' : 'Kesulitan'}
          active={Boolean(f.difficulty)}
          value={f.difficulty ? String(f.difficulty) : ''}
          onChange={(e) => go({ difficulty: e.target.value ? Number(e.target.value) : null })}
          options={[{ value: '', label: 'Semua tingkat' }, ...[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `${d} dari 5` }))]}
        />
        <Select
          label={f.source ? 'Sumber (1)' : 'Sumber'}
          active={Boolean(f.source)}
          value={f.source ?? ''}
          onChange={(e) => go({ source: e.target.value || null })}
          options={[{ value: '', label: 'Semua sumber' }, ...Object.entries(SOURCE_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
        />
      </section>

      <div className="-mt-3 flex flex-wrap items-center gap-3" aria-busy={pending || undefined}>
        <FilterChips
          resultText={filtered ? `${num(data.total)} soal sesuai filter` : `${num(data.total)} soal`}
          chips={chips.map((c) => ({ key: c.key, label: c.label, onRemove: () => go({ [c.key]: c.key === 'q' ? '' : null } as Partial<Filters>) }))}
          onClearAll={clearAll}
        />
        {pending ? <span className="text-small text-fg-muted">Memuat</span> : null}
      </div>

      {data.rows.length === 0 ? (
        filtered ? (
          <EmptyState
            filters={chips.map((c) => c.label)}
            title={`Tidak ada soal untuk ${chips.map((c) => c.label).join(', ')}.`}
            body="Longgarkan satu filter, atau hapus semua filter untuk melihat seluruh bank soal."
            actions={
              <>
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-11 cursor-pointer rounded-control border-0 bg-fg px-4 text-body font-bold text-white hover:bg-fg-muted"
                >
                  Hapus semua filter
                </button>
                {chips.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const last = chips[chips.length - 1]!
                      go({ [last.key]: last.key === 'q' ? '' : null } as Partial<Filters>)
                    }}
                    className="h-11 cursor-pointer rounded-control border-2 border-border bg-surface px-4 text-body font-bold text-fg hover:border-fg"
                  >
                    Hapus filter {chips[chips.length - 1]!.label.split(':')[0]}
                  </button>
                ) : null}
              </>
            }
          />
        ) : (
          <EmptyState
            icon="bank"
            title="Bank soal masih kosong."
            body="Impor paket resmi atau minta draf di Studio AI. Soal baru masuk bank soal setelah ditinjau."
            actions={
              <>
                <ButtonLink href={CONSOLE_ROUTES.import} variant="primary">
                  Impor paket resmi
                </ButtonLink>
                {data.shell.aiEnabled ? (
                  <ButtonLink href={CONSOLE_ROUTES.studio} variant="secondary">
                    Buka Studio AI
                  </ButtonLink>
                ) : null}
              </>
            }
          />
        )
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[2_1_700px] flex-col">
            <DataTable
              caption={`Bank soal, ${data.total} soal${filtered ? ' sesuai filter' : ''}, halaman ${data.page} dari ${pages}`}
              columns={columns}
              rows={data.rows}
              rowKey={(r) => r.ref}
              activeRowKey={p?.row.ref ?? null}
              minWidth={600}
              footer={
                <nav aria-label="Halaman bank soal" className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3">
                  <span className="text-small text-fg-muted tabular">
                    Halaman {data.page} dari {pages}, {data.pageSize} soal per halaman
                  </span>
                  <span className="flex gap-2">
                    {data.page > 1 ? (
                      <ButtonLink href={toQuery(f, { halaman: String(data.page - 1) })} variant="secondary" scroll={false}>
                        Sebelumnya
                      </ButtonLink>
                    ) : (
                      <span aria-disabled="true" className="inline-flex h-11 items-center rounded-control border-2 border-divider bg-bg px-4 font-bold text-border">
                        Sebelumnya
                      </span>
                    )}
                    {data.page < pages ? (
                      <ButtonLink href={toQuery(f, { halaman: String(data.page + 1) })} variant="secondary" scroll={false}>
                        Berikutnya
                      </ButtonLink>
                    ) : (
                      <span aria-disabled="true" className="inline-flex h-11 items-center rounded-control border-2 border-divider bg-bg px-4 font-bold text-border">
                        Berikutnya
                      </span>
                    )}
                  </span>
                </nav>
              }
            />
          </div>

          <aside aria-label="Pratinjau soal" aria-live="polite" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-card border border-divider bg-surface px-6 py-5 max-sm:px-4">
            {p ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx('text-small font-bold tabular', SUBJECT_TEXT[p.row.subject])}>{p.row.ref}</span>
                  <Pill tone={p.row.source === 'imported' ? 'dark' : 'neutral'}>{SOURCE_LABEL[p.row.source]}</Pill>
                  <SubjectChip subject={p.row.subject} withIcon={false} size="sm" />
                  <span className="text-small text-fg-muted">
                    {p.row.skillTitle}, Grade {p.row.grade}
                  </span>
                </div>
                <ItemStatic item={p.item} variant="screen" showKey={{ answerText: p.answerText, explanation: p.explanation }} />
                {p.hints.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-small font-bold text-fg-muted">Hint</span>
                    <ol className="m-0 flex flex-col gap-1 pl-5 text-body" lang={p.item.lang}>
                      {p.hints.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <p className="m-0 text-body text-fg-muted">
                  Dipakai {num(p.row.attempts)} kali{p.row.accuracy != null ? `, akurasi ${pct(p.row.accuracy)}` : ''}.
                  {p.row.reports > 0 ? ` Dilaporkan ${p.row.reports} kali, periksa kunci dan gambarnya.` : ''}
                  {p.row.source === 'imported' ? ' Soal paket resmi hanya untuk latihan keluarga ini dan tidak ikut ekspor.' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`${CONSOLE_ROUTES.paper}?tambah=${encodeURIComponent(p.row.ref)}`} variant="primary">
                    Tambah ke paper
                  </ButtonLink>
                  {data.shell.aiEnabled ? (
                    <ButtonLink href={`${CONSOLE_ROUTES.studio}?soal=${encodeURIComponent(p.row.ref)}`} variant="secondary" icon="sparkle">
                      Minta varian
                    </ButtonLink>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="m-0 text-body text-fg-muted">Pilih soal di tabel untuk melihat isi, kunci, dan pembahasannya.</p>
            )}
          </aside>
        </div>
      )}
    </ConsoleShell>
  )
}
