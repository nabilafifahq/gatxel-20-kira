import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Skema database Kira.
 * - Skema `auth`: identitas, rahasia, sesi, perangkat. Hanya role kira_auth.
 * - Skema `public`: data tenant (org = keluarga). Semua tabel ber-org_id dengan
 *   RLS ENABLE dan FORCE (lihat migrations/0001_roles_rls.sql).
 * Kolom memakai snake_case. Waktu memakai timestamptz, tanggal belajar memakai date (WIB).
 */

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (v) => Buffer.from(v),
  fromDriver: (v) => new Uint8Array(v),
})

const SESSION_ENUM = ['latihan', 'tes', 'paper', 'lesson', 'simulation', 'esmo', 'review', 'quick-maths', 'knowledge', 'english-skill', 'reading'] as const

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const createdAt = () => ts('created_at').notNull().defaultNow()
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`)
const orgId = () => uuid('org_id').notNull()

// ---------------------------------------------------------------------------
// auth

export const auth = pgSchema('auth')

export const userAccount = auth.table(
  'user_account',
  {
    id: id(),
    orgId: orgId(),
    kind: text('kind', { enum: ['adult', 'learner'] }).notNull(),
    role: text('role', { enum: ['tutor', 'guardian', 'learner'] }).notNull(),
    email: text('email'),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    passwordChangedAt: ts('password_changed_at'),
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: ts('locked_until'),
    lastLoginAt: ts('last_login_at'),
    createdAt: createdAt(),
    disabledAt: ts('disabled_at'),
    /** Email ternormalisasi (Gmail tanpa titik dan +tag). Akun lama bernilai null. */
    emailNorm: text('email_norm'),
    /** Bahasa tampilan anak. Akun yang sudah ada saat migrasi 0025 tetap en; anak baru id. */
    uiLang: text('ui_lang', { enum: ['id', 'en'] }).notNull().default('id'),
    /** Orang tua mengizinkan anak mengganti bahasa tampilan sendiri. */
    uiLangSwitch: boolean('ui_lang_switch').notNull().default(false),
    /** Email kabar produk: opsional, bawaan tidak berlangganan. Waktu setuju tetap disimpan sebagai bukti setelah berhenti. */
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    marketingOptInAt: ts('marketing_opt_in_at'),
    marketingWithdrawnAt: ts('marketing_withdrawn_at'),
    marketingNoticeVersion: text('marketing_notice_version'),
    /** Token tautan berhenti satu klik. Hanya ada pada akun yang pernah berlangganan. */
    marketingToken: text('marketing_token'),
  },
  (t) => [
    uniqueIndex('user_account_email_uq').on(sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    index('user_account_org_idx').on(t.orgId),
  ],
)

/** Pendaftar yang belum memverifikasi email. Bukan akun: tidak bisa masuk. Kedaluwarsa 24 jam. */
export const signup = auth.table('signup', {
  id: id(),
  email: text('email').notNull(),
  emailNorm: text('email_norm').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  termsVersion: text('terms_version').notNull(),
  noticeVersion: text('notice_version').notNull(),
  ipHash: text('ip_hash'),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  marketingOptInAt: ts('marketing_opt_in_at'),
  sentCount: integer('sent_count').notNull().default(1),
  lastSentAt: ts('last_sent_at').notNull().defaultNow(),
  /** Ada pendaftaran lain dengan password berbeda: tautan meminta nama dan password baru, tidak langsung mengaktifkan akun. */
  conflict: boolean('conflict').notNull().default(false),
  createdAt: createdAt(),
})

/** Akun Google yang tertaut ke akun orang dewasa. Hanya pengenal sub dari Google; tidak ada token yang disimpan. */
export const googleIdentity = auth.table('google_identity', {
  sub: text('sub').primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => userAccount.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
})

export const betaSeat = auth.table('beta_seat', {
  orgId: uuid('org_id').primaryKey(),
  userId: uuid('user_id').notNull(),
  emailNorm: text('email_norm').notNull().unique(),
  takenAt: ts('taken_at').notNull().defaultNow(),
})

export const waitlist = auth.table('waitlist', {
  id: id(),
  email: text('email').notNull(),
  emailNorm: text('email_norm').notNull().unique(),
  token: text('token').notNull().unique(),
  source: text('source', { enum: ['form', 'signup'] }).notNull().default('form'),
  consentText: text('consent_text').notNull(),
  consentedAt: ts('consented_at').notNull().defaultNow(),
  confirmedAt: ts('confirmed_at'),
  unsubscribedAt: ts('unsubscribed_at'),
  invitedAt: ts('invited_at'),
  convertedAt: ts('converted_at'),
  createdAt: createdAt(),
})

export const learnerSecret = auth.table('learner_secret', {
  userId: uuid('user_id').primaryKey().references(() => userAccount.id, { onDelete: 'cascade' }),
  pinHash: text('pin_hash').notNull(),
  failedPins: integer('failed_pins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const passkey = auth.table(
  'passkey',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => userAccount.id, { onDelete: 'cascade' }),
    publicKey: bytea('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: text('transports').array().notNull().default(sql`'{}'::text[]`),
    deviceType: text('device_type'),
    backedUp: boolean('backed_up').notNull().default(false),
    name: text('name').notNull(),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at'),
  },
  (t) => [index('passkey_user_idx').on(t.userId)],
)

export const session = auth.table(
  'session',
  {
    id: text('id').primaryKey(), // SHA-256 hex dari token; token asli hanya ada di cookie
    userId: uuid('user_id').notNull().references(() => userAccount.id, { onDelete: 'cascade' }),
    orgId: orgId(),
    kind: text('kind', { enum: ['adult', 'learner'] }).notNull(),
    deviceId: uuid('device_id'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    userAgent: text('user_agent'),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const device = auth.table(
  'device',
  {
    id: id(),
    orgId: orgId(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    learnerIds: uuid('learner_ids').array().notNull().default(sql`'{}'::uuid[]`),
    registeredBy: uuid('registered_by').notNull(),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('device_token_uq').on(t.tokenHash), index('device_org_idx').on(t.orgId)],
)

export const resetToken = auth.table('reset_token', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => userAccount.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: createdAt(),
})

export const invite = auth.table('invite', {
  id: id(),
  orgId: orgId(),
  email: text('email').notNull(),
  role: text('role', { enum: ['tutor', 'guardian'] }).notNull(),
  learnerIds: uuid('learner_ids').array().notNull().default(sql`'{}'::uuid[]`),
  tokenHash: text('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').notNull(),
  expiresAt: ts('expires_at').notNull(),
  acceptedAt: ts('accepted_at'),
  revokedAt: ts('revoked_at'),
  createdAt: createdAt(),
})

export const loginAttempt = auth.table(
  'login_attempt',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    key: text('key').notNull(),
    success: boolean('success').notNull(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('login_attempt_key_idx').on(t.key, t.at)],
)

export const webauthnChallenge = auth.table('webauthn_challenge', {
  id: id(),
  userId: uuid('user_id'),
  challenge: text('challenge').notNull(),
  purpose: text('purpose', { enum: ['register', 'login'] }).notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
})

export const mcpToken = auth.table('mcp_token', {
  id: id(),
  orgId: orgId(),
  userId: uuid('user_id').notNull().references(() => userAccount.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: ts('last_used_at'),
  revokedAt: ts('revoked_at'),
})

// ---------------------------------------------------------------------------
// public: org dan orang

export const org = pgTable('org', {
  id: id(),
  name: text('name').notNull(),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
})

export const memberProfile = pgTable(
  'member_profile',
  {
    userId: uuid('user_id').primaryKey(),
    orgId: orgId(),
    name: text('name').notNull(),
    role: text('role', { enum: ['tutor', 'guardian'] }).notNull(),
    email: text('email').notNull(),
    /** Laporan minggu pertama sudah dibuka, untuk daftar langkah di beranda keluarga (migrasi 0027). */
    firstReportSeenAt: ts('first_report_seen_at'),
    createdAt: createdAt(),
    removedAt: ts('removed_at'),
  },
  (t) => [index('member_profile_org_idx').on(t.orgId)],
)

export const learnerProfile = pgTable(
  'learner_profile',
  {
    userId: uuid('user_id').primaryKey(),
    orgId: orgId(),
    name: text('name').notNull(),
    avatar: text('avatar').notNull().default('fox'),
    /** Aksesori avatar yang dipakai; hanya yang sudah didapat dari level jalur XP (migrasi 0007). */
    avatarAccessory: text('avatar_accessory'),
    /** Latar avatar dari peti hadiah harian (migrasi 0010). */
    avatarBackground: text('avatar_background'),
    /** Pilihan tutor: bunyi dan musik di perangkat anak. Bila mati, pilihan perangkat tidak berlaku (migrasi 0010). */
    soundEnabled: boolean('sound_enabled').notNull().default(true),
    musicEnabled: boolean('music_enabled').notNull().default(true),
    grade: smallint('grade').notNull(),
    screenLimitMin: integer('screen_limit_min').notNull().default(60),
    restWeekdays: integer('rest_weekdays').array().notNull().default(sql`'{0}'::int[]`),
    reviewEnabled: boolean('review_enabled').notNull().default(true),
    active: boolean('active').notNull().default(false),
    xp: integer('xp').notNull().default(0),
    startedOn: date('started_on'),
    /** Streak dihitung mulai tanggal ini (diisi saat tutor mengatur ulang streak, migrasi 0013). Kosong berarti sejak started_on. */
    streakSince: date('streak_since'),
    /** Jalur yang dipilih orang tua saat onboarding: recommended, custom, skipped. Kosong berarti belum memilih (migrasi 0027). */
    setupPath: text('setup_path', { enum: ['recommended', 'custom', 'skipped'] }),
    /** Walkthrough pertama anak sudah tampil atau dilewati (migrasi 0027). */
    firstRunDoneAt: ts('first_run_done_at'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('learner_profile_org_idx').on(t.orgId)],
)

export const guardianLink = pgTable(
  'guardian_link',
  {
    orgId: orgId(),
    guardianId: uuid('guardian_id').notNull(),
    learnerId: uuid('learner_id').notNull(),
    relation: text('relation').notNull().default('orang tua'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.guardianId, t.learnerId] })],
)

/** Persetujuan bersifat append-only: setiap perubahan menjadi baris baru. */
export const consentEvent = pgTable(
  'consent_event',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    guardianId: uuid('guardian_id'),
    recordedBy: uuid('recorded_by').notNull(),
    purpose: text('purpose', { enum: ['learning', 'progress-email', 'audio', 'photo', 'ai-drafts'] }).notNull(),
    granted: boolean('granted').notNull(),
    noticeVersion: text('notice_version').notNull(),
    method: text('method', { enum: ['in-app', 'offline'] }).notNull(),
    evidence: text('evidence'),
    createdAt: createdAt(),
  },
  (t) => [index('consent_learner_idx').on(t.learnerId, t.purpose, t.createdAt)],
)

export const deletionRequest = pgTable('deletion_request', {
  id: id(),
  orgId: orgId(),
  learnerId: uuid('learner_id').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  reference: text('reference').notNull(),
  scheduledFor: date('scheduled_for').notNull(),
  createdAt: createdAt(),
  cancelledAt: ts('cancelled_at'),
  executedAt: ts('executed_at'),
})

// ---------------------------------------------------------------------------
// Belajar

export const skillState = pgTable(
  'skill_state',
  {
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    skillId: text('skill_id').notNull(),
    theta: real('theta').notNull().default(0),
    nAnswers: integer('n_answers').notNull().default(0),
    recent: real('recent').array().notNull().default(sql`'{}'::real[]`),
    gate: text('gate', { enum: ['new', 'reteach', 'review', 'mastered'] }).notNull().default('new'),
    stars: smallint('stars').notNull().default(0),
    lastPracticed: date('last_practiced'),
    lessonDoneAt: ts('lesson_done_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.skillId] })],
)

/** Tes penempatan per mapel (migrasi 0020): satu baris per percobaan. */
export const placementRun = pgTable(
  'placement_run',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    status: text('status', { enum: ['ready', 'in_progress', 'done', 'skipped'] }).notNull().default('ready'),
    origin: text('origin', { enum: ['auto', 'parent', 'tutor'] }).notNull().default('auto'),
    startGrade: smallint('start_grade').notNull(),
    theta: real('theta').notNull().default(0),
    answers: jsonb('answers').notNull().default(sql`'[]'::jsonb`),
    current: jsonb('current'),
    result: jsonb('result'),
    createdAt: createdAt(),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('placement_run_learner_idx').on(t.learnerId, t.subject, t.finishedAt)],
)

export const planWeek = pgTable(
  'plan_week',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    weekStart: date('week_start').notNull(),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    /** Template per hari: { "2026-10-14": "light" }. Hari tanpa catatan memakai hari sekolah atau Sabtu (migrasi 0006). */
    dayTemplates: jsonb('day_templates').notNull().default(sql`'{}'::jsonb`),
    publishedAt: ts('published_at'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plan_week_uq').on(t.learnerId, t.weekStart)],
)

export const planSlot = pgTable(
  'plan_slot',
  {
    id: id(),
    orgId: orgId(),
    planWeekId: uuid('plan_week_id').notNull().references(() => planWeek.id, { onDelete: 'cascade' }),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    kind: text('kind', { enum: ['quest', 'bonus'] }).notNull(),
    /** Jenis sesi (migrasi 0006). Slot lama bermode tes atau kertas dipetakan ke tes atau paper. */
    session: text('session', { enum: SESSION_ENUM }).notNull().default('latihan'),
    /** Sesi wajib dihitung untuk streak, sesi opsional tidak. */
    required: boolean('required').notNull().default(true),
    /** Paper tanpa paper tertentu: mini (8 soal, 15 menit) atau penuh. */
    paperKind: text('paper_kind', { enum: ['mini', 'full'] }),
    /** Pilihan tambahan sesi opsional: preset simulasi, jenis tugas English, detik per soal Tes. */
    config: jsonb('config'),
    skillId: text('skill_id'),
    paperId: uuid('paper_id'),
    mode: text('mode', { enum: ['belajar', 'latihan', 'tes', 'kertas'] }).notNull().default('latihan'),
    questionCount: integer('question_count').notNull().default(10),
    /** Slot menggantikan sesi dasar (aturan hari dan template) yang mapel dan jenisnya sama, Wajib atau Opsional (migrasi 0013). */
    base: boolean('base').notNull().default(false),
    /** Sesi dasar yang sama dimatikan untuk hari itu (migrasi 0013). */
    off: boolean('off').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('plan_slot_learner_date_idx').on(t.learnerId, t.date)],
)

/** Aturan hari bawaan per learner (migrasi 0013): preset dan, untuk Kustom, tingkat per hari, mapel, dan sesi. */
export const dayRules = pgTable('day_rules', {
  learnerId: uuid('learner_id').primaryKey(),
  orgId: orgId(),
  preset: text('preset', { enum: ['penuh', 'seimbang', 'ringan', 'kustom'] }).notNull().default('seimbang'),
  rules: jsonb('rules'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Lembar kerja yang dibuat orang tua (migrasi 0022): batas harian per keluarga dan seed untuk membuka ulang lembar yang sama. */
export const worksheet = pgTable(
  'worksheet',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    createdBy: uuid('created_by'),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    skillId: text('skill_id').notNull(),
    itemCount: smallint('item_count').notNull(),
    day: date('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('worksheet_org_day_idx').on(t.orgId, t.day)],
)

/** Kata yang disimpan anak dari Kamus Ketuk (migrasi 0019): bentuk dasar huruf kecil, satu baris per kata per learner. */
export const savedWord = pgTable(
  'saved_word',
  {
    learnerId: uuid('learner_id').notNull(),
    orgId: orgId(),
    word: text('word').notNull(),
    savedAt: ts('saved_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.word] })],
)

export const restDay = pgTable(
  'rest_day',
  {
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    rest: boolean('rest').notNull(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.date] })],
)

export const paper = pgTable(
  'paper',
  {
    id: id(),
    orgId: orgId(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    grade: smallint('grade').notNull(),
    minutes: integer('minutes').notNull(),
    mode: text('mode', { enum: ['latihan', 'tes', 'kertas'] }).notNull(),
    presetId: text('preset_id'),
    itemRefs: text('item_refs').array().notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('paper_code_uq').on(t.orgId, t.code)],
)

export const quest = pgTable(
  'quest',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    /** daily = sesi wajib, extra = sesi opsional dari tutor, bonus = quest bonus lama (tidak dibuat lagi). */
    kind: text('kind', { enum: ['daily', 'bonus', 'extra'] }).notNull(),
    /** Jenis sesi (migrasi 0006). */
    session: text('session', { enum: SESSION_ENUM }).notNull().default('latihan'),
    /** Nomor urut dalam kelompok (mapel, kind, sesi). */
    seq: smallint('seq').notNull().default(0),
    planSlotId: uuid('plan_slot_id'),
    config: jsonb('config'),
    skillId: text('skill_id'),
    paperId: uuid('paper_id'),
    mode: text('mode', { enum: ['belajar', 'latihan', 'tes', 'kertas'] }).notNull(),
    title: text('title').notNull(),
    status: text('status', { enum: ['ready', 'in_progress', 'done'] }).notNull().default('ready'),
    attemptId: uuid('attempt_id'),
    createdAt: createdAt(),
    completedAt: ts('completed_at'),
  },
  (t) => [
    uniqueIndex('quest_day_uq').on(t.learnerId, t.date, t.subject, t.kind, t.session, t.seq),
    uniqueIndex('quest_plan_slot_uq').on(t.planSlotId).where(sql`${t.planSlotId} is not null`),
  ],
)

export const attempt = pgTable(
  'attempt',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    kind: text('kind', { enum: ['quest', 'test', 'simulation', 'review', 'paper', 'lesson', 'esmo-pack', 'esmo-mock'] }).notNull(),
    refId: text('ref_id'),
    mode: text('mode', { enum: ['belajar', 'latihan', 'kilat', 'tes', 'simulasi', 'kertas', 'review'] }).notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    title: text('title').notNull(),
    items: jsonb('items').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    /** Pertama kali dibuka di runner; jam tes berwaktu mulai dari sini (lihat migrasi 0003). */
    openedAt: ts('opened_at'),
    submittedAt: ts('submitted_at'),
    timeLimitS: integer('time_limit_s'),
    elapsedS: integer('elapsed_s').notNull().default(0),
    status: text('status', { enum: ['in_progress', 'submitted', 'needs_grading', 'graded'] }).notNull().default('in_progress'),
    scoreRaw: real('score_raw'),
    scoreMax: real('score_max'),
    scoreScaled: real('score_scaled'),
    xp: integer('xp').notNull().default(0),
    result: jsonb('result'),
    code: text('code'),
    /** Percobaan resmi yang diulang. Kosong untuk percobaan pertama, yang dipakai laporan dan streak (migrasi 0006). */
    retryOf: uuid('retry_of'),
    retryNo: smallint('retry_no').notNull().default(0),
    /** Preset lomba yang menilai paper harian di tablet. */
    presetId: text('preset_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('attempt_learner_idx').on(t.learnerId, t.startedAt),
    uniqueIndex('attempt_code_uq').on(t.orgId, t.code),
    index('attempt_retry_idx').on(t.retryOf).where(sql`${t.retryOf} is not null`),
  ],
)

export const response = pgTable(
  'response',
  {
    id: id(),
    orgId: orgId(),
    attemptId: uuid('attempt_id').notNull().references(() => attempt.id, { onDelete: 'cascade' }),
    learnerId: uuid('learner_id').notNull(),
    position: integer('position').notNull(),
    attemptNo: integer('attempt_no').notNull().default(1),
    itemRef: text('item_ref').notNull(),
    skillId: text('skill_id').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    itemType: text('item_type').notNull(),
    difficulty: smallint('difficulty').notNull(),
    answer: jsonb('answer'),
    status: text('status', { enum: ['correct', 'wrong', 'blank', 'pending'] }).notNull(),
    score: real('score').notNull().default(0),
    maxScore: real('max_score').notNull().default(1),
    hintsUsed: integer('hints_used').notNull().default(0),
    timeMs: integer('time_ms').notNull().default(0),
    flagged: boolean('flagged').notNull().default(false),
    xp: integer('xp').notNull().default(0),
    /** Jawaban dari percobaan ulang sesi; tidak masuk laporan dan penguasaan (migrasi 0006). */
    retry: boolean('retry').notNull().default(false),
    clientId: text('client_id').notNull(),
    answeredAt: ts('answered_at').notNull().defaultNow(),
    gradedBy: uuid('graded_by'),
    gradedAt: ts('graded_at'),
    rubricScores: integer('rubric_scores').array(),
    feedback: text('feedback'),
    aiSuggestion: jsonb('ai_suggestion'),
    mediaId: uuid('media_id'),
  },
  (t) => [
    uniqueIndex('response_client_uq').on(t.clientId),
    uniqueIndex('response_slot_uq').on(t.attemptId, t.position, t.attemptNo),
    index('response_learner_skill_idx').on(t.learnerId, t.skillId, t.answeredAt),
  ],
)

export const reviewCard = pgTable(
  'review_card',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    itemRef: text('item_ref').notNull(),
    skillId: text('skill_id').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    card: jsonb('card').notNull(),
    dueAt: ts('due_at').notNull(),
    retired: boolean('retired').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('review_card_uq').on(t.learnerId, t.itemRef), index('review_card_due_idx').on(t.learnerId, t.dueAt)],
)

export const xpEvent = pgTable(
  'xp_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    ref: text('ref'),
    date: date('date').notNull(),
    /** Jalur XP: belajar (bawaan), hitung (Quick Maths), pengetahuan (Quiz Arena). Migrasi 0007. */
    track: text('track', { enum: ['belajar', 'hitung', 'pengetahuan'] }).notNull().default('belajar'),
    createdAt: createdAt(),
  },
  (t) => [
    index('xp_event_learner_idx').on(t.learnerId, t.date),
    index('xp_event_track_idx').on(t.learnerId, t.track, t.date),
    uniqueIndex('xp_event_arena_once').on(t.learnerId, t.reason, t.ref).where(sql`${t.track} <> 'belajar'`),
    // Migrasi 0004: XP pelajaran sekali per learner, skill, dan tanggal.
    uniqueIndex('xp_event_lesson_once').on(t.learnerId, t.ref, t.date).where(sql`${t.reason} = 'lesson'`),
  ],
)

/** Satu ronde arena (Quick Maths atau Quiz Arena). Soal dibuat ulang dari seed; kunci jawaban tidak disimpan di client. */
export const arenaSession = pgTable(
  'arena_session',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    arena: text('arena', { enum: ['hitung', 'pengetahuan'] }).notNull(),
    mode: text('mode').notNull(),
    missionStep: text('mission_step'),
    topic: text('topic'),
    seed: text('seed').notNull(),
    config: jsonb('config').notNull(),
    date: date('date').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
    answers: jsonb('answers').notNull().default(sql`'[]'::jsonb`),
    total: integer('total').notNull().default(0),
    answered: integer('answered'),
    correct: integer('correct'),
    durationMs: integer('duration_ms'),
    ppm: real('ppm'),
    xp: integer('xp').notNull().default(0),
    result: jsonb('result'),
    createdAt: createdAt(),
  },
  (t) => [
    index('arena_session_learner_idx').on(t.learnerId, t.arena, t.date).where(sql`${t.finishedAt} is not null`),
    index('arena_session_open_idx').on(t.learnerId, t.startedAt).where(sql`${t.finishedAt} is null`),
    uniqueIndex('arena_session_mission_once').on(t.learnerId, t.date, t.missionStep).where(sql`${t.missionStep} is not null and ${t.finishedAt} is not null`),
  ],
)

/** Kemajuan arena per learner: level adaptif, rekor, strategi selesai, fakta yang sudah dikenal. */
export const arenaState = pgTable(
  'arena_state',
  {
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    arena: text('arena', { enum: ['hitung', 'pengetahuan'] }).notNull(),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    /** Ringkasan ronde yang sudah dihapus retensi 90 hari (jumlah ronde, rekor, ronde sempurna). */
    rolled: jsonb('rolled').notNull().default(sql`'{}'::jsonb`),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.arena] })],
)

/** Peti hadiah harian: satu baris per learner per hari, hadiah dipilih di server (migrasi 0010). */
export const dailyChest = pgTable(
  'daily_chest',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    rewardKind: text('reward_kind', { enum: ['sticker', 'background', 'accessory'] }).notNull(),
    rewardId: text('reward_id').notNull(),
    isNew: boolean('is_new').notNull().default(true),
    openedAt: ts('opened_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('daily_chest_day_uq').on(t.learnerId, t.date)],
)

export const dayRecord = pgTable(
  'day_record',
  {
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    questsDone: integer('quests_done').notNull().default(0),
    questsRequired: integer('quests_required').notNull().default(9),
    minutes: integer('minutes').notNull().default(0),
    lastPingAt: ts('last_ping_at'),
    rest: boolean('rest').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.date] })],
)

export const badgeAward = pgTable(
  'badge_award',
  {
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    badgeId: text('badge_id').notNull(),
    awardedAt: ts('awarded_at').notNull().defaultNow(),
    seen: boolean('seen').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.badgeId] })],
)

export const media = pgTable('media', {
  id: id(),
  orgId: orgId(),
  learnerId: uuid('learner_id'),
  kind: text('kind', { enum: ['audio', 'image', 'drawing', 'pdf', 'page', 'figure'] }).notNull(),
  path: text('path').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: createdAt(),
  expiresAt: ts('expires_at'),
  deletedAt: ts('deleted_at'),
})

export const note = pgTable('note', {
  id: id(),
  orgId: orgId(),
  learnerId: uuid('learner_id').notNull(),
  authorId: uuid('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: createdAt(),
})

export const problemReport = pgTable('problem_report', {
  id: id(),
  orgId: orgId(),
  learnerId: uuid('learner_id'),
  reporterId: uuid('reporter_id').notNull(),
  itemRef: text('item_ref').notNull(),
  reason: text('reason').notNull(),
  note: text('note').notNull().default(''),
  reference: text('reference').notNull(),
  status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
  resolvedBy: uuid('resolved_by'),
})

export const competitionEvent = pgTable('competition_event', {
  id: id(),
  orgId: orgId(),
  competitionId: text('competition_id'),
  name: text('name').notNull(),
  subjects: text('subjects').array().notNull(),
  date: date('date'),
  dateIsEstimate: boolean('date_is_estimate').notNull().default(true),
  registrationClose: date('registration_close'),
  presetId: text('preset_id'),
  link: text('link'),
  status: text('status', { enum: ['not-open', 'not-registered', 'registered', 'done', 'skip', 'check'] }).notNull().default('check'),
  learnerIds: uuid('learner_ids').array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Soal privat org: hasil impor paket resmi, draf AI yang disetujui, atau tulisan tutor. Ref: org:<id>. */
export const orgItem = pgTable(
  'org_item',
  {
    id: id(),
    orgId: orgId(),
    skillId: text('skill_id').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    grade: smallint('grade').notNull(),
    body: jsonb('body').notNull(),
    source: text('source', { enum: ['imported', 'ai-draft', 'tutor'] }).notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    collection: text('collection'),
    position: integer('position'),
    createdBy: uuid('created_by').notNull(),
    approvedBy: uuid('approved_by'),
    approvedAt: ts('approved_at'),
    createdAt: createdAt(),
    retiredAt: ts('retired_at'),
  },
  (t) => [index('org_item_skill_idx').on(t.orgId, t.skillId), index('org_item_collection_idx').on(t.orgId, t.collection, t.position)],
)

export const aiJob = pgTable('ai_job', {
  id: id(),
  orgId: orgId(),
  kind: text('kind').notNull(),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: text('error'),
  provider: text('provider'),
  model: text('model'),
  durationMs: integer('duration_ms'),
  usage: jsonb('usage'),
  createdBy: uuid('created_by').notNull(),
  createdAt: createdAt(),
  startedAt: ts('started_at'),
  finishedAt: ts('finished_at'),
})

export const aiDraft = pgTable('ai_draft', {
  id: id(),
  orgId: orgId(),
  jobId: uuid('job_id').notNull().references(() => aiJob.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  body: jsonb('body').notNull(),
  problems: text('problems').array().notNull().default(sql`'{}'::text[]`),
  compareRef: text('compare_ref'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: ts('reviewed_at'),
  orgItemId: uuid('org_item_id'),
  createdAt: createdAt(),
})

export const importBatch = pgTable('import_batch', {
  id: id(),
  orgId: orgId(),
  title: text('title').notNull(),
  subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
  grade: smallint('grade').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  mediaId: uuid('media_id').notNull(),
  status: text('status', { enum: ['uploaded', 'parsing', 'review', 'done', 'failed'] }).notNull().default('uploaded'),
  items: jsonb('items').notNull().default(sql`'[]'::jsonb`),
  pages: text('pages').array().notNull().default(sql`'{}'::text[]`),
  error: text('error'),
  /** Metadata paper lomba (migrasi 0009): id lomba katalog, tahun, bagian (A, B, C, penuh), waktu asli, sumber. */
  competition: text('competition'),
  year: smallint('year'),
  section: text('section'),
  originalMinutes: integer('original_minutes'),
  source: text('source'),
  createdBy: uuid('created_by').notNull(),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const job = pgTable(
  'job',
  {
    id: id(),
    orgId: orgId(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    runAfter: ts('run_after').notNull().defaultNow(),
    lockedAt: ts('locked_at'),
    lastError: text('last_error'),
    result: jsonb('result'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('job_queue_idx').on(t.status, t.runAfter)],
)

export const outboxEmail = pgTable('outbox_email', {
  id: id(),
  orgId: orgId(),
  toAddr: text('to_addr').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  kind: text('kind').notNull(),
  status: text('status', { enum: ['queued', 'sent', 'failed', 'no-smtp'] }).notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: createdAt(),
  sentAt: ts('sent_at'),
})

/** Kotak keluar email yang belum punya org (verifikasi, kabar, undangan kursi). Web menulis, worker mengirim. */
export const publicMail = pgTable('public_mail', {
  id: id(),
  toAddr: text('to_addr').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  kind: text('kind').notNull(),
  listUnsubscribe: text('list_unsubscribe'),
  replyTo: text('reply_to'),
  /** Path relatif di KIRA_DATA_DIR/support. Dihapus setelah terkirim atau setelah masa simpan lampiran. */
  attachmentPath: text('attachment_path'),
  attachmentName: text('attachment_name'),
  attachmentMime: text('attachment_mime'),
  sendAfter: ts('send_after').notNull().defaultNow(),
  status: text('status', { enum: ['queued', 'sent', 'failed', 'no-smtp'] }).notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: createdAt(),
  sentAt: ts('sent_at'),
})

/**
 * Pesan dari halaman Bantuan. Tanpa org: pengirim publik belum punya keluarga. Web hanya boleh INSERT (migrasi 0026),
 * tidak ada role aplikasi yang bisa membacanya; pembacaan lewat email ke tim dan perintah admin.
 */
export const supportTicket = pgTable('support_ticket', {
  id: id(),
  reference: text('reference').notNull().unique(),
  category: text('category', { enum: ['bug', 'saran', 'koreksi', 'kemitraan', 'lainnya'] }).notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  senderEmail: text('sender_email').notNull(),
  accountId: uuid('account_id'),
  accountRole: text('account_role', { enum: ['tutor', 'guardian'] }),
  userAgent: text('user_agent'),
  screen: text('screen'),
  appVersion: text('app_version'),
  pageFrom: text('page_from'),
  ipHash: text('ip_hash'),
  attachmentName: text('attachment_name'),
  attachmentMime: text('attachment_mime'),
  attachmentBytes: integer('attachment_bytes'),
  createdAt: createdAt(),
})

export const weekReport = pgTable(
  'week_report',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    weekStart: date('week_start').notNull(),
    note: text('note'),
    data: jsonb('data').notNull(),
    sentAt: ts('sent_at'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('week_report_uq').on(t.learnerId, t.weekStart)],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: orgId(),
    actorId: uuid('actor_id'),
    actorKind: text('actor_kind').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    meta: jsonb('meta'),
    requestId: text('request_id'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_org_idx').on(t.orgId, t.createdAt)],
)

/** Jadwal worker (backup, laporan mingguan, retensi). Tidak bertenant; hanya kira_worker. */
export const scheduleState = pgTable('schedule_state', {
  name: text('name').primaryKey(),
  lastRunAt: ts('last_run_at'),
  lastResult: text('last_result'),
})


// ---------------------------------------------------------------------------
// Pustaka paper, Buku Salah, program olimpiade, sumber soal (migrasi 0009)

/** Satu bagian paper lomba (atau paper penuh) di pustaka keluarga. Dibuat dari paket impor, disusun dari soal org (ref org:<id>). */
export const paperLibrary = pgTable(
  'paper_library',
  {
    id: id(),
    orgId: orgId(),
    importBatchId: uuid('import_batch_id'),
    origin: text('origin', { enum: ['official', 'kira-made'] }).notNull().default('official'),
    competition: text('competition'),
    year: smallint('year'),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    grade: smallint('grade').notNull(),
    /** A, B, C, dan seterusnya, atau "penuh" untuk paper utuh. */
    section: text('section').notNull().default('penuh'),
    title: text('title').notNull(),
    minutes: integer('minutes').notNull(),
    /** Alamat sumber atau "unggahan tutor". */
    source: text('source').notNull(),
    itemRefs: text('item_refs').array().notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    retiredAt: ts('retired_at'),
  },
  (t) => [
    uniqueIndex('paper_library_batch_uq').on(t.importBatchId).where(sql`${t.importBatchId} is not null`),
    index('paper_library_pick_idx').on(t.orgId, t.subject, t.grade),
  ],
)

/** Paper harian yang sudah dipilih untuk learner: dipakai agar pilihan hari yang sama tetap, dan agar bagian yang sudah keluar tidak dipilih lagi. */
export const paperPick = pgTable(
  'paper_pick',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }).notNull(),
    kind: text('kind', { enum: ['mini', 'full'] }).notNull(),
    libraryId: uuid('library_id'),
    origin: text('origin', { enum: ['official', 'kira-made'] }).notNull(),
    competition: text('competition'),
    year: smallint('year'),
    title: text('title').notNull(),
    minutes: integer('minutes').notNull(),
    source: text('source').notNull(),
    itemRefs: text('item_refs').array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('paper_pick_day_uq').on(t.learnerId, t.date, t.subject, t.kind)],
)

/** Program persiapan olimpiade yang dijalankan untuk satu learner. slot_ids = baris plan_slot yang dibuat program ini. */
export const programRun = pgTable(
  'program_run',
  {
    id: id(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    programId: text('program_id').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: text('status', { enum: ['active', 'cancelled'] }).notNull().default('active'),
    slotIds: uuid('slot_ids').array().notNull().default(sql`'{}'::uuid[]`),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('program_run_learner_idx').on(t.learnerId, t.status)],
)

/** Catatan setiap soal atau PDF yang diambil dari registri sumber. Kunci unik (org, content_hash) membuang yang dobel. */
export const sourceRecord = pgTable(
  'source_record',
  {
    id: id(),
    orgId: orgId(),
    sourceId: text('source_id').notNull(),
    kind: text('kind', { enum: ['item', 'pdf'] }).notNull(),
    externalId: text('external_id'),
    contentHash: text('content_hash').notNull(),
    subject: text('subject', { enum: ['math', 'english', 'science'] }),
    grade: smallint('grade'),
    skillId: text('skill_id'),
    body: jsonb('body').notNull(),
    keyOrigin: text('key_origin', { enum: ['source', 'ai', 'none'] }).notNull().default('none'),
    verify: text('verify', { enum: ['agree', 'disagree', 'ai-only', 'unverified'] }).notNull().default('unverified'),
    status: text('status', { enum: ['fetched', 'unmapped', 'published', 'queued', 'rejected', 'imported'] }).notNull().default('fetched'),
    orgItemId: uuid('org_item_id'),
    aiDraftId: uuid('ai_draft_id'),
    importBatchId: uuid('import_batch_id'),
    license: text('license').notNull(),
    attribution: text('attribution').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('source_record_hash_uq').on(t.orgId, t.contentHash), index('source_record_source_idx').on(t.orgId, t.sourceId, t.status)],
)

/** Status pengambilan per sumber: kapan terakhir, hasilnya, dan penanda lanjut (misalnya offset). */
export const sourceState = pgTable(
  'source_state',
  {
    orgId: orgId(),
    sourceId: text('source_id').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    cursor: jsonb('cursor'),
    lastRunAt: ts('last_run_at'),
    lastResult: text('last_result'),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.sourceId] })],
)

// ---------------------------------------------------------------------------
// Kira World (migrasi 0021)

export const starLedger = pgTable(
  'star_ledger',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: orgId(),
    learnerId: uuid('learner_id').notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    source: text('source').notNull(),
    date: date('date').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('star_ledger_source_uq').on(t.learnerId, t.source), index('star_ledger_day_idx').on(t.learnerId, t.date)],
)

export const worldState = pgTable('world_state', {
  learnerId: uuid('learner_id').primaryKey(),
  orgId: orgId(),
  pet: jsonb('pet'),
  equipped: jsonb('equipped').notNull().default(sql`'{}'::jsonb`),
  progress: jsonb('progress').notNull().default(sql`'{}'::jsonb`),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const worldItem = pgTable(
  'world_item',
  {
    learnerId: uuid('learner_id').notNull(),
    orgId: orgId(),
    itemId: text('item_id').notNull(),
    source: text('source').notNull(),
    acquiredAt: ts('acquired_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.itemId] })],
)

export const worldCard = pgTable(
  'world_card',
  {
    learnerId: uuid('learner_id').notNull(),
    orgId: orgId(),
    cardId: text('card_id').notNull(),
    source: text('source').notNull(),
    acquiredAt: ts('acquired_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.cardId] })],
)

export const contestMedal = pgTable('contest_medal', {
  id: id(),
  orgId: orgId(),
  learnerId: uuid('learner_id').notNull(),
  title: text('title').notNull(),
  medal: text('medal', { enum: ['gold', 'silver', 'bronze', 'honour', 'participant'] }).notNull(),
  earnedOn: date('earned_on').notNull(),
  createdAt: createdAt(),
  removedAt: ts('removed_at'),
})

/** Kode keluarga untuk anak masuk di browser (migrasi 0031). Satu per org; tulisan hanya lewat fungsi definer. */
export const familyCode = pgTable('family_code', {
  orgId: uuid('org_id').primaryKey().references(() => org.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  createdAt: createdAt(),
  rotatedAt: ts('rotated_at'),
})

/** Tabel tenant yang wajib RLS. Dipakai migrasi RLS dan tes. */
export const TENANT_TABLES = [
  'org', 'member_profile', 'learner_profile', 'guardian_link', 'consent_event', 'deletion_request', 'skill_state',
  'plan_week', 'plan_slot', 'rest_day', 'paper', 'quest', 'attempt', 'response', 'review_card', 'xp_event',
  'day_record', 'badge_award', 'media', 'note', 'problem_report', 'competition_event', 'org_item', 'ai_job',
  'ai_draft', 'import_batch', 'job', 'outbox_email', 'week_report', 'audit_log',
  'arena_session', 'arena_state', 'daily_chest',
  'paper_library', 'paper_pick', 'program_run', 'source_record', 'source_state', 'placement_run', 'worksheet',
  'saved_word',
  'star_ledger', 'world_state', 'world_item', 'world_card', 'contest_medal',
  'family_code',
] as const

/** Tabel yang berisi data per learner; dibatasi lagi untuk role learner dan guardian. */
export const LEARNER_SCOPED_TABLES = [
  'skill_state', 'plan_week', 'plan_slot', 'rest_day', 'quest', 'attempt', 'response', 'review_card', 'xp_event',
  'day_record', 'badge_award', 'note', 'week_report', 'placement_run',
  'arena_session', 'arena_state', 'daily_chest',
  'paper_pick', 'worksheet', 'saved_word',
  'star_ledger', 'world_state', 'world_item', 'world_card', 'contest_medal',
] as const

/** Saklar fitur per learner (migrasi 0017). Tanpa baris berarti menyala. */
export const learnerFeature = pgTable(
  'learner_feature',
  {
    learnerId: uuid('learner_id').notNull(),
    orgId: orgId(),
    key: text('key').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.key] })],
)

/** Keadaan FSRS satu kartu belajar per anak (migrasi 0017). Isi dek ada di content/flashcards. */
export const flashcardState = pgTable(
  'flashcard_state',
  {
    learnerId: uuid('learner_id').notNull(),
    orgId: orgId(),
    deckId: text('deck_id').notNull(),
    cardId: text('card_id').notNull(),
    card: jsonb('card').notNull(),
    dueAt: ts('due_at').notNull(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.deckId, t.cardId] }), index('flashcard_state_due_idx').on(t.learnerId, t.dueAt)],
)

// ---------------------------------------------------------------------------
// Ruang Baca (migrasi 0018)

/** Kemajuan per buku: bab dan kalimat terakhir (untuk melanjutkan), selesai bila finished_at terisi. */
export const bookProgress = pgTable(
  'book_progress',
  {
    learnerId: uuid('learner_id').notNull(),
    bookId: text('book_id').notNull(),
    orgId: orgId(),
    chapterId: text('chapter_id').notNull(),
    sentenceIdx: integer('sentence_idx').notNull().default(0),
    startedAt: ts('started_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.bookId] })],
)

/** Bab yang selesai dibaca dan kuisnya dikerjakan. XP hanya sekali per bab. */
export const bookChapter = pgTable(
  'book_chapter',
  {
    learnerId: uuid('learner_id').notNull(),
    bookId: text('book_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    orgId: orgId(),
    quizCount: integer('quiz_count').notNull().default(0),
    bestCorrect: integer('best_correct').notNull().default(0),
    bestTotal: integer('best_total').notNull().default(0),
    xp: integer('xp').notNull().default(0),
    doneAt: ts('done_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.bookId, t.chapterId] })],
)

/** Kuis bab: soal dipilih server (tanpa soal kembar antar kuis), dinilai server saat dikumpulkan. */
export const bookQuiz = pgTable(
  'book_quiz',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnerId: uuid('learner_id').notNull(),
    bookId: text('book_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    orgId: orgId(),
    questionIds: text('question_ids').array().notNull(),
    createdAt: createdAt(),
    submittedAt: ts('submitted_at'),
    correct: integer('correct'),
  },
  (t) => [index('book_quiz_learner_idx').on(t.learnerId, t.bookId, t.chapterId, t.createdAt)],
)

/** Detik membaca per hari (Asia/Jakarta). */
export const readingDay = pgTable(
  'reading_day',
  {
    learnerId: uuid('learner_id').notNull(),
    date: date('date').notNull(),
    orgId: orgId(),
    seconds: integer('seconds').notNull().default(0),
    lastAt: ts('last_at'),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.date] })],
)
