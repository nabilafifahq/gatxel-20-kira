'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Avatar } from '@kira/figures'
import type { AvatarName, ConsoleShell, PinPicture } from '@/lib/dto'
import type { ParentChildCard, ParentHomeDTO } from '@/lib/dto-parent'
import { Button, ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { Dialog } from '@/components/console/Dialog'
import { ActionError, InlineAlert } from '@/components/console/Feedback'
import { Checkbox, RadioGroup, TextField } from '@/components/console/Field'
import { PinChooser, pinProblem } from '@/components/console/PinChooser'
import { FAMILY_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { FamilyShell } from '@/components/family/FamilyShell'
import { FirstRunChecklist } from '@/components/family/FirstRunChecklist'
import type { ChecklistItem } from '@/server/dal/onboarding'
import { UiIcon } from '@/components/ui/icons'
import { AVATARS, AvatarPicker } from '@/screens/console/LearnersScreen'
import { parentAddChildAction } from '@/server/actions/parent'
import { UiLangChoice } from '@/components/family/UiLangChoice'
import type { UiLang } from '@/lib/i18n/lang'
import { registerDeviceAction } from '@/server/actions/auth'

/**
 * Beranda orang tua (/keluarga): satu kartu per anak dengan status hari ini, streak, menit, dan jalur XP.
 * Dirancang untuk HP: satu kolom, tombol 48px. Dari sini orang tua menambah anak, mendaftarkan tablet, dan
 * mengunduh APK. Semua pengaturan anak ada di halaman anak.
 */

const TONE: Record<ParentChildCard['status'], string> = {
  rest: 'text-fg-muted',
  none: 'text-fg-muted',
  'not-started': 'text-fg',
  'in-progress': 'text-fg',
  done: 'text-success',
}

export function ChildCard({ c }: { c: ParentChildCard }) {
  const pct = c.requiredTotal > 0 ? Math.round((c.requiredDone / c.requiredTotal) * 100) : c.status === 'none' && c.optionalTotal > 0 ? 100 : 0
  return (
    <article aria-labelledby={`anak-${c.id}`} className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4">
      <div className="flex items-center gap-3">
        <Avatar name={c.avatar} size={56} className="flex-none" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={`anak-${c.id}`} className="m-0 text-h3 font-bold">
            {c.name}
          </h2>
          <span className="text-small text-fg-muted">
            Kelas {c.grade}, level {c.level}, {c.xp} XP
          </span>
        </div>
      </div>
      {!c.active ? (
        <InlineAlert tone="warn" title={`${c.name} belum bisa belajar.`} live="none">
          Persetujuan orang tua belum diberikan. <Link href={`${FAMILY_ROUTES.privacy}?learner=${encodeURIComponent(c.id)}`}>Beri persetujuan di halaman Privasi</Link>.
        </InlineAlert>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className={cx('m-0 text-body font-bold', TONE[c.status])}>{c.statusLabel}</p>
          <div role="img" aria-label={`${c.requiredDone} dari ${c.requiredTotal} sesi wajib selesai`} className="flex h-3 overflow-hidden rounded-pill bg-divider">
            <span className="bg-success" style={{ width: `${pct}%` }} />
          </div>
          {c.optionalTotal > 0 ? (
            <span className="text-small text-fg-muted">
              Sesi opsional: {c.optionalDone} dari {c.optionalTotal}. Tidak memengaruhi streak.
            </span>
          ) : null}
        </div>
      )}
      <dl className="m-0 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-control bg-bg p-2">
          <dt className="text-small text-fg-muted">Streak</dt>
          <dd className="m-0 text-h3 font-bold">{c.streak} hari</dd>
        </div>
        <div className="rounded-control bg-bg p-2">
          <dt className="text-small text-fg-muted">Hari ini</dt>
          <dd className="m-0 text-h3 font-bold">{c.minutesToday} mnt</dd>
        </div>
        <div className="rounded-control bg-bg p-2">
          <dt className="text-small text-fg-muted">Batas</dt>
          <dd className="m-0 text-h3 font-bold">{c.screenLimitMin} mnt</dd>
        </div>
      </dl>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={`Jalur XP ${c.name}`}>
        {c.tracks.map((t) => (
          <li key={t.track} className="flex items-center gap-2 text-small">
            <span className="w-24 flex-none font-semibold">{t.name}</span>
            <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-divider" role="img" aria-label={`${t.name}, level ${t.level}`}>
              <span className="bg-fg" style={{ width: `${t.span > 0 ? Math.min(100, Math.round((t.into / t.span) * 100)) : 0}%` }} />
            </span>
            <span className="w-20 flex-none text-right text-fg-muted">Level {t.level}</span>
          </li>
        ))}
      </ul>
      {c.reading && (c.reading.minutesWeek > 0 || c.reading.booksFinished > 0 || c.reading.reading) ? (
        <p className="m-0 rounded-control bg-bg p-3 text-small" data-testid="ruang-baca">
          <span className="font-bold">Ruang Baca.</span> {c.reading.minutesWeek} menit membaca dalam 7 hari terakhir, {c.reading.booksFinished} buku selesai.
          {c.reading.reading ? ` Sedang membaca ${c.reading.reading}.` : ''}
        </p>
      ) : null}
      <ButtonLink href={c.href} variant="primary" className="h-12 w-full">
        Lihat {c.name}
      </ButtonLink>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href={`${c.href}#atur`} className="kira-press flex min-h-12 items-center gap-2 rounded-control bg-lavender px-4 font-bold text-fg no-underline hover:text-fg">
          <UiIcon name="pencil" size={20} />
          Pengaturan {c.name}
        </Link>
        <Link href={`${c.href}#fitur`} className="kira-press flex min-h-12 items-center gap-2 rounded-control bg-lavender px-4 font-bold text-fg no-underline hover:text-fg">
          <UiIcon name="list" size={20} />
          Mapel dan fitur
        </Link>
      </div>
    </article>
  )
}

export function ParentHomeClient({ shell, data, checklist = null, owner = false }: { shell: ConsoleShell; data: ParentHomeDTO; checklist?: ChecklistItem[] | null; /** Orang tua yang memiliki keluarganya: bisa membuka ulang langkah persiapan. */ owner?: boolean }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [deviceOpen, setDeviceOpen] = useState(false)
  const canAdd = data.children.length < data.maxChildren && !data.hasTutor

  return (
    <FamilyShell shell={shell} active="home">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h2 font-bold">Halo, {data.parentName}</h1>
        <p className="m-0 text-body text-fg-muted">Ini kabar belajar anak-anak di {data.familyName} hari ini.</p>
      </div>

      {checklist ? <FirstRunChecklist items={checklist} /> : null}

      {data.children.length === 0 ? (
        <section aria-labelledby="kosong" className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-5">
          <h2 id="kosong" className="m-0 text-h3 font-bold">
            Mari tambahkan anak pertama
          </h2>
          <p className="m-0 text-body text-fg-muted">Cukup nama, kelas, avatar, dan PIN gambar. Setelah itu anak bisa belajar di tablet atau di HP ini.</p>
          <Button variant="primary" className="h-12 self-start" onClick={() => setAddOpen(true)}>
            Tambah anak
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {data.children.map((c) => (
            <ChildCard key={c.id} c={c} />
          ))}
        </div>
      )}

      <section aria-labelledby="atur" className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4">
        <h2 id="atur" className="m-0 text-h3 font-bold">
          Perangkat dan data
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {canAdd && data.children.length > 0 ? (
            <Button variant="secondary" className="h-12" onClick={() => setAddOpen(true)}>
              Tambah anak
            </Button>
          ) : null}
          <Button variant="secondary" className="h-12" onClick={() => setDeviceOpen(true)} disabled={data.children.length === 0}>
            Daftarkan perangkat ini
          </Button>
          {owner && data.children.length > 0 ? (
            <ButtonLink href="/mulai?langkah=3" variant="secondary" className="h-12">
              Cara anak masuk
            </ButtonLink>
          ) : null}
          {data.apk.available ? (
            <ButtonLink href="/api/apk" variant="secondary" className="h-12" external>
              Unduh aplikasi tablet{data.apk.size ? ` (${data.apk.size})` : ''}
            </ButtonLink>
          ) : (
            <p className="m-0 self-center text-small text-fg-muted">Aplikasi tablet belum tersedia untuk diunduh. Tautan unduhan muncul di sini begitu siap.</p>
          )}
          <ButtonLink href={FAMILY_ROUTES.privacy} variant="secondary" className="h-12">
            Persetujuan, ekspor, dan hapus data
          </ButtonLink>
          <ButtonLink href="/keluarga/piala" variant="secondary" className="h-12">
            Medali lomba anak
          </ButtonLink>
          <ButtonLink href="/panduan" variant="secondary" className="h-12">Panduan orang tua</ButtonLink>
        </div>
      </section>

      <AddChildDialog open={addOpen} onClose={() => setAddOpen(false)} taken={data.children.map((c) => [c.avatar, c.name] as const)} onDone={(id) => router.push(`${FAMILY_ROUTES.privacy}?learner=${encodeURIComponent(id)}&baru=1`)} />
      <RegisterDeviceDialog open={deviceOpen} onClose={() => setDeviceOpen(false)} children_={data.children} />
    </FamilyShell>
  )
}

function AddChildDialog({ open, onClose, taken, onDone }: { open: boolean; onClose: () => void; taken: (readonly [AvatarName, string])[]; onDone: (id: string) => void }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('1')
  const used = Object.fromEntries(taken) as Partial<Record<AvatarName, string>>
  const [avatar, setAvatar] = useState<AvatarName>(AVATARS.find((a) => !used[a]) ?? 'cat')
  const [pin, setPin] = useState<PinPicture[]>([])
  const [uiLang, setUiLang] = useState<UiLang>('id')
  const [error, setError] = useState<string | null>(null)
  const add = useAction(parentAddChildAction)

  async function submit() {
    if (!name.trim()) return setError('Isi nama anak dulu.')
    const p = pinProblem(pin)
    if (p) return setError(p)
    setError(null)
    const r = await add.run({ name: name.trim(), grade: Number(grade), avatar, pin, uiLang })
    if (r.ok) onDone(r.data.learnerId)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!add.pending}
      size="lg"
      title="Tambah anak"
      description="Anak bisa mulai belajar setelah Anda memberi persetujuan di langkah berikutnya."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={add.pending}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} loading={add.pending}>
            Simpan dan lanjut
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField label="Nama anak" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
        <RadioGroup
          name="kelas-baru"
          legend="Kelas"
          value={grade}
          onChange={setGrade}
          options={['1', '2', '3', '4', '5', '6'].map((g) => ({ value: g, label: `Kelas ${g}` }))}
          layout="row"
        />
        <AvatarPicker value={avatar} onChange={setAvatar} taken={used} />
        <UiLangChoice name="bahasa-baru" value={uiLang} onChange={setUiLang} />
        <PinChooser value={pin} onChange={setPin} />
        {error ? <InlineAlert tone="danger" title={error} /> : null}
        <ActionError error={add.error} />
      </div>
    </Dialog>
  )
}

