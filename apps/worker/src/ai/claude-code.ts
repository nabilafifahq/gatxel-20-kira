import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JobError, UsageLimitError, abortError, durationId } from '../errors'
import { ProcSpawnError, runProcess } from '../proc'
import { extractJson } from './json'
import type { AiProvider, AiRunInput, AiRunOutput, AiTier } from './types'

/**
 * Provider `claude-code`: menjalankan Claude Code CLI dalam mode print, login lewat
 * CLAUDE_CODE_OAUTH_TOKEN (hasil `claude setup-token`, langganan Claude Max).
 *
 * Flag diverifikasi terhadap @anthropic-ai/claude-code 2.1.295 (`claude --help` dan uji dengan
 * server Messages API tiruan):
 * - `--tools ""` mematikan semua tool bawaan. Dengan `--json-schema`, satu-satunya tool yang tersisa
 *   adalah StructuredOutput (init event: tools = ["StructuredOutput"]).
 * - `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` tanpa server MCP.
 * - `--setting-sources ""` tidak memuat setelan user, project, atau local.
 * - `--no-session-persistence` tidak menyimpan transkrip.
 * - `--input-format stream-json` menerima pesan user berisi blok image base64 (diteruskan ke API
 *   sebagai blok image). `--output-format stream-json` butuh `--verbose` di mode print.
 * - Batas pemakaian langganan muncul sebagai event rate_limit_event (status rejected, resetsAt detik)
 *   dan result is_error dengan api_error_status 429 tanpa percobaan ulang.
 * `--bare` tidak dipakai karena mode itu hanya membaca ANTHROPIC_API_KEY dan mengabaikan token OAuth.
 * Proses berjalan di folder kosong dengan HOME sementara dan env minimal, jadi URL database dan
 * rahasia lain tidak pernah sampai ke proses Claude, dan CLAUDE.md tidak ikut terbaca.
 */

export const CLAUDE_TOKEN_MISSING =
  'Token Claude belum diisi. Jalankan claude setup-token di komputer yang login ke akun Claude Max, isi CLAUDE_CODE_OAUTH_TOKEN di .env, lalu mulai ulang worker.'

export function claudeArgs(opts: { model: string; system: string; schema: Record<string, unknown> }): string[] {
  return [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', opts.model,
    '--system-prompt', opts.system,
    '--json-schema', JSON.stringify(opts.schema),
    '--tools', '',
    '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}',
    '--setting-sources', '',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
  ]
}

const PASS_THROUGH = ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE']

/** Env minimal untuk proses claude. Tidak ada DATABASE_URL, SMTP_URL, atau token internal. */
export function claudeChildEnv(base: NodeJS.ProcessEnv, home: string, token: string, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {
    PATH: base.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: home,
    LANG: 'C.UTF-8',
    CLAUDE_CODE_OAUTH_TOKEN: token,
    CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_ERROR_REPORTING: '1',
    CLAUDE_CODE_MAX_RETRIES: '2',
  }
  for (const k of PASS_THROUGH) {
    const v = base[k]
    if (v) env[k] = v
  }
  return { ...env, ...extra }
}

