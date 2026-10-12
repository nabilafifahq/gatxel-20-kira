'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ConsentPurpose, PrivacyActions, PrivacyDTO } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { ConfirmDialog } from '@/components/console/Dialog'
import { Switch } from '@/components/console/Field'
import { ActionError, InlineAlert } from '@/components/console/Feedback'
import { dateId, dateTimeId } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction, type ActionFailure } from '@/components/console/useAction'
import { FamilyShell } from '@/components/family/FamilyShell'

/**
 * G02 Privasi keluarga (papan PrivasiKeluarga, PrivasiKeluargaDitarik, PrivasiKeluargaFase3).
 * Satu sakelar per tujuan persetujuan. Menarik persetujuan selalu lewat konfirmasi yang
 * menyebut akibatnya; memberi persetujuan langsung tercatat. Unduh data sebagai JSON,
 * hapus akun dengan mengetik nama learner, dan pembatalan selama masa tunggu.
 * Tutor melihat halaman ini tanpa bisa mengubahnya.
 */

export type PrivacyScreenProps = { data: PrivacyDTO; actions: PrivacyActions }

type PurposeId = ConsentPurpose['id']

/** Akibat menarik persetujuan per tujuan (papan PrivasiKeluarga). */
function withdrawEffect(id: PurposeId, name: string): string {
  switch (id) {
    case 'learning':
      return `${name} tidak bisa membuka quest dan laporan mingguan berhenti. Data yang sudah ada tetap bisa diunduh atau dihapus dari halaman ini.`
    case 'progress-email':
      return 'Laporan mingguan tidak dikirim ke email lagi. Ringkasan tetap bisa dibuka di halaman Ringkasan.'
    case 'audio':
      return 'Soal berbicara dilewati tanpa mengurangi skor, dan rekaman yang sudah ada dihapus.'
    case 'photo':
      return 'Tutor tidak bisa mengunggah foto lagi dan paper kertas dinilai lewat input LJK saja. Foto yang sudah ada dihapus.'
    case 'ai-drafts':
      return 'Tulisan tetap dinilai tutor, tanpa saran nilai dari AI.'
  }
}

