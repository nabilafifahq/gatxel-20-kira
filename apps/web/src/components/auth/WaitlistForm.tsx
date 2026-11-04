'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { Checkbox, FieldError, focusFirstProblem, RequiredNote, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { isComplete, waitlistProblems, type Problems, type WaitlistField } from '@/lib/required-rules'
import { joinWaitlistAction } from '@/server/actions/signup'

/** Form daftar tunggu: email dan persetujuan (tidak dicentang dari awal). Jawaban sukses sama untuk email apa pun. */
export function WaitlistForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [errors, setErrors] = useState<Problems<WaitlistField>>({})
  const [done, setDone] = useState<string | null>(null)
  const join = useAction(joinWaitlistAction)

  const problems = waitlistProblems({ email, consent, captchaNeeded: Boolean(turnstileSiteKey) && !captcha })
  const incomplete = !isComplete(problems)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const em = email.trim()
    setErrors(problems)
    if (incomplete) {
      focusFirstProblem(form)
      return
    }
    const r = await join.run({ email: em, consent, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) setDone(em)
    else {
      if (r.fieldErrors) {
        setErrors({ email: r.fieldErrors.email, consent: r.fieldErrors.consent })
        focusFirstProblem(form)
      }
      setCaptchaKey((k) => k + 1)
    }
  }

  if (done) {
    return (
      <InlineAlert tone="success" title={`Cek email ${done}.`} live="status">
        Kami mengirim satu email berisi tombol konfirmasi. Setelah Anda menekannya, Anda masuk daftar tunggu dan dikabari saat kursi dibuka lagi. Cek juga folder spam.
      </InlineAlert>
    )
  }

  return (
    <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label="Daftar tunggu">
      <RequiredNote />
      <TextField
        name="email"
        required
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
      <Checkbox
        name="consent"
        required
        checked={consent}
        error={errors.consent}
        onChange={(e) => {
          setConsent(e.target.checked)
          if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
        }}
        label="Kabari saya lewat email saat kursi Kira dibuka lagi"
        description="Kami hanya mengirim kabar soal kursi dan perkembangan Kira. Setiap email punya tautan untuk berhenti."
      />
      <div tabIndex={errors.captcha ? -1 : undefined} data-problem={errors.captcha ? 'true' : undefined} className="flex flex-col gap-1">
        <TurnstileField
          siteKey={turnstileSiteKey}
          onToken={(t) => {
            setCaptcha(t)
            if (t && errors.captcha) setErrors((x) => ({ ...x, captcha: undefined }))
          }}
          resetKey={captchaKey}
        />
        {errors.captcha ? <FieldError id="tunggu-captcha-error">{errors.captcha}</FieldError> : null}
      </div>
      {join.error && !join.error.fieldErrors ? (
        <InlineAlert tone="danger" title={join.error.message} reference={join.error.reference}>
          Coba lagi dalam beberapa menit.
        </InlineAlert>
      ) : null}
      <Button type="submit" variant="primary" loading={join.pending} incomplete={incomplete} className="h-12! w-full">
        Masuk daftar tunggu
      </Button>
    </form>
  )
}
