import { spawn } from 'node:child_process'

/**
 * Menjalankan program luar (claude, pdftotext, pdftoppm) dengan batas waktu.
 * Proses dibuat di grup proses sendiri (detached) supaya saat waktu habis atau worker berhenti
 * seluruh pohon prosesnya (proses induk dan semua anaknya) ikut dimatikan.
 */

export type ProcResult = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
  aborted: boolean
  stdoutTruncated: boolean
}

export type ProcOptions = {
  cwd?: string
  env?: Record<string, string>
  input?: string
  timeoutMs: number
  signal?: AbortSignal
  maxStdout?: number
  maxStderr?: number
}

const live = new Set<number>()

function killGroup(pid: number, sig: NodeJS.Signals): void {
  try {
    process.kill(-pid, sig)
  } catch {
    try {
      process.kill(pid, sig)
    } catch {
      // sudah berhenti
    }
  }
}

/** Dipanggil saat worker keluar: jangan tinggalkan proses anak yang masih jalan. */
export function killAllChildren(): void {
  for (const pid of live) killGroup(pid, 'SIGKILL')
  live.clear()
}

export class ProcSpawnError extends Error {
  override name = 'ProcSpawnError'
  constructor(
    readonly command: string,
    readonly code: string | undefined,
  ) {
    super(`Program ${command} tidak bisa dijalankan (${code ?? 'tanpa kode'})`)
  }
}

export function runProcess(command: string, args: string[], opts: ProcOptions): Promise<ProcResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      resolve({ code: null, signal: null, stdout: '', stderr: '', timedOut: false, aborted: true, stdoutTruncated: false })
      return
    }
    const maxOut = opts.maxStdout ?? 32 * 1024 * 1024
    const maxErr = opts.maxStderr ?? 64 * 1024
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? (process.env as Record<string, string>),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })
    let stdout = ''
    let stderr = ''
    let stdoutTruncated = false
    let timedOut = false
    let aborted = false
    let settled = false
    if (child.pid) live.add(child.pid)

    const stop = (why: 'timeout' | 'abort') => {
      if (why === 'timeout') timedOut = true
      else aborted = true
      if (!child.pid) return
      killGroup(child.pid, 'SIGTERM')
      setTimeout(() => child.pid && killGroup(child.pid, 'SIGKILL'), 2000).unref()
    }
    const timer = setTimeout(() => stop('timeout'), opts.timeoutMs)
    const onAbort = () => stop('abort')
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d: string) => {
      if (stdout.length + d.length > maxOut) {
        stdoutTruncated = true
        stdout += d.slice(0, Math.max(0, maxOut - stdout.length))
      } else stdout += d
    })
    child.stderr.on('data', (d: string) => {
      if (stderr.length < maxErr) stderr += d.slice(0, maxErr - stderr.length)
    })
    child.stdin.on('error', () => {
      // EPIPE bila proses keluar sebelum membaca semua input; hasilnya tetap dibaca dari kode keluar.
    })

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      if (child.pid) live.delete(child.pid)
      fn()
    }
    child.on('error', (err: NodeJS.ErrnoException) => finish(() => reject(new ProcSpawnError(command, err.code))))
    child.on('close', (code, signal) =>
      finish(() => resolve({ code, signal, stdout, stderr, timedOut, aborted, stdoutTruncated })),
    )

    if (opts.input !== undefined) child.stdin.end(opts.input)
    else child.stdin.end()
  })
}
