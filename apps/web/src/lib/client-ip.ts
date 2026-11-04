const IP_RE = /^[0-9a-fA-F:.]{3,45}$/

/**
 * Alamat klien. Di balik Cloudflare Tunnel, cloudflared menambah CF-Connecting-IP dan itu satu-satunya
 * nilai yang dipercaya. Tanpa header itu (akses lokal atau proxy sendiri) dipakai entri TERAKHIR
 * X-Forwarded-For, yang ditambahkan proxy terdekat; entri pertama bisa dipalsukan klien dan tidak dipakai.
 */
export function pickClientIp(h: { get(name: string): string | null }): string | null {
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf && IP_RE.test(cf)) return cf
  const xff = h.get('x-forwarded-for')?.split(',').map((x) => x.trim()).filter(Boolean)
  const last = xff?.[xff.length - 1]
  if (last && IP_RE.test(last)) return last
  const real = h.get('x-real-ip')?.trim()
  return real && IP_RE.test(real) ? real : null
}
