'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { Avatar } from '@kira/figures'
import { jakartaDate } from '@kira/core/time'
import type { AvatarName, ConsentPurpose, LearnersActions, LearnersDTO, PinPicture } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { Dialog } from '@/components/console/Dialog'
import { Checkbox, FieldError, RadioGroup, TextField } from '@/components/console/Field'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { dateId } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { KeyValues, PageHeader, Pill } from '@/components/console/Layout'
import { PinChooser, pinProblem } from '@/components/console/PinChooser'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T13 Learner dan grade (papan LearnerGrade, LearnerGradeTambah). Daftar learner
 * dengan status persetujuan, tambah learner (nama, avatar, grade, PIN gambar,
 * email orang tua), ubah data, PIN baru, buka kunci PIN, dan catat persetujuan
 * yang diberikan di luar Kira (formulir kertas atau langsung).
 */

export type LearnersScreenProps = { data: LearnersDTO; actions: LearnersActions }

type Learner = LearnersDTO['learners'][number]

const AVATARS: AvatarName[] = ['fox', 'cat', 'owl', 'bear', 'rabbit', 'turtle', 'penguin', 'frog']
const AVATAR_LABEL: Record<AvatarName, string> = {
  fox: 'Rubah',
  cat: 'Kucing',
  owl: 'Burung hantu',
  bear: 'Beruang',
  rabbit: 'Kelinci',
  turtle: 'Kura-kura',
  penguin: 'Penguin',
  frog: 'Katak',
}

const GRADES = [1, 2, 3, 4, 5, 6]
const NAME_MAX = 20
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Judul tujuan sama dengan halaman Privasi keluarga (LearnersDTO tidak membawa daftar tujuan). */
const PURPOSES: { id: ConsentPurpose['id']; title: string; required?: boolean }[] = [
  { id: 'learning', title: 'Belajar di Kira', required: true },
  { id: 'progress-email', title: 'Laporan mingguan lewat email' },
  { id: 'audio', title: 'Rekaman suara untuk soal berbicara' },
  { id: 'photo', title: 'Foto jawaban kertas' },
  { id: 'ai-drafts', title: 'Saran nilai dari AI untuk tulisan' },
]

const METHODS = [
  { value: 'paper-form', label: 'Formulir kertas bertanda tangan' },
  { value: 'in-person', label: 'Langsung, setelah Kebijakan Privasi dibaca bersama' },
  { value: 'written-message', label: 'Pesan tertulis, misalnya WhatsApp atau email' },
] as const
type Method = (typeof METHODS)[number]['value']

function statusOf(l: Learner): { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral' } {
  if (l.consent === 'pending') return { label: 'Menunggu persetujuan', tone: 'warn' }
  if (l.consent === 'withdrawn') return { label: 'Persetujuan ditarik', tone: 'danger' }
  if (!l.active) return { label: 'Dijeda', tone: 'neutral' }
  return { label: 'Aktif', tone: 'success' }
}

const CONSENT_TEXT: Record<Learner['consent'], string> = {
  granted: 'Tercatat',
  pending: 'Belum ada',
  withdrawn: 'Ditarik orang tua',
}

