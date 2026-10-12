'use client'

import Link from 'next/link'
import { useState } from 'react'
import { addDays, jakartaDate, weekStart as mondayOf } from '@kira/core/time'
import type { ReportActions, ReportDTO } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ActionError, EmptyState, InlineAlert, StatusText } from '@/components/console/Feedback'
import { Checkbox, TextArea } from '@/components/console/Field'
import { dateTimeId } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill, Section, SectionHeading } from '@/components/console/Layout'
import { CONSOLE_ROUTES, FAMILY_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'
import { WeekSummary } from '@/components/family/WeekSummary'

/**
 * T09 Laporan dan ekspor (papan Laporan): pratinjau ringkasan untuk orang tua dengan
 * catatan tutor, kirim laporan, kotak keluar email, dan ekspor Markdown atau JSON untuk Claude.
 * Ekspor memakai nama samaran learner_1 kecuali tutor sengaja menyertakan nama asli.
 * Minggu dipilih lewat parameter URL `minggu` (tanggal Senin).
 */

export type ReportScreenProps = { data: ReportDTO; actions: ReportActions }

const OUTBOX_STATUS = {
  sent: { tone: 'success' as const, label: 'Terkirim' },
  queued: { tone: 'muted' as const, label: 'Menunggu dikirim' },
  failed: { tone: 'danger' as const, label: 'Gagal terkirim' },
  'no-smtp': { tone: 'warn' as const, label: 'Email belum diatur' },
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ReportScreen({ data, actions }: ReportScreenProps) {
  const toast = useToast()
  const s = data.summary
  const [note, setNote] = useState(s.tutorNote ?? '')
  const [sent, setSent] = useState(Boolean(data.sentAt))
  const [fmt, setFmt] = useState<'md' | 'json'>('md')
  const [withName, setWithName] = useState(false)
  const [json, setJson] = useState<{ filename: string; json: string } | null>(null)
  const send = useAction(actions.sendReport)
  const exp = useAction(actions.exportJson)

  const noSmtp = data.outbox.some((o) => o.status === 'no-smtp')
  const failed = data.outbox.filter((o) => o.status === 'failed')
  const pseudonym = 'learner_1'
  const reveal = (t: string) => (withName ? t.split(pseudonym).join(s.learnerName) : t)
  const exportText = fmt === 'md' ? reveal(data.markdown) : json ? reveal(json.json) : ''

  async function doSend() {
    if (note.trim().length > 600) return
    const r = await send.run({ learnerId: data.learnerId, weekStart: data.weekStart, note: note.trim() })
    if (r.ok) {
      setSent(true)
      toast({
        tone: 'success',
        title: noSmtp ? 'Laporan disimpan di kotak keluar.' : 'Laporan dikirim ke orang tua.',
        body: noSmtp ? 'Email belum diatur, jadi laporan tampil di halaman keluarga saja.' : undefined,
      })
    }
  }

  async function loadJson() {
    setFmt('json')
    if (json) return
    const r = await exp.run(data.learnerId)
    if (r.ok) setJson(r.data)
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(exportText)
      toast({ tone: 'success', title: 'Markdown disalin. Tempel ke Claude.' })
    } catch {
      const pre = document.getElementById('isi-ekspor')
      if (pre) {
        const range = document.createRange()
        range.selectNodeContents(pre)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      toast({ tone: 'info', title: 'Teks ekspor sudah dipilih.', body: 'Tekan Ctrl+C atau Cmd+C untuk menyalin.' })
    }
  }

  const noteTooLong = note.trim().length > 600
  // Learner tetap terpilih saat pindah minggu; minggu depan belum punya data.
  const weekHref = (days: number) => `?learner=${encodeURIComponent(data.learnerId)}&minggu=${addDays(data.weekStart, days)}`
  const hasNextWeek = addDays(data.weekStart, 7) <= mondayOf(jakartaDate())

  return (
    <ConsoleShell shell={data.shell} active="reports">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Laporan minggu</h1>
            <span role="status">{sent ? <Pill tone="success">Terkirim</Pill> : <Pill>Belum dikirim</Pill>}</span>
          </div>
          <p className="m-0 text-body text-fg-muted">
            {data.weekLabel}. Laporan untuk orang tua dan ekspor untuk Claude dibuat dari data yang sama.
          </p>
        </div>
        <nav aria-label="Pilih minggu" className="flex gap-2">
          <ButtonLink href={weekHref(-7)} variant="secondary" icon="chevronLeft">
            Minggu sebelumnya
          </ButtonLink>
          {hasNextWeek ? (
            <ButtonLink href={weekHref(7)} variant="secondary" iconAfter="chevronRight" aria-label="Minggu berikutnya">
              <span className="max-sm:hidden">Berikutnya</span>
            </ButtonLink>
          ) : null}
        </nav>
      </header>

      {noSmtp ? (
        <InlineAlert
          tone="warn"
          title="Email belum diatur di server ini."
          action={
            <ButtonLink href={CONSOLE_ROUTES.settings} variant="secondary" size="S">
              Buka Pengaturan
            </ButtonLink>
          }
        >
          Laporan tetap tampil di halaman keluarga. Email menunggu di kotak keluar sampai SMTP diatur.
        </InlineAlert>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="untuk-ortu" className="flex min-w-0 flex-[1.2_1_480px] flex-col gap-5 rounded-card border border-divider bg-surface p-6 max-sm:p-4">
          <div className="flex flex-col gap-1">
            <h2 id="untuk-ortu" className="m-0 text-h2 font-bold max-sm:text-h3">
              Untuk orang tua
            </h2>
            <span className="text-body text-fg-muted">Dikirim lewat email dan tampil di halaman keluarga.</span>
          </div>
          <WeekSummary summary={{ ...s, tutorNote: null }} compact headingLevel={3} />
          <TextArea
            label="Catatan tutor"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint={`Satu sampai tiga kalimat. Tulis yang bisa dilakukan orang tua di rumah. ${note.trim().length} dari 600 karakter.`}
            error={noteTooLong ? `Catatan paling panjang 600 karakter. Sekarang ${note.trim().length}.` : null}
          />
          <ActionError error={send.error} />
          <div className="flex flex-wrap gap-3 border-t border-divider pt-4">
            <Button variant="primary" icon="mail" onClick={doSend} loading={send.pending}>
              {sent ? 'Kirim ulang' : 'Kirim ke orang tua'}
            </Button>
            <ButtonLink href={FAMILY_ROUTES.home} variant="secondary" target="_blank">
              Lihat di halaman keluarga
            </ButtonLink>
          </div>
        </section>

        <section aria-labelledby="ekspor-claude" className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-card border border-divider bg-surface p-6 max-sm:p-4">
          <div className="flex flex-col gap-1">
            <h2 id="ekspor-claude" className="m-0 text-h2 font-bold max-sm:text-h3">
              Ekspor untuk Claude
            </h2>
            <span className="text-body text-fg-muted">Tempel ke Claude untuk menyusun rencana minggu depan.</span>
          </div>
          <div role="group" aria-label="Format ekspor" className="flex gap-1.5">
            {(['md', 'json'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={fmt === f}
                onClick={() => (f === 'md' ? setFmt('md') : void loadJson())}
                className={cx(
                  'h-10 cursor-pointer rounded-pill border-2 px-3.5 text-body font-bold text-fg',
                  fmt === f ? 'border-fg bg-bg' : 'border-divider bg-surface hover:border-fg',
                )}
              >
                {f === 'md' ? 'Markdown' : 'JSON'}
              </button>
            ))}
          </div>
          <Checkbox
            label={`Sertakan nama ${s.learnerName}`}
            description={`Tanpa centang, nama diganti ${pseudonym}.`}
            checked={withName}
            onChange={(e) => setWithName(e.target.checked)}
          />
          {fmt === 'json' && exp.pending ? (
            <p role="status" className="m-0 rounded-control border border-divider bg-bg p-4 text-body text-fg-muted">
              Menyiapkan JSON
            </p>
          ) : fmt === 'json' && !json ? (
            <ActionError error={exp.error ?? { message: 'JSON belum bisa dibuat.', reference: 'KRA-EXP' }} />
          ) : (
            <pre
              id="isi-ekspor"
              aria-label="Isi ekspor"
              tabIndex={0}
              className="relative m-0 max-h-[420px] overflow-auto rounded-control border border-divider bg-bg px-4 py-3.5 font-body text-small whitespace-pre-wrap"
            >
              {exportText}
            </pre>
          )}
          <div className="flex flex-wrap gap-3">
            {fmt === 'md' ? (
              <Button variant="primary" icon="copy" onClick={copyMarkdown}>
                Salin Markdown
              </Button>
            ) : (
              <Button variant="primary" icon="download" disabled={!json} onClick={() => json && download(reveal(json.filename), exportText, 'application/json')}>
                Unduh JSON
              </Button>
            )}
            <ButtonLink href={CONSOLE_ROUTES.claude} variant="secondary" icon="plug">
              Koneksi Claude
            </ButtonLink>
          </div>
          <p className="m-0 text-small text-fg-muted">
            {fmt === 'md'
              ? 'Markdown hanya berisi angka dan nama skill. Jawaban mentah, foto, rekaman, dan catatan pribadi tutor tidak ikut.'
              : 'JSON berisi salinan lengkap data belajar, termasuk jawaban dan catatan tutor, tanpa foto dan rekaman. Periksa isinya sebelum dibagikan.'}
          </p>
        </section>
      </div>

      <Section labelledBy="kotak-keluar">
        <SectionHeading id="kotak-keluar" count={data.outbox.length || undefined} countLabel={`${data.outbox.length} email`}>
          Kotak keluar email
        </SectionHeading>
        {failed.length > 0 ? (
          <InlineAlert tone="danger" title={`${failed.length} email gagal terkirim.`} live="status">
            Periksa alamat email orang tua dan pengaturan SMTP, lalu kirim ulang laporan.{' '}
            <Link href={CONSOLE_ROUTES.settings} className="font-bold">
              Buka Pengaturan
            </Link>
          </InlineAlert>
        ) : null}
        {data.outbox.length === 0 ? (
          <EmptyState compact icon="mail" title="Belum ada email laporan." body="Email laporan mingguan muncul di sini setelah dikirim, dengan statusnya." />
        ) : (
          <ul className="m-0 list-none overflow-hidden rounded-card border border-divider bg-surface p-0">
            {data.outbox.map((o) => {
              const st = OUTBOX_STATUS[o.status]
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-divider px-5 py-3.5 last:border-b-0 max-sm:px-4">
                  <ConsoleIcon name="mail" size={20} />
                  <span className="flex min-w-0 flex-[1_1_280px] flex-col">
                    <span className="truncate text-body font-bold">{o.subject}</span>
                    <span className="text-small text-fg-muted">
                      Untuk {o.to}, dibuat {dateTimeId(o.createdAt)}
                    </span>
                  </span>
                  <StatusText tone={st.tone}>{st.label}</StatusText>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </ConsoleShell>
  )
}
