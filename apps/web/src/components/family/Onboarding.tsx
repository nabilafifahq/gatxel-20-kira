'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type FormEvent } from 'react'
import { Avatar, Icon } from '@kira/figures'
import { AVATARS } from '@kira/figures/spec'
import { recommendationFor, recommendationSummary } from '@kira/core/recommendation'
import type { AvatarName, PinPicture } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { Checkbox, FieldError, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PIN_LABEL, PinChooser, pinProblem } from '@/components/console/PinChooser'
import { FAMILY_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { FeatureChecklist } from '@/components/family/FeatureChecklist'
import { AccountMenu } from '@/components/ui/AccountMenu'
import { UiIcon } from '@/components/ui/icons'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ONBOARDING_STEPS, naturalStep, type OnboardingStep } from '@/lib/onboarding-steps'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { addChildAction, applyPathAction, markCustomPathAction, saveConsentsAction } from '@/server/actions/onboarding'
import { UiLangChoice } from './UiLangChoice'
import type { UiLang } from '@/lib/i18n/lang'
import { registerDeviceAction } from '@/server/actions/auth'
import type { OnboardingChild, OnboardingPurpose, OnboardingState } from '@/server/dal/onboarding'

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

const PURPOSES: { id: OnboardingPurpose; label: string; description: string }[] = [
  { id: 'learning', label: 'Belajar di Kira', description: 'Menyimpan jawaban, skor, dan kemajuan supaya soal berikutnya sesuai kemampuan anak. Perlu dicentang supaya anak bisa masuk.' },
  { id: 'progress-email', label: 'Laporan mingguan lewat email', description: 'Ringkasan belajar seminggu sekali ke email kamu.' },
  { id: 'audio', label: 'Rekaman suara', description: 'Menyimpan rekaman latihan berbicara. Disimpan 90 hari.' },
  { id: 'photo', label: 'Foto dan gambar jawaban', description: 'Menyimpan foto jawaban di kertas. Disimpan 90 hari.' },
]

const CAN_CHANGE = 'Bisa diubah kapan saja di dashboard orang tua.'
const stepHref = (n: OnboardingStep) => `/mulai?langkah=${n}`

/**
 * Onboarding orang tua setelah email terkonfirmasi, tiga langkah jelas: tambah anak, pilih jalur, cara anak masuk.
 * Langkah ada di alamat (?langkah=), jadi tombol kembali dan muat ulang benar; server yang menentukan langkah yang boleh dibuka.
 * Melewati langkah jalur memakai jalur rekomendasi, jadi tidak pernah buntu.
 */
export function Onboarding({ state, step, customChild }: { state: OnboardingState; step: OnboardingStep; customChild: OnboardingChild | null }) {
  const [pins, setPins] = useState<Record<string, PinPicture[]>>({})
  const reached = naturalStep(state.children)
  return (
    <PublicFrame
      center={false}
      brandHref={FAMILY_ROUTES.home}
      headerAction={<AccountMenu name={state.parentName} links={[{ href: FAMILY_ROUTES.home, label: 'Buka dashboard' }]} />}
    >
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <StepProgress step={step} reached={reached} />
        <div key={customChild ? customChild.id : step} className="kira-fade-up flex flex-col gap-6">
          {step === 1 ? <StepChildren state={state} onPin={(id, pin) => setPins((p) => ({ ...p, [id]: pin }))} pins={pins} /> : null}
          {step === 2 && customChild ? <StepCustom child={customChild} all={state.children} /> : null}
          {step === 2 && !customChild ? <StepPath state={state} /> : null}
          {step === 3 ? <StepLogin state={state} pins={pins} /> : null}
        </div>
      </div>
    </PublicFrame>
  )
}