export function LearnersScreen({ data, actions }: LearnersScreenProps) {
  const router = useRouter()
  const toast = useToast()
  const [, startRefresh] = useTransition()
  const [src, setSrc] = useState(data.learners)
  const [list, setList] = useState<Learner[]>(data.learners)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Learner | null>(null)
  const [pinFor, setPinFor] = useState<Learner | null>(null)
  const [consentFor, setConsentFor] = useState<Learner | null>(null)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const unlock = useAction(actions.unlockLearner)

  if (src !== data.learners) {
    setSrc(data.learners)
    setList(data.learners)
  }

  const full = list.length >= data.maxLearners
  const activeN = list.filter((l) => l.active).length
  const pendingN = list.filter((l) => l.consent === 'pending').length
  const refresh = () => startRefresh(() => router.refresh())

  async function runUnlock(l: Learner) {
    setUnlocking(l.id)
    const r = await unlock.run(l.id)
    setUnlocking(null)
    if (r.ok) toast({ tone: 'success', title: `PIN ${l.name} bisa dicoba lagi sekarang.` })
    else toast({ tone: 'error', title: r.message, body: `Kunci PIN ${l.name} belum dibuka. Coba lagi sebentar lagi.`, reference: r.reference })
  }

  return (
    <ConsoleShell shell={data.shell} active="learners">
      <div className="flex flex-col gap-6">
        <nav aria-label="Jejak" className="-mb-2 flex flex-wrap items-center gap-2 text-small text-fg-muted">
          <Link href={CONSOLE_ROUTES.settings} className="font-semibold">
            Pengaturan
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Learner dan grade</span>
        </nav>
        <PageHeader
          title="Learner dan grade"
          description="Setiap learner punya PIN gambar, grade, bintang, dan streak sendiri. Batas waktu layar dan hari istirahat diatur di Pengaturan."
          actions={
            !full ? (
              <Button variant="primary" icon="userPlus" aria-haspopup="dialog" onClick={() => setAdding(true)}>
                Tambah learner
              </Button>
            ) : null
          }
        />
        {full ? (
          <InlineAlert tone="info" title={`Akun ini sudah berisi ${data.maxLearners} learner, batas untuk server ini.`}>
            Learner baru bisa ditambah setelah salah satu akun learner dihapus lewat halaman Privasi keluarga.
          </InlineAlert>
        ) : null}

        <section aria-labelledby="daftar-learner" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="daftar-learner" className="m-0 text-h2 font-bold max-sm:text-h3">
              Learner di akun ini
            </h2>
            {list.length ? (
              <span className="text-body text-fg-muted tabular">
                {activeN} aktif{pendingN ? `, ${pendingN} menunggu persetujuan` : ''}, batas {data.maxLearners} learner
              </span>
            ) : null}
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon="learners"
              title="Belum ada learner."
              body="Tambah learner pertama. Learner bisa masuk di tablet setelah persetujuan orang tua tercatat."
              actions={
                <Button variant="primary" icon="userPlus" aria-haspopup="dialog" onClick={() => setAdding(true)}>
                  Tambah learner
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
              {list.map((l) => (
                <LearnerCard
                  key={l.id}
                  learner={l}
                  unlocking={unlocking === l.id}
                  onEdit={() => setEditing(l)}
                  onPin={() => setPinFor(l)}
                  onConsent={() => setConsentFor(l)}
                  onUnlock={() => runUnlock(l)}
                />
              ))}
            </div>
          )}
          <p className="m-0 max-w-[72ch] text-small text-fg-muted">
            Mengubah grade memindahkan quest ke bab grade baru mulai Senin berikutnya. Bintang, streak, dan riwayat di grade lama tetap tersimpan.
          </p>
        </section>
      </div>

      <AddLearnerDialog
        open={adding}
        existing={list}
        actions={actions}
        onClose={() => setAdding(false)}
        onAdded={(l) => {
          setList((xs) => [...xs, l])
          refresh()
        }}
        onRecordConsent={(l) => {
          setAdding(false)
          setConsentFor(l)
        }}
      />
      <EditLearnerDialog
        learner={editing}
        existing={list}
        actions={actions}
        onClose={() => setEditing(null)}
        onSaved={(l) => {
          setList((xs) => xs.map((x) => (x.id === l.id ? l : x)))
          setEditing(null)
          toast({ tone: 'success', title: `Data ${l.name} tersimpan.` })
          refresh()
        }}
      />
      <PinDialog
        learner={pinFor}
        actions={actions}
        onClose={() => setPinFor(null)}
        onSaved={(l) => {
          setPinFor(null)
          toast({ tone: 'success', title: `PIN baru ${l.name} aktif.`, body: 'PIN lama tidak berlaku lagi di semua tablet.' })
        }}
      />
      <ConsentDialog
        learner={consentFor}
        actions={actions}
        onClose={() => setConsentFor(null)}
        onSaved={(l) => {
          setList((xs) => xs.map((x) => (x.id === l.id ? { ...x, consent: 'granted', active: true } : x)))
          setConsentFor(null)
          toast({ tone: 'success', title: `Persetujuan untuk ${l.name} tercatat.`, body: `${l.name} sekarang bisa masuk di tablet.` })
          refresh()
        }}
      />
    </ConsoleShell>
  )
}

