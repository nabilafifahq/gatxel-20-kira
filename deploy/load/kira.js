// Skenario beban Kira (k6). Pemakaian: lihat deploy/load/README.md dan docs/laporan-beban.md.
//   SCENARIO = mixed | latihan | tes | paper | today | audio | qm | quiz | parent | signin | pin | signup | spike
//              | hub | cards | reading | dict | world | boss | placement | feedback | parentswitch
//   STAGE    = smoke | 100 | 300 | 500 | 1000 | soak | stress | burst   (jumlah VU puncak; soak = 100 VU selama SOAK_MIN menit)
//              stress: anak tangga dari STEPS (mis. 1250,1500,2000), masing-masing STEP_SECONDS; berhenti sendiri bila galat satu anak tangga lewat 1%.
//              burst: BURST_N pendaftaran dalam 120 detik (skenario signup), untuk menguji batas kursi.
//   THINK    = faktor waktu berpikir (bawaan 1); HOLD = detik di puncak (bawaan 180)
// Satu VU adalah satu anak yang sedang aktif (atau satu orang tua). Staging saja, bukan produksi.
import http from 'k6/http'
import { SharedArray } from 'k6/data'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import {
  BASE, ORIGIN, MAILPIT, THINK, families, action, page, cookieFor, headers, think, uuids, uuidv4, bizOk, expect200, clipBytes, clipCount, toolBytes,
} from './lib.js'

const SCENARIO = __ENV.SCENARIO || 'mixed'
const STAGE = __ENV.STAGE || 'smoke'
const SOAK_MIN = Number(__ENV.SOAK_MIN || 30)

// ---------------------------------------------------------------------------
// Opsi: tahap dan ambang. Ambang pada submetrik per nama hanya supaya k6 menulis p50/p95/p99 per endpoint ke ringkasan.

const NAMES = [
  'today', 'quest_intro', 'run_page', 'save_answer', 'submit', 'results', 'heartbeat', 'audio_clip', 'audio_clip_cold', 'static_sound',
  'qm_page', 'qm_start', 'qm_answer', 'qm_finish', 'quiz_page', 'quiz_start', 'quiz_answer', 'quiz_finish', 'parent_dashboard', 'parent_privacy',
  'login_page', 'login', 'pin_page', 'pin', 'signup', 'signup_verify', 'signup_page', 'signup_confirm_page', 'waitlist', 'onboard_page', 'onboard_child', 'health',
  'tts_today', 'practice_hub', 'practice_start', 'cards_hub', 'cards_deck', 'cards_finish', 'reading_hub', 'reading_book', 'reading_chapter', 'reading_progress',
  'reading_time', 'dict_file', 'dict_page', 'dict_save', 'world_home', 'world_shop', 'world_buy', 'world_album', 'boss_hub', 'boss_start', 'boss_turn', 'boss_submit', 'boss_result',
  'placement_page', 'placement_answer', 'parent_child', 'parent_switch', 'feedback_page', 'feedback_send', 'mailpit',
]
const STEPS = (__ENV.STEPS || '').split(',').filter(Boolean).map(Number)
const STEP_SECONDS = Number(__ENV.STEP_SECONDS || 90)

function thresholds() {
  const t = {
    http_req_failed: ['rate<0.5'],
    http_req_duration: ['p(99)<60000'],
    kira_business_ok: ['rate>0'],
  }
  for (const n of NAMES) {
    t[`http_req_duration{name:${n}}`] = ['max>=0']
    t[`http_req_failed{name:${n}}`] = ['rate>=0']
    t[`kira_business_ok{name:${n}}`] = ['rate>=0']
  }
  // Satu anak tangga lewat 1% galat HTTP: uji berhenti sendiri, itulah titik patah.
  for (const n of STEPS) {
    t[`http_req_failed{step:${n}}`] = [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '20s' }]
    t[`http_req_duration{step:${n}}`] = ['max>=0']
    t[`http_reqs{step:${n}}`] = ['count>=0']
    t[`kira_business_ok{step:${n}}`] = ['rate>=0']
    t[`http_req_duration{name:today,step:${n}}`] = ['max>=0']
    t[`http_req_duration{name:save_answer,step:${n}}`] = ['max>=0']
  }
  return t
}