function StepProgress({ step, reached }: { step: OnboardingStep; reached: OnboardingStep }) {
  return (
    <nav aria-label="Langkah persiapan">
      <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {ONBOARDING_STEPS.map((s) => {
          const on = s.step === step
          const done = s.step < reached
          const open = s.step <= reached
          const body = (
            <>
              <span aria-hidden="true" className={cx('h-1.5 w-full rounded-pill', on || done ? 'bg-fg' : 'bg-lavender')} />
              <span className={cx('flex items-center gap-1 text-small leading-tight', on ? 'font-extrabold' : 'font-semibold')}>
                {done ? <UiIcon name="check" size={14} className="flex-none" /> : null}
                <span>
                  <span className="visually-hidden">Langkah {s.step}: </span>
                  {s.label}
                </span>
              </span>
            </>
          )
          return (
            <li key={s.step}>
              {open && !on ? (
                <Link href={stepHref(s.step)} className="kira-press flex min-h-11 flex-col gap-1.5 pt-1 text-fg no-underline hover:text-fg">
                  {body}
                </Link>
              ) : (
                <span aria-current={on ? 'step' : undefined} className="flex min-h-11 flex-col gap-1.5 pt-1">
                  {body}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepChildren({ state, pins, onPin }: { state: OnboardingState; pins: Record<string, PinPicture[]>; onPin: (id: string, pin: PinPicture[]) => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const canAdd = state.children.length < state.max
  const first = state.children.length === 0
  const refresh = () => startTransition(() => router.refresh())
  return (
    <section aria-labelledby="langkah-1" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 id="langkah-1" className="m-0 text-h1 font-bold max-sm:text-h2">
          {first ? `Selamat datang, ${state.parentName.split(' ')[0]}` : 'Anak yang belajar di Kira'}
        </h1>
        <p className="m-0 text-body-lg text-fg-muted">{first ? 'Tiga langkah pendek, lalu anak bisa mulai.' : 'Tambah anak lain, atau lanjut memilih jalur belajar.'}</p>
      </header>
      {state.children.map((c) => (
        <div key={c.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-soft">
            <Avatar name={c.avatar} size={52} className="flex-none" />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="m-0 text-h3 font-bold">{c.name}</p>
              <p className="m-0 text-small text-fg-muted">Kelas {c.grade}</p>
              {pins[c.id] ? <PinPreview name={c.name} pin={pins[c.id]!} /> : null}
            </div>
            {c.active ? <UiIcon name="check-circle" size={24} className="flex-none text-success" title="Izin belajar sudah diberikan" /> : null}
          </div>
          {!c.active ? <ChildCard child={c} onSaved={refresh} /> : null}
        </div>
      ))}
      {canAdd && (first || adding) ? (
        <AddChildForm
          existing={state.children}
          first={first}
          onAdded={(id, pin) => {
            onPin(id, pin)
            setAdding(false)
            refresh()
          }}
        />
      ) : null}
      {canAdd && !first && !adding ? (
        <Button variant="secondary" icon="plus" className="h-12" onClick={() => setAdding(true)}>
          Tambah anak lain
        </Button>
      ) : null}
      {!canAdd ? (
        <InlineAlert tone="info" title={`Kamu sudah menambahkan ${state.max} anak, batas satu keluarga.`}>
          Butuh menukar? Hapus akun salah satu anak lewat halaman Privasi keluarga.
        </InlineAlert>
      ) : null}
      {!first ? (
        <ButtonLink href={stepHref(2)} variant="primary" iconAfter="arrowRight" className="h-12 w-full">
          Lanjut pilih jalur
        </ButtonLink>
      ) : null}
    </section>
  )
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="kira-press inline-flex min-h-11 items-center gap-1 self-start font-bold">
      <UiIcon name="arrow-left" size={18} />
      {label}
    </Link>
  )
}

function PinPreview({ name, pin }: { name: string; pin: PinPicture[] }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="text-small font-bold">PIN {name}:</span>
      {pin.map((p, i) => (
        <span key={i} className="inline-flex size-8 items-center justify-center rounded-sm border-2 border-fg bg-surface" title={PIN_LABEL[p]}>
          <Icon name={p} size={22} />
          <span className="visually-hidden">{PIN_LABEL[p]}</span>
        </span>
      ))}
    </div>
  )
}

function StepPath({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const apply = useAction(applyPathAction)
  const skip = useAction(applyPathAction)
  const pending = state.children.filter((c) => c.setupPath === null)
  const targets = (pending.length > 0 ? pending : state.children).map((c) => c.id)
  const go = async (runner: typeof apply, mode: 'recommended' | 'skipped') => {
    const r = await runner.run({ mode, learnerIds: targets })
    if (r.ok) router.push(stepHref(3))
  }
  const failure = apply.error ?? skip.error
  return (
    <section aria-labelledby="langkah-2" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <BackLink href={stepHref(1)} label="Kembali ke tambah anak" />
        <h1 id="langkah-2" className="m-0 text-h1 font-bold max-sm:text-h2">
          Pilih jalur belajar
        </h1>
        <p className="m-0 text-body-lg text-fg-muted">{CAN_CHANGE}</p>
      </header>
      {failure ? (
        <InlineAlert tone="danger" title={failure.message} reference={failure.reference}>
          Coba lagi sebentar.
        </InlineAlert>
      ) : null}
      <div className="flex flex-col gap-4 rounded-card border-2 border-fg bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-h2 font-bold">Pakai jalur rekomendasi</h2>
          <span className="inline-flex h-7 items-center rounded-pill bg-yellow px-3 text-small font-extrabold">Disarankan</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {state.children.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar name={c.avatar} size={36} className="flex-none" />
              <span className="text-body">{c.setupPath === 'custom' && pending.length > 0 ? `${c.name} sudah diatur sendiri.` : recommendationSummary(c.name, c.grade)}</span>
            </li>
          ))}
        </ul>
        <Button variant="primary" className="h-12 w-full" loading={apply.pending} disabled={skip.pending} onClick={() => go(apply, 'recommended')}>
          Pakai jalur rekomendasi
        </Button>
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft">
        <h2 className="m-0 text-h3 font-bold">Atur sendiri</h2>
        <p className="m-0 text-body text-fg-muted">Pilih mapel dan fitur untuk tiap anak. Setiap saklar menjelaskan apa yang dilakukannya.</p>
        <div className="flex flex-col gap-2">
          {state.children.map((c) => (
            <ButtonLink key={c.id} href={`${stepHref(2)}&anak=${encodeURIComponent(c.id)}`} variant="secondary" iconAfter="arrowRight" className="h-12 w-full">
              Atur sendiri untuk {c.name}
            </ButtonLink>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <Button variant="quiet" loading={skip.pending} disabled={apply.pending} onClick={() => go(skip, 'skipped')} className="min-h-11">
          Lewati dulu
        </Button>
        <p className="m-0 text-small text-fg-muted">Kalau dilewati, kami pakai jalur rekomendasi. {CAN_CHANGE}</p>
      </div>
    </section>
  )
}

function StepCustom({ child, all }: { child: OnboardingChild; all: OnboardingChild[] }) {
  const router = useRouter()
  const mark = useAction(markCustomPathAction)
  // Belum pernah memilih: mulai dari jalur rekomendasi, lalu diubah seperlunya.
  const initial = child.setupPath ? child.features : recommendationFor(child.grade).features
  return (
    <section aria-labelledby="langkah-2-atur" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <BackLink href={stepHref(2)} label="Kembali ke pilihan jalur" />
        <h1 id="langkah-2-atur" className="m-0 text-h1 font-bold max-sm:text-h2">
          Atur sendiri untuk {child.name}
        </h1>
        <p className="m-0 text-body-lg text-fg-muted">Kelas {child.grade}. {CAN_CHANGE}</p>
      </header>
      {mark.error ? <InlineAlert tone="danger" title={mark.error.message} reference={mark.error.reference} /> : null}
      <FeatureChecklist
        learnerId={child.id}
        name={child.name}
        initial={initial}
        primary
        saveLabel="Simpan dan lanjut"
        onSaved={async () => {
          const r = await mark.run({ learnerId: child.id })
          if (!r.ok) return
          const others = all.some((c) => c.id !== child.id && c.setupPath === null)
          router.push(others ? stepHref(2) : stepHref(3))
        }}
      />
    </section>
  )
}

function StepLogin({ state, pins }: { state: OnboardingState; pins: Record<string, PinPicture[]> }) {
  const open = useAction(registerDeviceAction)
  const [copied, setCopied] = useState<'copied' | 'shared' | 'failed' | null>(null)
  const activeIds = state.children.filter((c) => c.active).map((c) => c.id)
  const names = state.children.map((c) => c.name).join(', ')

  async function openForChild() {
    const r = await open.run({ name: 'Perangkat anak', learnerIds: activeIds })
    if (r.ok) window.location.assign(r.data.redirectTo)
  }

  function shareText() {
    return `Cara masuk Kira untuk ${names}: buka ${window.location.origin} di tablet atau HP anak. Orang tua masuk sekali, lalu tekan Mulai belajar sebagai anak. Setelah itu anak memilih namanya dan menekan PIN gambar.`
  }

  async function share() {
    const text = shareText()
    setCopied(null)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Cara masuk Kira', text })
        setCopied('shared')
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied('copied')
    } catch (e) {
      // Membatalkan lembar bagikan bukan kegagalan.
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(text)
        setCopied('copied')
      } catch {
        setCopied('failed')
      }
    }
  }

  return (
    <section aria-labelledby="langkah-3" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <BackLink href={stepHref(2)} label="Kembali ke pilihan jalur" />
        <h1 id="langkah-3" className="m-0 text-h1 font-bold max-sm:text-h2">
          Cara anak masuk
        </h1>
        <p className="m-0 text-body-lg text-fg-muted">Anak tidak butuh email atau password. Yang dibutuhkan hanya tablet atau HP, namanya, dan PIN gambar.</p>
      </header>

      <ol className="m-0 flex list-none flex-col gap-3 rounded-card bg-surface p-5 shadow-soft">
        {[
          'Buka Kira di tablet atau HP anak, lewat browser atau aplikasi.',
          'Masuk dengan akun orang tua sekali saja, lalu tekan Mulai belajar sebagai anak di halaman ini.',
          'Anak memilih namanya dan menekan PIN gambar. Selesai.',
        ].map((t, i) => (
          <li key={t} className="flex items-start gap-3">
            <span aria-hidden="true" className="inline-flex size-8 flex-none items-center justify-center rounded-pill bg-lilac font-numbers text-body font-bold">
              {i + 1}
            </span>
            <span className="text-body">{t}</span>
          </li>
        ))}
      </ol>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {state.children.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-control bg-lavender p-3">
            <Avatar name={c.avatar} size={44} className="flex-none" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-bold">{c.name}</span>
              {pins[c.id] ? <PinPreview name={c.name} pin={pins[c.id]!} /> : <span className="text-small">PIN gambar yang kamu pilih saat menambah {c.name}.</span>}
              {!c.active ? <span className="text-small font-bold">Belum bisa masuk: izin belajar belum diberikan.</span> : null}
            </div>
            <Link href={FAMILY_ROUTES.child(c.id)} className="kira-press inline-flex min-h-11 flex-none items-center text-small font-bold">
              Ganti PIN
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" className="h-12 w-full" onClick={share}>
          Bagikan cara masuk
        </Button>
        {copied === 'copied' ? <p role="status" className="m-0 text-small font-bold">Tersalin. Tempel di pesan ke pasangan atau pengasuh.</p> : null}
        {copied === 'shared' ? <p role="status" className="m-0 text-small font-bold">Terbagikan.</p> : null}
        {copied === 'failed' ? <p role="status" className="m-0 text-small font-bold">Belum bisa menyalin di perangkat ini. Kamu bisa membacakan langkah di atas.</p> : null}
        <p className="m-0 text-small text-fg-muted">
          Mau memasang aplikasinya? <Link href="/panduan/aplikasi" prefetch={false}>Lihat cara memasang aplikasi Kira</Link>.
        </p>
      </div>

      {activeIds.length === 0 ? (
        <InlineAlert tone="warn" title="Izin belajar belum diberikan." live="status">
          <Link href={stepHref(1)}>Kembali ke langkah pertama</Link> untuk mencentang izin Belajar di Kira.
        </InlineAlert>
      ) : null}
      {open.error ? (
        <InlineAlert tone="danger" title={open.error.message} reference={open.error.reference}>
          Coba lagi, atau buka dashboard dulu.
        </InlineAlert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button variant="primary" disabled={activeIds.length === 0} loading={open.pending} onClick={openForChild} className="h-12 w-full">
          Mulai belajar sebagai anak
        </Button>
        <p className="m-0 text-small text-fg-muted">Perangkat ini menjadi perangkat anak, dan kamu keluar dari akun orang tua di sini. Masuk lagi kapan saja dari perangkatmu sendiri.</p>
        <ButtonLink href={FAMILY_ROUTES.home} variant="secondary" className="h-12 w-full">
          Buka dashboard
        </ButtonLink>
      </div>
    </section>
  )
}

function ChildCard({ child, onSaved }: { child: OnboardingChild; onSaved: () => void }) {
  const [consents, setConsents] = useState<Record<OnboardingPurpose, boolean>>(child.consents)
  const [saved, setSaved] = useState(false)
  const save = useAction(saveConsentsAction)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const r = await save.run({ learnerId: child.id, consents })
    if (r.ok) {
      setSaved(true)
      onSaved()
    }
  }
  return (
    <form onSubmit={submit} aria-label={`Izin data untuk ${child.name}`} className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-5">
      <div className="flex items-center gap-3">
        <Avatar name={child.avatar} size={52} className="flex-none" />
        <div className="min-w-0">
          <p className="m-0 text-h3 font-bold">{child.name}</p>
          <p className="m-0 text-small text-fg-muted">Kelas {child.grade}</p>
        </div>
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-body font-bold">Izin data untuk {child.name}</legend>
        {PURPOSES.map((p) => (
          <Checkbox
            key={p.id}
            checked={consents[p.id]}
            onChange={(e) => {
              setSaved(false)
              setConsents((c) => ({ ...c, [p.id]: e.target.checked }))
            }}
            label={p.label}
            description={p.description}
          />
        ))}
      </fieldset>
      {save.error ? (
        <InlineAlert tone="danger" title={save.error.message} reference={save.error.reference}>
          Coba simpan lagi.
        </InlineAlert>
      ) : null}
      {saved ? (
        <InlineAlert tone="success" title={consents.learning ? `${child.name} sudah bisa belajar di Kira.` : 'Pilihan tersimpan.'} live="status">
          {consents.learning ? 'Lanjut pilih jalur belajar.' : `${child.name} belum bisa masuk sampai izin Belajar di Kira dicentang.`} Izin bisa diubah kapan saja di halaman Privasi keluarga.
        </InlineAlert>
      ) : null}
      <Button type="submit" variant="secondary" loading={save.pending} className="self-start">
        Simpan izin
      </Button>
    </form>
  )
}

function AddChildForm({ existing, first, onAdded }: { existing: OnboardingChild[]; first: boolean; onAdded: (id: string, pin: PinPicture[]) => void }) {
  const taken = new Set(existing.map((c) => c.avatar))
  const firstFree = AVATARS.find((a) => !taken.has(a)) ?? AVATARS[0]!
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(1)
  const [avatar, setAvatar] = useState<AvatarName>(firstFree)
  const [pin, setPin] = useState<PinPicture[]>([])
  const [uiLang, setUiLang] = useState<UiLang>('id')
  const [consents, setConsents] = useState<Record<OnboardingPurpose, boolean>>({ learning: false, 'progress-email': false, audio: false, photo: false })
  const [errors, setErrors] = useState<{ name?: string; pin?: string; consent?: string }>({})
  const add = useAction(addChildAction)
  const saveConsents = useAction(saveConsentsAction)
  const gid = useId().replace(/:/g, '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Isi nama panggilan anak.'
    const pp = pinProblem(pin)
    if (pp) next.pin = pp
    if (!consents.learning) next.consent = 'Centang izin Belajar di Kira supaya anak bisa masuk.'
    setErrors(next)
    if (next.name || next.pin || next.consent) return
    const r = await add.run({ name: name.trim(), grade, avatar, pin, uiLang })
    if (r.ok) {
      // Izin dicatat sesudah anak ada. Bila gagal, kartu izin muncul di daftar anak dan bisa dicoba lagi.
      await saveConsents.run({ learnerId: r.data.learnerId, consents })
      const chosen = pin
      setName('')
      setPin([])
      setAvatar(AVATARS.find((a) => a !== avatar && !taken.has(a)) ?? firstFree)
      onAdded(r.data.learnerId, chosen)
    } else if (r.fieldErrors?.name) setErrors({ name: r.fieldErrors.name })
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Tambah anak" className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-soft">
      <h2 className="m-0 text-h3 font-bold">{first ? 'Siapa yang akan belajar?' : 'Tambah anak lain'}</h2>
      <TextField
        label="Nama panggilan"
        hint="Nama yang tampil di layar anak. Tidak perlu nama lengkap."
        value={name}
        error={errors.name}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => {
          setName(e.target.value)
          if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
        }}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-bold">Kelas</span>
        <SegmentedControl
          label="Kelas"
          value={String(grade)}
          onChange={(v) => setGrade(Number(v))}
          options={['1', '2', '3', '4', '5', '6'].map((g) => ({ value: g, label: g }))}
        />
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-small font-bold">Avatar</legend>
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((a) => (
            <label key={a} className={cx('relative flex min-w-0', taken.has(a) ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <input type="radio" name={`avatar${gid}`} value={a} checked={avatar === a} disabled={taken.has(a)} onChange={() => setAvatar(a)} className="peer visually-hidden" />
              <span
                className={cx(
                  'flex w-full flex-col items-center gap-1 rounded-control border-2 border-border bg-surface px-1.5 py-2.5 text-center',
                  'peer-checked:border-3 peer-checked:border-fg peer-checked:bg-bg',
                  'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                  'peer-disabled:border-dashed peer-disabled:border-review peer-disabled:bg-bg',
                )}
              >
                <Avatar name={a} size={44} className={taken.has(a) ? 'opacity-50' : undefined} />
                <span className="text-small leading-tight font-semibold">{AVATAR_LABEL[a]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <UiLangChoice name={`bahasa${gid}`} value={uiLang} onChange={setUiLang} />
      <PinChooser value={pin} onChange={(p) => { setPin(p); if (errors.pin) setErrors((x) => ({ ...x, pin: undefined })) }} error={errors.pin} legend="PIN gambar untuk masuk" />
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-small font-bold">Izin data</legend>
        <Checkbox
          checked={consents.learning}
          onChange={(e) => {
            setConsents((c) => ({ ...c, learning: e.target.checked }))
            if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
          }}
          label={PURPOSES[0]!.label}
          description={PURPOSES[0]!.description}
        />
        {errors.consent ? <FieldError id={`${gid}-c`}>{errors.consent}</FieldError> : null}
        <details className="group">
          <summary className="flex min-h-11 list-none items-center gap-2 text-body font-bold">
            <UiIcon name="chevron-right" size={18} className="transition-transform duration-150 ease-kira group-open:rotate-90" />
            Izin tambahan, boleh nanti
          </summary>
          <div className="flex flex-col gap-3 pt-2">
            {PURPOSES.slice(1).map((p) => (
              <Checkbox key={p.id} checked={consents[p.id]} onChange={(e) => setConsents((c) => ({ ...c, [p.id]: e.target.checked }))} label={p.label} description={p.description} />
            ))}
          </div>
        </details>
      </fieldset>
      {add.error && !add.error.fieldErrors ? (
        <InlineAlert tone="danger" title={add.error.message} reference={add.error.reference}>
          Periksa isian lalu coba lagi.
        </InlineAlert>
      ) : null}
      {add.error?.fieldErrors?.name ? <FieldError id={`${gid}-n`}>{add.error.fieldErrors.name}</FieldError> : null}
      <Button type="submit" variant="primary" loading={add.pending} className="h-12 w-full">
        Tambahkan anak
      </Button>
    </form>
  )
}