function LearnerCard({
  learner: l,
  unlocking,
  onEdit,
  onPin,
  onConsent,
  onUnlock,
}: {
  learner: Learner
  unlocking: boolean
  onEdit: () => void
  onPin: () => void
  onConsent: () => void
  onUnlock: () => void
}) {
  const st = statusOf(l)
  const hid = `learner-${l.id}`
  return (
    <article aria-labelledby={hid} className="flex min-w-0 flex-col gap-4 rounded-card border border-divider bg-surface p-6 max-sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={l.avatar} size={56} className="flex-none" />
        <div className="flex min-w-0 flex-[1_1_140px] flex-col">
          <h3 id={hid} className="m-0 text-h3 font-bold [overflow-wrap:anywhere]">
            {l.name}
          </h3>
          <span className="text-small text-fg-muted">
            Grade {l.grade}, Cambridge Primary Stage {l.grade}
          </span>
        </div>
        <Pill tone={st.tone}>
          {st.tone === 'success' ? <ConsoleIcon name="check" size={14} strokeWidth={3} className="text-success" /> : null}
          {st.tone === 'warn' || st.tone === 'danger' ? <ConsoleIcon name="alert" size={14} strokeWidth={2.5} className={st.tone === 'warn' ? 'text-warn' : 'text-danger'} /> : null}
          {st.label}
        </Pill>
      </div>
      <KeyValues
        items={[
          { label: l.consent === 'pending' ? 'Dibuat' : 'Aktif sejak', value: dateId(l.since, true) },
          { label: 'Perangkat', value: l.devices ? `${l.devices} perangkat` : 'Belum ada' },
          { label: 'Orang tua', value: l.guardians.length ? l.guardians.join(', ') : 'Belum terhubung' },
          { label: 'Persetujuan', value: CONSENT_TEXT[l.consent] },
        ]}
      />
      {l.consent === 'pending' ? (
        <p className="m-0 rounded-control border border-warn bg-warn-50 px-4 py-3 text-body">
          {l.name} belum bisa masuk di tablet sampai persetujuan orang tua tercatat, lewat tautan undangan atau dicatat offline di sini.
        </p>
      ) : null}
      {l.consent === 'withdrawn' ? (
        <p className="m-0 rounded-control border border-danger bg-danger-50 px-4 py-3 text-body">
          Orang tua menarik persetujuan. {l.name} tidak bisa membuka quest sampai persetujuan diberikan lagi.
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {l.consent === 'granted' ? (
          <ButtonLink href={CONSOLE_ROUTES.learnerDetail(l.id)} variant="secondary" size="S">
            Lihat detail
          </ButtonLink>
        ) : (
          <Button variant="primary" size="S" onClick={onConsent} aria-haspopup="dialog">
            Catat persetujuan offline
          </Button>
        )}
        <Button variant="secondary" size="S" icon="edit" onClick={onEdit} aria-haspopup="dialog">
          Ubah
        </Button>
        <Button variant="secondary" size="S" icon="key" onClick={onPin} aria-haspopup="dialog">
          PIN baru
        </Button>
        {l.active ? (
          <Button variant="quiet" size="S" icon="lock" loading={unlocking} onClick={onUnlock}>
            Buka kunci PIN
          </Button>
        ) : null}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Kontrol bersama

function AvatarPicker({ value, onChange, taken }: { value: AvatarName; onChange: (a: AvatarName) => void; taken: Partial<Record<AvatarName, string>> }) {
  const auto = useId()
  const name = `avatar${auto.replace(/:/g, '')}`
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" aria-describedby={`${name}-hint`}>
      <legend className="mb-1.5 p-0 text-small font-bold">Avatar</legend>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(96px,1fr))]">
        {AVATARS.map((a) => {
          const usedBy = taken[a]
          return (
            <label key={a} className={cx('relative flex min-w-0', usedBy ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <input
                type="radio"
                name={name}
                value={a}
                checked={value === a}
                disabled={Boolean(usedBy)}
                onChange={() => onChange(a)}
                className="peer visually-hidden"
              />
              <span
                className={cx(
                  'flex w-full flex-col items-center gap-1 rounded-control border-2 border-border bg-surface px-1.5 py-2.5 text-center',
                  'peer-checked:border-3 peer-checked:border-fg peer-checked:bg-bg',
                  'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                  'peer-disabled:border-dashed peer-disabled:border-review peer-disabled:bg-bg',
                  !usedBy && 'hover:border-fg',
                )}
              >
                <Avatar name={a} size={44} className={usedBy ? 'opacity-50' : undefined} />
                <span className={cx('text-small leading-tight font-semibold', usedBy && 'text-fg-muted')}>
                  {usedBy ? (
                    <>
                      <span className="visually-hidden">{AVATAR_LABEL[a]}, </span>Dipakai {usedBy}
                    </>
                  ) : (
                    AVATAR_LABEL[a]
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <span id={`${name}-hint`} className="text-small text-fg-muted">
        Setiap learner memakai avatar berbeda supaya mudah dikenali di layar pilih learner.
      </span>
    </fieldset>
  )
}

function GradePicker({ value, onChange }: { value: number; onChange: (g: number) => void }) {
  return (
    <RadioGroup<string>
      name="grade"
      legend="Grade"
      layout="tiles"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={GRADES.map((g) => ({ value: String(g), label: `Grade ${g}`, description: `Cambridge Primary Stage ${g}` }))}
    />
  )
}

function nameProblem(name: string, existing: Learner[], selfId: string | null): string | null {
  const n = name.trim()
  if (!n) return 'Isi nama tampilan.'
  if (n.length > NAME_MAX) return `Nama tampilan paling banyak ${NAME_MAX} karakter, sekarang ${n.length}.`
  if (existing.some((l) => l.id !== selfId && l.name.trim().toLowerCase() === n.toLowerCase()))
    return `Nama ${n} sudah dipakai learner lain. Pakai nama lain supaya mudah dibedakan di tablet.`
  return null
}

function takenAvatars(existing: Learner[], selfId: string | null): Partial<Record<AvatarName, string>> {
  const out: Partial<Record<AvatarName, string>> = {}
  for (const l of existing) if (l.id !== selfId) out[l.avatar] = l.name
  return out
}

function CopyLink({ link, label }: { link: string; label: string }) {
  const toast = useToast()
  const auto = useId()
  const id = `link${auto.replace(/:/g, '')}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-bold">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-[1_1_240px] rounded-control border-2 border-border bg-bg px-3 text-body"
        />
        <Button
          variant="secondary"
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              toast({ tone: 'success', title: 'Tautan disalin.' })
            } catch {
              const el = document.getElementById(id) as HTMLInputElement | null
              el?.focus()
              el?.select()
              toast({ tone: 'info', title: 'Tautan sudah dipilih. Tekan Ctrl+C untuk menyalin.' })
            }
          }}
        >
          Salin tautan
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog tambah learner

function AddLearnerDialog({
  open,
  existing,
  actions,
  onClose,
  onAdded,
  onRecordConsent,
}: {
  open: boolean
  existing: Learner[]
  actions: LearnersActions
  onClose: () => void
  onAdded: (l: Learner) => void
  onRecordConsent: (l: Learner) => void
}) {
  const taken = takenAvatars(existing, null)
  const firstFree = AVATARS.find((a) => !taken[a]) ?? 'cat'
  const [wasOpen, setWasOpen] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<AvatarName>(firstFree)
  const [grade, setGrade] = useState(2)
  const [pin, setPin] = useState<PinPicture[]>([])
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; pin?: string; email?: string }>({})
  const [done, setDone] = useState<{ learner: Learner; inviteLink: string | null; email: string | null } | null>(null)
  const add = useAction(actions.addLearner)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName('')
      setAvatar(firstFree)
      setGrade(2)
      setPin([])
      setEmail('')
      setErrors({})
      setDone(null)
      add.reset()
    }
  }

  async function submit() {
    const next: typeof errors = {}
    const np = nameProblem(name, existing, null)
    if (np) next.name = np
    const pp = pinProblem(pin)
    if (pp) next.pin = pp
    const em = email.trim()
    if (em && !EMAIL_RE.test(em)) next.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    setErrors(next)
    if (next.name || next.pin || next.email) {
      document.getElementById(next.name ? 'learner-nama' : next.pin ? 'learner-pin' : 'learner-email')?.focus()
      return
    }
    const r = await add.run({ name: name.trim(), grade, avatar, pin, guardianEmail: em || null })
    if (!r.ok) {
      if (r.fieldErrors) setErrors({ name: r.fieldErrors.name, email: r.fieldErrors.guardianEmail, pin: r.fieldErrors.pin })
      return
    }
    const learner: Learner = {
      id: r.data.learnerId,
      name: name.trim(),
      grade,
      avatar,
      active: false,
      consent: 'pending',
      guardians: [],
      devices: 0,
      since: jakartaDate(),
    }
    onAdded(learner)
    setDone({ learner, inviteLink: r.data.inviteLink, email: em || null })
  }

  if (done) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={`${done.learner.name} ditambahkan`}
        description={`${done.learner.name} bisa masuk di tablet setelah persetujuan orang tua tercatat.`}
        footer={
          <>
            {!done.email ? (
              <Button variant="secondary" onClick={() => onRecordConsent(done.learner)}>
                Catat persetujuan offline
              </Button>
            ) : null}
            <Button variant="primary" onClick={onClose}>
              Selesai
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {done.email ? (
            <InlineAlert tone="success" title={`Permintaan persetujuan dikirim ke ${done.email}.`} live="status">
              Email berisi Kebijakan Privasi, Syarat dan Ketentuan, dan tombol untuk menyetujui.
            </InlineAlert>
          ) : (
            <p className="m-0 text-body">Tanpa email orang tua, persetujuan bisa dicatat offline dari formulir kertas atau tatap muka.</p>
          )}
          {done.inviteLink ? (
            <CopyLink link={done.inviteLink} label="Tautan persetujuan untuk orang tua" />
          ) : null}
          {done.inviteLink ? (
            <p className="m-0 text-small text-fg-muted">Kirim tautan ini lewat pesan bila email tidak sampai. Tautan hanya bisa dipakai sekali.</p>
          ) : null}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!add.pending}
      title="Tambah learner"
      description="Learner baru aktif setelah orang tuanya memberi persetujuan."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={add.pending}>
            Batal
          </Button>
          <Button variant="primary" loading={add.pending} onClick={submit}>
            {email.trim() ? 'Kirim permintaan persetujuan' : 'Tambah learner'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          id="learner-nama"
          data-autofocus=""
          label="Nama tampilan"
          hint="Nama yang terlihat di tablet. Nama panggilan sudah cukup."
          value={name}
          maxLength={40}
          autoComplete="off"
          error={errors.name}
          onChange={(e) => {
            setName(e.target.value)
            if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
          }}
        />
        <AvatarPicker value={avatar} onChange={setAvatar} taken={taken} />
        <GradePicker value={grade} onChange={setGrade} />
        <div id="learner-pin" tabIndex={-1} className="outline-none">
          <PinChooser
            value={pin}
            onChange={(p) => {
              setPin(p)
              if (errors.pin) setErrors((x) => ({ ...x, pin: undefined }))
            }}
            error={errors.pin}
            hint="Pilih 4 gambar berurutan. Gambar yang sama boleh dipakai lagi. Beri tahu learner urutannya setelah disimpan."
          />
        </div>
        <TextField
          id="learner-email"
          label="Email orang tua (opsional)"
          hint="Permintaan persetujuan dikirim ke email ini bersama Kebijakan Privasi dan Syarat dan Ketentuan. Kosongkan bila persetujuan dicatat offline."
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          maxLength={254}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
          }}
        />
        <p className="m-0 flex items-start gap-2 text-small text-fg-muted">
          <ConsoleIcon name="shield" size={18} className="mt-0.5 flex-none" />
          <span>Kira tidak meminta tanggal lahir, foto, nama lengkap, atau nama sekolah.</span>
        </p>
        <ActionError error={add.error} />
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog ubah learner

function EditLearnerDialog({
  learner,
  existing,
  actions,
  onClose,
  onSaved,
}: {
  learner: Learner | null
  existing: Learner[]
  actions: LearnersActions
  onClose: () => void
  onSaved: (l: Learner) => void
}) {
  const [src, setSrc] = useState<Learner | null>(null)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<AvatarName>('cat')
  const [grade, setGrade] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const save = useAction(actions.updateLearner)

  if (learner && learner !== src) {
    setSrc(learner)
    setName(learner.name)
    setAvatar(learner.avatar)
    setGrade(learner.grade)
    setError(null)
    save.reset()
  }

  async function submit() {
    if (!learner) return
    const np = nameProblem(name, existing, learner.id)
    setError(np)
    if (np) {
      document.getElementById('ubah-nama')?.focus()
      return
    }
    const r = await save.run({ learnerId: learner.id, name: name.trim(), grade, avatar })
    if (r.ok) onSaved({ ...learner, name: name.trim(), grade, avatar })
  }

  const gradeChanged = learner != null && grade !== learner.grade

  return (
    <Dialog
      open={learner != null}
      onClose={onClose}
      size="lg"
      dismissible={!save.pending}
      title={learner ? `Ubah data ${learner.name}` : 'Ubah data learner'}
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
      {learner ? (
        <div className="flex flex-col gap-5">
          <TextField
            id="ubah-nama"
            label="Nama tampilan"
            value={name}
            maxLength={40}
            autoComplete="off"
            error={error}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
          />
          <AvatarPicker value={avatar} onChange={setAvatar} taken={takenAvatars(existing, learner.id)} />
          <GradePicker value={grade} onChange={setGrade} />
          {gradeChanged ? (
            <InlineAlert tone="warn" title={`Grade berubah dari ${learner.grade} ke ${grade}.`} live="status">
              Quest pindah ke bab Grade {grade} mulai Senin berikutnya. Bintang, streak, dan riwayat di Grade {learner.grade} tetap tersimpan.
            </InlineAlert>
          ) : null}
          <ActionError error={save.error} />
        </div>
      ) : null}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog PIN baru

function PinDialog({ learner, actions, onClose, onSaved }: { learner: Learner | null; actions: LearnersActions; onClose: () => void; onSaved: (l: Learner) => void }) {
  const [src, setSrc] = useState<Learner | null>(null)
  const [pin, setPin] = useState<PinPicture[]>([])
  const [error, setError] = useState<string | null>(null)
  const save = useAction(actions.resetPin)

  if (learner && learner !== src) {
    setSrc(learner)
    setPin([])
    setError(null)
    save.reset()
  }

  async function submit() {
    if (!learner) return
    const pp = pinProblem(pin)
    setError(pp)
    if (pp) return
    const r = await save.run({ learnerId: learner.id, pin })
    if (r.ok) onSaved(learner)
  }

  return (
    <Dialog
      open={learner != null}
      onClose={onClose}
      dismissible={!save.pending}
      title={learner ? `PIN baru untuk ${learner.name}` : 'PIN baru'}
      description="PIN lama langsung tidak berlaku di semua tablet. Beri tahu learner urutan gambar yang baru."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Batal
          </Button>
          <Button variant="primary" loading={save.pending} onClick={submit}>
            Simpan PIN baru
          </Button>
        </>
      }
    >
      {learner ? (
        <div className="flex flex-col gap-4">
          <PinChooser
            value={pin}
            onChange={(p) => {
              setPin(p)
              if (error) setError(null)
            }}
            error={error}
            legend="PIN gambar baru"
          />
          <ActionError error={save.error} />
        </div>
      ) : null}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog catat persetujuan offline

function ConsentDialog({ learner, actions, onClose, onSaved }: { learner: Learner | null; actions: LearnersActions; onClose: () => void; onSaved: (l: Learner) => void }) {
  const auto = useId()
  const dateFieldId = `tgl${auto.replace(/:/g, '')}`
  const [src, setSrc] = useState<Learner | null>(null)
  const [guardian, setGuardian] = useState('')
  const [method, setMethod] = useState<Method>('paper-form')
  const [date, setDate] = useState('')
  const [purposes, setPurposes] = useState<Set<ConsentPurpose['id']>>(() => new Set(['learning']))
  const [errors, setErrors] = useState<{ guardian?: string; date?: string }>({})
  const save = useAction(actions.recordOfflineConsent)
  const today = jakartaDate()

  if (learner && learner !== src) {
    setSrc(learner)
    setGuardian('')
    setMethod('paper-form')
    setDate(today)
    setPurposes(new Set(['learning']))
    setErrors({})
    save.reset()
  }

  async function submit() {
    if (!learner) return
    const next: typeof errors = {}
    const g = guardian.trim()
    if (!g) next.guardian = 'Isi nama orang tua yang memberi persetujuan.'
    else if (g.length > 80) next.guardian = `Nama paling banyak 80 karakter, sekarang ${g.length}.`
    if (!date) next.date = 'Isi tanggal persetujuan diberikan.'
    else if (date > today) next.date = `Tanggal tidak boleh setelah hari ini (${dateId(today)}).`
    setErrors(next)
    if (next.guardian || next.date) {
      document.getElementById(next.guardian ? 'izin-ortu' : dateFieldId)?.focus()
      return
    }
    const r = await save.run({ learnerId: learner.id, guardianName: g, method, date, purposes: [...purposes] })
    if (r.ok) onSaved(learner)
  }

  return (
    <Dialog
      open={learner != null}
      onClose={onClose}
      size="lg"
      dismissible={!save.pending}
      title={learner ? `Catat persetujuan untuk ${learner.name}` : 'Catat persetujuan'}
      description="Untuk persetujuan yang diberikan di kertas atau langsung. Catatan masuk riwayat persetujuan dan terlihat oleh orang tua di halaman Privasi."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Batal
          </Button>
          <Button variant="primary" loading={save.pending} onClick={submit}>
            Catat persetujuan
          </Button>
        </>
      }
    >
      {learner ? (
        <div className="flex flex-col gap-5">
          <TextField
            id="izin-ortu"
            label="Nama orang tua atau wali"
            value={guardian}
            maxLength={120}
            autoComplete="off"
            error={errors.guardian}
            onChange={(e) => {
              setGuardian(e.target.value)
              if (errors.guardian) setErrors((x) => ({ ...x, guardian: undefined }))
            }}
          />
          <RadioGroup<Method>
            name="izin-cara"
            legend="Cara persetujuan diberikan"
            value={method}
            onChange={setMethod}
            options={METHODS.map((m) => ({ value: m.value, label: m.label }))}
          />
          <div className="flex max-w-[260px] flex-col gap-1.5">
            <label htmlFor={dateFieldId} className="text-small font-bold">
              Tanggal persetujuan
            </label>
            <input
              id={dateFieldId}
              type="date"
              value={date}
              max={today}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? `${dateFieldId}-error` : undefined}
              onChange={(e) => {
                setDate(e.target.value)
                if (errors.date) setErrors((x) => ({ ...x, date: undefined }))
              }}
              className={cx(
                'h-11 w-full min-w-0 rounded-control border-2 bg-surface px-3 text-body text-fg',
                errors.date ? 'border-danger' : 'border-border hover:border-fg',
              )}
            />
            {errors.date ? <FieldError id={`${dateFieldId}-error`}>{errors.date}</FieldError> : null}
          </div>
          <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-small font-bold">Tujuan yang disetujui</legend>
            {PURPOSES.map((p) => (
              <Checkbox
                key={p.id}
                label={p.title}
                description={p.required ? 'Wajib untuk memakai Kira.' : undefined}
                checked={purposes.has(p.id)}
                disabled={p.required}
                onChange={(e) => {
                  const on = e.target.checked
                  setPurposes((s) => {
                    const n = new Set(s)
                    if (on) n.add(p.id)
                    else n.delete(p.id)
                    return n
                  })
                }}
              />
            ))}
          </fieldset>
          <InlineAlert tone="info" live="none">
            Simpan bukti aslinya, misalnya foto formulir bertanda tangan. Kira hanya mencatat ringkasannya.
          </InlineAlert>
          <ActionError error={save.error} />
        </div>
      ) : null}
    </Dialog>
  )
}
