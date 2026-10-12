'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PasskeyRegisterFn, SettingsActions, SettingsDTO } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog, Dialog } from '@/components/console/Dialog'
import { ActionError, InlineAlert, StatusText } from '@/components/console/Feedback'
import { Checkbox, RadioGroup, Switch, TextField } from '@/components/console/Field'
import { dateId, dateTimeId, daysUntil } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Card, PageHeader, Section, SectionHeading } from '@/components/console/Layout'
import { PasswordField, passwordProblem } from '@/components/console/PasswordField'
import { CONSOLE_ROUTES, FAMILY_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'
import { jakartaDate } from '@kira/core/time'

/**
 * T10 Pengaturan (papan Pengaturan, PengaturanCabut): akun dan passkey, perangkat terdaftar
 * dengan konfirmasi cabut, batas waktu layar per learner, anggota dan undangan, status email,
 * dan cadangan. Aksi yang tidak bisa dibatalkan memakai konfirmasi yang menyebut akibatnya.
 */

export type SettingsScreenProps = {
  data: SettingsDTO
  actions: SettingsActions
  /** Dari pembungkus passkey (WebAuthn berjalan di client). Tanpa ini tombol Tambah passkey disembunyikan. */
  registerPasskey?: PasskeyRegisterFn
}

// 0 = Minggu ... 6 = Sabtu, sama dengan @kira/core/time weekday()
const WEEKDAYS = [
  { n: 1, label: 'Sen', long: 'Senin' },
  { n: 2, label: 'Sel', long: 'Selasa' },
  { n: 3, label: 'Rab', long: 'Rabu' },
  { n: 4, label: 'Kam', long: 'Kamis' },
  { n: 5, label: 'Jum', long: 'Jumat' },
  { n: 6, label: 'Sab', long: 'Sabtu' },
  { n: 0, label: 'Min', long: 'Minggu' },
]

const ROLE_LABEL = { tutor: 'Tutor', guardian: 'Orang tua' } as const

export function SettingsScreen({ data, actions, registerPasskey }: SettingsScreenProps) {
  const toast = useToast()
  const today = jakartaDate()

  // Perangkat
  const [devices, setDevices] = useState(data.devices)
  const [revoking, setRevoking] = useState<SettingsDTO['devices'][number] | null>(null)
  const [renaming, setRenaming] = useState<SettingsDTO['devices'][number] | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [regName, setRegName] = useState('')
  const [regLearners, setRegLearners] = useState<string[]>([])
  const [regError, setRegError] = useState<string | null>(null)
  const revoke = useAction(actions.revokeDevice)
  const rename = useAction(actions.renameDevice)
  const register = useAction(actions.registerThisDevice)

  // Batas per learner
  const [learnerId, setLearnerId] = useState(data.shell.currentLearnerId ?? data.learners[0]?.id ?? '')
  const learner = data.learners.find((l) => l.id === learnerId)
  const [limits, setLimits] = useState(() =>
    Object.fromEntries(data.learners.map((l) => [l.id, { minutes: String(l.screenLimitMin), rest: l.restWeekdays, review: l.reviewEnabled }])),
  )
  const [limitError, setLimitError] = useState<string | null>(null)
  const saveLimits = useAction(actions.updateLearnerLimits)
  const cur = limits[learnerId]

  // Akun
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string }>({})
  const changePw = useAction(actions.changePassword)
  const [passkeys, setPasskeys] = useState(data.account.passkeys)
  const [removingKey, setRemovingKey] = useState<SettingsDTO['account']['passkeys'][number] | null>(null)
  const removeKey = useAction(actions.removePasskey)
  const [pkOpen, setPkOpen] = useState(false)
  const [pkName, setPkName] = useState('')
  const [pkBusy, setPkBusy] = useState(false)
  const [pkError, setPkError] = useState<{ message: string; reference: string } | null>(null)

  // Anggota
  const [invites, setInvites] = useState(data.invites)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invEmail, setInvEmail] = useState('')
  const [invRole, setInvRole] = useState<'tutor' | 'guardian'>('guardian')
  const [invLearners, setInvLearners] = useState<string[]>(data.learners.map((l) => l.id))
  const [invError, setInvError] = useState<string | null>(null)
  const [invLink, setInvLink] = useState<string | null>(null)
  const invite = useAction(actions.inviteMember)
  const [revokingInvite, setRevokingInvite] = useState<SettingsDTO['invites'][number] | null>(null)
  const revokeInv = useAction(actions.revokeInvite)

  async function doRevoke() {
    if (!revoking) return
    const r = await revoke.run(revoking.id)
    if (r.ok) {
      setDevices((d) => d.filter((x) => x.id !== revoking.id))
      toast({ tone: 'success', title: `${revoking.name} sudah dicabut.` })
      setRevoking(null)
    }
  }

  async function doRename() {
    if (!renaming) return
    const n = newName.trim()
    if (!n) return setNameError('Isi nama perangkat dulu.')
    if (n.length > 40) return setNameError(`Nama paling panjang 40 karakter. Sekarang ${n.length}.`)
    const r = await rename.run({ deviceId: renaming.id, name: n })
    if (r.ok) {
      setDevices((d) => d.map((x) => (x.id === renaming.id ? { ...x, name: n } : x)))
      toast({ tone: 'success', title: `Nama perangkat diganti menjadi ${n}.` })
      setRenaming(null)
    }
  }

  async function doRegister() {
    const n = regName.trim()
    if (!n) return setRegError('Isi nama perangkat dulu, misalnya Tablet Alya.')
    if (regLearners.length === 0) return setRegError('Pilih paling sedikit satu learner yang memakai perangkat ini.')
    setRegError(null)
    const r = await register.run({ name: n, learnerIds: regLearners })
    if (r.ok) {
      setRegisterOpen(false)
      toast({ tone: 'success', title: `${n} terdaftar.`, body: 'Learner bisa masuk dengan PIN gambar di perangkat ini.' })
    }
  }

  async function doSaveLimits() {
    if (!learner || !cur) return
    const m = Number(cur.minutes)
    if (!Number.isInteger(m) || m < 15 || m > 180) {
      setLimitError(`Batas harus 15 sampai 180 menit. Isian sekarang: ${cur.minutes || 'kosong'}.`)
      return
    }
    if (cur.rest.length >= 7) {
      setLimitError('Semua hari dipilih sebagai hari istirahat. Sisakan paling sedikit satu hari belajar.')
      return
    }
    setLimitError(null)
    const r = await saveLimits.run({ learnerId: learner.id, screenLimitMin: m, restWeekdays: cur.rest, reviewEnabled: cur.review })
    if (r.ok) toast({ tone: 'success', title: `Batas ${learner.name} tersimpan.`, body: 'Berlaku mulai besok.' })
  }

  async function doChangePassword() {
    const e: typeof pwErrors = {}
    if (!pwCurrent) e.current = 'Isi password sekarang dulu.'
    const p = passwordProblem(pwNext)
    if (p) e.next = p
    else if (pwNext === pwCurrent) e.next = 'Password baru sama dengan password sekarang. Pilih yang berbeda.'
    setPwErrors(e)
    if (e.current || e.next) return
    const r = await changePw.run({ current: pwCurrent, next: pwNext })
    if (r.ok) {
      setPwOpen(false)
      setPwCurrent('')
      setPwNext('')
      toast({ tone: 'success', title: 'Password diganti.', body: 'Perangkat lain keluar dan perlu masuk lagi.' })
    } else if (r.fieldErrors?.current) {
      setPwErrors({ current: r.fieldErrors.current })
    }
  }

  async function doAddPasskey() {
    if (!registerPasskey) return
    const n = pkName.trim() || 'Passkey baru'
    setPkBusy(true)
    setPkError(null)
    try {
      const r = await registerPasskey(n)
      if (r.ok) {
        setPasskeys((list) => [...list, { id: `baru-${Date.now()}`, name: n, createdAt: new Date().toISOString(), lastUsedAt: null }])
        setPkOpen(false)
        toast({ tone: 'success', title: `Passkey ${n} tersimpan.` })
      } else setPkError({ message: r.message, reference: r.reference })
    } catch {
      setPkError({ message: 'Peramban membatalkan pembuatan passkey.', reference: 'WEBAUTHN' })
    } finally {
      setPkBusy(false)
    }
  }

  async function doRemoveKey() {
    if (!removingKey) return
    const r = await removeKey.run(removingKey.id)
    if (r.ok) {
      setPasskeys((list) => list.filter((k) => k.id !== removingKey.id))
      toast({ tone: 'success', title: `Passkey ${removingKey.name} dihapus.` })
      setRemovingKey(null)
    }
  }

  async function doInvite() {
    const em = invEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setInvError('Alamat email belum lengkap. Contoh: nama@domain.id')
    if (invLearners.length === 0) return setInvError('Pilih paling sedikit satu learner yang boleh dilihat.')
    setInvError(null)
    const r = await invite.run({ email: em, role: invRole, learnerIds: invLearners })
    if (r.ok) {
      setInvLink(r.data.link)
      setInvites((list) => [...list, { id: `inv-${Date.now()}`, email: em, role: invRole, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() }])
    }
  }

  async function doRevokeInvite() {
    if (!revokingInvite) return
    const r = await revokeInv.run(revokingInvite.id)
    if (r.ok) {
      setInvites((list) => list.filter((i) => i.id !== revokingInvite.id))
      toast({ tone: 'success', title: `Undangan untuk ${revokingInvite.email} dibatalkan.` })
      setRevokingInvite(null)
    }
  }

  const backupAge = data.backups.lastAt ? daysUntil(data.backups.lastAt, today) : null

  return (
    <ConsoleShell shell={data.shell} active="settings">
      <PageHeader title="Pengaturan" description="Hanya pemilik akun keluarga yang bisa mengubah halaman ini." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="akun" className="flex flex-col gap-4">
          <h2 id="akun" className="m-0 text-h3 font-bold">
            Akun {data.account.name}
          </h2>
          <dl className="m-0 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <dt className="w-[110px] text-small font-semibold text-fg-muted">Peran</dt>
              <dd className="m-0 text-body font-semibold">{data.shell.role === 'tutor' ? 'Tutor' : 'Orang tua'}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <dt className="w-[110px] text-small font-semibold text-fg-muted">Email</dt>
              <dd className="m-0 text-body font-semibold break-all">{data.account.email}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <dt className="w-[110px] text-small font-semibold text-fg-muted">Password</dt>
              <dd className="m-0 flex min-w-0 flex-[1_1_200px] flex-wrap items-center gap-3 text-body font-semibold">
                Aktif
                <Button variant="secondary" size="S" className="ml-auto" onClick={() => (setPwOpen(true), changePw.reset(), setPwErrors({}))}>
                  Ganti password
                </Button>
              </dd>
            </div>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
              <dt className="w-[110px] pt-1 text-small font-semibold text-fg-muted">Passkey</dt>
              <dd className="m-0 flex min-w-0 flex-[1_1_220px] flex-col gap-2">
                {passkeys.length === 0 ? <span className="text-body text-fg-muted">Belum ada passkey.</span> : null}
                {passkeys.map((k) => (
                  <span key={k.id} className="flex flex-wrap items-center gap-2">
                    <ConsoleIcon name="key" size={18} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold">{k.name}</span>
                      <span className="text-small text-fg-muted">
                        Dibuat {dateId(k.createdAt)}
                        {k.lastUsedAt ? `, terakhir dipakai ${dateTimeId(k.lastUsedAt)}` : ', belum pernah dipakai'}
                      </span>
                    </span>
                    <Button variant="quiet" size="S" tone="danger" onClick={() => (removeKey.reset(), setRemovingKey(k))} aria-label={`Hapus passkey ${k.name}`}>
                      Hapus
                    </Button>
                  </span>
                ))}
                {registerPasskey ? (
                  <Button variant="secondary" size="S" icon="plus" className="self-start" onClick={() => (setPkOpen(true), setPkError(null))}>
                    Tambah passkey
                  </Button>
                ) : (
                  <span className="text-small text-fg-muted">Peramban ini belum mendukung passkey.</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card as="section" aria-labelledby="email-server" className="flex flex-col gap-4">
          <h2 id="email-server" className="m-0 text-h3 font-bold">
            Email dan cadangan
          </h2>
          {data.email.configured ? (
            <StatusText tone="success">Email aktif, dikirim dari {data.email.from ?? 'alamat server'}</StatusText>
          ) : (
            <InlineAlert tone="warn" title="Email belum diatur." live="none">
              Laporan tetap tampil di halaman keluarga dan menunggu di kotak keluar. Isi SMTP_URL di berkas .env server, lalu mulai ulang Kira.
            </InlineAlert>
          )}
          <div className="flex flex-col gap-1 border-t border-divider pt-3">
            <span className="text-small font-bold text-fg-muted">Cadangan harian</span>
            {data.backups.lastAt ? (
              <StatusText tone={backupAge != null && backupAge > 2 ? 'warn' : 'success'}>
                Terakhir {dateTimeId(data.backups.lastAt)}
                {data.backups.lastSize ? `, ${data.backups.lastSize}` : ''}
                {backupAge != null && backupAge > 2 ? `, sudah ${backupAge} hari` : ''}
              </StatusText>
            ) : (
              <StatusText tone="danger">Belum ada cadangan. Periksa job cadangan di worker.</StatusText>
            )}
            <span className="text-small text-fg-muted">
              Folder: <span className="font-semibold break-all text-fg">{data.backups.folder}</span>
            </span>
          </div>
        </Card>
      </div>

      <Section labelledBy="perangkat">
        <SectionHeading
          id="perangkat"
          aside={
            <Button variant="secondary" icon="tablet" onClick={() => (setRegisterOpen(true), register.reset(), setRegError(null), setRegName(''), setRegLearners(data.shell.currentLearnerId ? [data.shell.currentLearnerId] : []))}>
              Daftarkan perangkat ini
            </Button>
          }
        >
          Perangkat terdaftar
        </SectionHeading>
        <p className="-mt-1 mb-0 text-body text-fg-muted">Tablet learner memakai token perangkat 90 hari. Perangkat orang dewasa memakai sesi 24 jam.</p>
        {devices.length === 0 ? (
          <Card>
            <p className="m-0 text-body font-bold">Belum ada perangkat learner.</p>
            <p className="m-0 text-body text-fg-muted">Buka Kira di tablet anak, masuk sebagai orang dewasa, lalu pilih Daftarkan perangkat ini.</p>
          </Card>
        ) : (
          <div role="region" aria-labelledby="perangkat-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface">
            <table className="w-full min-w-[760px] border-collapse text-body">
              <caption id="perangkat-cap" className="visually-hidden">
                Perangkat terdaftar
              </caption>
              <thead>
                <tr>
                  {['Perangkat', 'Dipakai oleh', 'Terakhir aktif', 'Berlaku sampai'].map((h) => (
                    <th key={h} scope="col" className="border-b border-divider px-4 py-3 text-left text-small font-semibold text-fg-muted">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-divider px-4 py-3 text-right text-small font-semibold text-fg-muted">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const left = daysUntil(today, d.expiresAt)
                  return (
                    <tr key={d.id} className="border-b border-divider align-top last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <span className="flex flex-col">
                          <span className="font-bold">{d.name}</span>
                          <span className="text-small text-fg-muted">Didaftarkan {dateId(d.createdAt)}</span>
                        </span>
                      </th>
                      <td className="px-4 py-3">{d.learners.length ? d.learners.join(', ') : <span className="text-fg-muted">Belum ada learner</span>}</td>
                      <td className="px-4 py-3">{d.lastSeenAt ? dateTimeId(d.lastSeenAt) : <span className="text-fg-muted">Belum pernah</span>}</td>
                      <td className="px-4 py-3">
                        <span className={cx(left <= 7 ? 'font-bold text-warn' : undefined)}>
                          {dateId(d.expiresAt)}
                          {left <= 7 && left >= 0 ? `, ${left} hari lagi` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex flex-wrap justify-end gap-2">
                          <Button variant="secondary" size="S" onClick={() => (setRenaming(d), setNewName(d.name), setNameError(null), rename.reset())} aria-label={`Ganti nama ${d.name}`}>
                            Ganti nama
                          </Button>
                          <Button
                            variant="secondary"
                            size="S"
                            aria-haspopup="dialog"
                            tone="danger"
                            onClick={() => (revoke.reset(), setRevoking(d))}
                            aria-label={`Cabut ${d.name}`}
                          >
                            Cabut
                          </Button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="batas" className="flex flex-col gap-4">
          <h2 id="batas" className="m-0 text-h3 font-bold">
            Batas waktu layar
          </h2>
          {data.learners.length > 1 ? (
            <RadioGroup
              name="learner-batas"
              legend="Learner"
              value={learnerId}
              onChange={(v) => (setLearnerId(v), setLimitError(null))}
              options={data.learners.map((l) => ({ value: l.id, label: l.name }))}
              layout="row"
            />
          ) : null}
          {learner && cur ? (
            <>
              <div className="flex items-end gap-2.5">
                <TextField
                  label="Paling lama per hari"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cur.minutes}
                  onChange={(e) => setLimits((x) => ({ ...x, [learnerId]: { ...cur, minutes: e.target.value } }))}
                  fieldClassName="w-[130px]"
                  className="tabular"
                />
                <span className="pb-2.5 text-body font-semibold">menit</span>
              </div>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-small font-bold">Hari istirahat</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((w) => {
                    const on = cur.rest.includes(w.n)
                    return (
                      <label
                        key={w.n}
                        className={cx(
                          'flex h-11 min-w-16 cursor-pointer items-center gap-2 rounded-control px-3 text-body font-semibold',
                          on ? 'border-3 border-fg bg-bg' : 'border-2 border-border bg-surface hover:border-fg',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={w.long}
                          onChange={(e) =>
                            setLimits((x) => ({ ...x, [learnerId]: { ...cur, rest: e.target.checked ? [...cur.rest, w.n] : cur.rest.filter((r) => r !== w.n) } }))
                          }
                          className="size-[18px] cursor-pointer accent-fg"
                        />
                        <span aria-hidden="true">{w.label}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <div className="flex items-start gap-3">
                <Switch
                  checked={cur.review}
                  onChange={(v) => setLimits((x) => ({ ...x, [learnerId]: { ...cur, review: v } }))}
                  labelledBy="review-label"
                  describedBy="review-desc"
                />
                <span className="flex flex-col">
                  <span id="review-label" className="text-body font-bold">
                    Buku Koreksi
                  </span>
                  <span id="review-desc" className="text-small text-fg-muted">
                    Soal yang salah kembali sebagai kartu review berjarak.
                  </span>
                </span>
              </div>
              <p className="m-0 text-small text-fg-muted">
                Saat batas tercapai, {learner.name} melihat layar Selesai untuk hari ini dan quest yang belum selesai tersimpan. Perubahan berlaku mulai besok.
              </p>
              {limitError ? <InlineAlert tone="danger" title={limitError} /> : null}
              <ActionError error={saveLimits.error} />
              <Button variant="primary" className="self-start" onClick={doSaveLimits} loading={saveLimits.pending}>
                Simpan batas
              </Button>
            </>
          ) : (
            <p className="m-0 text-body text-fg-muted">
              Belum ada learner. <Link href={CONSOLE_ROUTES.learners}>Tambah learner</Link>
            </p>
          )}
        </Card>

        <Card as="section" aria-labelledby="anggota" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="anggota" className="m-0 mr-auto text-h3 font-bold">
              Anggota keluarga
            </h2>
            <Button variant="secondary" size="S" icon="userPlus" onClick={() => (setInviteOpen(true), setInvLink(null), setInvEmail(''), setInvError(null), invite.reset())}>
              Undang anggota
            </Button>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider py-3 last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-bold">{m.name}</span>
                  <span className="text-small break-all text-fg-muted">{m.email}</span>
                </span>
                <span className="text-small">
                  <span className="font-bold">{ROLE_LABEL[m.role]}</span>
                  {m.learners.length ? `, ${m.learners.join(', ')}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {invites.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-divider pt-3">
              <span className="text-small font-bold text-fg-muted">Undangan yang belum diterima</span>
              {invites.map((i) => (
                <span key={i.id} className="flex flex-wrap items-center gap-2">
                  <ConsoleIcon name="mail" size={18} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body font-semibold break-all">{i.email}</span>
                    <span className="text-small text-fg-muted">
                      {ROLE_LABEL[i.role]}, berlaku sampai {dateId(i.expiresAt)}
                    </span>
                  </span>
                  <Button variant="quiet" size="S" tone="danger" onClick={() => (revokeInv.reset(), setRevokingInvite(i))} aria-label={`Batalkan undangan ${i.email}`}>
                    Batalkan
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
          <p className="m-0 text-small text-fg-muted">
            Persetujuan privasi hanya bisa diubah oleh orang tua dari akunnya sendiri. <Link href={FAMILY_ROUTES.privacy}>Halaman privasi keluarga</Link>
          </p>
        </Card>
      </div>

      {/* Dialog */}
      <ConfirmDialog
        open={revoking != null}
        onClose={() => setRevoking(null)}
        title={revoking ? `Cabut ${revoking.name}?` : 'Cabut perangkat?'}
        body={
          revoking
            ? `${revoking.learners.length ? revoking.learners.join(' dan ') : 'Pengguna perangkat ini'} langsung keluar dari perangkat ini. Untuk memakainya lagi, orang dewasa harus masuk dan mendaftarkan perangkat ulang.`
            : ''
        }
        warning="Jawaban yang belum sinkron di perangkat ini hilang kalau dicabut sekarang. Sambungkan perangkat ke internet dulu kalau masih bisa."
        confirmLabel="Cabut perangkat"
        onConfirm={doRevoke}
        error={revoke.error ? <ActionError error={revoke.error} /> : null}
      />

      <Dialog
        open={renaming != null}
        onClose={() => setRenaming(null)}
        dismissible={!rename.pending}
        title="Ganti nama perangkat"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)} disabled={rename.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={doRename} loading={rename.pending}>
              Simpan nama
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Nama perangkat" value={newName} onChange={(e) => (setNewName(e.target.value), setNameError(null))} error={nameError} maxLength={40} autoComplete="off" />
          <ActionError error={rename.error} />
        </div>
      </Dialog>

      <Dialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        dismissible={!register.pending}
        title="Daftarkan perangkat ini"
        description="Perangkat yang terdaftar bisa dipakai learner masuk dengan PIN gambar selama 90 hari."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegisterOpen(false)} disabled={register.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={doRegister} loading={register.pending}>
              Daftarkan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Nama perangkat" placeholder="Contoh: Tablet Alya" value={regName} onChange={(e) => setRegName(e.target.value)} maxLength={40} autoComplete="off" />
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 p-0 text-small font-bold">Learner yang memakai perangkat ini</legend>
            {data.shell.learners.map((l) => (
              <Checkbox
                key={l.id}
                label={`${l.name}, Grade ${l.grade}`}
                checked={regLearners.includes(l.id)}
                onChange={(e) => setRegLearners((x) => (e.target.checked ? [...x, l.id] : x.filter((y) => y !== l.id)))}
              />
            ))}
          </fieldset>
          {regError ? <InlineAlert tone="danger" title={regError} /> : null}
          <ActionError error={register.error} />
        </div>
      </Dialog>

      <Dialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        dismissible={!changePw.pending}
        title="Ganti password"
        description="Paling sedikit 15 karakter. Kalimat pendek yang mudah diingat lebih aman daripada kata acak yang pendek."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwOpen(false)} disabled={changePw.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={doChangePassword} loading={changePw.pending}>
              Simpan password
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void doChangePassword()
          }}
        >
          <input type="text" name="username" autoComplete="username" value={data.account.email} readOnly hidden />
          <PasswordField label="Password sekarang" autoComplete="current-password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} error={pwErrors.current} />
          <PasswordField
            label="Password baru"
            autoComplete="new-password"
            value={pwNext}
            onChange={(e) => setPwNext(e.target.value)}
            error={pwErrors.next}
            hint={`${[...pwNext].length} karakter. Diperiksa terhadap daftar password yang pernah bocor.`}
          />
          <ActionError error={changePw.error} />
          <button type="submit" hidden />
        </form>
      </Dialog>

      <Dialog
        open={pkOpen}
        onClose={() => setPkOpen(false)}
        dismissible={!pkBusy}
        title="Tambah passkey"
        description="Peramban akan meminta sidik jari, wajah, atau PIN perangkat ini."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPkOpen(false)} disabled={pkBusy}>
              Batal
            </Button>
            <Button variant="primary" onClick={doAddPasskey} loading={pkBusy}>
              Buat passkey
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Nama passkey" placeholder="Contoh: Laptop rumah" value={pkName} onChange={(e) => setPkName(e.target.value)} maxLength={40} autoComplete="off" />
          <ActionError error={pkError} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={removingKey != null}
        onClose={() => setRemovingKey(null)}
        title={removingKey ? `Hapus passkey ${removingKey.name}?` : 'Hapus passkey?'}
        body="Perangkat itu tidak bisa lagi masuk dengan passkey ini. Password tetap bisa dipakai."
        confirmLabel="Hapus passkey"
        onConfirm={doRemoveKey}
        error={removeKey.error ? <ActionError error={removeKey.error} /> : null}
      />

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        dismissible={!invite.pending}
        title="Undang anggota"
        description="Undangan berlaku 7 hari dan hanya bisa dipakai sekali."
        footer={
          invLink ? (
            <Button variant="primary" onClick={() => setInviteOpen(false)}>
              Selesai
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={invite.pending}>
                Batal
              </Button>
              <Button variant="primary" onClick={doInvite} loading={invite.pending}>
                Buat undangan
              </Button>
            </>
          )
        }
      >
        {invLink ? (
          <div className="flex flex-col gap-3">
            <InlineAlert tone="success" title={`Undangan untuk ${invEmail.trim()} dibuat.`} live="status">
              Kirim tautan ini lewat WhatsApp atau email. Tautan hanya bisa dipakai sekali.
            </InlineAlert>
            <TextField label="Tautan undangan" value={invLink} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="secondary"
              icon="copy"
              className="self-start"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invLink)
                  toast({ tone: 'success', title: 'Tautan undangan disalin.' })
                } catch {
                  toast({ tone: 'info', title: 'Pilih tautan lalu salin manual.' })
                }
              }}
            >
              Salin tautan
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={invEmail}
              onChange={(e) => (setInvEmail(e.target.value), setInvError(null))}
            />
            <RadioGroup
              name="peran"
              legend="Peran"
              value={invRole}
              onChange={setInvRole}
              options={[
                { value: 'guardian', label: 'Orang tua', description: 'Melihat laporan dan mengatur privasi anaknya.' },
                { value: 'tutor', label: 'Tutor', description: 'Menyusun rencana, menilai, dan mengelola bank soal.' },
              ]}
            />
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-small font-bold">Learner yang boleh dilihat</legend>
              {data.learners.map((l) => (
                <Checkbox
                  key={l.id}
                  label={l.name}
                  checked={invLearners.includes(l.id)}
                  onChange={(e) => setInvLearners((x) => (e.target.checked ? [...x, l.id] : x.filter((y) => y !== l.id)))}
                />
              ))}
            </fieldset>
            {invError ? <InlineAlert tone="danger" title={invError} /> : null}
            <ActionError error={invite.error} />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={revokingInvite != null}
        onClose={() => setRevokingInvite(null)}
        title={revokingInvite ? `Batalkan undangan untuk ${revokingInvite.email}?` : 'Batalkan undangan?'}
        body="Tautan undangan langsung tidak berlaku. Buat undangan baru kalau masih dibutuhkan."
        confirmLabel="Batalkan undangan"
        cancelLabel="Kembali"
        onConfirm={doRevokeInvite}
        error={revokeInv.error ? <ActionError error={revokeInv.error} /> : null}
      />
    </ConsoleShell>
  )
}
