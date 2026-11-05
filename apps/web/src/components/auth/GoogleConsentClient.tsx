'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { FieldError, focusFirstProblem, RequiredNote } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { SignupConsentChecks } from '@/components/auth/SignupConsentChecks'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { googleConsentProblems, isComplete, type GoogleConsentField, type Problems } from '@/lib/required-rules'
import { AuthCard } from '@/screens/public/PublicFrame'
import { googleConsentAction } from '@/server/actions/google'

/** Persetujuan orang tua baru yang datang dari Google. Email sudah diperiksa Google, jadi tidak ada tautan email lagi. */
export function GoogleConsentClient({ email, turnstileSiteKey }: { email: string; turnstileSiteKey: string | null }) {
  const [consent, setConsent] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [errors, setErrors] = useState<Problems<GoogleConsentField>>({})
  const action = useAction(googleConsentAction)
  const problems = googleConsentProblems({ consent, captchaNeeded: Boolean(turnstileSiteKey) && !captcha })
  const incomplete = !isComplete(problems)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setErrors(problems)
    if (incomplete) {
      focusFirstProblem(form)
      return
    }
    const r = await action.run({ consent, marketing, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) {
      window.location.assign(r.data.redirectTo)
      return
    }
    setCaptchaKey((k) => k + 1)
    if (r.fieldErrors) {
      setErrors({ consent: r.fieldErrors.consent })
      focusFirstProblem(form)
    }
  }

  return (
    <AuthCard labelledBy="google-judul">
      <div className="flex flex-col gap-1">
        <h1 id="google-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Satu langkah lagi
        </h1>
        <p className="m-0 text-body text-fg-muted">
          Anda mendaftar dengan akun Google <strong className="text-fg">{email}</strong>. Setelah setuju, keluarga Kira Anda langsung dibuat dan Anda bisa menambahkan anak.
        </p>
        <RequiredNote className="mt-1" />
      </div>
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <SignupConsentChecks
          consent={consent}
          marketing={marketing}
          consentError={errors.consent}
          onConsentChange={(checked) => {
            setConsent(checked)
            if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
          }}
          onMarketingChange={setMarketing}
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
          {errors.captcha ? <FieldError id="google-captcha-error">{errors.captcha}</FieldError> : null}
        </div>
        {action.error && !action.error.fieldErrors ? (
          <InlineAlert tone="danger" title={action.error.message} reference={action.error.reference}>
            Coba lagi dalam beberapa menit.
          </InlineAlert>
        ) : null}
        <Button type="submit" variant="primary" loading={action.pending} incomplete={incomplete} className="h-12! w-full">
          Buat keluarga saya
        </Button>
      </form>
      <p className="m-0 text-body text-fg-muted">
        Bukan akun yang ingin dipakai?{' '}
        <Link href="/daftar" className="font-bold">
          Kembali
        </Link>
      </p>
    </AuthCard>
  )
}
