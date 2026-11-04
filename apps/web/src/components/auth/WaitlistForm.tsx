'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { Checkbox, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { joinWaitlistAction } from '@/server/actions/signup'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Form daftar tunggu: email dan persetujuan (tidak dicentang dari awal). Jawaban sukses sama untuk email apa pun. */
export function WaitlistForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({})
  const [done, setDone] = useState<string | null>(null)
  const join = useAction(joinWaitlistAction)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const em = email.trim()
    const next: typeof errors = {}
    if (!em) next.email = 'Isi email kamu.'
    else if (!EMAIL_RE.test(em)) next.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    if (!consent) next.consent = 'Centang persetujuan supaya kami boleh mengirim kabar.'
    setErrors(next)
    if (next.email || next.consent) return
    if (turnstileSiteKey && !captcha) {
      setErrors({ email: 'Selesaikan pemeriksaan keamanan di bawah dulu.' })
      return
    }
    const r = await join.run({ email: em, consent, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) setDone(em)
    else {
      if (r.fieldErrors) setErrors({ email: r.fieldErrors.email, consent: r.fieldErrors.consent })
      setCaptchaKey((k) => k + 1)
    }
  }

  if (done) {
    return (
      <InlineAlert tone="success" title={`Cek email ${done}.`} live="status">
        Kami mengirim satu email berisi tombol konfirmasi. Setelah kamu menekannya, kamu masuk daftar tunggu dan dikabari saat kursi dibuka lagi. Cek juga folder spam.
      </InlineAlert>
    )
  }

  return (
    <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label="Daftar tunggu">
      <TextField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={email}
        error={errors.email}
        className="h-12!"
        onChange={(e) => {
          setEmail(e.target.value)
          if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
        }}
      />
      <div className="flex flex-col gap-1">
        <Checkbox
          name="consent"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
            if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
          }}
          label="Kabari saya lewat email saat kursi Kira dibuka lagi"
          description="Kami hanya mengirim kabar soal kursi dan perkembangan Kira. Setiap email punya tautan untuk berhenti."
        />
        {errors.consent ? <p className="m-0 text-small font-bold text-danger">{errors.consent}</p> : null}
      </div>
      <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />
      {join.error && !join.error.fieldErrors ? (
        <InlineAlert tone="danger" title={join.error.message} reference={join.error.reference}>
          Coba lagi dalam beberapa menit.
        </InlineAlert>
      ) : null}
      <Button type="submit" variant="primary" loading={join.pending} className="h-12! w-full">
        Masuk daftar tunggu
      </Button>
    </form>
  )
}
