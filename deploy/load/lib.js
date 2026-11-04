// Pustaka bersama skenario k6 Kira. Cookie diatur manual: cookie sesi memakai awalan __Host- dan Secure,
// sedangkan staging berjalan di http, jadi cookie jar k6 tidak akan mengirimkannya.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { SharedArray } from 'k6/data'
import { Counter, Rate } from 'k6/metrics'

export const BASE = __ENV.BASE_URL || 'http://proxy:8080'
export const MAILPIT = __ENV.MAILPIT_URL || 'http://mailpit:8025'
// Faktor waktu berpikir: 1 = anak sungguhan (4 sampai 12 detik per soal), 0.25 = lebih rapat, 0 = tanpa jeda.
export const THINK = Number(__ENV.THINK ?? 1)

export const families = new SharedArray('families', () => JSON.parse(open('/out/families.json')))
export const ACTIONS = JSON.parse(open('/out/actions.json'))

export const bizErrors = new Counter('kira_business_errors')
export const bizOk = new Rate('kira_business_ok')

const SESSION = '__Host-kira.session'
const DEVICE = '__Host-kira.device'

export function pick(arr, n) {
  return arr[n % arr.length]
}

export function think(minS, maxS) {
  if (THINK <= 0) return
  sleep((minS + Math.random() * (maxS - minS)) * THINK)
}

/** Alamat klien berbeda per VU lewat CF-Connecting-IP (proxy mempercayainya dari jaringan privat), supaya batas laju per IP tidak mengenai semua VU sekaligus. */
function fakeIp() {
  const v = __VU
  return `10.${(v >> 8) & 255}.${v & 255}.${(__ITER % 250) + 1}`
}

export function cookieFor(kind, fam, kid) {
  if (kind === 'parent') return `${SESSION}=${fam.guardianToken}`
  return `${SESSION}=${kid.token}; ${DEVICE}=${fam.deviceToken}`
}

export function headers(cookie, extra) {
  return Object.assign({ Cookie: cookie || '', 'CF-Connecting-IP': fakeIp(), 'Accept-Language': 'id,en;q=0.8' }, extra || {})
}

export function page(path, cookie, name) {
  const res = http.get(BASE + path, { headers: headers(cookie, { Accept: 'text/html' }), tags: { name: name || path } })
  return res
}

/** Jalankan Server Action Next. args = array argumen. path = halaman tempat action dipanggil. */
export function action(name, args, path, cookie, tag) {
  const id = ACTIONS[name]
  if (!id) throw new Error('Server Action tidak dikenal: ' + name)
  const res = http.post(BASE + path, JSON.stringify(args), {
    headers: headers(cookie, {
      'Next-Action': id,
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: 'text/x-component',
      Origin: BASE,
    }),
    tags: { name: tag || name },
  })
  const okHttp = res.status === 200
  const ok = okHttp && res.body && res.body.indexOf('"ok":true') >= 0
  bizOk.add(ok, { name: tag || name })
  if (!ok) bizErrors.add(1, { name: tag || name })
  return { res, ok, body: res.body || '' }
}

export function expect200(res, label) {
  return check(res, { [label + ' 200']: (r) => r.status === 200 })
}

/** Ambil semua UUID unik dari teks (HTML dan aliran RSC). */
export function uuids(text, prefix) {
  const re = prefix ? new RegExp(prefix.replace(/\//g, '\\/') + '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'g') : /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
  const out = []
  let m
  while ((m = re.exec(text)) !== null) {
    const id = prefix ? m[1] : m[0]
    if (out.indexOf(id) < 0) out.push(id)
  }
  return out
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
