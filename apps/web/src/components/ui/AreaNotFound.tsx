import { ButtonLink } from '@/components/ui/Button'
import { KiraLogo } from '@/components/ui/KiraStar'

/**
 * Isi halaman 404 di area dewasa. notFound() di grup rute tanpa berkas not-found.tsx jatuh ke layar 404 bawaan Next.js:
 * berbahasa Inggris, tanpa gaya, tanpa jalan kembali. Kalimatnya tidak membedakan alamat salah dan data milik keluarga lain.
 */
export function AreaNotFound({ home, label }: { home: string; label: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-[560px] flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-fg">
      <KiraLogo size={96} />
      <h1 className="m-0 font-display text-h1 font-bold">Halaman ini tidak ada</h1>
      <p className="m-0 text-body-lg">Alamatnya mungkin salah ketik, atau halaman ini tidak tersedia untuk akun Anda.</p>
      <ButtonLink href={home} iconAfter="arrow-right">
        {label}
      </ButtonLink>
    </main>
  )
}
