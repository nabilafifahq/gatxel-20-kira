'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type FormEvent } from 'react'
import { Avatar } from '@kira/figures'
import { AVATARS } from '@kira/figures/spec'
import type { AvatarName, PinPicture } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { Checkbox, FieldError, Select, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PinChooser, pinProblem } from '@/components/console/PinChooser'
import { useAction } from '@/components/console/useAction'
import { FeatureChecklist } from '@/components/family/FeatureChecklist'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { addChildAction, saveConsentsAction } from '@/server/actions/onboarding'
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

/** Onboarding orang tua setelah masuk pertama: tambah anak, persetujuan per tujuan, lalu buka Kira untuk anak di perangkat ini. */
export function Onboarding({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const open = useAction(registerDeviceAction)
  const activeIds = state.children.filter((c) => c.active).map((c) => c.id)
  const canAdd = state.children.length < state.max

  async function openForChild() {
    const r = await open.run({ name: 'Perangkat anak', learnerIds: activeIds })
    if (r.ok) window.location.assign(r.data.redirectTo)
  }

  return (
    <PublicFrame center={false} brandHref="/keluarga" headerAction={<Link href="/keluarga" className="font-bold">Ringkasan keluarga</Link>}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Selamat datang, {state.parentName.split(' ')[0]}</h1>
          <p className="m-0 text-body-lg text-fg-muted">Tiga langkah, tanpa bantuan siapa pun: tambahkan anak, pilih izin data, lalu buka Kira di tablet atau HP anak.</p>
        </header>

        <section aria-labelledby="langkah-1" className="flex flex-col gap-4">
          <h2 id="langkah-1" className="m-0 text-h2 font-bold">
            1. Tambahkan anak
          </h2>
          {state.children.map((c) => (
            <div key={c.id} className="flex flex-col gap-3">
              <ChildCard child={c} onSaved={() => startTransition(() => router.refresh())} />
              <ChildFeatures child={c} />
            </div>
          ))}
          {canAdd ? (
            <AddChildForm existing={state.children} first={state.children.length === 0} onAdded={() => startTransition(() => router.refresh())} />
          ) : (
            <InlineAlert tone="info" title={`Kamu sudah menambahkan ${state.max} anak, batas satu keluarga.`}>
              Butuh menukar? Hapus akun salah satu anak lewat halaman Privasi keluarga.
            </InlineAlert>
          )}
        </section>

        <section aria-labelledby="langkah-3" className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-5">
          <h2 id="langkah-3" className="m-0 text-h2 font-bold">
            3. Buka Kira untuk anak
          </h2>
          <p className="m-0 text-body text-fg-muted">
            Tekan tombol ini di tablet atau HP yang akan dipakai anak. Perangkat itu lalu menampilkan pilihan nama anak dan PIN gambar. Kamu keluar dari akun di perangkat ini supaya anak tidak membuka area orang tua. Masuk lagi kapan saja dari perangkatmu sendiri.
          </p>
          {activeIds.length === 0 ? (
            <p role="status" className="m-0 text-small font-bold text-fg-muted">
              Tombol aktif setelah ada anak dengan izin Belajar di Kira dicentang dan disimpan.
            </p>
          ) : null}
          {open.error ? (
            <InlineAlert tone="danger" title={open.error.message} reference={open.error.reference}>
              Coba lagi, atau lewati dulu dan buka dari menu Pengaturan nanti.
            </InlineAlert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={activeIds.length === 0} loading={open.pending} onClick={openForChild} className="h-12!">
              Buka Kira untuk anak di perangkat ini
            </Button>
            <Link href="/keluarga" className="inline-flex h-12 items-center font-bold">
              Lewati dulu
            </Link>
          </div>
        </section>
      </div>
    </PublicFrame>
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
        <legend className="mb-1 p-0 text-body font-bold">2. Izin data untuk {child.name}</legend>
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
          {consents.learning ? 'Lanjut ke langkah 3 untuk membuka Kira di perangkat anak.' : `${child.name} belum bisa masuk sampai izin Belajar di Kira dicentang.`} Izin bisa diubah kapan saja di halaman Privasi keluarga.
        </InlineAlert>
      ) : null}
      <Button type="submit" variant="secondary" loading={save.pending} className="self-start">
        Simpan izin
      </Button>
    </form>
  )
}

function ChildFeatures({ child }: { child: OnboardingChild }) {
  return (
    <details className="rounded-card border border-divider bg-surface">
      <summary className="min-h-14 cursor-pointer px-5 py-4 text-body font-bold">Pilih mapel dan fitur untuk {child.name} (boleh dilewati)</summary>
      <div className="border-t border-divider p-5">
        <FeatureChecklist learnerId={child.id} name={child.name} initial={child.features} />
      </div>
    </details>
  )
}

function AddChildForm({ existing, first, onAdded }: { existing: OnboardingChild[]; first: boolean; onAdded: () => void }) {
  const taken = new Set(existing.map((c) => c.avatar))
  const firstFree = AVATARS.find((a) => !taken.has(a)) ?? AVATARS[0]!
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(1)
  const [avatar, setAvatar] = useState<AvatarName>(firstFree)
  const [pin, setPin] = useState<PinPicture[]>([])
  const [uiLang, setUiLang] = useState<UiLang>('id')
  const [errors, setErrors] = useState<{ name?: string; pin?: string }>({})
  const add = useAction(addChildAction)
  const gid = useId().replace(/:/g, '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Isi nama panggilan anak.'
    const pp = pinProblem(pin)
    if (pp) next.pin = pp
    setErrors(next)
    if (next.name || next.pin) return
    const r = await add.run({ name: name.trim(), grade, avatar, pin, uiLang })
    if (r.ok) {
      setName('')
      setPin([])
      setAvatar(AVATARS.find((a) => a !== avatar && !taken.has(a)) ?? firstFree)
      onAdded()
    } else if (r.fieldErrors?.name) setErrors({ name: r.fieldErrors.name })
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Tambah anak" className="flex flex-col gap-5 rounded-card border border-divider bg-surface p-5">
      <h3 className="m-0 text-h3 font-bold">{first ? 'Siapa yang akan belajar?' : 'Tambah anak lain'}</h3>
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
      <Select
        label="Kelas"
        value={String(grade)}
        onChange={(e) => setGrade(Number(e.target.value))}
        options={[1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `Kelas ${g}` }))}
      />
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-small font-bold">Avatar</legend>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(96px,1fr))]">
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
      {add.error && !add.error.fieldErrors ? (
        <InlineAlert tone="danger" title={add.error.message} reference={add.error.reference}>
          Periksa isian lalu coba lagi.
        </InlineAlert>
      ) : null}
      {add.error?.fieldErrors?.name ? <FieldError id={`${gid}-n`}>{add.error.fieldErrors.name}</FieldError> : null}
      <Button type="submit" variant="primary" loading={add.pending} className="self-start">
        Tambahkan anak
      </Button>
    </form>
  )
}
