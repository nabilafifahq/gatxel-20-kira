'use client'

import Link from 'next/link'
import { useId, useState, type FormEvent } from 'react'
import type { ClaudeConnectionActions, ClaudeConnectionDTO } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog } from '@/components/console/Dialog'
import { DataTable, type Column } from '@/components/console/DataTable'
import { TextField } from '@/components/console/Field'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { dateTimeId } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Card, PageHeader } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T14 Koneksi Claude (papan KoneksiClaude, KoneksiClaudeBelum). Dua koneksi:
 * AI di worker untuk Studio AI dan saran nilai (Claude Code atau endpoint
 * OpenAI-compatible, dites dari sini), dan server MCP supaya Claude Code milik
 * tutor bisa membaca hasil belajar dan mengirim draf soal, dengan token per perangkat.
 */

export type ClaudeConnectionScreenProps = { data: ClaudeConnectionDTO; actions: ClaudeConnectionActions }

type Token = ClaudeConnectionDTO['mcp']['tokens'][number]

const PROVIDER_LABEL: Record<ClaudeConnectionDTO['provider'], string> = {
  'claude-code': 'Claude Code dengan langganan Claude',
  'openai-compatible': 'Endpoint OpenAI-compatible',
  none: 'Belum dipilih',
}

const STATUS: Record<ClaudeConnectionDTO['status'], { label: string; dot: string; border: string }> = {
  connected: { label: 'Terhubung', dot: 'bg-success', border: 'border-success' },
  'not-configured': { label: 'Belum diatur', dot: 'bg-border', border: 'border-border' },
  error: { label: 'Gagal tersambung', dot: 'bg-danger', border: 'border-danger' },
}

const READS = [
  'Daftar learner sebagai Learner 1, Learner 2, dengan grade dan status aktif',
  'Bintang dan gerbang setiap skill yang sudah dilatih',
  'Akurasi per mapel per minggu, empat minggu terakhir',
  'Skill kurikulum dan soal di Bank soal, termasuk kunci jawabannya',
]
const NEVER = [
  'Nama anak, foto lembar jawaban, dan rekaman suara',
  'Teks jawaban, tulisan, dan gambar',
  'Catatan pribadi tutor',
  'Email, password, dan data akun orang dewasa',
]
const TOOLS: { name: string; what: string; ask: string }[] = [
  { name: 'list_learners', what: 'Daftar learner dengan label, grade, dan status aktif', ask: 'Siapa saja learner di Kira dan grade berapa?' },
  { name: 'learner_progress', what: 'Bintang dan gerbang per skill, akurasi per mapel empat minggu terakhir', ask: 'Skill Math mana yang perlu diulang Learner 1?' },
  { name: 'list_skills', what: 'Skill kurikulum per mapel dan grade', ask: 'Skill apa saja di English Grade 2?' },
  { name: 'get_item', what: 'Satu soal lengkap dengan kunci, hint, dan pembahasan', ask: 'Tampilkan soal m2.oly-patterns.003 beserta kuncinya.' },
  { name: 'search_items', what: 'Cari soal per skill atau kata di teks soal', ask: 'Cari soal tentang jam di Math Grade 2.' },
  { name: 'create_draft_items', what: 'Kirim draf soal ke antrean Studio AI; dipakai setelah disetujui tutor', ask: 'Buat 5 soal cerita Numbers to 100 bertema pasar, lalu kirim sebagai draf.' },
]

const SETUP_STEPS: Record<ClaudeConnectionDTO['provider'], { title: string; steps: string[] }> = {
  'claude-code': {
    title: 'Cara menyambungkan Claude Code',
    steps: [
      'Di komputer yang sudah masuk ke akun Claude, jalankan claude setup-token.',
      'Isi token itu sebagai CLAUDE_CODE_OAUTH_TOKEN di file .env worker di server rumah.',
      'Jalankan ulang worker, lalu tekan Tes koneksi.',
    ],
  },
  'openai-compatible': {
    title: 'Cara menyambungkan endpoint OpenAI-compatible',
    steps: ['Isi AI_BASE_URL, AI_MODEL, dan AI_API_KEY di file .env worker di server rumah.', 'Jalankan ulang worker, lalu tekan Tes koneksi.'],
  },
  none: {
    title: 'Cara menyalakan AI',
    steps: [
      'Isi AI_PROVIDER dengan claude-code atau openai-compatible di file .env web dan worker.',
      'Lengkapi token atau alamat AI di .env worker.',
      'Jalankan ulang web dan worker, lalu tekan Tes koneksi.',
    ],
  },
}

