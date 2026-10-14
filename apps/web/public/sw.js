/*
 * Service worker Kira.
 * - Aset statis Next (/_next/static, ikon, favicon, manifest, halaman offline): cache dulu.
 * - Halaman learner (Today, pembuka quest, runner, hasil, peta, Review, pelajaran): jaringan dulu,
 *   simpanan dipakai saat internet rumah putus. Jawaban offline disimpan di IndexedDB oleh halaman.
 * - Konsol tutor, halaman orang tua, cetak, masuk, dan semua /api tidak pernah disimpan.
 * - Server tidak terjangkau (502 sampai 504 dan 520 sampai 530 dari Cloudflare, atau jaringan putus):
 *   halaman tersimpan atau halaman offline.
 * - Ganti learner (/bye) atau kembali ke pilihan learner menghapus simpanan halaman.
 * - Klip suara bahasa Inggris (/tts/<sha256>.mp3): cache dulu. Klip untuk sesi hari ini disimpan di muka
 *   (pesan precache-audio dari TtsRuntime) supaya suara tetap ada saat internet rumah putus.
 * - Gambar media organisasi (/api/media/<id>, misalnya gambar soal paper): server melarang disimpan (no-store), jadi
 *   hanya yang dirujuk halaman learner yang di-precache yang disimpan, di simpanan pribadi sendiri. Jaringan tetap
 *   dipakai lebih dulu (akses yang dicabut tidak bertahan); simpanan hanya dipakai saat internet putus. Simpanan
 *   ini dihapus bersama simpanan halaman saat learner berganti.
 */
const VERSION = 'kira-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const AUDIO_CACHE = `${VERSION}-audio`
const MEDIA_CACHE = `${VERSION}-media`
const OFFLINE_URL = '/offline.html'
const MAX_PAGES = 60
const MAX_STATIC = 400
// Efek suara learner (sekitar 45 KB): disimpan saat pemasangan supaya bunyi tetap ada saat offline.
const SOUNDS = ['correct', 'notyet', 'combo', 'levelup', 'badge', 'complete', 'tick', 'timeup', 'tap'].map((n) => `/sounds/${n}.mp3`)
const MAX_AUDIO = 900
const MAX_MEDIA = 120
const MEDIA = /^\/api\/media\/[0-9a-f-]{36}$/
const CLIP = /^\/tts\/[0-9a-f]{64}\.mp3$/

const LEARNER_PAGES = [
  /^\/today$/,
  /^\/today\/done$/,
  /^\/quest\/[0-9a-f-]{36}$/,
  /^\/run\/[0-9a-f-]{36}$/,
  /^\/results\/[0-9a-f-]{36}(\/review)?$/,
  /^\/map$/,
  /^\/me$/,
  /^\/review$/,
  /^\/lesson\/[mes][1-6]\.[a-z0-9-]+$/,
  /^\/esmo$/,
  /^\/competitions(\/[a-z0-9-]+)?$/,
]

function isLearnerPage(pathname) {
  return LEARNER_PAGES.some((re) => re.test(pathname))
}

function isStatic(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/sounds/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === OFFLINE_URL
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/manifest.webmanifest', ...SOUNDS]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') {
    await cache.put(request, res.clone())
    void trim(STATIC_CACHE, MAX_STATIC)
  }
  return res
}

/**
 * Kira di rumah tidak terjangkau. Cloudflare menjawab 502 sampai 504 saat server mati atau lambat, dan
 * 520 sampai 530 saat Cloudflare Tunnel putus (misalnya 521 dan 530). Jawaban itu diperlakukan seperti
 * internet putus: halaman tersimpan dipakai, atau halaman offline.
 */
function isUnreachable(status) {
  return (status >= 502 && status <= 504) || (status >= 520 && status <= 530)
}

/** Klip suara tidak pernah berubah (nama berkas = sha256 isinya), jadi simpanan dipakai lebih dulu. */
async function audioCacheFirst(request) {
  const cache = await caches.open(AUDIO_CACHE)
  const hit = await cache.match(request.url)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') {
    await cache.put(request.url, res.clone())
    void trim(AUDIO_CACHE, MAX_AUDIO)
  }
  return res
}

async function precacheAudio(urls) {
  const cache = await caches.open(AUDIO_CACHE)
  for (const raw of urls.slice(0, 600)) {
    let url
    try {
      url = new URL(raw, self.location.origin)
    } catch {
      continue
    }
    if (url.origin !== self.location.origin || !CLIP.test(url.pathname)) continue
    if (await cache.match(url.href)) continue
    try {
      const res = await fetch(url.href, { credentials: 'same-origin' })
      if (res.ok && res.type === 'basic') await cache.put(url.href, res)
    } catch {
      // offline atau server sibuk: klip berikutnya, sisanya dicoba lagi saat halaman berikutnya dibuka
    }
  }
  await trim(AUDIO_CACHE, MAX_AUDIO)
}

