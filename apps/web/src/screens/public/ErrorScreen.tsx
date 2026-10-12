'use client'

import type { ErrorScreenProps } from '@/lib/dto'
import { buttonClass, ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { ConsoleIcon, type ConsoleIconName } from '@/components/console/icons'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { PublicFrame } from './PublicFrame'

/**
 * P03 Halaman error (papan HalamanError, HalamanError500, HalamanErrorOffline):
 * 404, 500, offline, dan tanpa akses. Selalu menyebut apa yang terjadi, apa yang
 * harus dilakukan, dan kode referensi bila ada. Bahasa mengikuti area: id untuk
 * konsol, orang tua, dan publik; en-GB untuk layar learner (tanpa tautan keluar).
 */

type Copy = { title: string; what: string; todo: string; home: string; retry: string; refPrefix: string; login?: string }

const COPY: Record<ErrorScreenProps['lang'], Record<ErrorScreenProps['kind'], Copy>> = {
  id: {
    '404': {
      title: 'Halaman ini tidak ada',
      what: 'Alamatnya mungkin salah ketik, atau halamannya sudah dipindah.',
      todo: 'Kembali ke halaman utama, atau buka menu untuk mencari halaman yang dimaksud.',
      home: 'Ke halaman utama',
      retry: 'Coba lagi',
      refPrefix: 'Kode referensi',
    },
    '500': {
      title: 'Halaman gagal dimuat',
      what: 'Ada kesalahan di server Kira. Data belajar tidak hilang.',
      todo: 'Coba lagi dalam beberapa menit. Kalau masih gagal, catat kode di bawah.',
      home: 'Ke halaman utama',
      retry: 'Coba lagi',
      refPrefix: 'Kode referensi',
    },
    offline: {
      title: 'Perangkat ini sedang offline',
      what: 'Halaman ini butuh internet untuk memuat data terbaru.',
      todo: 'Sambungkan ke Wi-Fi, lalu tekan Coba lagi. Jawaban yang sudah dikerjakan tetap tersimpan di perangkat dan terkirim saat online.',
      home: 'Ke halaman utama',
      retry: 'Coba lagi',
      refPrefix: 'Kode referensi',
    },
    forbidden: {
      title: 'Halaman ini tidak bisa dibuka dengan akun ini',
      what: 'Akun yang sedang masuk tidak punya akses ke halaman ini.',
      todo: 'Kembali ke halaman utama, atau keluar lalu masuk dengan akun lain.',
      home: 'Ke halaman utama',
      retry: 'Coba lagi',
      refPrefix: 'Kode referensi',
      login: 'Masuk dengan akun lain',
    },
  },
  'en-GB': {
    '404': {
      title: 'This page is not here',
      what: 'The address may be wrong, or the page has moved.',
      todo: 'Go back to Today to carry on with your quests.',
      home: 'Go to Today',
      retry: 'Try again',
      refPrefix: 'Reference code',
    },
    '500': {
      title: 'This page did not load',
      what: 'Something went wrong on the Kira server. Your answers are safe.',
      todo: 'Try again in a few minutes. If it still does not work, show this code to your tutor.',
      home: 'Go to Today',
      retry: 'Try again',
      refPrefix: 'Reference code',
    },
    offline: {
      title: 'This tablet is offline',
      what: 'This page needs the internet to load.',
      todo: 'Connect to Wi-Fi, then tap Try again. Your answers are saved on this tablet and will send when you are online.',
      home: 'Go to Today',
      retry: 'Try again',
      refPrefix: 'Reference code',
    },
    forbidden: {
      title: 'This page is for grown-ups',
      what: 'Your tutor or parent can open it from their own account.',
      todo: 'Go back to Today to carry on with your quests.',
      home: 'Go to Today',
      retry: 'Try again',
      refPrefix: 'Reference code',
    },
  },
}

const ICON: Record<ErrorScreenProps['kind'], { name: ConsoleIconName; className: string }> = {
  '404': { name: 'map', className: 'text-fg' },
  '500': { name: 'alert', className: 'text-danger' },
  offline: { name: 'cloudOff', className: 'text-fg' },
  forbidden: { name: 'lock', className: 'text-fg' },
}

export function ErrorScreen({ kind, reference, homeHref, lang, retry }: ErrorScreenProps) {
  const c = COPY[lang][kind]
  const icon = ICON[kind]
  const canRetry = kind === '500' || kind === 'offline'
  const onRetry = retry ?? (() => window.location.reload())
  const learner = lang === 'en-GB'
  return (
    <div lang={lang} className="contents">
      <PublicFrame brandHref={learner ? null : PUBLIC_ROUTES.login} showLegal={!learner}>
        <div className="flex w-full max-w-[640px] flex-col items-start gap-[18px]">
          <div className="flex size-24 items-center justify-center rounded-card border-2 border-fg bg-surface">
            <ConsoleIcon name={icon.name} size={52} strokeWidth={1.75} className={icon.className} />
          </div>
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">{c.title}</h1>
          <p className="m-0 text-body-lg">{c.what}</p>
          <p className="m-0 text-body-lg">{c.todo}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {canRetry ? (
              <>
                <button type="button" onClick={onRetry} className={cx(buttonClass('primary', 'M', 'h-12! cursor-pointer px-5!'))}>
                  {c.retry}
                </button>
                <ButtonLink href={homeHref} variant="secondary" className="h-12!">
                  {c.home}
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href={homeHref} variant="primary" className="h-12! px-5!">
                  {c.home}
                </ButtonLink>
                {c.login ? (
                  <ButtonLink href={PUBLIC_ROUTES.login} variant="secondary" className="h-12!">
                    {c.login}
                  </ButtonLink>
                ) : null}
              </>
            )}
          </div>
          {reference ? (
            <p className="m-0 text-small text-fg-muted tabular">
              {c.refPrefix} <span className="font-semibold text-fg select-all">{reference}</span>
            </p>
          ) : null}
        </div>
      </PublicFrame>
    </div>
  )
}