export function ClaudeConnectionScreen({ data, actions }: ClaudeConnectionScreenProps) {
  return (
    <ConsoleShell shell={data.shell} active="claude">
      <div className="flex flex-col gap-6">
        <nav aria-label="Jejak" className="-mb-2 flex flex-wrap items-center gap-2 text-small text-fg-muted">
          <Link href={CONSOLE_ROUTES.reports} className="font-semibold">
            Laporan
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Koneksi Claude</span>
        </nav>
        <PageHeader
          title="Koneksi Claude"
          description="Claude Code membaca hasil belajar dari Kira lewat MCP dan bisa mengirim draf soal ke Studio AI. Claude tidak bisa mengubah rencana, nilai, atau pengaturan, dan draf baru dipakai setelah disetujui tutor."
        />
        <div className="flex flex-wrap items-start gap-6">
          <ProviderCard data={data} actions={actions} />
          <McpCard data={data} />
        </div>
        <TokensSection data={data} actions={actions} />
        <div className="flex flex-wrap items-start gap-6">
          <Card as="section" aria-labelledby="data-dibaca" className="flex flex-[1_1_360px] flex-col gap-3">
            <h2 id="data-dibaca" className="m-0 text-h3 font-bold">
              Data yang dibaca Claude
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {READS.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-body">
                  <ConsoleIcon name="check" size={20} strokeWidth={2.5} className="mt-0.5 text-success" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <h3 className="m-0 mt-2 text-body font-bold">Tidak pernah dikirim</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {NEVER.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-body">
                  <ConsoleIcon name="x" size={20} strokeWidth={2.5} className="mt-0.5 text-danger" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-small text-fg-muted">
              Learner tampil dengan nama samaran Learner 1, Learner 2, dan seterusnya. Data yang dibaca Claude diproses Anthropic di luar Indonesia. Isi
              percakapan mengikuti pengaturan akun Claude milik tutor.
            </p>
          </Card>
          <section aria-labelledby="tools-mcp" className="flex min-w-0 flex-[1.4_1_480px] flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="tools-mcp" className="m-0 text-h3 font-bold">
                Tools yang tersedia
              </h2>
              <span className="text-body text-fg-muted">Enam tool. Lima hanya membaca; create_draft_items menaruh draf di antrean tinjau Studio AI.</span>
            </div>
            <DataTable
              caption="Tools MCP Kira"
              minWidth={620}
              rows={TOOLS}
              rowKey={(t) => t.name}
              columns={[
                { key: 'name', header: 'Tool', rowHeader: true, cell: (t) => <code className="font-body text-small font-bold whitespace-nowrap">{t.name}</code> },
                { key: 'what', header: 'Isi', cell: (t) => t.what },
                { key: 'ask', header: 'Contoh pertanyaan ke Claude', cell: (t) => <span className="text-fg-muted">{t.ask}</span> },
              ]}
            />
          </section>
        </div>
      </div>
    </ConsoleShell>
  )
}

function StatusChip({ status }: { status: ClaudeConnectionDTO['status'] }) {
  const s = STATUS[status]
  return (
    <span className={cx('inline-flex h-8 items-center gap-2 rounded-pill border-2 bg-surface px-3 text-small font-bold', s.border)}>
      <span aria-hidden="true" className={cx('size-2.5 rounded-pill', s.dot)} />
      {s.label}
    </span>
  )
}

function ProviderCard({ data, actions }: ClaudeConnectionScreenProps) {
  const toast = useToast()
  const test = useAction(actions.testConnection)
  const [result, setResult] = useState<{ status: ClaudeConnectionDTO['status']; detail: string; at: string | null }>({
    status: data.status,
    detail: data.detail,
    at: data.lastCheckAt,
  })
  const [src, setSrc] = useState(data)
  if (src !== data) {
    setSrc(data)
    setResult({ status: data.status, detail: data.detail, at: data.lastCheckAt })
  }

  async function run() {
    const r = await test.run()
    if (r.ok) {
      setResult({ status: 'connected', detail: r.data.detail, at: new Date().toISOString() })
      toast({ tone: 'success', title: 'Koneksi AI berjalan.', body: r.data.detail })
    }
  }

  return (
    <Card as="section" aria-labelledby="ai-worker" className="flex flex-[1_1_380px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="ai-worker" className="m-0 text-h3 font-bold">
          AI untuk Studio AI dan saran nilai
        </h2>
        <span className="ml-auto">
          <StatusChip status={result.status} />
        </span>
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-6 gap-y-2">
        <dt className="text-body text-fg-muted">Penyedia</dt>
        <dd className="m-0 text-body font-semibold">{PROVIDER_LABEL[data.provider]}</dd>
        <dt className="text-body text-fg-muted">Dicek terakhir</dt>
        <dd className="m-0 text-body font-semibold tabular">{result.at ? dateTimeId(result.at) : 'Belum pernah'}</dd>
      </dl>
      <p role="status" className="m-0 text-body">
        {result.detail}
      </p>
      {result.status === 'not-configured' ? (
        <div className="flex flex-col gap-2 rounded-control border border-divider bg-bg px-4 py-3.5">
          <span className="text-body font-bold">{SETUP_STEPS[data.provider].title}</span>
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-body [overflow-wrap:anywhere]">
            {SETUP_STEPS[data.provider].steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {result.status === 'error' ? (
        <InlineAlert tone="danger" title="Worker tidak bisa memakai AI sekarang." live="none">
          Studio AI dan saran nilai berhenti sementara. Perbarui token di pengaturan worker, jalankan ulang worker, lalu tes lagi.
        </InlineAlert>
      ) : null}
      <ActionError error={test.error} />
      <div>
        <Button variant={result.status === 'connected' ? 'secondary' : 'primary'} icon="sync" loading={test.pending} onClick={run}>
          Tes koneksi
        </Button>
      </div>
    </Card>
  )
}

function CopyRow({ label, value, copyLabel, toastTitle }: { label: string; value: string; copyLabel: string; toastTitle: string }) {
  const toast = useToast()
  const auto = useId()
  const id = `c${auto.replace(/:/g, '')}`
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={`${id}-l`} className="text-small font-bold">
        {label}
      </span>
      <div className="flex flex-wrap items-stretch gap-2">
        <code
          id={id}
          aria-labelledby={`${id}-l`}
          className="flex min-h-11 min-w-0 flex-[1_1_260px] items-center rounded-control border border-divider bg-bg px-3 py-2 font-body text-small font-semibold [overflow-wrap:anywhere] select-all"
        >
          {value}
        </code>
        <Button
          variant="secondary"
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              toast({ tone: 'success', title: toastTitle })
            } catch {
              const el = document.getElementById(id)
              if (el) {
                const range = document.createRange()
                range.selectNodeContents(el)
                const sel = window.getSelection()
                sel?.removeAllRanges()
                sel?.addRange(range)
              }
              toast({ tone: 'info', title: 'Teks sudah dipilih. Tekan Ctrl+C untuk menyalin.' })
            }
          }}
        >
          {copyLabel}
        </Button>
      </div>
    </div>
  )
}

function McpCard({ data }: { data: ClaudeConnectionDTO }) {
  const tokens = data.mcp.tokens
  const used = tokens.filter((t) => t.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))[0]
  return (
    <Card as="section" aria-labelledby="mcp-status" className="flex flex-[1.2_1_420px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="mcp-status" className="m-0 text-h3 font-bold">
          Server MCP untuk Claude
        </h2>
        <span className="ml-auto">
          <span
            className={cx(
              'inline-flex h-8 items-center gap-2 rounded-pill border-2 bg-surface px-3 text-small font-bold',
              data.mcp.enabled ? 'border-success' : 'border-border',
            )}
          >
            <span aria-hidden="true" className={cx('size-2.5 rounded-pill', data.mcp.enabled ? 'bg-success' : 'bg-border')} />
            {data.mcp.enabled ? 'Menyala' : 'Mati'}
          </span>
        </span>
      </div>
      {data.mcp.enabled ? (
        <>
          <p className="m-0 text-body">
            {tokens.length === 0
              ? 'Belum ada perangkat yang tersambung. Buat token di bawah untuk setiap perangkat yang memakai Claude.'
              : `${tokens.length} token aktif.${used ? ` Dipakai terakhir ${dateTimeId(used.lastUsedAt as string)} oleh ${used.name}.` : ' Belum ada yang dipakai.'}`}
          </p>
          <CopyRow label="Alamat server MCP" value={data.mcp.url} copyLabel="Salin alamat" toastTitle="Alamat server disalin." />
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-bold">Claude Code di laptop yang tersambung ke Tailscale</span>
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-body">
              <li>Buat token di bawah dengan nama laptop itu.</li>
              <li>Jalankan perintah yang muncul bersama token di terminal laptop.</li>
              <li>Jalankan /mcp di Claude Code untuk memastikan Kira tersambung.</li>
            </ol>
            <code className="rounded-control border border-divider bg-bg px-3 py-2 font-body text-small font-semibold [overflow-wrap:anywhere]">
              {claudeCodeCommand(data.mcp.url, '<token>')}
            </code>
          </div>
          <p className="m-0 text-small text-fg-muted">
            Aplikasi Claude di web, desktop, dan HP menyambung ke server MCP dari server Anthropic lewat internet publik, jadi tidak bisa menjangkau Kira
            yang hanya ada di jaringan Tailscale rumah.
          </p>
        </>
      ) : (
        <InlineAlert tone="info" title="Server MCP sedang mati." live="none">
          Claude tidak bisa membaca data Kira. Nyalakan server MCP di pengaturan server rumah, lalu muat ulang halaman ini.
        </InlineAlert>
      )}
    </Card>
  )
}

