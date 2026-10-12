/**
 * Jembatan ke aplikasi Android Kira (apps/android). Objek `KiraNative` disuntikkan oleh
 * WebViewCompat.addWebMessageListener hanya untuk origin server Kira, jadi di browser biasa
 * objek ini tidak ada dan semua fungsi di sini diam. Pesan berupa string JSON; balasan datang
 * lewat event `message` pada objek yang sama. Protokol lengkap ada di docs/android.md.
 */

export type NativeLang = 'en-GB' | 'id'

export type NativeInfo = {
  /** TextToSpeech Android siap dipakai. */
  tts: boolean
  /** versionName aplikasi, misalnya 1.0.12. */
  app: string
}

type NativeMessageEvent = { data: unknown }
type NativeListener = (event: NativeMessageEvent) => void

type KiraNativeObject = {
  postMessage(message: string): void
  addEventListener?: (type: 'message', listener: NativeListener) => void
  onmessage?: NativeListener | null
}

declare global {
  interface Window {
    KiraNative?: KiraNativeObject
  }
}

type Incoming =
  | { type: 'ready'; tts: boolean; app: string }
  | { type: 'speech-start' | 'speech-end' | 'speech-error'; id: string }

type Pending = { resolve: () => void; timer: number; speakMs: number }

const READY_TIMEOUT_MS = 4000
const START_TIMEOUT_MS = 10_000
const MAX_TEXT = 2000
const MAX_INCOMING = 4096

let info: NativeInfo | null = null
let readyPromise: Promise<NativeInfo | null> | null = null
let resolveReady: ((value: NativeInfo | null) => void) | null = null
let listening = false
let seq = 0
const pending = new Map<string, Pending>()

function bridge(): KiraNativeObject | null {
  if (typeof window === 'undefined') return null
  const candidate = window.KiraNative
  return candidate && typeof candidate.postMessage === 'function' ? candidate : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parse(data: unknown): Incoming | null {
  if (typeof data !== 'string' || data.length > MAX_INCOMING) return null
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  const type = value.type
  if (type === 'ready') {
    const tts = value.tts
    const app = value.app
    return typeof tts === 'boolean' && typeof app === 'string' ? { type, tts, app } : null
  }
  if (type === 'speech-start' || type === 'speech-end' || type === 'speech-error') {
    const id = value.id
    return typeof id === 'string' ? { type, id } : null
  }
  return null
}

function settle(id: string): void {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  window.clearTimeout(entry.timer)
  entry.resolve()
}

function onMessage(event: NativeMessageEvent): void {
  const message = parse(event.data)
  if (!message) return
  if (message.type === 'ready') {
    info = { tts: message.tts, app: message.app }
    resolveReady?.(info)
    resolveReady = null
    return
  }
  if (message.type === 'speech-start') {
    // Bacaan mulai: ganti batas waktu mulai dengan perkiraan lama bacaan.
    const entry = pending.get(message.id)
    if (entry) {
      window.clearTimeout(entry.timer)
      entry.timer = window.setTimeout(() => settle(message.id), entry.speakMs)
    }
    return
  }
  settle(message.id)
}

function listen(target: KiraNativeObject): void {
  if (listening) return
  listening = true
  if (typeof target.addEventListener === 'function') target.addEventListener('message', onMessage)
  else target.onmessage = onMessage
}

/** true bila halaman berjalan di aplikasi Android Kira dengan jembatan aktif. */
export function hasNativeBridge(): boolean {
  return bridge() !== null
}

/** true bila TextToSpeech Android sudah menjawab siap. Sebelum `nativeReady()` selesai nilainya false. */
export function nativeTtsReady(): boolean {
  return info?.tts === true && bridge() !== null
}

/**
 * Kirim `hello` sekali dan tunggu `ready`. Hasilnya null bila tidak ada jembatan atau aplikasi
 * tidak menjawab dalam 4 detik; jawaban yang datang terlambat tetap dicatat.
 */
export function nativeReady(): Promise<NativeInfo | null> {
  if (info) return Promise.resolve(info)
  const target = bridge()
  if (!target) return Promise.resolve(null)
  if (!readyPromise) {
    listen(target)
    readyPromise = new Promise<NativeInfo | null>((resolve) => {
      resolveReady = resolve
      window.setTimeout(() => {
        if (resolveReady !== resolve) return
        resolveReady = null
        resolve(null)
      }, READY_TIMEOUT_MS)
    })
    try {
      target.postMessage(JSON.stringify({ type: 'hello' }))
    } catch {
      // Jembatan tidak menerima pesan; batas waktu di atas menyelesaikan promise dengan null.
    }
  }
  return readyPromise
}

/**
 * Bacakan teks dengan TextToSpeech Android. Selesai saat speech-end atau speech-error datang,
 * atau saat batas waktu habis, jadi pemanggil tidak pernah menunggu tanpa akhir.
 * Ditolak hanya bila jembatan atau TTS belum siap.
 */
export function nativeSpeak(text: string, lang: NativeLang, rate = 1): Promise<void> {
  const target = bridge()
  if (!target || info?.tts !== true) return Promise.reject(new Error('Text-to-speech Android belum siap.'))
  const body = text.slice(0, MAX_TEXT)
  const safeRate = Math.min(1.5, Math.max(0.5, Number.isFinite(rate) ? rate : 1))
  const id = `s${Date.now().toString(36)}${(seq++).toString(36)}`
  // Sekitar 15 karakter per detik pada kecepatan 1, ditambah jeda 8 detik, paling lama 3 menit.
  const speakMs = Math.min(180_000, 8000 + Math.ceil((body.length * 70) / safeRate))
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => settle(id), START_TIMEOUT_MS)
    pending.set(id, { resolve, timer, speakMs })
    try {
      target.postMessage(JSON.stringify({ type: 'speak', id, text: body, lang, rate: safeRate }))
    } catch {
      settle(id)
    }
  })
}

/** Hentikan bacaan Android dan selesaikan semua promise yang masih menunggu. */
export function nativeStop(): void {
  const target = bridge()
  if (target) {
    try {
      target.postMessage(JSON.stringify({ type: 'stop' }))
    } catch {
      // WebView sedang ditutup.
    }
  }
  for (const id of [...pending.keys()]) settle(id)
}

/**
 * Jaga layar tetap menyala selama runner terbuka. Aplikasi Android memakai FLAG_KEEP_SCREEN_ON lewat
 * jembatan; browser biasa memakai Screen Wake Lock API bila tersedia. Mengembalikan fungsi pelepas.
 */
export function keepScreenAwake(): () => void {
  const target = bridge()
  if (target) {
    try {
      target.postMessage(JSON.stringify({ type: 'keep-awake', on: true }))
    } catch {
      // WebView sedang ditutup.
    }
    return () => {
      try {
        target.postMessage(JSON.stringify({ type: 'keep-awake', on: false }))
      } catch {
        // WebView sedang ditutup.
      }
    }
  }
  type WakeLock = { release(): Promise<void> }
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLock> } }
  if (!nav.wakeLock) return () => {}
  let lock: WakeLock | null = null
  let stopped = false
  const acquire = () => {
    if (stopped || document.visibilityState !== 'visible') return
    nav.wakeLock!
      .request('screen')
      .then((l) => {
        if (stopped) void l.release()
        else lock = l
      })
      .catch(() => {
        // Ditolak browser (baterai hemat atau tidak didukung): layar mengikuti pengaturan perangkat.
      })
  }
  acquire()
  document.addEventListener('visibilitychange', acquire)
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', acquire)
    void lock?.release().catch(() => {})
  }
}
