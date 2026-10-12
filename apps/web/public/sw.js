/*
 * Service worker Kira.
 * - Aset statis Next (/_next/static, ikon, favicon, manifest, halaman offline): cache dulu.
 * - Halaman learner (Today, pembuka quest, runner, hasil, peta, Review, pelajaran): jaringan dulu,
 *   simpanan dipakai saat internet rumah putus. Jawaban offline disimpan di IndexedDB oleh halaman.
 * - Konsol tutor, halaman orang tua, cetak, masuk, dan semua /api tidak pernah disimpan.
 * - Ganti learner (/bye) atau kembali ke pilihan learner menghapus simpanan halaman.
 */
const VERSION = 'kira-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const OFFLINE_URL = '/offline.html'
const MAX_PAGES = 60
const MAX_STATIC = 400

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
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === OFFLINE_URL
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/manifest.webmanifest']))
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

async function offlineFallback() {
  return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const res = await fetch(request)
    if (res.ok && res.type === 'basic' && !res.redirected) {
      await cache.put(request, res.clone())
      void trim(PAGE_CACHE, MAX_PAGES)
    }
    return res
  } catch {
    const hit = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }))
    return hit || offlineFallback()
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
  if (data.type === 'clear-pages') event.waitUntil(caches.delete(PAGE_CACHE))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (isStatic(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (request.mode !== 'navigate') return

  // Pergantian learner: halaman anak sebelumnya tidak boleh tersisa di tablet.
  if (url.pathname === '/bye' || url.pathname === '/' || url.pathname.startsWith('/pin/')) {
    event.waitUntil(caches.delete(PAGE_CACHE))
    event.respondWith(fetch(request).catch(offlineFallback))
    return
  }
  if (isLearnerPage(url.pathname)) {
    event.respondWith(networkFirstPage(request))
    return
  }
  event.respondWith(fetch(request).catch(offlineFallback))
})
