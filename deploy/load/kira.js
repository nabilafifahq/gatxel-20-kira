// Skenario beban Kira (k6). Pemakaian: lihat deploy/load/README.md dan docs/laporan-beban.md.
//   SCENARIO = mixed | latihan | tes | paper | today | audio | qm | quiz | parent | signin | pin | signup | spike
//   STAGE    = smoke | 100 | 300 | 500 | 1000 | soak   (jumlah VU puncak; soak = 100 VU selama SOAK_MIN menit)
//   THINK    = faktor waktu berpikir (bawaan 1); HOLD = detik di puncak (bawaan 180)
// Satu VU adalah satu anak yang sedang aktif (atau satu orang tua). Staging saja, bukan produksi.
import http from 'k6/http'
import { SharedArray } from 'k6/data'
import { check } from 'k6'
import {
  BASE, MAILPIT, THINK, families, action, page, cookieFor, headers, think, uuids, uuidv4, bizOk, expect200,
} from './lib.js'

const SCENARIO = __ENV.SCENARIO || 'mixed'
const STAGE = __ENV.STAGE || 'smoke'
const SOAK_MIN = Number(__ENV.SOAK_MIN || 30)

// ---------------------------------------------------------------------------
// Opsi: tahap dan ambang. Ambang pada submetrik per nama hanya supaya k6 menulis p50/p95/p99 per endpoint ke ringkasan.

const NAMES = [
  'today', 'quest_intro', 'run_page', 'save_answer', 'submit', 'results', 'heartbeat', 'audio_clip', 'audio_clip_cold', 'static_sound',
  'qm_page', 'qm_start', 'qm_answer', 'qm_finish', 'quiz_page', 'quiz_start', 'quiz_answer', 'quiz_finish', 'parent_dashboard', 'parent_privacy',
  'login_page', 'login', 'pin_page', 'pin', 'signup', 'signup_verify', 'signup_page', 'health',
]

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
  // Beberapa klip suara per sesi (cache di Cloudflare di produksi; di sini lewat proxy).
  if (!fast) audioFetch(w, 2)
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

const clips = new SharedArray('clips', () => {
  try {
    return JSON.parse(open('/out/clips.json'))
  } catch {
    return []
  }
})

function audioFetch(w, count) {
  for (let i = 0; i < count; i++) {
    const hash = clips.length ? clips[Math.floor(Math.random() * clips.length)] : '0'.repeat(64)
    const r = http.get(BASE + '/tts/' + hash + '.mp3', { headers: headers(w.cookie, { Accept: 'audio/mpeg' }), tags: { name: 'audio_clip' } })
    check(r, { 'audio 200': (x) => x.status === 200 })
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
  http.post(BASE + '/api/heartbeat', null, { headers: headers(w.cookie, { Origin: BASE }), tags: { name: 'heartbeat' } })
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

/** Daftar dan verifikasi lewat Mailpit. Butuh kode pendaftaran publik (cabang akun) pada image yang diuji. */
export function signup() {
  const stamp = `${__VU}-${__ITER}-${Date.now()}`
  const email = `su${stamp}@loadtest.test`
  page('/daftar', '', 'signup_page')
  think(3, 8)
  const r = action('signUpAction', [{ name: 'Orang Tua Uji', email, password: 'Kira-Uji-Beban-2026!x', consent: true }], '/daftar', '', 'signup')
  if (!r.ok) return
  let token = null
  for (let i = 0; i < 20 && !token; i++) {
    think(0.5, 1)
    const q = http.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`, { tags: { name: 'mailpit' } })
    const msgs = q.status === 200 ? q.json('messages') : []
    if (msgs && msgs.length) {
      const msg = http.get(`${MAILPIT}/api/v1/message/${msgs[0].ID}`, { tags: { name: 'mailpit' } })
      const mm = /\/daftar\/konfirmasi\/([A-Za-z0-9_-]{20,100})/.exec(msg.body || '')
      if (mm) token = mm[1]
    }
  }
  if (!token) {
    bizOk.add(false, { name: 'signup_verify' })
    return
  }
  page('/daftar/konfirmasi/' + token, '', 'signup_page')
  action('verifySignupAction', [{ token }], '/daftar/konfirmasi/' + token, '', 'signup_verify')
}

/** Campuran seperti hari ramai: anak mengerjakan sesi hari ini, ronde Quick Maths dan Quiz, orang tua melihat dasbor, beberapa masuk ulang. */
export function mixed() {
  const roll = Math.random()
  if (roll < 0.5) return sessionScenario('any')
  if (roll < 0.62) return qm()
  if (roll < 0.7) return quiz()
  if (roll < 0.8) return today()
  if (roll < 0.9) return parent()
  if (roll < 0.95) return pin()
  return signin()
}

export function setup() {
  const h = http.get(BASE + '/api/health', { tags: { name: 'health' } })
  if (h.status !== 200) throw new Error('Proxy atau web belum sehat: ' + h.status)
  if (!families.length) throw new Error('families.json kosong: jalankan seed dulu')
  return { families: families.length, think: THINK }
}