function ramp(peak, rampS, holdS) {
  return [
    { duration: `${rampS}s`, target: peak },
    { duration: `${holdS}s`, target: peak },
    { duration: '30s', target: 0 },
  ]
}

function stageOptions() {
  const peakOf = { smoke: 5, 100: 100, 300: 300, 500: 500, 1000: 1000, soak: 100 }
  if (SCENARIO === 'spike') {
    return { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 500 }, { duration: '120s', target: 500 }, { duration: '30s', target: 0 }], gracefulRampDown: '30s', gracefulStop: '60s' }
  }
  if (STAGE === 'stress') {
    const stages = []
    for (const n of STEPS) {
      stages.push({ duration: `${Math.floor(STEP_SECONDS / 3)}s`, target: n })
      stages.push({ duration: `${STEP_SECONDS - Math.floor(STEP_SECONDS / 3)}s`, target: n })
    }
    return { executor: 'ramping-vus', startVUs: 0, stages, gracefulRampDown: '10s', gracefulStop: '30s' }
  }
  if (STAGE === 'burst') {
    const n = Number(__ENV.BURST_N || 130)
    return { executor: 'constant-arrival-rate', rate: n, timeUnit: '120s', duration: '120s', preAllocatedVUs: n, maxVUs: n, gracefulStop: '90s' }
  }
  if (STAGE === 'soak') {
    return { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '60s', target: 100 }, { duration: `${SOAK_MIN}m`, target: 100 }, { duration: '30s', target: 0 }], gracefulRampDown: '30s', gracefulStop: '60s' }
  }
  const peak = peakOf[STAGE] ?? Number(STAGE)
  const hold = Number(__ENV.HOLD || (STAGE === 'smoke' ? 30 : 180))
  const rampS = Math.min(STAGE === 'smoke' ? 10 : 60, hold)
  return { executor: 'ramping-vus', startVUs: 0, stages: ramp(peak, rampS, hold), gracefulRampDown: '30s', gracefulStop: '60s' }
}

export const options = {
  scenarios: { [SCENARIO]: Object.assign({ exec: SCENARIO === 'spike' ? 'mixed' : SCENARIO }, stageOptions()) },
  thresholds: thresholds(),
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: 'kira-k6/1.0',
}

// ---------------------------------------------------------------------------
// Bantu

function who() {
  const fam = families[(__VU - 1) % families.length]
  const kid = fam.kids[Math.floor((__VU - 1) / families.length) % fam.kids.length]
  return { fam, kid, cookie: cookieFor('kid', fam, kid), parent: cookieFor('parent', fam) }
}

const RUN_LINK = new RegExp('/run/([0-9a-f-]{36})')
const LABEL = /aria-label="(\w+) (practice|test|paper), ([a-z ]+)\.[^"]*"[^>]*href="\/quest\/([0-9a-f-]{36})"/g

