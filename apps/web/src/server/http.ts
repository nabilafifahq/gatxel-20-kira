import 'server-only'

/**
 * Permintaan prefetch dari router Next (tautan yang terlihat di layar) atau dari browser.
 * Route Handler GET yang punya efek (mulai sesi latihan, keluar) wajib menolak prefetch
 * supaya tautan yang sekadar tampil tidak menjalankan aksinya.
 */
export function isPrefetch(req: Request): boolean {
  const h = req.headers
  return h.has('next-router-prefetch') || h.get('purpose') === 'prefetch' || (h.get('sec-purpose') ?? '').includes('prefetch')
}

export function prefetchRefused(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
