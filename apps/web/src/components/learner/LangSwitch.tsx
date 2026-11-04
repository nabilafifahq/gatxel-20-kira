'use client'

import { useTransition } from 'react'
import { cx } from '@/components/ui/cx'
import { UI_LANGS, type UiLang } from '@/lib/i18n/lang'
import { useLang, useT } from '@/lib/i18n/client'
import { setMyUiLangAction } from '@/server/actions/learner-lang'

/** Tombol bahasa kecil untuk anak. Hanya dirender bila orang tua mengizinkan. Muat ulang penuh supaya html lang ikut berganti. */
export function LangSwitch() {
  const t = useT()
  const lang = useLang()
  const [pending, start] = useTransition()
  function choose(next: UiLang) {
    if (next === lang || pending) return
    start(async () => {
      const r = await setMyUiLangAction({ uiLang: next })
      if (r.ok) window.location.reload()
    })
  }
  return (
    <div role="group" aria-label={t.common.langSwitch.label} className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="text-body font-bold">
        {t.common.langSwitch.label}
      </span>
      {UI_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l === 'en' ? 'en-GB' : 'id'}
          aria-pressed={l === lang}
          disabled={pending}
          onClick={() => choose(l)}
          className={cx(
            'inline-flex h-11 cursor-pointer items-center rounded-control border-2 px-4 text-body font-bold',
            l === lang ? 'border-fg bg-lilac text-fg' : 'border-border bg-surface text-fg hover:border-fg',
          )}
        >
          {t.common.langSwitch[l]}
        </button>
      ))}
    </div>
  )
}