function claudeCodeCommand(url: string, token: string): string {
  return `claude mcp add --transport http kira ${url} --header "Authorization: Bearer ${token}"`
}

function TokensSection({ data, actions }: ClaudeConnectionScreenProps) {
  const toast = useToast()
  const [src, setSrc] = useState(data.mcp.tokens)
  const [tokens, setTokens] = useState<Token[]>(data.mcp.tokens)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null)
  const [revoking, setRevoking] = useState<Token | null>(null)
  const create = useAction(actions.createMcpToken)
  const revoke = useAction(actions.revokeMcpToken)

  if (src !== data.mcp.tokens) {
    setSrc(data.mcp.tokens)
    setTokens(data.mcp.tokens)
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      setNameError('Beri nama token, misalnya nama perangkatnya.')
      return
    }
    if (n.length > 60) {
      setNameError(`Nama token paling banyak 60 karakter, sekarang ${n.length}.`)
      return
    }
    if (tokens.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      setNameError(`Token bernama ${n} sudah ada. Pakai nama lain supaya mudah dicabut nanti.`)
      return
    }
    setNameError(null)
    const r = await create.run(n)
    if (r.ok) {
      setCreated({ name: n, token: r.data.token })
      setTokens((xs) => [{ id: `baru-${Date.now()}`, name: n, createdAt: new Date().toISOString(), lastUsedAt: null }, ...xs])
      setName('')
    }
  }

  const columns: Column<Token>[] = [
    { key: 'name', header: 'Nama', rowHeader: true, cell: (t) => t.name },
    { key: 'created', header: 'Dibuat', cell: (t) => <span className="tabular">{dateTimeId(t.createdAt)}</span> },
    {
      key: 'used',
      header: 'Dipakai terakhir',
      cell: (t) => (t.lastUsedAt ? <span className="tabular">{dateTimeId(t.lastUsedAt)}</span> : <span className="text-fg-muted">Belum pernah</span>),
    },
    {
      key: 'act',
      header: <span className="visually-hidden">Aksi</span>,
      align: 'right',
      cell: (t) => (
        <Button variant="quiet" tone="danger" size="S" icon="trash" onClick={() => setRevoking(t)} aria-haspopup="dialog" aria-label={`Cabut token ${t.name}`}>
          Cabut
        </Button>
      ),
    },
  ]

  return (
    <section aria-labelledby="token-mcp" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="token-mcp" className="m-0 text-h2 font-bold max-sm:text-h3">
          Token akses
        </h2>
        <span className="text-body text-fg-muted">Satu token untuk setiap perangkat. Token yang dicabut langsung berhenti bekerja.</span>
      </div>
      <Card className="flex flex-col gap-4">
        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
          <TextField
            label="Nama token baru"
            hint="Nama perangkat yang memakai Claude, misalnya Laptop kerja."
            value={name}
            maxLength={80}
            autoComplete="off"
            error={nameError}
            fieldClassName="max-w-[460px]"
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError(null)
            }}
          />
          <div>
            <Button type="submit" variant="primary" icon="key" loading={create.pending} disabled={!data.mcp.enabled}>
              Buat token
            </Button>
          </div>
        </form>
        <ActionError error={create.error} />
        {created ? (
          <div role="status" className="flex flex-col gap-3 rounded-control border-2 border-success bg-science-50 p-4">
            <div className="flex items-start gap-2.5">
              <ConsoleIcon name="checkCircle" size={22} strokeWidth={2.5} className="mt-0.5 text-success" />
              <div className="flex min-w-0 flex-col">
                <span className="text-body font-bold">Token {created.name} dibuat.</span>
                <span className="text-body">Token hanya tampil sekali. Salin sekarang dan simpan di perangkat itu saja.</span>
              </div>
            </div>
            <CopyRow label="Token" value={created.token} copyLabel="Salin token" toastTitle="Token disalin." />
            <CopyRow
              label="Perintah untuk Claude Code"
              value={claudeCodeCommand(data.mcp.url, created.token)}
              copyLabel="Salin perintah"
              toastTitle="Perintah Claude Code disalin."
            />
            <span className="text-small">Setelah itu jalankan /mcp di Claude Code untuk memastikan Kira tersambung.</span>
            <div>
              <Button variant="secondary" size="S" onClick={() => setCreated(null)}>
                Sembunyikan token
              </Button>
            </div>
          </div>
        ) : null}
        {tokens.length === 0 ? (
          <EmptyState
            compact
            icon="key"
            title="Belum ada token."
            body="Claude belum bisa membaca data Kira. Buat token pertama untuk laptop yang memakai Claude Code."
          />
        ) : (
          <DataTable caption="Token akses MCP" minWidth={560} rows={tokens} rowKey={(t) => t.id} columns={columns} />
        )}
      </Card>
      <ConfirmDialog
        open={revoking != null}
        onClose={() => setRevoking(null)}
        title={revoking ? `Cabut token ${revoking.name}?` : 'Cabut token?'}
        body="Perangkat yang memakai token ini tidak bisa membaca data Kira lagi sampai diberi token baru."
        warning="Percakapan di Claude yang sudah memuat data Kira tidak ikut terhapus. Hapus percakapan itu dari Claude bila perlu."
        confirmLabel="Cabut token"
        error={revoke.error ? <ActionError error={revoke.error} /> : null}
        onConfirm={async () => {
          if (!revoking) return
          const t = revoking
          const r = await revoke.run(t.id)
          if (r.ok) {
            setTokens((xs) => xs.filter((x) => x.id !== t.id))
            setRevoking(null)
            if (created?.name === t.name) setCreated(null)
            toast({ tone: 'success', title: `Token ${t.name} dicabut.` })
          }
        }}
      />
    </section>
  )
}
