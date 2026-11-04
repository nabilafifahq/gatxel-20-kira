import { pickClientIp } from '@/lib/client-ip'

/**
 * Log akses di jalur proxy: satu baris JSON per permintaan halaman atau API, TANPA query string, cookie,
 * header otorisasi, atau isi. Alamat IP dipotong (IPv4 ke /24, IPv6 ke /48) supaya log tidak menyimpan
 * alamat penuh orang tua atau anak. Retensi mengikuti rotasi log Docker (lihat docs/laporan-keamanan.md).
 * Id di path (UUID) dipertahankan karena acak dan perlu untuk melacak serangan menebak id.
 */
export function ipPrefix(ip: string | null): string {
  if (!ip) return 'unknown'
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':').replace(/:+$/, '') + '::/48'
  const p = ip.split('.')
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0/24` : 'unknown'
}

export function accessLogLine(method: string, pathname: string, h: { get(name: string): string | null }): string {
  return JSON.stringify({
    t: new Date().toISOString(),
    level: 'info',
    msg: 'akses',
    method,
    path: pathname.slice(0, 200),
    ipPrefix: ipPrefix(pickClientIp(h)),
    country: h.get('cf-ipcountry') ?? undefined,
    cf: h.get('cf-ray') ? true : undefined,
  })
}