/** Daftar sesi hari ini dari halaman Today: [{subject, session, state, questId, runId}] */
function parseToday(body) {
  const out = []
  const urlsM = /"urls":\[((?:"[^"]*",?)+)\]/.exec(body.replace(/\\"/g, '"'))
  const pairs = {}
  if (urlsM) {
    const list = urlsM[1].split(',').map((s) => s.replace(/"/g, ''))
    for (let i = 0; i + 1 < list.length; i++) {
      if (list[i].indexOf('/quest/') === 0 && list[i + 1].indexOf('/run/') === 0) pairs[list[i].slice(7)] = list[i + 1].slice(5)
    }
  }
  LABEL.lastIndex = 0
  let m
  while ((m = LABEL.exec(body)) !== null) {
    out.push({ subject: m[1].toLowerCase(), session: m[2], state: m[3], questId: m[4], runId: pairs[m[4]] || null })
  }
  return out
}

function answerFor(type) {
  if (type === 'mcq' || type === 'listen') return { choice: Math.floor(Math.random() * 3) }
  if (type === 'numeric') return { value: String(1 + Math.floor(Math.random() * 20)) }
  return null
}

/** Jalankan satu sesi (Latihan, Tes, atau Paper) sampai dikumpulkan. fast = tanpa waktu berpikir (persiapan, ditandai prep). */
function runSession(w, s, opts) {
  const fast = opts && opts.fast
  const tag = (n) => (fast ? 'prep_' + n : n)
  const lim = s.session === 'test' || s.session === 'paper'
  const intro = http.get(BASE + '/quest/' + s.questId, { headers: headers(w.cookie, { Accept: 'text/html' }), tags: { name: tag('quest_intro') } })
  if (!s.runId) {
    const mm = RUN_LINK.exec(intro.body.replace(/\\"/g, '"'))
    if (!mm) return false
    s.runId = mm[1]
  }
  const run = http.get(BASE + '/run/' + s.runId, { headers: headers(w.cookie, { Accept: 'text/html' }), tags: { name: tag('run_page') } })
  if (!expect200(run, 'run')) return false
  const text = run.body.replace(/\\"/g, '"')
  const types = []
  const re = /"ref":"[^"]+","type":"(\w+)","skill"/g
  let m
  while ((m = re.exec(text)) !== null) types.push(m[1])
  let n = types.length
  if (n === 0) {
    const pos = text.match(/"position":(\d+)/g) || []
    n = pos.length
  }
  if (n === 0) return false
  for (let p = 1; p <= n; p++) {
    if (!fast) think(lim ? 3 : 4, lim ? 9 : 12)
    action(
      'saveAnswerAction',
      [{ attemptId: s.runId, position: p, answer: answerFor(types[p - 1]), hintsUsed: 0, attemptNo: 1, timeMs: 4000 + Math.floor(Math.random() * 6000), flagged: false, clientId: uuidv4(), answeredAt: new Date().toISOString() }],
      '/run/' + s.runId, w.cookie, tag('save_answer'),
    )
  }
  if (!fast) think(1, 3)
  const sub = action('submitAttemptAction', [s.runId, uuidv4()], '/run/' + s.runId, w.cookie, tag('submit'))
  if (!fast) page('/results/' + s.runId, w.cookie, 'results')
  return sub.ok
}

/** Mengerjakan satu attempt yang sudah ada (latihan bebas, bos). */
function answerAttempt(w, runId, tags) {
  const run = http.get(BASE + '/run/' + runId, { headers: headers(w.cookie, { Accept: 'text/html' }), tags: { name: 'run_page' } })
  if (!expect200(run, 'run')) return false
  const text = run.body.replace(/\\"/g, '"')
  const types = []
  const re = /"ref":"[^"]+","type":"(\w+)","skill"/g
  let m
  while ((m = re.exec(text)) !== null) types.push(m[1])
  if (types.length === 0) return false
  for (let p = 1; p <= types.length; p++) {
    think(3, 10)
    action(
      'saveAnswerAction',
      [{ attemptId: runId, position: p, answer: answerFor(types[p - 1]), hintsUsed: 0, attemptNo: 1, timeMs: 4000 + Math.floor(Math.random() * 6000), flagged: false, clientId: uuidv4(), answeredAt: new Date().toISOString() }],
      '/run/' + runId, w.cookie, tags.save,
    )
  }
  think(1, 3)
  return action('submitAttemptAction', [runId, uuidv4()], '/run/' + runId, w.cookie, tags.submit).ok
}

const ASSETS = (() => {
  try {
    return JSON.parse(open('/out/assets.json'))
  } catch {
    return {}
  }
})()

const clips = new SharedArray('clips', () => {
  try {
    return JSON.parse(open('/out/clips.json'))
  } catch {
    return []
  }
})

// CLIP_ORIGIN=0: klip tidak diambil dari origin, seperti saat Cloudflare sudah menyimpannya. Bawaan: semua klip lewat origin (paling berat).
const CLIP_ORIGIN = __ENV.CLIP_ORIGIN !== '0'
function clipGet(w, path) {
  if (!CLIP_ORIGIN) return
  // Isi tidak disimpan k6 (hemat memori generator); byte tetap dihitung dari Content-Length.
  const r = http.get(BASE + path, { headers: headers(w.cookie, { Accept: 'audio/mpeg' }), tags: { name: 'audio_clip' }, responseType: 'none' })
  check(r, { 'audio 200': (x) => x.status === 200 })
  clipBytes.add(Number(r.headers['Content-Length'] || 0))
  clipCount.add(1)
}

function audioFetch(w, count) {
  for (let i = 0; i < count; i++) clipGet(w, '/tts/' + (clips.length ? clips[Math.floor(Math.random() * clips.length)] : '0'.repeat(64)) + '.mp3')
}

// Alur peramban (TtsRuntime dan sw.js): tanya /api/tts/today, lalu service worker menyimpan semua klip hari itu satu per satu, kecuali yang sudah tersimpan.
// Saat diputar, klip dibaca dari simpanan perangkat. Tiap VU punya simpanannya sendiri, seperti satu tablet.
const stored = {}
function clipPrecache(w) {
  const r = http.get(BASE + '/api/tts/today', { headers: headers(w.cookie), tags: { name: 'tts_today' } })
  if (r.status !== 200) return
  let urls
  try {
    urls = r.json('urls') || []
  } catch {
    return
  }
  for (const u of urls.slice(0, 600)) {
    if (stored[u]) continue
    stored[u] = true
    clipGet(w, u)
  }
}

function pickSession(sessions, kind) {
  const open = sessions.filter((s) => s.state === 'ready' || s.state === 'in progress')
  const want = kind === 'latihan' ? 'practice' : kind === 'tes' ? 'test' : kind === 'paper' ? 'paper' : null
  const pool = want ? open.filter((s) => s.session === want) : open
  if (pool.length === 0) return null
  // Latihan dulu, lalu Tes, lalu Paper (urutan hari anak).
  const order = { practice: 0, test: 1, paper: 2 }
  pool.sort((a, b) => order[a.session] - order[b.session])
  return pool[0]
}

function heartbeat(w) {
  http.post(BASE + '/api/heartbeat', null, { headers: headers(w.cookie, { Origin: ORIGIN }), tags: { name: 'heartbeat' } })
}

function todayView(w) {
  const r = page('/today', w.cookie, 'today')
  expect200(r, 'today')
  return r
}

// ---------------------------------------------------------------------------
// Skenario

export function today() {
  const w = who()
  todayView(w)
  heartbeat(w)
  think(5, 20)
}

function sessionScenario(kind) {
  const w = who()
  const r = todayView(w)
  heartbeat(w)
  clipPrecache(w)
  let sessions = parseToday(r.body)
  let s = pickSession(sessions, kind)
  // Tes dan Paper terkunci sampai Latihan mapel itu selesai: selesaikan Latihan dulu tanpa jeda (tanda prep_).
  if (!s && (kind === 'tes' || kind === 'paper')) {
    const lat = pickSession(sessions, 'latihan')
    if (lat) {
      runSession(w, lat, { fast: true })
      sessions = parseToday(todayView(w).body)
      s = pickSession(sessions, kind)
    }
  }
  if (!s) {
    think(5, 15)
    return
  }
  runSession(w, s, {})
  think(3, 10)
}

export function latihan() {
  sessionScenario('latihan')
}
export function tes() {
  sessionScenario('tes')
}
export function paper() {
  sessionScenario('paper')
}

export function audio() {
  const w = who()
  // Kunci klip sungguhan (out/clips.json), ukuran berkas sungguhan.
  audioFetch(w, 6)
  think(1, 4)
}

export function qm() {
  const w = who()
  page('/quick-maths', w.cookie, 'qm_page')
  think(2, 6)
  const st = action(
    'startQmAction',
    [{ mode: 'target20', op: 'add', digits: 1, carry: false, auto: false, table: 2, division: false, flashLevel: null, sorobanStage: 'read', sorobanLevel: null, focus: null, mission: null }],
    '/quick-maths', w.cookie, 'qm_start',
  )
  const id = st.ok ? (uuids(st.body, '/quick-maths/play/')[0] || null) : null
  if (!id) return
  page('/quick-maths/play/' + id, w.cookie, 'qm_page')
  for (let i = 0; i < 20; i++) {
    think(1.5, 5)
    action('answerQmAction', [{ roundId: id, index: i, answer: Math.floor(Math.random() * 20), ms: 2000 + Math.floor(Math.random() * 3000) }], '/quick-maths/play/' + id, w.cookie, 'qm_answer')
  }
  action('finishQmAction', [id], '/quick-maths/play/' + id, w.cookie, 'qm_finish')
  think(2, 6)
}

export function quiz() {
  const w = who()
  page('/quiz-arena', w.cookie, 'quiz_page')
  think(2, 6)
  const st = action('startQuizAction', [{ topic: 'flags', mode: 'quiz' }], '/quiz-arena', w.cookie, 'quiz_start')
  const id = st.ok ? (uuids(st.body, '/quiz-arena/play/')[0] || null) : null
  if (!id) return
  page('/quiz-arena/play/' + id, w.cookie, 'quiz_page')
  for (let i = 0; i < 10; i++) {
    think(2, 7)
    action('answerQuizAction', [{ roundId: id, index: i, answer: null, ms: 3000 + Math.floor(Math.random() * 3000) }], '/quiz-arena/play/' + id, w.cookie, 'quiz_answer')
  }
  action('finishQuizAction', [id], '/quiz-arena/play/' + id, w.cookie, 'quiz_finish')
  think(2, 6)
}

export function parent() {
  const w = who()
  const r = page('/keluarga', w.parent, 'parent_dashboard')
  expect200(r, 'parent')
  think(8, 25)
  if (Math.random() < 0.3) {
    page('/keluarga/privasi', w.parent, 'parent_privacy')
    think(5, 15)
  }
}

export function signin() {
  const w = who()
  page('/masuk', '', 'login_page')
  think(2, 6)
  const r = action('passwordLoginAction', [{ email: w.fam.email, password: w.fam.password, next: null }], '/masuk', '', 'login')
  check(r.res, { 'login ok': () => r.ok })
  think(2, 6)
}

export function pin() {
  const w = who()
  page('/pin/' + w.kid.id, `__Host-kira.device=${w.fam.deviceToken}`, 'pin_page')
  think(2, 6)
  const r = action('submitPinAction', [w.kid.id, w.fam.pin], '/pin/' + w.kid.id, `__Host-kira.device=${w.fam.deviceToken}`, 'pin')
  check(r.res, { 'pin ok': () => r.ok })
  think(1, 4)
}

const SIGNUP_PASSWORD = 'Kira-Uji-Beban-2026!x'
const signupStarted = new Counter('kira_signup_started')
const signupFull = new Counter('kira_signup_rejected_full')
const signupOther = new Counter('kira_signup_rejected_other')
const verifyOk = new Counter('kira_verify_ok')
const verifyFull = new Counter('kira_verify_full')
const verifyOther = new Counter('kira_verify_other')
const verifyNoMail = new Counter('kira_verify_no_mail')

/**
 * Daftar, verifikasi lewat Mailpit, lalu tambah anak pertama. Domain email harus punya MX (web memeriksanya); staging mengirim ke Mailpit,
 * jadi tidak ada surat yang keluar. Kursi penuh dihitung sendiri (bukan galat), dan pengunjung itu masuk daftar tunggu.
 */
export function signup() {
  const stamp = `${__VU}-${__ITER}-${Date.now()}`
  const email = `beban-${stamp}@gatxel.com`
  page('/daftar', '', 'signup_page')
  think(3, 8)
  const r = action('signUpAction', [{ name: 'Orang Tua Uji', email, password: SIGNUP_PASSWORD, consent: true }], '/daftar', '', 'signup')
  if (!r.ok) {
    if (r.body.indexOf('Kursi beta sudah penuh') >= 0) {
      signupFull.add(1)
      action('joinWaitlistAction', [{ email, consent: true }], '/daftar', '', 'waitlist')
    } else {
      signupOther.add(1)
    }
    return
  }
  signupStarted.add(1)
  let token = null
  for (let i = 0; i < 90 && !token; i++) {
    think(0.5, 1)
    const q = http.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`, { tags: { name: 'mailpit' } })
    toolBytes.add((q.body || '').length)
    const msgs = q.status === 200 ? q.json('messages') : []
    if (msgs && msgs.length) {
      const msg = http.get(`${MAILPIT}/api/v1/message/${msgs[0].ID}`, { tags: { name: 'mailpit' } })
      toolBytes.add((msg.body || '').length)
      const mm = /\/daftar\/konfirmasi\/([A-Za-z0-9_-]{20,100})/.exec(msg.body || '')
      if (mm) token = mm[1]
    }
  }
  if (!token) {
    verifyNoMail.add(1)
    bizOk.add(false, { name: 'signup_verify' })
    return
  }
  page('/daftar/konfirmasi/' + token, '', 'signup_confirm_page')
  think(2, 5)
  const v = action('verifySignupAction', [{ token, password: SIGNUP_PASSWORD }], '/daftar/konfirmasi/' + token, '', 'signup_verify')
  if (v.body.indexOf('"status":"ok"') < 0) {
    if (v.body.indexOf('"status":"full"') >= 0) verifyFull.add(1)
    else verifyOther.add(1)
    return
  }
  verifyOk.add(1)
  // Cookie sesi baru: nama berawalan __Host- dan Secure, jadi diambil dari header, bukan dari cookie jar.
  const sc = v.res.headers['Set-Cookie'] || ''
  const mm = /__Host-kira\.session=([^;,\s]+)/.exec(Array.isArray(sc) ? sc.join(';') : sc)
  if (!mm) return
  const cookie = '__Host-kira.session=' + mm[1]
  page('/mulai', cookie, 'onboard_page')
  think(3, 8)
  action('addChildAction', [{ name: 'Anak Uji', grade: 1 + (__VU % 6), avatar: 'fox', pin: ['sun', 'moon', 'star', 'cat'] }], '/mulai', cookie, 'onboard_child')
}

const DIRECT = (path, cookie, name) => http.get(BASE + path, { headers: headers(cookie, { Accept: 'text/html' }), tags: { name }, redirects: 0 })
const oneOf = (arr) => arr[Math.floor(Math.random() * arr.length)]
const unescapeRsc = (t) => (t || '').replace(/\\"/g, '"').replace(/&amp;/g, '&')

/** Tile di /practice: mulai Latihan Bebas lewat rute GET, kerjakan soalnya. */
export function hub() {
  const w = who()
  const hubPage = page('/practice', w.cookie, 'practice_hub')
  expect200(hubPage, 'practice')
  const links = unescapeRsc(hubPage.body).match(/\/practice\/start\?subject=[a-z]+&strand=[A-Za-z]+&n=10&timed=0&style=mixed/g) || []
  think(2, 6)
  if (links.length === 0) return
  const st = DIRECT(oneOf(links), w.cookie, 'practice_start')
  const m = /\/run\/([0-9a-f-]{36})/.exec(st.headers.Location || '')
  check(st, { 'practice mulai': () => Boolean(m) })
  if (!m) return
  answerAttempt(w, m[1], { save: 'save_answer', submit: 'submit' })
  think(2, 6)
}

/** Kartu belajar: daftar dek, satu dek, tandai 8 kartu, selesaikan putaran. */
export function cards() {
  const w = who()
  const list = page('/practice/cards', w.cookie, 'cards_hub')
  expect200(list, 'cards')
  const decks = unescapeRsc(list.body).match(/\/practice\/cards\/[a-z0-9-]{2,61}\?mode=cards/g) || []
  think(2, 5)
  if (decks.length === 0) return
  const path = oneOf(decks)
  const deckId = /cards\/([a-z0-9-]+)\?/.exec(path)[1]
  const deck = page(path, w.cookie, 'cards_deck')
  expect200(deck, 'deck')
  const raw = /"cards":\[(.*?)\],"pool"/.exec(unescapeRsc(deck.body))
  const ids = []
  if (raw) {
    const re = /"id":"([a-z0-9-]{1,61})","front"/g
    let m
    while ((m = re.exec(raw[1])) !== null && ids.length < 8) ids.push(m[1])
  }
  if (ids.length === 0) return
  const results = []
  for (const id of ids) {
    think(2, 5)
    results.push({ cardId: id, knew: Math.random() < 0.7 })
  }
  action('finishCardsAction', [{ deckId, results }], path, w.cookie, 'cards_finish')
  think(2, 5)
}

const TAP_WORDS = ['river', 'forest', 'happy', 'bridge', 'market', 'cloud', 'whisper', 'journey', 'village', 'gentle', 'brave', 'garden']

/** Ruang Baca: rak, buku, bab, simpan tempat baca, catat waktu, ketuk satu kata. Kamus: berkas statis sekali per perangkat, pencarian di perangkat. */
export function reading() {
  const w = who()
  const shelf = page('/reading', w.cookie, 'reading_hub')
  expect200(shelf, 'reading')
  const books = unescapeRsc(shelf.body).match(/href="\/reading\/g\d-[a-z0-9-]+"/g) || []
  think(2, 6)
  if (books.length === 0) return
  const bookId = /reading\/(g\d-[a-z0-9-]+)/.exec(oneOf(books))[1]
  const book = page('/reading/' + bookId, w.cookie, 'reading_book')
  const chapters = unescapeRsc(book.body).match(/\/reading\/g\d-[a-z0-9-]+\/c\d/g) || []
  think(1, 4)
  if (chapters.length === 0) return
  const path = oneOf(chapters.slice(0, 3))
  const chapterId = /(c\d)$/.exec(path)[1]
  const ch = page(path, w.cookie, 'reading_chapter')
  expect200(ch, 'chapter')
  dictFile(w)
  for (let i = 0; i < 3; i++) {
    think(8, 20)
    action('saveReadingProgressAction', [{ bookId, chapterId, sentenceIdx: i * 3 }], path, w.cookie, 'reading_progress')
    if (i === 1) {
      action('logReadingTimeAction', [{ seconds: 30 }], path, w.cookie, 'reading_time')
      dictTap(w, path)
    }
  }
  think(2, 6)
}

let dictDone = false
function dictFile(w) {
  if (dictDone || !ASSETS.dict) return
  dictDone = true
  const r = http.get(BASE + ASSETS.dict, { headers: headers(w.cookie, { Accept: 'application/json' }), tags: { name: 'dict_file' }, responseType: 'none' })
  check(r, { 'kamus 200': (x) => x.status === 200 })
}
function dictTap(w, path) {
  audioFetch(w, 1)
  action('saveWordAction', [{ word: oneOf(TAP_WORDS) }], path, w.cookie, 'dict_save')
}

/** Kamus saja: berkas kamus lalu dua ketukan kata. */
export function dict() {
  const w = who()
  dictFile(w)
  page('/my-words', w.cookie, 'dict_page')
  think(2, 6)
  dictTap(w, '/my-words')
  think(2, 6)
  dictTap(w, '/my-words')
  think(2, 6)
}

/** Kira World: dompet bintang (halaman dunia), toko, beli barang yang belum dimiliki, album kartu. */
export function world() {
  const w = who()
  const home = page('/world', w.cookie, 'world_home')
  expect200(home, 'world')
  think(2, 6)
  const shop = page('/world/shop', w.cookie, 'world_shop')
  expect200(shop, 'shop')
  const text = unescapeRsc(shop.body)
  const bal = /"stars":\{"balance":(\d+)/.exec(text)
  const balance = bal ? Number(bal[1]) : 0
  const items = []
  const re = /"id":"([a-z0-9-]+)","kind":"[a-z]+","name":"[^"]*","price":(\d+),"owned":false/g
  let m
  while ((m = re.exec(text)) !== null) if (Number(m[2]) > 0 && Number(m[2]) <= balance && Number(m[2]) <= 40) items.push(m[1])
  think(3, 8)
  if (items.length > 0 && Math.random() < 0.5) {
    action('buyItemAction', [{ id: oneOf(items) }], '/world/shop', w.cookie, 'world_buy')
    think(2, 5)
  }
  page('/world/cards', w.cookie, 'world_album')
  think(3, 10)
}

/** Tantangan bos: daftar lawan, mulai, setiap jawaban adalah satu giliran, kumpul, hasil. */
export function boss() {
  const w = who()
  const list = page('/world/boss', w.cookie, 'boss_hub')
  expect200(list, 'boss')
  const open = unescapeRsc(list.body).match(/\/world\/boss\/start\?b=[a-z0-9-]+/g) || []
  think(2, 6)
  if (open.length === 0) return
  const st = DIRECT(oneOf(open), w.cookie, 'boss_start')
  const m = /\/run\/([0-9a-f-]{36})/.exec(st.headers.Location || '')
  check(st, { 'bos mulai': () => Boolean(m) })
  if (!m) return
  answerAttempt(w, m[1], { save: 'boss_turn', submit: 'boss_submit' })
  page('/world/boss/result/' + m[1], w.cookie, 'boss_result')
  think(2, 6)
}

/** Tes penempatan: pilih mapel, jawab sampai selesai atau paling banyak 12 soal. Anak yang sudah selesai melihat "tidak ada tes". */
export function placement() {
  const w = who()
  const subject = oneOf(['math', 'english', 'science'])
  const first = page('/placement?subject=' + subject, w.cookie, 'placement_page')
  expect200(first, 'placement')
  let text = unescapeRsc(first.body)
  const run = /"step":\{"runId":"([0-9a-f-]{36})"/.exec(text)
  if (!run) {
    think(2, 6)
    return
  }
  for (let i = 0; i < 12; i++) {
    const it = /"item":\{"ref":"([^"]+)","type":"(\w+)"/.exec(text)
    if (!it) break
    think(4, 12)
    const unsure = Math.random() < 0.2
    const a = action('answerPlacementAction', [Object.assign({ runId: run[1], ref: it[1], unsure }, unsure ? {} : { answer: answerFor(it[2]) })], '/placement?subject=' + subject, w.cookie, 'placement_answer')
    text = unescapeRsc(a.body)
    if (!a.ok || text.indexOf('"done":true') >= 0) break
  }
  think(2, 6)
}

/** Orang tua membuka bantuan dan mengirim pesan (Route Handler, tanpa lampiran). */
export function feedback() {
  const w = who()
  page('/feedback', w.parent, 'feedback_page')
  think(5, 15)
  const r = http.post(
    BASE + '/api/feedback',
    { category: 'saran', subject: 'Uji beban saran', message: 'Pesan uji beban dari keluarga fiktif, tidak perlu dibalas.' },
    { headers: headers(w.parent, { Origin: ORIGIN }), tags: { name: 'feedback_send' } },
  )
  bizOk.add(r.status === 200, { name: 'feedback_send' })
  think(2, 6)
}

/** Dasbor orang tua, halaman anak, dan mengubah satu saklar fitur lalu mengembalikannya. */
export function parentswitch() {
  const w = who()
  const dash = page('/keluarga', w.parent, 'parent_dashboard')
  expect200(dash, 'parent')
  const kids = unescapeRsc(dash.body).match(/\/keluarga\/anak\/[0-9a-f-]{36}/g) || []
  think(4, 10)
  if (kids.length === 0) return
  const path = oneOf(kids)
  const learnerId = path.slice(-36)
  page(path, w.parent, 'parent_child')
  think(4, 10)
  action('parentSaveFeaturesAction', [{ learnerId, features: { 'olympiad-science': false } }], path, w.parent, 'parent_switch')
  think(4, 10)
  action('parentSaveFeaturesAction', [{ learnerId, features: { 'olympiad-science': true } }], path, w.parent, 'parent_switch')
  think(4, 10)
}

/** Campuran seperti hari ramai. Bobot dalam persen per iterasi: kebanyakan anak mengerjakan sesi hari ini, lainnya tersebar di fitur lain. */
export function mixed() {
  const roll = Math.random() * 100
  if (roll < 38) return sessionScenario('any')
  if (roll < 46) return qm()
  if (roll < 51) return quiz()
  if (roll < 59) return today()
  if (roll < 65) return hub()
  if (roll < 70) return cards()
  if (roll < 76) return reading()
  if (roll < 79) return placement()
  if (roll < 86) return world()
  if (roll < 89) return boss()
  if (roll < 92) return parent()
  if (roll < 95) return parentswitch()
  if (roll < 96) return feedback()
  if (roll < 97) return signup()
  if (roll < 99) return pin()
  return signin()
}

export function setup() {
  const h = http.get(BASE + '/api/health', { tags: { name: 'health' } })
  if (h.status !== 200) throw new Error('Proxy atau web belum sehat: ' + h.status)
  if (!families.length) throw new Error('families.json kosong: jalankan seed dulu')
  return { families: families.length, think: THINK }
}