/** Gambar media: jaringan lebih dulu; simpanan (bila ada) dipakai hanya saat jaringan putus atau server tidak terjangkau. */
async function mediaNetworkFirst(request) {
  const cache = await caches.open(MEDIA_CACHE)
  const key = request.url
  try {
    const res = await fetch(request)
    if (isUnreachable(res.status)) return (await cache.match(key)) || res
    if (res.ok && res.type === 'basic') {
      // Hanya perbarui yang memang sudah disimpan oleh precache halaman.
      if (await cache.match(key)) await cache.put(key, res.clone())
    } else if (res.status === 401 || res.status === 403 || res.status === 404) {
      await cache.delete(key)
    }
    return res
  } catch {
    return (await cache.match(key)) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

/** Simpan gambar media yang dirujuk halaman learner yang di-precache, supaya gambar soal paper tampil saat offline. */
async function cacheMediaOf(html) {
  const cache = await caches.open(MEDIA_CACHE)
  const found = new Set(html.match(/\/api\/media\/[0-9a-f-]{36}/g) || [])
  for (const path of [...found].slice(0, 40)) {
    const href = new URL(path, self.location.origin).href
    if (await cache.match(href)) continue
    try {
      const res = await fetch(href, { credentials: 'same-origin' })
      if (res.ok && res.type === 'basic') await cache.put(href, res)
    } catch {
      // gambar berikutnya
    }
  }
  await trim(MEDIA_CACHE, MAX_MEDIA)
}

async function clearLearnerCaches() {
  await caches.delete(PAGE_CACHE)
  await caches.delete(MEDIA_CACHE)
}

async function offlineFallback() {
  return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/** Halaman yang tidak disimpan: jaringan, dan halaman offline bila server tidak terjangkau. */
async function fetchOrOffline(request) {
  try {
    const res = await fetch(request)
    return isUnreachable(res.status) ? offlineFallback() : res
  } catch {
    return offlineFallback()
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE)
  const cached = async () => (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }))
  try {
    const res = await fetch(request)
    if (isUnreachable(res.status)) return (await cached()) || offlineFallback()
    if (res.ok && res.type === 'basic' && !res.redirected) {
      await cache.put(request, res.clone())
      void trim(PAGE_CACHE, MAX_PAGES)
    }
    return res
  } catch {
    return (await cached()) || offlineFallback()
  }
}

/** Simpan aset /_next/static yang dirujuk halaman supaya halaman itu tetap jalan saat offline. */
async function cacheAssetsOf(html) {
  const cache = await caches.open(STATIC_CACHE)
  const found = new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./~]+\.(?:js|css|woff2)/g) || [])
  for (const path of found) {
    if (await cache.match(path)) continue
    try {
      const res = await fetch(path)
      if (res.ok) await cache.put(path, res)
    } catch {
      // aset berikutnya
    }
  }
}

async function precache(urls) {
  const cache = await caches.open(PAGE_CACHE)
  for (const raw of urls.slice(0, 16)) {
    let url
    try {
      url = new URL(raw, self.location.origin)
    } catch {
      continue
    }
    if (url.origin !== self.location.origin || !isLearnerPage(url.pathname)) continue
    try {
      // Header ini memberi tahu server bahwa ini bukan pembukaan oleh learner (jam tes belum mulai).
      const res = await fetch(url.href, { credentials: 'same-origin', headers: { 'x-kira-precache': '1' } })
      if (!res.ok || res.redirected || res.type !== 'basic') continue
      const html = await res.clone().text()
      await cache.put(url.href, res)
      await cacheAssetsOf(html)
      await cacheMediaOf(html)
    } catch {
      // offline atau server sibuk: coba lagi saat Today dibuka berikutnya
    }
  }
  await trim(PAGE_CACHE, MAX_PAGES)
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'precache' && Array.isArray(data.urls)) {
    event.waitUntil(precache(data.urls.filter((u) => typeof u === 'string')))
  }
  if (data.type === 'precache-audio' && Array.isArray(data.urls)) {
    event.waitUntil(precacheAudio(data.urls.filter((u) => typeof u === 'string')))
  }
  if (data.type === 'clear-pages') event.waitUntil(clearLearnerCaches())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (MEDIA.test(url.pathname)) {
    event.respondWith(mediaNetworkFirst(request))
    return
  }
  if (url.pathname.startsWith('/api/')) return
  if (CLIP.test(url.pathname)) {
    event.respondWith(audioCacheFirst(request))
    return
  }

  if (isStatic(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (request.mode !== 'navigate') return

  // Pergantian learner: halaman anak sebelumnya tidak boleh tersisa di tablet.
  if (url.pathname === '/bye' || url.pathname === '/' || url.pathname.startsWith('/pin/')) {
    event.waitUntil(clearLearnerCaches())
    event.respondWith(fetchOrOffline(request))
    return
  }
  if (isLearnerPage(url.pathname)) {
    event.respondWith(networkFirstPage(request))
    return
  }
  event.respondWith(fetchOrOffline(request))
})