/** Satu baris stdin stream-json: teks prompt lalu gambar sebagai blok image base64. */
export function claudeUserMessage(prompt: string, images: AiRunInput['images'] = []): string {
  const content: unknown[] = [{ type: 'text', text: prompt }]
  for (const img of images) content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.base64 } })
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`
}

export type ClaudeOutcome =
  | { kind: 'ok'; json: unknown; usage: Record<string, unknown>; model: string }
  | { kind: 'limit'; resetAt: Date | null }
  | { kind: 'error'; message: string; retryable: boolean; status: number | null; detail: string }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)

const LIMIT_TEXT = /hit your (?:\w+ )?limit|usage limit|rate limit|limiting requests/i
const AUTH_TEXT = /authenticat|not logged in|oauth|invalid (?:api key|bearer)|\/login/i
const MODEL_TEXT = /model[\s\S]{0,80}(not found|invalid|does not exist|not available|unknown|may not exist)/i

/** Tafsirkan keluaran stream-json CLI. Murni, diuji dengan contoh keluaran nyata CLI 2.1.295. */
export function interpretClaudeStream(stdout: string, exitCode: number | null, requestedModel: string): ClaudeOutcome {
  let result: Obj | null = null
  let initModel: string | null = null
  let rejected: Obj | null = null
  for (const line of stdout.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    let msg: unknown
    try {
      msg = JSON.parse(t)
    } catch {
      continue
    }
    if (!isObj(msg)) continue
    if (msg.type === 'result') result = msg
    else if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.model === 'string') initModel = msg.model
    else if (msg.type === 'rate_limit_event' && isObj(msg.rate_limit_info) && msg.rate_limit_info.status === 'rejected') rejected = msg.rate_limit_info
  }
  const resetAt = (() => {
    const s = rejected?.resetsAt
    return typeof s === 'number' && Number.isFinite(s) && s > 0 ? new Date(s * 1000) : null
  })()

  if (!result) {
    if (rejected) return { kind: 'limit', resetAt }
    return { kind: 'error', message: `Claude CLI berhenti tanpa hasil (kode keluar ${exitCode ?? 'tidak ada'}).`, retryable: true, status: null, detail: '' }
  }

  const status = typeof result.api_error_status === 'number' ? result.api_error_status : null
  const text = typeof result.result === 'string' ? result.result : ''
  const detail = [text, Array.isArray(result.errors) ? result.errors.join('; ') : ''].filter(Boolean).join(' | ').slice(0, 300)
  if (result.is_error === true || result.subtype !== 'success') {
    if (status === 429 || result.api_error === 'usage_limit_reached' || rejected || LIMIT_TEXT.test(text)) return { kind: 'limit', resetAt }
    if (status === 401 || status === 403 || AUTH_TEXT.test(text)) {
      return { kind: 'error', status, detail, retryable: false, message: 'Token Claude ditolak. Buat token baru dengan claude setup-token, ganti CLAUDE_CODE_OAUTH_TOKEN di .env, lalu mulai ulang worker.' }
    }
    if (status === 404 || (status === 400 && MODEL_TEXT.test(text))) {
      return { kind: 'error', status, detail, retryable: false, message: 'Model Claude tidak dikenal. Cek CLAUDE_MODEL_AUTHOR dan CLAUDE_MODEL_FAST di .env.' }
    }
    if (result.subtype === 'error_max_structured_output_retries') {
      return { kind: 'error', status, detail, retryable: true, message: 'Jawaban Claude tidak sesuai format JSON yang diminta.' }
    }
    if (status !== null && status >= 500) {
      return { kind: 'error', status, detail, retryable: true, message: `Server Claude sedang bermasalah (kode ${status}).` }
    }
    return { kind: 'error', status, detail, retryable: true, message: status ? `Claude gagal menjawab (kode ${status}).` : 'Claude gagal menjawab.' }
  }

  const json = result.structured_output !== undefined && result.structured_output !== null ? result.structured_output : extractJson(text)
  if (json === undefined) return { kind: 'error', status, detail: '', retryable: true, message: 'Jawaban Claude bukan JSON yang bisa dibaca.' }
  const u = isObj(result.usage) ? result.usage : {}
  const usedModel = isObj(result.modelUsage) ? Object.keys(result.modelUsage)[0] : undefined
  return {
    kind: 'ok',
    json,
    model: usedModel ?? initModel ?? requestedModel,
    usage: {
      inputTokens: u.input_tokens ?? null,
      outputTokens: u.output_tokens ?? null,
      cacheReadInputTokens: u.cache_read_input_tokens ?? null,
      cacheCreationInputTokens: u.cache_creation_input_tokens ?? null,
      costUsdEstimate: result.total_cost_usd ?? null,
      numTurns: result.num_turns ?? null,
      durationApiMs: result.duration_api_ms ?? null,
    },
  }
}

export type ClaudeCodeOptions = {
  bin: string
  token: string | undefined
  modelAuthor: string
  modelFast: string
  /** Folder kerja; bawaan <tmp>/kira-claude. */
  baseDir?: string
  /** Hanya untuk tes (misalnya ANTHROPIC_BASE_URL ke server tiruan). Tidak dibaca dari .env. */
  extraEnv?: Record<string, string>
  baseEnv?: NodeJS.ProcessEnv
}

export class ClaudeCodeProvider implements AiProvider {
  readonly name = 'claude-code' as const
  readonly label = 'Claude'
  readonly model: string
  readonly ready: boolean
  readonly notReadyReason: string | null
  private readonly baseDir: string

  constructor(private readonly opts: ClaudeCodeOptions) {
    this.model = opts.modelAuthor
    this.ready = Boolean(opts.token)
    this.notReadyReason = opts.token ? null : CLAUDE_TOKEN_MISSING
    this.baseDir = opts.baseDir ?? join(tmpdir(), 'kira-claude')
  }

  modelFor(tier: AiTier): string {
    return tier === 'fast' ? this.opts.modelFast : this.opts.modelAuthor
  }

  private async dirs(): Promise<{ home: string; work: string }> {
    const home = join(this.baseDir, 'home')
    const work = join(this.baseDir, 'work')
    await mkdir(home, { recursive: true, mode: 0o700 })
    // Folder kerja selalu kosong: tidak ada berkas yang bisa terbaca sebagai konteks.
    await rm(work, { recursive: true, force: true })
    await mkdir(work, { recursive: true, mode: 0o700 })
    return { home, work }
  }

  async describe(): Promise<string | null> {
    try {
      const { home, work } = await this.dirs()
      const r = await runProcess(this.opts.bin, ['--version'], {
        cwd: work,
        env: claudeChildEnv(this.opts.baseEnv ?? process.env, home, this.opts.token ?? '', this.opts.extraEnv),
        timeoutMs: 20_000,
      })
      const v = /(\d+\.\d+\.\d+)/.exec(r.stdout)
      return v ? `Claude Code CLI ${v[1]}` : null
    } catch {
      return null
    }
  }

  async run(input: AiRunInput): Promise<AiRunOutput> {
    if (!this.opts.token) throw new JobError(CLAUDE_TOKEN_MISSING, { retryable: false })
    const model = this.modelFor(input.tier ?? 'author')
    const { home, work } = await this.dirs()
    const started = Date.now()
    let r
    try {
      r = await runProcess(this.opts.bin, claudeArgs({ model, system: input.system, schema: input.jsonSchema }), {
        cwd: work,
        env: claudeChildEnv(this.opts.baseEnv ?? process.env, home, this.opts.token, this.opts.extraEnv),
        input: claudeUserMessage(input.prompt, input.images),
        timeoutMs: input.timeoutMs,
        ...(input.signal ? { signal: input.signal } : {}),
      })
    } catch (e) {
      if (e instanceof ProcSpawnError) {
        throw new JobError(`Program ${this.opts.bin} tidak ditemukan di server worker. Pasang Claude Code CLI di image worker atau isi CLAUDE_BIN.`, { retryable: false, cause: e })
      }
      throw e
    }
    if (r.aborted) throw abortError()
    if (r.timedOut) throw new JobError(`Claude tidak menjawab dalam ${durationId(input.timeoutMs)}.`, { retryable: true })
    const outcome = interpretClaudeStream(r.stdout, r.code, model)
    if (outcome.kind === 'limit') throw new UsageLimitError(outcome.resetAt, this.label)
    if (outcome.kind === 'error') {
      const err = new JobError(outcome.message, { retryable: outcome.retryable })
      // Yang dicatat hanya pesan kesalahan CLI; isi prompt dan jawaban tidak pernah masuk log.
      Object.assign(err, { providerDetail: outcome.detail, providerStderr: r.stderr.slice(0, 300) })
      throw err
    }
    return { json: outcome.json, usage: outcome.usage, model: outcome.model, durationMs: Date.now() - started }
  }
}
