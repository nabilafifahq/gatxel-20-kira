'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LoginClient } from '@/components/auth/LoginClient'
import { SignupClient } from '@/components/auth/SignupClient'
import { WaitlistForm } from '@/components/auth/WaitlistForm'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { SIGN_IN_CLASS, SiteHeader } from '@/components/ui/SiteHeader'
import type { LoginScreenProps } from '@/lib/dto'
import { HeroPanel } from './HeroPanel'

export type SeatsDTO = { total: number; taken: number; left: number; full: boolean }
export type GatewayMode = 'signup' | 'login'

const LOGIN_PATH = '/masuk'
const SIGNUP_PATH = '/daftar'

function titleOf(m: GatewayMode, full: boolean): string {
  return m === 'login' ? 'Masuk, Kira' : full ? 'Daftar tunggu, Kira' : 'Daftar, Kira'
}

function modeOfPath(path: string, fallback: GatewayMode): GatewayMode {
  if (path === LOGIN_PATH) return 'login'
  if (path === SIGNUP_PATH) return 'signup'
  return fallback
}

/**
 * Layar utama publik: panel gradien di kiri, form di kanan, dengan kontrol segmen Daftar dan Masuk di halaman yang sama.
 * Dipakai oleh /, /daftar, dan /masuk. Pindah mode tidak memuat ulang halaman; alamat ikut berubah lewat pushState,
 * jadi tombol kembali dan muat ulang tetap benar. Saat kursi penuh, sisi Daftar menjadi daftar tunggu dan Masuk tetap bisa.
 */
export function AuthGateway({
  initialMode,
  seats,
  claim,
  turnstileSiteKey,
  next = null,
  notice = null,
  below,
}: {
  initialMode: GatewayMode
  seats: SeatsDTO
  claim: string | null
  turnstileSiteKey: string | null
  next?: string | null
  notice?: LoginScreenProps['notice']
  /** Bagian tenang di bawah lipatan. */
  below?: ReactNode
}) {
  const [mode, setModeState] = useState<GatewayMode>(initialMode)
  const [email, setEmail] = useState('')
  // Panel memudar masuk hanya saat berpindah mode, tidak saat halaman pertama dimuat.
  const [toggled, setToggled] = useState(false)

  useEffect(() => {
    const onPop = () => {
      const m = modeOfPath(window.location.pathname, initialMode)
      setModeState(m)
      document.title = titleOf(m, seats.full)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [initialMode, seats.full])

  const setMode = useCallback(
    (m: GatewayMode) => {
      setModeState(m)
      setToggled(true)
      const query = m === 'login' && next ? `?next=${encodeURIComponent(next)}` : ''
      const url = (m === 'login' ? LOGIN_PATH : SIGNUP_PATH) + query
      if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url)
      document.title = titleOf(m, seats.full)
    },
    [next, seats.full],
  )

  const signupLabel = seats.full ? 'Daftar tunggu' : 'Daftar'

  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <a href="#form-akun" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-bold">
        Langsung ke form
      </a>
      <SiteHeader
        inner="max-w-none"
        account={
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className={SIGN_IN_CLASS}>
            {mode === 'login' ? signupLabel : 'Masuk'}
          </button>
        }
      />
      <main id="isi" className="flex-1">
        <div className="grid md:min-h-[calc(100svh-57px)] md:grid-cols-2">
          <HeroPanel seats={seats} claim={claim} />
          <section aria-label="Akun Kira" className="flex justify-center px-4 pt-5 pb-8 md:items-center md:px-8 md:py-10">
            <div id="form-akun" className="flex w-full max-w-[420px] flex-col gap-5">
              <SegmentedControl
                semantic="tabs"
                label="Daftar atau masuk"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'signup', label: signupLabel, id: 'tab-daftar', controls: 'panel-akun' },
                  { value: 'login', label: 'Masuk', id: 'tab-masuk', controls: 'panel-akun' },
                ]}
              />
              <div id="panel-akun" role="tabpanel" aria-labelledby={mode === 'login' ? 'tab-masuk' : 'tab-daftar'} key={mode} className={toggled ? 'kira-fade-up' : undefined}>
                {mode === 'login' ? (
                  <LoginClient bare next={next} notice={notice} turnstileSiteKey={turnstileSiteKey} onSwitchToSignup={() => setMode('signup')} sharedEmail={email} onEmailChange={setEmail} />
                ) : seats.full ? (
                  <FullSeatsPanel turnstileSiteKey={turnstileSiteKey} onLogin={() => setMode('login')} />
                ) : (
                  <SignupClient bare turnstileSiteKey={turnstileSiteKey} seatsLeft={seats.left} onSwitchToLogin={() => setMode('login')} sharedEmail={email} onEmailChange={setEmail} />
                )}
              </div>
            </div>
          </section>
        </div>
        {below}
      </main>
      <SiteFooter />
    </div>
  )
}

function FullSeatsPanel({ turnstileSiteKey, onLogin }: { turnstileSiteKey: string | null; onLogin: () => void }) {
  return (
    <section aria-labelledby="penuh-judul" id="daftar-tunggu" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="penuh-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Kursi beta sudah penuh
        </h2>
        <p className="m-0 text-body text-fg-muted">Kami membuka Kira bertahap supaya setiap keluarga mendapat perhatian yang cukup. Tinggalkan email, dan kamu dikabari lebih dulu saat kursi dibuka lagi.</p>
      </div>
      <WaitlistForm turnstileSiteKey={turnstileSiteKey} />
      <p className="m-0 text-small text-fg-muted">Kami menyimpan alamat emailmu hanya untuk kabar ini. Setiap email punya tautan berhenti berlangganan.</p>
      <p className="m-0 text-body text-fg-muted">
        Sudah punya akun?{' '}
        <button type="button" onClick={onLogin} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-accent underline underline-offset-3">
          Masuk
        </button>
      </p>
    </section>
  )
}
