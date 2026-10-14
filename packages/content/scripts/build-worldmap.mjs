/**
 * Membuat peta dunia sederhana untuk soal "Point on the map" Quiz Arena: tujuh benua dan lima samudra sebagai
 * path SVG, ditulis ke src/knowledge/data/worldmap.ts. Dijalankan tangan bila perlu (`pnpm --filter @kira/content build:worldmap`),
 * hasilnya ikut di repo, jadi tidak ada aset luar saat aplikasi berjalan.
 *
 * Data: paket npm world-atlas (lisensi ISC) berisi Natural Earth (domain publik), countries-110m. Negara digabung per benua.
 * Rusia dipotong di bujur 60 derajat timur (Pegunungan Ural): barat Eropa, timur Asia. Samudra adalah poligon kasar di bawah
 * daratan; yang kelihatan hanya bagian airnya. Proyeksi equirectangular: x = bujur + 180, y = 90 - lintang, satu satuan per derajat.
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature, merge } = require('topojson-client')
const topology = require('world-atlas/countries-110m.json')
const atlasVersion = require('world-atlas/package.json').version

const BY_NAME = {
  asia: [
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan',
    'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'South Korea',
    'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen',
  ],
  europe: [
    'Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Cyprus', 'N. Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
    'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Lithuania', 'Luxembourg', 'Macedonia', 'Moldova', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia',
    'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
  ],
  africa: [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo', "Côte d'Ivoire", 'Djibouti', 'Egypt', 'Eq. Guinea',
    'Eritrea', 'eSwatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Morocco',
    'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'S. Sudan', 'Senegal', 'Sierra Leone', 'Somalia', 'Somaliland', 'South Africa', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'W. Sahara',
    'Zambia', 'Zimbabwe',
  ],
  namerica: [
    'Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Rep.', 'El Salvador', 'Greenland', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico',
    'Trinidad and Tobago', 'United States of America',
  ],
  samerica: ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'],
  oceania: ['Australia', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea', 'Solomon Is.', 'Vanuatu'],
  antarctica: ['Antarctica'],
}
const LABELS = { asia: 'Asia', europe: 'Europe', africa: 'Africa', namerica: 'North America', samerica: 'South America', oceania: 'Oceania', antarctica: 'Antarctica' }
const SKIP = new Set(['Fr. S. Antarctic Lands'])
const URALS = 60

// Samudra: poligon kasar (bujur, lintang). Daratan digambar di atasnya.
const OCEANS = {
  pacific: {
    label: 'Pacific Ocean',
    polys: [
      [[180, 66], [140, 66], [132, 52], [113, 40], [100, 28], [100, 5], [110, -8], [129, -11], [135, -12], [146, -16], [146, -39], [147, -60], [180, -60]],
      [[-180, 66], [-130, 66], [-110, 40], [-100, 20], [-92, 14], [-84, 10], [-80, 8], [-62, -20], [-67, -56], [-67, -60], [-180, -60]],
    ],
  },
  atlantic: {
    label: 'Atlantic Ocean',
    polys: [[[-67, -60], [-67, -56], [-62, -20], [-80, 8], [-84, 10], [-92, 14], [-100, 20], [-110, 40], [-130, 66], [40, 66], [40, 28], [20, 28], [20, -60]]],
  },
  indian: { label: 'Indian Ocean', polys: [[[20, -60], [20, 28], [100, 28], [100, 5], [110, -8], [129, -11], [135, -12], [146, -16], [146, -39], [147, -60]]] },
  southern: { label: 'Southern Ocean', polys: [[[-180, -60], [180, -60], [180, -90], [-180, -90]]] },
  arctic: { label: 'Arctic Ocean', polys: [[[-180, 66], [180, 66], [180, 90], [-180, 90]]] },
}

const nameOf = new Map()
for (const [id, names] of Object.entries(BY_NAME)) for (const n of names) nameOf.set(n, id)
const geoms = topology.objects.countries.geometries
const unknown = geoms.filter((g) => !SKIP.has(g.properties.name) && g.properties.name !== 'Russia' && !nameOf.has(g.properties.name)).map((g) => g.properties.name)
if (unknown.length) {
  console.error('Negara tanpa benua:', unknown.join(', '))
  process.exit(1)
}

// Potong cincin dengan setengah bidang (Sutherland-Hodgman) pada bujur x = URALS.
function clipRing(ring, keepWest) {
  const inside = (p) => (keepWest ? p[0] <= URALS : p[0] >= URALS)
  const cross = (a, b) => {
    const t = (URALS - a[0]) / (b[0] - a[0])
    return [URALS, a[1] + t * (b[1] - a[1])]
  }
  const out = []
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    if (inside(a)) {
      out.push(a)
      if (!inside(b)) out.push(cross(a, b))
    } else if (inside(b)) out.push(cross(a, b))
  }
  if (out.length < 3) return null
  out.push(out[0])
  return out
}

function polygonsOf(geom) {
  const f = feature(topology, geom)
  const g = f.geometry
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates
}

const regions = {}
for (const id of Object.keys(BY_NAME)) {
  const members = geoms.filter((g) => nameOf.get(g.properties.name) === id)
  const merged = merge(topology, members)
  regions[id] = merged.coordinates.map((poly) => poly)
}
const russia = geoms.find((g) => g.properties.name === 'Russia')
for (const original of polygonsOf(russia)) {
  // Chukotka melewati garis tanggal: bujur negatif digeser +360 supaya ikut sisi timur Ural.
  const poly = original.map((r) => r.map(([x, y]) => [x < 0 ? x + 360 : x, y]))
  const west = poly.map((r) => clipRing(r, true))
  const east = poly.map((r) => clipRing(r, false))
  if (west[0]) regions.europe.push(west.filter(Boolean))
  if (east[0]) regions.asia.push(east.filter(Boolean))
}

// Sederhanakan: Douglas-Peucker, buang pulau sangat kecil.
function dp(points, eps) {
  if (points.length < 3) return points
  const keep = new Array(points.length).fill(false)
  keep[0] = keep[points.length - 1] = true
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    let max = 0
    let idx = -1
    const [ax, ay] = points[s]
    const [bx, by] = points[e]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1e-9
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > eps && idx > 0) {
      keep[idx] = true
      stack.push([s, idx], [idx, e])
    }
  }
  return points.filter((_, i) => keep[i])
}
/** Cincin tertutup: bagi di titik terjauh dari titik pertama supaya dp tidak memakai garis sepanjang nol. */
function simplifyRing(ring, eps) {
  const pts = ring.slice(0, -1)
  if (pts.length < 4) return ring
  let far = 1
  let best = -1
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1])
    if (d > best) {
      best = d
      far = i
    }
  }
  const a = dp(pts.slice(0, far + 1), eps)
  const b = dp([...pts.slice(far), pts[0]], eps)
  return [...a.slice(0, -1), ...b]
}
const area = (ring) => {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return Math.abs(a / 2)
}
const fmt = (n) => String(Math.round(n * 10) / 10)
const pt = ([lon, lat]) => `${fmt(lon + 180)} ${fmt(90 - lat)}`
/**
 * Cincin yang melintasi garis tanggal (Chukotka, Fiji) disimpan dengan lonjakan bujur 360 derajat. Bujurnya dibuat
 * sambung (unwrap), lalu digambar tiga salinan (-360, 0, +360) supaya bagian yang keluar peta terpotong oleh viewBox.
 */