function RegisterDeviceDialog({ open, onClose, children_ }: { open: boolean; onClose: () => void; children_: ParentChildCard[] }) {
  const [name, setName] = useState('Tablet anak')
  const [ids, setIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const reg = useAction(registerDeviceAction)

  async function submit() {
    const ready = ids.length > 0 ? ids : children_.map((c) => c.id)
    if (!name.trim()) return setError('Beri nama perangkat, misalnya Tablet Aisha.')
    setError(null)
    const r = await reg.run({ name: name.trim(), learnerIds: ready })
    if (r.ok) window.location.assign(r.data.redirectTo)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!reg.pending}
      title="Daftarkan perangkat ini"
      description="Browser ini menjadi tablet anak. Anda keluar dari akun orang tua di perangkat ini, dan anak masuk dengan PIN gambar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reg.pending}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} loading={reg.pending}>
            Daftarkan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Nama perangkat" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-small font-bold">Anak yang memakai perangkat ini</legend>
          {children_.map((c) => (
            <Checkbox key={c.id} label={c.name} checked={ids.includes(c.id)} onChange={(e) => setIds(e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />
          ))}
          <span className="text-small text-fg-muted">Tidak ada yang dipilih berarti semua anak.</span>
        </fieldset>
        {error ? <InlineAlert tone="danger" title={error} /> : null}
        <ActionError error={reg.error} />
      </div>
    </Dialog>
  )
}