export function PrivacyScreen({ data, actions }: PrivacyScreenProps) {
  const toast = useToast()
  const name = data.learner.name
  const isGuardian = data.shell.role === 'guardian'
  const [src, setSrc] = useState(data)
  const [purposes, setPurposes] = useState(data.purposes)
  const [deletion, setDeletion] = useState(data.deletion)
  const [deletionRef, setDeletionRef] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<PurposeId | null>(null)
  const [consentError, setConsentError] = useState<(ActionFailure & { id: PurposeId }) | null>(null)
  const [withdrawing, setWithdrawing] = useState<ConsentPurpose | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const consent = useAction(actions.setConsent)
  const exporter = useAction(actions.exportData)
  const remove = useAction(actions.requestDeletion)
  const cancel = useAction(actions.cancelDeletion)

  if (src !== data) {
    setSrc(data)
    setPurposes(data.purposes)
    setDeletion(data.deletion)
  }

  const withdrawnRequired = purposes.find((p) => p.required && !p.granted)

  async function setGranted(p: ConsentPurpose, granted: boolean): Promise<boolean> {
    setPendingId(p.id)
    setConsentError(null)
    const r = await consent.run({ learnerId: data.learner.id, purpose: p.id, granted })
    setPendingId(null)
    if (!r.ok) {
      setConsentError({ ...r, id: p.id })
      return false
    }
    setPurposes((xs) => xs.map((x) => (x.id === p.id ? { ...x, granted, grantedAt: granted ? new Date().toISOString() : null } : x)))
    toast(
      granted
        ? { tone: 'success', title: `Persetujuan ${p.title} diberikan.`, body: `Tercatat dengan Kebijakan Privasi versi ${data.noticeVersion}.` }
        : { tone: 'success', title: `Persetujuan ${p.title} ditarik.`, body: 'Pemrosesan untuk tujuan ini berhenti paling lambat 3 x 24 jam.' },
    )
    return true
  }

  async function download() {
    const r = await exporter.run(data.learner.id)
    if (!r.ok) return
    const blob = new Blob([r.data.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = r.data.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast({ tone: 'success', title: `File ${r.data.filename} diunduh.`, body: 'Simpan file ini di tempat yang aman. Isinya data pribadi anak.' })
  }

  async function cancelDeletion() {
    const r = await cancel.run(data.learner.id)
    if (r.ok) {
      setDeletion({ requestedAt: null, scheduledFor: null })
      setDeletionRef(null)
      toast({ tone: 'success', title: `Penghapusan akun ${name} dibatalkan.`, body: 'Data tetap tersimpan seperti sebelumnya.' })
    }
  }

  return (
    <FamilyShell shell={data.shell} active="privacy" learnerName={name}>
      {data.shell.learners.length > 1 ? (
        <nav aria-label="Pilih anak" className="relative -mb-2 flex gap-2 overflow-x-auto">
          {data.shell.learners.map((l) => {
            const on = l.id === data.learner.id
            return (
              <Link
                key={l.id}
                href={`?learner=${encodeURIComponent(l.id)}`}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'inline-flex h-11 flex-none items-center rounded-pill border-2 px-4 text-body font-bold text-fg no-underline hover:text-fg',
                  on ? 'border-fg bg-surface' : 'border-divider bg-surface hover:border-fg',
                )}
              >
                {l.name}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h2 font-bold">Privasi dan data {name}</h1>
        <p className="m-0 text-body text-fg-muted">
          {isGuardian ? 'Hanya orang tua yang bisa mengubah halaman ini.' : 'Hanya orang tua yang bisa mengubah persetujuan. Tutor melihat halaman ini tanpa bisa mengubahnya.'}
        </p>
      </div>

      {withdrawnRequired ? (
        <div role="status" className="flex flex-col gap-1 rounded-card border-2 border-warn bg-warn-50 p-4">
          <span className="flex items-center gap-2 text-body font-bold">
            <ConsoleIcon name="alert" size={20} strokeWidth={2.5} className="text-warn" />
            Persetujuan {withdrawnRequired.title} ditarik.
          </span>
          <span className="text-body">
            Pemrosesan berhenti paling lambat 3 x 24 jam setelah penarikan. {name} tidak bisa membuka quest sampai persetujuan diberikan lagi. Data yang ada bisa
            diunduh atau dihapus di bawah.
          </span>
        </div>
      ) : null}

      {deletion.scheduledFor ? (
        <InlineAlert
          tone="warn"
          title={`Akun ${name} dijadwalkan terhapus ${dateId(deletion.scheduledFor, true)}.`}
          reference={deletionRef}
          action={
            isGuardian ? (
              <Button variant="secondary" loading={cancel.pending} onClick={cancelDeletion}>
                Batalkan penghapusan
              </Button>
            ) : null
          }
        >
          {deletion.requestedAt ? `Diminta ${dateTimeId(deletion.requestedAt)}. ` : ''}
          Sampai tanggal itu {name} tidak bisa masuk, dan permintaan masih bisa dibatalkan.
        </InlineAlert>
      ) : null}
      <ActionError error={cancel.error} />

      <section aria-labelledby="persetujuan" className="flex flex-col gap-3">
        <h2 id="persetujuan" className="m-0 text-h3 font-bold">
          Persetujuan
        </h2>
        <ul className="m-0 flex list-none flex-col rounded-card border border-divider bg-surface p-0">
          {purposes.map((p) => {
            const labelId = `izin-${p.id}`
            const descId = `izin-${p.id}-isi`
            const busy = pendingId === p.id
            return (
              <li key={p.id} className="flex flex-col gap-2 border-b border-divider px-4 py-4 last:border-b-0 sm:px-5">
                <div className="flex items-start gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span id={labelId} className="text-body font-bold">
                      {p.title}
                      {p.required ? <span className="font-semibold text-fg-muted"> (wajib)</span> : null}
                    </span>
                    <span id={descId} className="text-body">
                      {p.description}
                    </span>
                    <span className={cx('text-small', !p.granted && p.required ? 'font-bold text-warn' : 'text-fg-muted')}>
                      {p.granted
                        ? p.grantedAt
                          ? `Diberikan ${dateTimeId(p.grantedAt)}`
                          : 'Diberikan'
                        : p.required
                          ? 'Ditarik. Kira tidak bisa dipakai tanpa persetujuan ini.'
                          : 'Belum diberikan'}
                    </span>
                  </div>
                  <Switch
                    checked={p.granted}
                    labelledBy={labelId}
                    describedBy={descId}
                    busy={busy}
                    disabled={!isGuardian || (pendingId !== null && !busy)}
                    onChange={(next) => {
                      if (next) void setGranted(p, true)
                      else setWithdrawing(p)
                    }}
                  />
                </div>
                {consentError?.id === p.id ? <ActionError error={consentError} /> : null}
              </li>
            )
          })}
        </ul>
        <p className="m-0 text-small text-fg-muted">
          Setiap persetujuan tercatat dengan versi Kebijakan Privasi, waktu, dan cara diberikan. Penarikan menghentikan pemrosesan paling lambat 3 x 24 jam.
        </p>
      </section>

      <section aria-labelledby="data-learner" className="flex flex-col gap-3">
        <h2 id="data-learner" className="m-0 text-h3 font-bold">
          Data {name}
        </h2>
        <div className="flex flex-col rounded-card border border-divider bg-surface">
          <div className="flex flex-col gap-3 border-b border-divider px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-bold">Unduh salinan data</span>
              <span className="text-body">File JSON berisi profil, jawaban, skor, kartu review, dan riwayat persetujuan.</span>
            </div>
            <div>
              <Button variant="secondary" icon="download" loading={exporter.pending} onClick={download}>
                Unduh data (JSON)
              </Button>
            </div>
            <ActionError error={exporter.error} />
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-bold">Hapus akun {name}</span>
              <span className="text-body">
                Profil, data belajar, dan riwayat persetujuan dihapus 7 hari setelah permintaan, sesuai Kebijakan Privasi. Catatan audit tentang perubahan persetujuan dan penghapusan ini disimpan 12 bulan.
              </span>
            </div>
            {deletion.scheduledFor ? (
              <span className="text-body font-semibold">Permintaan hapus sudah tercatat. Lihat jadwalnya di atas.</span>
            ) : isGuardian ? (
              <div>
                <Button variant="secondary" tone="danger" icon="trash" aria-haspopup="dialog" onClick={() => setDeleteOpen(true)}>
                  Hapus akun dan data
                </Button>
              </div>
            ) : (
              <span className="text-body text-fg-muted">Hanya orang tua yang bisa meminta penghapusan.</span>
            )}
          </div>
        </div>
      </section>

      {data.retention.length ? (
        <section aria-labelledby="simpan" className="flex flex-col gap-3">
          <h2 id="simpan" className="m-0 text-h3 font-bold">
            Lama penyimpanan
          </h2>
          <dl className="m-0 flex flex-col rounded-card border border-divider bg-surface">
            {data.retention.map((r) => (
              <div key={r.label} className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-divider px-4 py-3 last:border-b-0 sm:px-5">
                <dt className="min-w-0 flex-[1_1_200px] text-body text-fg-muted">{r.label}</dt>
                <dd className="m-0 min-w-0 flex-[1_1_240px] text-body font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="riwayat" className="flex flex-col gap-3">
        <h2 id="riwayat" className="m-0 text-h3 font-bold">
          Riwayat persetujuan
        </h2>
        {data.history.length ? (
          <ol className="m-0 flex list-none flex-col rounded-card border border-divider bg-surface p-0">
            {data.history.map((h, i) => (
              <li key={`${h.date}-${i}`} className="flex flex-col gap-0.5 border-b border-divider px-4 py-3 last:border-b-0 sm:px-5">
                <span className="text-small text-fg-muted tabular">{dateTimeId(h.date)}</span>
                <span className="text-body">{h.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-body text-fg-muted">Belum ada catatan. Setiap persetujuan dan penarikan akan tercatat di sini.</p>
        )}
      </section>

      <nav aria-label="Dokumen" className="flex flex-col gap-2">
        <Link href={PUBLIC_ROUTES.privacyNotice} className="inline-flex min-h-11 items-center gap-2 text-body font-bold">
          <ConsoleIcon name="shield" size={18} />
          Kebijakan Privasi, versi {data.noticeVersion}
        </Link>
        <Link href={PUBLIC_ROUTES.terms} className="inline-flex min-h-11 items-center gap-2 text-body font-bold">
          <ConsoleIcon name="report" size={18} />
          Syarat dan Ketentuan
        </Link>
      </nav>

      <ConfirmDialog
        open={withdrawing != null}
        onClose={() => setWithdrawing(null)}
        title={withdrawing ? `Tarik persetujuan ${withdrawing.title}?` : 'Tarik persetujuan?'}
        body={withdrawing ? withdrawEffect(withdrawing.id, name) : ''}
        warning="Pemrosesan berhenti paling lambat 3 x 24 jam. Persetujuan bisa diberikan lagi kapan saja dari halaman ini."
        confirmLabel="Tarik persetujuan"
        onConfirm={async () => {
          if (!withdrawing) return
          const p = withdrawing
          setWithdrawing(null)
          await setGranted(p, false)
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Hapus akun ${name}?`}
        body={`Profil, jawaban, skor, rekaman, dan foto ${name} dihapus 7 hari dari sekarang. Selama masa itu ${name} tidak bisa masuk, dan permintaan masih bisa dibatalkan dari halaman ini.`}
        warning="Setelah 7 hari data tidak bisa dikembalikan. Unduh salinan data dulu bila perlu."
        confirmLabel="Hapus akun dan data"
        confirmText={name}
        confirmTextLabel={`Ketik ${name} untuk melanjutkan`}
        error={remove.error ? <ActionError error={remove.error} /> : null}
        onConfirm={async () => {
          const r = await remove.run({ learnerId: data.learner.id, confirmName: name })
          if (r.ok) {
            setDeletion({ requestedAt: new Date().toISOString(), scheduledFor: r.data.scheduledFor })
            setDeletionRef(r.data.reference)
            setDeleteOpen(false)
            toast({ tone: 'success', title: 'Permintaan hapus tercatat.', body: `Akun ${name} terhapus ${dateId(r.data.scheduledFor)}.`, reference: r.data.reference })
          }
        }}
      />
    </FamilyShell>
  )
}
