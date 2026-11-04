'use client'

import { useState, type FormEvent, type ReactElement } from 'react'
import type { ActionResult } from '@/lib/dto'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/icons'
import { formatFamilyCode, normalizeFamilyCode, type FamilyChildChoice } from '@/lib/family-code'
import { useT } from '@/lib/i18n/client'
import { ActionError, SignInBar } from './common'

/**
 * Anak masuk di browser tanpa orang tua: kode keluarga, lalu nama, lalu PIN gambar di /masuk/anak/[id].
 * Tiket kode ada di cookie server, jadi muat ulang dan tombol kembali tetap benar. Daftar nama hanya berisi nama depan.
 */

type Failure = Extract<ActionResult, { ok: false }>

function ChildFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <SignInBar grownUpHref="/masuk" />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-2 pb-10 md:px-10 md:pb-14">{children}</main>
      <SiteFooter area="learner" />
    </div>
  )
}

export function FamilyCodeStep({
  turnstileSiteKey,
  checkCode,
}: {
  turnstileSiteKey: string | null
  checkCode: (input: { code: string; turnstile?: string }) => Promise<ActionResult<{ redirectTo: string }>>
}): ReactElement {
  const t = useT().shell.kode
  const [code, setCode] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFailure(null)
    if (normalizeFamilyCode(code).length !== 8) return setHint(t.tooShort)
    if (turnstileSiteKey && !captcha) return setHint(t.finishCheck)
    setHint(null)
    setPending(true)
    try {
      const r = await checkCode({ code, ...(captcha ? { turnstile: captcha } : {}) })
      if (r.ok) {
        window.location.assign(r.data.redirectTo)
        return
      }
      setFailure(r)
      setCaptchaKey((k) => k + 1)
    } catch {
      setFailure({ ok: false, message: t.noServer, reference: 'KRA-KODE-NET' })
    }
    setPending(false)
  }

  return (
    <ChildFrame>
      <div className="flex w-full max-w-[440px] flex-col items-center gap-5 text-center">
        <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-pill bg-lilac">
          <UiIcon name="lock" size={40} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-h1 font-bold">{t.title}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.intro}</p>
        </div>
        <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="kode-keluarga" className="text-body-lg font-bold">
              {t.label}
            </label>
            <input
              id="kode-keluarga"
              name="kode-keluarga"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="ABCD-2345"
              value={code}
              aria-invalid={Boolean(hint || failure)}
              aria-describedby={hint ? 'kode-keluarga-petunjuk' : undefined}
              onChange={(e) => {
                setCode(formatFamilyCode(e.target.value))
                setHint(null)
                setFailure(null)
              }}
              className="h-18 w-full rounded-control border-2 border-border bg-surface px-4 text-center font-numbers text-h1 font-bold tracking-widest text-fg uppercase placeholder:text-fg-muted placeholder:opacity-50 focus:border-fg focus:outline-none"
            />
            {hint ? (
              <p id="kode-keluarga-petunjuk" role="alert" className="m-0 text-body font-semibold">
                {hint}
              </p>
            ) : null}
          </div>
          <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />
          {failure ? <ActionError message={failure.message} reference={failure.reference} className="text-left" /> : null}
          <Button type="submit" className="w-full" iconAfter="arrow-right" disabled={pending}>
            {pending ? t.checking : t.next}
          </Button>
        </form>
        <p className="m-0 text-body text-fg-muted">{t.whereToFind}</p>
      </div>
    </ChildFrame>
  )
}

export function FamilyNamesStep({
  childrenList,
  forgetCode,
}: {
  childrenList: FamilyChildChoice[]
  forgetCode: () => Promise<ActionResult<{ redirectTo: string }>>
}): ReactElement {
  const t = useT().shell
  const [pending, setPending] = useState(false)

  async function otherCode() {
    setPending(true)
    const r = await forgetCode().catch(() => null)
    window.location.assign(r?.ok ? r.data.redirectTo : '/masuk/anak')
  }

  return (
    <ChildFrame>
      {childrenList.length === 0 ? (
        <div className="flex w-full max-w-[440px] flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-pill bg-lilac">
            <UiIcon name="question" size={40} />
          </span>
          <h1 className="m-0 text-h1 font-bold">{t.kode.noChildrenTitle}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.kode.noChildrenBody}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="m-0 text-h1 font-bold">{t.pick.who}</h1>
            <p className="m-0 text-body-lg text-fg-muted">{t.kode.tapName}</p>
          </div>
          <ul aria-label={t.kode.namesLabel} className="m-0 grid w-full max-w-[560px] list-none grid-cols-1 gap-3 p-0 min-[420px]:grid-cols-2">
            {childrenList.map((c) => (
              <li key={c.id} className="flex">
                {/* Pindah halaman penuh: tiket dibaca lagi di server dan PIN memakai halaman barunya sendiri. */}
                <a
                  href={`/masuk/anak/${c.id}`}
                  className="flex min-h-22 w-full items-center justify-center rounded-card border-2 border-border bg-surface px-4 py-5 text-center text-h2 font-bold break-words text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-97"
                >
                  {c.firstName}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button variant="secondary" onClick={otherCode} disabled={pending}>
        {t.kode.otherCode}
      </Button>
    </ChildFrame>
  )
}