function unwrap(ring) {
  const out = [ring[0].slice()]
  let shift = 0
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i][0] - ring[i - 1][0]
    if (d > 180) shift -= 360
    else if (d < -180) shift += 360
    out.push([ring[i][0] + shift, ring[i][1]])
  }
  return { ring: out, wrapped: shift !== 0 || out.some((p, i) => i > 0 && Math.abs(p[0] - out[i - 1][0]) > 180) }
}
function pathOf(polys, eps, minArea, noWrap = false) {
  const parts = []
  for (const poly of polys) {
    for (const [i, ring] of poly.entries()) {
      const u = noWrap ? { ring, wrapped: false } : unwrap(ring)
      // Setelah unwrap bujur sambung; titik penutup bisa berbeda 360 dari titik awal, tutup lagi dengan titik awal.
      const closed = u.ring[0][0] === u.ring.at(-1)[0] ? u.ring : [...u.ring, u.ring[0]]
      if (i === 0 && area(closed) < minArea) break
      if (i > 0 && area(closed) < minArea) continue
      const s = simplifyRing(closed, eps)
      if (s.length < 3) continue
      const offsets = noWrap ? [0] : [-360, 0, 360]
      for (const off of offsets) {
        const xs = s.map((p) => p[0] + off)
        if (Math.max(...xs) < -180 || Math.min(...xs) > 180) continue
        parts.push(`M${s.map((p) => pt([p[0] + off, p[1]])).join('L')}Z`)
      }
    }
  }
  return parts.join('')
}

const land = Object.keys(BY_NAME).map((id) => ({ id, label: LABELS[id], d: pathOf(regions[id], 0.22, 0.5, id === 'antarctica') }))
const water = Object.entries(OCEANS).map(([id, o]) => ({ id, label: o.label, d: o.polys.map((p) => `M${p.map(pt).join('L')}Z`).join('') }))

const total = [...land, ...water].reduce((n, r) => n + r.d.length, 0)
const body = `/**
 * Peta dunia sederhana untuk soal "Point on the map" Quiz Arena. DIBUAT OTOMATIS oleh scripts/build-worldmap.mjs, jangan diubah tangan.
 * Sumber: paket npm world-atlas ${atlasVersion} (ISC), data Natural Earth (domain publik), countries-110m, digabung per benua.
 * Proyeksi equirectangular: x = bujur + 180, y = 90 - lintang. Rusia dipotong di Pegunungan Ural (60 derajat timur).
 * Samudra adalah poligon kasar yang digambar di bawah daratan.
 */
export type MapRegion = { id: string; label: string; d: string }

export const WORLD_MAP: { viewBox: string; land: readonly MapRegion[]; water: readonly MapRegion[] } = {
  viewBox: '0 0 360 180',
  land: ${JSON.stringify(land, null, 2).replace(/\n/g, '\n  ')},
  water: ${JSON.stringify(water, null, 2).replace(/\n/g, '\n  ')},
}
`
writeFileSync(fileURLToPath(new URL('../src/knowledge/data/worldmap.ts', import.meta.url)), body)
console.log(`worldmap.ts: ${land.length} daratan, ${water.length} samudra, ${(total / 1024).toFixed(1)} KB path`)
