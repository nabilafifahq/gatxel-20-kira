'use client'

import { useState, type FormEvent } from 'react'
import { Avatar } from '@kira/figures'
import type { RegisterDeviceScreenProps } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { FieldError, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { ConsoleIcon } from '@/components/console/icons'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { AuthCard, PublicFrame } from './PublicFrame'

/**
 * Daftarkan tablet keluarga (orang dewasa sudah masuk di tablet). Tablet terdaftar
 * menyimpan token perangkat, lalu learner yang dipilih bisa masuk dengan PIN gambar.
 */

/** Halaman awal learner di tablet (pilih learner). Ubah bila rute learner berbeda. */
export const LEARNER_START_HREF = '/'

function joinNames(ns: string[]): string {
  if (ns.length <= 1) return ns.join('')
  return `${ns.slice(0, -1).join(', ')} dan ${ns[ns.length - 1]}`
}

export function RegisterDeviceScreen({ learners, registered, registerDevice }: RegisterDeviceScreenProps) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set(learners.length === 1 ? [learners[0]!.id] : []))
  const [errors, setErrors] = useState<{ name?: string; learners?: string }>({})
  const reg = useAction(registerDevice)

  if (registered) {
    return (
      <PublicFrame>
        <AuthCard labelledBy="perangkat-judul">
          <ConsoleIcon name="checkCircle" size={40} strokeWidth={2} className="text-success" />
          <div className="flex flex-col gap-2">
            <h1 id="perangkat-judul" className="m-0 text-h1 font-bold max-sm:text-h2 [overflow-wrap:anywhere]">
              {registered.name} terdaftar
            </h1>
            <p className="m-0 text-body">
              {registered.learnerNames.length
                ? `${joinNames(registered.learnerNames)} bisa masuk di tablet ini dengan PIN gambar.`
                : 'Tablet ini belum terhubung ke learner mana pun. Atur dari Pengaturan di konsol tutor.'}
            </p>
            <p className="m-0 text-body text-fg-muted">Tablet bisa dicabut kapan saja dari Pengaturan di konsol tutor.</p>
          </div>
          <ButtonLink href={LEARNER_START_HREF} variant="primary" className="h-12! w-full">
            Buka layar learner
          </ButtonLink>
        </AuthCard>
      </PublicFrame>
    )
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next: typeof errors = {}
    const n = name.trim()
    if (!n) next.name = 'Beri nama tablet, misalnya Tablet Alya.'
    else if (n.length > 40) next.name = `Nama tablet paling banyak 40 karakter, sekarang ${n.length}.`
    if (picked.size === 0) next.learners = 'Pilih minimal satu learner yang memakai tablet ini.'
    setErrors(next)
    if (next.name || next.learners) {
      document.getElementById(next.name ? 'perangkat-nama' : 'perangkat-learner')?.focus()
      return
    }
    const r = await reg.run({ name: n, learnerIds: [...picked] })
    if (r.ok) window.location.assign(r.data.redirectTo)
  }

  return (
    <PublicFrame>
      <AuthCard labelledBy="perangkat-judul">
        <div className="flex flex-col gap-1">
          <h1 id="perangkat-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
            Daftarkan tablet ini
          </h1>
          <p className="m-0 text-body text-fg-muted">
            Learner yang dipilih bisa masuk di tablet ini dengan PIN gambar, tanpa password orang dewasa. Daftarkan hanya tablet milik keluarga.
          </p>
        </div>
        {learners.length === 0 ? (
          <>
            <InlineAlert tone="info" title="Belum ada learner aktif." live="status">
              Tambah learner dan catat persetujuan orang tua di konsol tutor, lalu buka halaman ini lagi.
            </InlineAlert>
            <ButtonLink href={CONSOLE_ROUTES.learners} variant="secondary" className="h-12! w-full">
              Buka Learner di konsol
            </ButtonLink>
          </>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <TextField
              id="perangkat-nama"
              label="Nama tablet"
              hint="Terlihat di Pengaturan saat mencabut tablet."
              autoComplete="off"
              value={name}
              error={errors.name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
              }}
            />
            <fieldset
              id="perangkat-learner"
              tabIndex={-1}
              className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 outline-none"
              aria-describedby={errors.learners ? 'perangkat-learner-error' : undefined}
            >
              <legend className="mb-1.5 p-0 text-small font-bold">Learner yang memakai tablet ini</legend>
              {learners.map((l) => {
                const on = picked.has(l.id)
                return (
                  <label
                    key={l.id}
                    className={cx(
                      'flex min-h-14 cursor-pointer items-center gap-3 rounded-control border-2 px-3 py-2',
                      on ? 'border-fg bg-bg' : 'border-border bg-surface hover:border-fg',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setPicked((s) => {
                          const n = new Set(s)
                          if (checked) n.add(l.id)
                          else n.delete(l.id)
                          return n
                        })
                        if (errors.learners) setErrors((x) => ({ ...x, learners: undefined }))
                      }}
                      className="size-5 flex-none cursor-pointer accent-fg"
                    />
                    <Avatar name={l.avatar} size={40} className="flex-none" />
                    <span className={cx('text-body', on ? 'font-bold' : 'font-semibold')}>{l.name}</span>
                  </label>
                )
              })}
              {errors.learners ? <FieldError id="perangkat-learner-error">{errors.learners}</FieldError> : null}
            </fieldset>
            {reg.error ? (
              <InlineAlert tone="danger" title={reg.error.message} reference={reg.error.reference}>
                Coba lagi. Bila masih gagal, masuk ulang lalu buka halaman ini lagi.
              </InlineAlert>
            ) : null}
            <Button type="submit" variant="primary" icon="tablet" loading={reg.pending} className="h-12! w-full">
              Daftarkan tablet
            </Button>
          </form>
        )}
      </AuthCard>
    </PublicFrame>
  )
}
