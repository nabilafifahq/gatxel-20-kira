import Link from 'next/link'
import { ButtonLink } from '@/components/console/Button'
import { ConsoleIcon } from '@/components/console/icons'
import { FeedbackForm, type FeedbackViewer } from '@/components/support/FeedbackForm'
import { WHATSAPP_DISPLAY, WHATSAPP_HELP_URL, WHATSAPP_PARTNER_URL } from '@/lib/support'
import { PublicFrame } from './PublicFrame'

/** Halaman Bantuan: jalur cepat WhatsApp di atas, formulir email di bawah. Tanpa Link ke luar di layar anak. */
export function FeedbackScreen({ viewer, turnstileSiteKey, appVersion, fromPath }: { viewer: FeedbackViewer | null; turnstileSiteKey: string | null; appVersion: string; fromPath: string }) {
  return (
    <PublicFrame
      center={false}
      brandHref={viewer?.homeHref ?? '/'}
      headerAction={viewer ? <ButtonLink href={viewer.homeHref} size="S" icon="arrowLeft">Kembali</ButtonLink> : <ButtonLink href="/masuk" size="S">Masuk</ButtonLink>}
    >
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-h1 font-semibold max-sm:text-h2">Bantuan dan masukan</h1>
          <p className="m-0 text-body-lg text-fg-muted">Ceritakan masalah, saran, atau koreksi Anda. Tim Kira di Gatxel membaca setiap pesan selama masa beta.</p>
        </header>

        <section aria-labelledby="whatsapp" className="flex flex-col gap-3 rounded-card bg-lavender p-5">
          <div className="flex flex-col gap-0.5">
            <h2 id="whatsapp" className="m-0 font-display text-h3 font-semibold">
              Butuh jawaban cepat?
            </h2>
            <p className="m-0 text-body">
              Chat langsung dengan tim Gatxel di <strong className="whitespace-nowrap">{WHATSAPP_DISPLAY}</strong>.
            </p>
          </div>
          <ButtonLink href={WHATSAPP_HELP_URL} external variant="primary" icon="chat" className="h-14! w-full text-body-lg!">
            Chat lewat WhatsApp
          </ButtonLink>
          <p className="m-0 text-small">
            Ingin bermitra dengan Gatxel?{' '}
            <a href={WHATSAPP_PARTNER_URL} target="_blank" rel="noopener noreferrer" className="font-bold">
              Chat tim kemitraan
            </a>
          </p>
        </section>

        <FeedbackForm viewer={viewer} turnstileSiteKey={turnstileSiteKey} appVersion={appVersion} fromPath={fromPath} />
      </div>
    </PublicFrame>
  )
}

/** Yang dilihat anak bila membuka halaman Bantuan: ajakan ramah, tanpa formulir, unggahan, atau tautan ke luar. */
export function ChildHelpScreen({ homeHref }: { homeHref: string }) {
  return (
    <PublicFrame brandHref={homeHref} showLegal={false}>
      <section aria-labelledby="minta-bantuan" className="flex w-full max-w-[440px] flex-col items-center gap-4 rounded-card bg-surface p-8 text-center shadow-soft">
        <span className="inline-flex size-16 items-center justify-center rounded-pill bg-lavender">
          <ConsoleIcon name="learners" size={32} />
        </span>
        <h1 id="minta-bantuan" className="m-0 font-display text-h2 font-semibold">
          Minta bantuan orang tua
        </h1>
        <p className="m-0 text-body-lg">Ada yang membingungkan? Panggil ayah, ibu, atau orang dewasa di rumah. Mereka bisa menghubungi tim Kira dari akun orang tua.</p>
        <Link href={homeHref} className="inline-flex min-h-11 items-center font-bold">
          Kembali belajar
        </Link>
      </section>
    </PublicFrame>
  )
}
