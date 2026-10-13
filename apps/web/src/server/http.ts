import 'server-only'

/**
 * Permintaan prefetch dari router Next (tautan yang terlihat di layar) atau dari browser.
 * Route Handler GET yang punya efek (mulai sesi latihan, keluar) wajib menolak prefetch
 * supaya tautan yang sekadar tampil tidak menjalankan aksinya.
 */
export function isPrefetch(req: Request): boolean {
  const h = req.headers
  return (
    h.has('next-router-prefetch') ||
    h.get('purpose') === 'prefetch' ||
    (h.get('sec-purpose') ?? '').includes('prefetch')
  )
}

export function prefetchRefused(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

/*
 * Jangan memakai req.url untuk origin atau tujuan redirect. Server standalone Next (image Docker,
 * HOSTNAME=0.0.0.0) menyusun req.url sebagai http://0.0.0.0:3000/..., bukan alamat yang dibuka
 * browser. Alamat yang benar ada di header Host, X-Forwarded-Host (bila ada proxy), dan KIRA_ORIGIN. Cloudflare Tunnel meneruskan Host asli, yaitu alamat publik Kira.
 */

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

/** Host yang sah untuk permintaan ini: X-Forwarded-Host, Host, dan host dari KIRA_ORIGIN. */
export function requestHosts(
  req: Request,
  configuredOrigin: string | undefined = process.env.KIRA_ORIGIN,
): string[] {
  const hosts = new Set<string>()
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase()
  if (forwarded) hosts.add(forwarded)
  const host = req.headers.get('host')?.trim().toLowerCase()
  if (host) hosts.add(host)
  const configured = hostOf(configuredOrigin)
  if (configured) hosts.add(configured)
  return [...hosts]
}

/**
 * Perlindungan CSRF tambahan untuk Route Handler POST (cookie sesi sudah SameSite=Lax).
 * Header Origin, bila dikirim browser, harus menunjuk host yang sama dengan permintaan ini.
 * Origin "null" (iframe sandbox, berkas lokal) selalu ditolak. Klien tanpa Origin (curl, CLI) lolos
 * ke pemeriksaan sesi seperti biasa.
 */
export function sameOrigin(
  req: Request,
  configuredOrigin: string | undefined = process.env.KIRA_ORIGIN,
): boolean {
  const origin = req.headers.get('origin')
  if (origin === null) return true
  const host = hostOf(origin)
  return host !== null && requestHosts(req, configuredOrigin).includes(host)
}

/**
 * Redirect 303 dengan Location relatif. Browser menyelesaikannya terhadap alamat yang sedang dibuka,
 * jadi benar di http://localhost:3000, di balik Cloudflare Tunnel, dan di server standalone.
 */
export function seeOther(path: string): Response {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new Error('seeOther hanya menerima path lokal')
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } })
}

/**
 * Baca isi permintaan sebagai teks dan berhenti begitu melebihi `max` byte, juga untuk body chunked
 * tanpa Content-Length. Mengembalikan null bila terlalu besar.
 */
export async function readTextCapped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? '0') > max) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}
