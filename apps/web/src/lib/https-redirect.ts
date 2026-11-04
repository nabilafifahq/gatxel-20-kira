type Headers = { get(name: string): string | null }

/**
 * Skema yang dipakai pengunjung. Cloudflare mengirim CF-Visitor {"scheme":"https"}; bila ada, itu yang
 * dipercaya (proxy di antara cloudflared dan web bisa menimpa X-Forwarded-Proto). Bila tidak ada, X-Forwarded-Proto.
 */
export function visitorScheme(h: Headers): 'http' | 'https' | null {
  const cf = h.get('cf-visitor')
  if (cf) {
    try {
      const s = (JSON.parse(cf) as { scheme?: string }).scheme
      if (s === 'http' || s === 'https') return s
    } catch {
      /* abaikan, pakai X-Forwarded-Proto */
    }
  }
  const x = h.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  return x === 'http' || x === 'https' ? x : null
}

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i
const IPV4 = /^\d+(\.\d+){3}(:\d+)?$/

/** Alamat https tujuan bila permintaan datang lewat http di balik Cloudflare; null bila tidak perlu. */
export function httpsRedirectTarget(h: Headers, pathAndQuery: string, production: boolean): string | null {
  if (!production) return null
  if (visitorScheme(h) !== 'http') return null
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]!.trim()
  // Tanpa titik (localhost, nama layanan Docker) atau alamat IP berarti akses internal, bukan lewat Cloudflare.
  if (!HOSTNAME.test(host) || IPV4.test(host)) return null
  const path = pathAndQuery.startsWith('/') && !pathAndQuery.startsWith('//') ? pathAndQuery : '/'
  return `https://${host.replace(/:\d+$/, '')}${path}`
}

/** Permintaan yang jelas lewat Cloudflare (header yang hanya ditambahkan edge atau cloudflared). */
export function viaCloudflare(h: Headers): boolean {
  return ['cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-ipcountry', 'cdn-loop', 'cf-warp-tag-id'].some((k) => h.get(k) !== null)
}
