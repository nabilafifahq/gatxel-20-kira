// Menjalankan satu uji beban k6 terhadap staging (project kirastg) sambil mencuplik CPU, RAM, dan sambungan Postgres,
// lalu menulis out/<nama>/result.md dan result.json.
// Pemakaian:
//   node deploy/load/run.mjs --scenario mixed --stage 100 [--think 1] [--name label] [--env C:/kw4/stg/env.staging] [--project kirastg]
// Syarat: stack staging jalan dengan profil loadtest, deploy/load/out/families.json dan actions.json sudah ada (seed.mjs, actions.mjs).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k)
  return i > 0 ? process.argv[i + 1] : d
}
const scenario = arg('scenario', 'mixed')
const stage = arg('stage', 'smoke')
const think = arg('think', '1')
const project = arg('project', 'kirastg')
const envFile = arg('env', 'C:/kw4/stg/env.staging')
const name = arg('name', `${scenario}-${stage}`)
const soakMin = arg('soak-min', '30')
const hold = arg('hold', '180')
const steps = arg('steps', '')
const stepSeconds = arg('step-seconds', '90')
const burstN = arg('burst-n', '130')
const clipOrigin = arg('clip-origin', '1')
const outDir = join(here, 'out', name)
mkdirSync(outDir, { recursive: true })

const envText = readFileSync(envFile, 'utf8')
const envVal = (k) => (envText.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const appPw = envVal('KIRA_APP_PASSWORD')
const valkeyPw = envVal('KIRA_VALKEY_PASSWORD') || envVal('KIRA_INTERNAL_TOKEN')

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024, ...opts })
  } catch {
    return ''
  }
}

// --- Valkey: hit dan miss sejak uji mulai ---
const valkeyStats = () => {
  const t = sh('docker', ['exec', '-e', `REDISCLI_AUTH=${valkeyPw}`, '-e', `VALKEYCLI_AUTH=${valkeyPw}`, `${project}-valkey-1`, 'valkey-cli', 'INFO', 'stats'])
  const num = (k) => Number((new RegExp(k + ':(\\d+)').exec(t) || [])[1] || 0)
  return { hits: num('keyspace_hits'), misses: num('keyspace_misses') }
}
const valkeyStart = valkeyStats()
const sinkCount = () => sh('docker', ['logs', `${project}-tts-sink`], { stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((l) => l.includes('"method"')).length
const sinkStart = sinkCount()

// --- GPU (nvidia-smi tiap 5 detik) dan CPU seluruh PC (typeperf tiap 5 detik) ---
const gpuSamples = []
const hostCpu = []
const lineProc = (cmd, args, onLine) => {
  try {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let buf = ''
    p.stdout.on('data', (d) => {
      buf += d
      const parts = buf.split(/\r?\n/)
      buf = parts.pop()
      for (const l of parts) onLine(l)
    })
    p.on('error', () => {})
    return p
  } catch {
    return null
  }
}
const gpuProc = lineProc('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,power.draw', '--format=csv,noheader,nounits', '-l', '5'], (l) => {
  const [util, mem, power] = l.split(',').map((x) => Number(x))
  if (Number.isFinite(util)) gpuSamples.push({ t: Date.now(), util, mem, power })
})
const cpuProc = lineProc('typeperf', ['\\Processor(_Total)\\% Processor Time', '-si', '5'], (l) => {
  const m = /^"[^"]+","([\d.]+)"/.exec(l)
  if (m) hostCpu.push(Number(m[1]))
})

// --- Cuplikan sumber daya tiap 5 detik ---
const samples = []
let sampling = true
const pct = (s) => Number(String(s).replace('%', '')) || 0
const mib = (s) => {
  const m = /([0-9.]+)s*(KiB|MiB|GiB|kB|MB|GB|B)/.exec(s || '')
  if (!m) return 0
  const unit = { GiB: 1024, MiB: 1, KiB: 1 / 1024, GB: 1000 / 1.048576, MB: 1 / 1.048576, kB: 1 / 1048.576, B: 1 / 1048576 }
  return Number(m[1]) * unit[m[2]]
}
async function sampleLoop() {
  while (sampling) {
    const t = Date.now()
    const allStats = sh('docker', ['stats', '--no-stream', '--format', '{{json .}}']).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    const stats = allStats.filter((s) => s.Name.startsWith(project + '-'))
    const otherCpu = allStats.filter((s) => !s.Name.startsWith(project + '-')).reduce((a, s) => a + pct(s.CPUPerc), 0)
    const proxyTx = mib((allStats.find((s) => s.Name === `${project}-proxy-1`)?.NetIO || '').split('/')[1])
    const pg = sh('docker', ['exec', `${project}-db-1`, 'psql', '-U', 'postgres', '-d', 'kira', '-tAF', ',', '-c', "select count(*) filter (where state='active'), count(*) filter (where state='idle'), count(*) filter (where state like 'idle in%'), count(*) from pg_stat_activity where datname='kira'"]).trim()
    const [active, idle, idleTx, total] = pg.split(',').map(Number)
    const pgb = sh('docker', ['exec', '-e', `PGPASSWORD=${appPw}`, `${project}-db-1`, 'psql', '-h', 'pgbouncer', '-p', '6432', '-U', 'kira_app', '-d', 'pgbouncer', '-tAF', ',', '-c', 'SHOW POOLS']).trim()
    let cl_waiting = 0
    let sv_active = 0
    for (const row of pgb.split('\n').filter(Boolean)) {
      const c = row.split(',')
      // Kolom SHOW POOLS: database, user, cl_active, cl_waiting, cl_active_cancel_req, cl_waiting_cancel_req, sv_active, ...
      if (c[0] === 'kira') {
        cl_waiting += Number(c[3]) || 0
        sv_active += Number(c[6]) || 0
      }
    }
    samples.push({
      t,
      otherCpu,
      proxyTx,
      containers: stats.map((s) => ({ name: s.Name.replace(project + '-', '').replace(/-run-.*$/, '-run'), cpu: pct(s.CPUPerc), mem: mib(s.MemUsage.split('/')[0]) })),
      pg: { active, idle, idleTx, total },
      pgb: { cl_waiting, sv_active },
    })
    await new Promise((r) => setTimeout(r, 5000))
  }
}
const sampler = sampleLoop()

// --- k6 ---
const composeArgs = ['compose', '-p', project, '--env-file', envFile, '--profile', 'loadtest', '--profile', 'loadrun', 'run', '--rm', '-T',
  '-e', `SCENARIO=${scenario}`, '-e', `STAGE=${stage}`, '-e', `THINK=${think}`, '-e', `SOAK_MIN=${soakMin}`, '-e', `HOLD=${hold}`, '-e', `STEPS=${steps}`, '-e', `STEP_SECONDS=${stepSeconds}`, '-e', `BURST_N=${burstN}`, '-e', `CLIP_ORIGIN=${clipOrigin}`,
  'k6', 'run', `--summary-export=/out/${name}/summary.json`, '/load/kira.js']
console.log('docker', composeArgs.join(' '))
const started = Date.now()
const code = await new Promise((resolve) => {
  const p = spawn('docker', composeArgs, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, KIRA_LOAD_OUT: join(here, 'out').replace(/\\/g, '/') } })
  let log = ''
  p.stdout.on('data', (d) => (log += d))
  p.stderr.on('data', (d) => (log += d))
  p.on('close', (c) => {
    writeFileSync(join(outDir, 'k6.log'), log)
    resolve(c)
  })
})
const finished = Date.now()
sampling = false
await sampler
gpuProc?.kill()
cpuProc?.kill()
const valkeyEnd = valkeyStats()
const sinkEnd = sinkCount()

// --- Ringkasan ---
const summaryPath = join(outDir, 'summary.json')
if (!existsSync(summaryPath)) {
  console.error('k6 tidak menulis summary.json, lihat', join(outDir, 'k6.log'))
  process.exit(1)
}
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
const m = summary.metrics
const trend = (key) => m[key] ?? null
const rate = (key) => {
  const r = m[key]
  if (!r) return null
  return r.value ?? r.rate ?? (r.passes + r.fails > 0 ? r.passes / (r.passes + r.fails) : 0)
}
const rows = []
for (const key of Object.keys(m)) {
  const mm = /^http_req_duration\{name:([^}]+)\}$/.exec(key)
  if (!mm || mm[1].includes(',')) continue
  const t = m[key]
  if (!t.count) continue
  const failed = m[`http_req_failed{name:${mm[1]}}`]
  const fr = failed ? (failed.value ?? failed.rate ?? 0) : 0
  const biz = m[`kira_business_ok{name:${mm[1]}}`]
  rows.push({ name: mm[1], count: t.count, p50: t.med, p95: t['p(95)'], p99: t['p(99)'], max: t.max, httpErr: fr, bizOk: biz ? (biz.value ?? biz.rate) : null })
}
rows.sort((a, b) => b.count - a.count)
const dur = trend('http_req_duration')
const peak = (f) => samples.reduce((a, s) => Math.max(a, f(s) || 0), 0)
const peakOf = (a, k) => a.reduce((x, s) => Math.max(x, s[k] || 0), 0)
const containers = {}
for (const s of samples) for (const c of s.containers) {
  const k = c.name.replace(/-\d+$/, '')
  containers[k] ??= { cpuPeak: 0, memPeak: 0, n: new Set() }
  containers[k].n.add(c.name)
}
for (const s of samples) {
  const agg = {}
  for (const c of s.containers) {
    const k = c.name.replace(/-\d+$/, '')
    agg[k] ??= { cpu: 0, mem: 0 }
    agg[k].cpu += c.cpu
    agg[k].mem += c.mem
  }
  for (const [k, v] of Object.entries(agg)) {
    containers[k].cpuPeak = Math.max(containers[k].cpuPeak, v.cpu)
    containers[k].memPeak = Math.max(containers[k].memPeak, v.mem)
  }
}
const txSeries = samples.map((s) => ({ t: s.t, tx: s.proxyTx })).filter((s) => s.tx > 0)
let txPeak = 0
for (let i = 1; i < txSeries.length; i++) {
  const dt = (txSeries[i].t - txSeries[i - 1].t) / 1000
  if (dt > 0) txPeak = Math.max(txPeak, ((txSeries[i].tx - txSeries[i - 1].tx) * 8 * 1.048576) / dt)
}
const hits = valkeyEnd.hits - valkeyStart.hits
const misses = valkeyEnd.misses - valkeyStart.misses
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const stepRows = []
for (const n of steps.split(',').filter(Boolean)) {
  const d = m[`http_req_duration{step:${n}}`]
  if (!d || !d.count) continue
  const fr = m[`http_req_failed{step:${n}}`]
  const biz = m[`kira_business_ok{step:${n}}`]
  const td = m[`http_req_duration{name:today,step:${n}}`]
  const sv = m[`http_req_duration{name:save_answer,step:${n}}`]
  stepRows.push({ todayP95: td?.['p(95)'] ?? null, saveP95: sv?.['p(95)'] ?? null, vus: Number(n), count: d.count, p50: d.med, p95: d['p(95)'], p99: d['p(99)'], httpErr: fr ? (fr.value ?? fr.rate ?? 0) : 0, bizOk: biz ? (biz.value ?? biz.rate ?? null) : null })
}
const result = {
  name, scenario, stage, think,
  clipBytes: trend('kira_clip_bytes')?.count ?? 0,
  clipCount: trend('kira_clip_count')?.count ?? 0,
  toolBytes: trend('kira_tool_bytes')?.count ?? 0,
  signup: Object.fromEntries(['kira_signup_started', 'kira_signup_rejected_full', 'kira_signup_rejected_other', 'kira_verify_ok', 'kira_verify_full', 'kira_verify_other', 'kira_verify_no_mail'].map((k) => [k.replace('kira_', ''), trend(k)?.count ?? 0])),
  valkey: { hits, misses, hitRate: hits + misses > 0 ? hits / (hits + misses) : null },
  proxyTxPeakMbps: txPeak,
  gpu: { utilPeak: peakOf(gpuSamples, 'util'), utilAvg: avg(gpuSamples.map((s) => s.util)), memMin: Math.min(...gpuSamples.map((s) => s.mem)), memMax: peakOf(gpuSamples, 'mem'), powerPeak: peakOf(gpuSamples, 'power'), samples: gpuSamples.length },
  hostCpu: { avg: avg(hostCpu), peak: Math.max(0, ...hostCpu), samples: hostCpu.length },
  otherContainersCpuPeak: Math.round(peak((s) => s.otherCpu)),
  ttsSinkRequests: sinkEnd - sinkStart,
  steps: stepRows,
  seconds: Math.round((finished - started) / 1000),
  exit: code,
  requests: trend('http_reqs')?.count ?? 0,
  rps: trend('http_reqs')?.rate ?? 0,
  overall: dur ? { p50: dur.med, p95: dur['p(95)'], p99: dur['p(99)'], max: dur.max } : null,
  httpFailRate: rate('http_req_failed'),
  bytesReceived: trend('data_received')?.count ?? 0,
  downMbps: ((trend('data_received')?.rate ?? 0) * 8) / 1e6,
  bizOkRate: rate('kira_business_ok'),
  vusMax: trend('vus_max')?.max ?? trend('vus')?.max ?? null,
  endpoints: rows,
  resources: Object.fromEntries(Object.entries(containers).map(([k, v]) => [k, { replicas: v.n.size, cpuPeakPercentOfOneCore: Math.round(v.cpuPeak), memPeakMiB: Math.round(v.memPeak) }])),
  postgres: { activePeak: peak((s) => s.pg.active), idlePeak: peak((s) => s.pg.idle), idleInTxPeak: peak((s) => s.pg.idleTx), totalPeak: peak((s) => s.pg.total) },
  pgbouncer: { clientsWaitingPeak: peak((s) => s.pgb.cl_waiting), serverActivePeak: peak((s) => s.pgb.sv_active) },
}
writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 1))
writeFileSync(join(outDir, 'samples.json'), JSON.stringify(samples))

const f = (v, d = 0) => (v === null || v === undefined ? '-' : Number(v).toFixed(d))
const lines = []
lines.push(`### ${name}: ${scenario}, ${stage === 'soak' ? `soak ${soakMin} menit` : stage + ' VU'}, think ${think}`)
lines.push('')
lines.push(`Durasi ${result.seconds} detik, ${result.requests} permintaan (${f(result.rps, 1)} per detik), galat HTTP ${f((result.httpFailRate ?? 0) * 100, 2)}%, transaksi bisnis berhasil ${f((result.bizOkRate ?? 1) * 100, 2)}%. Semua endpoint: p50 ${f(result.overall?.p50)} ms, p95 ${f(result.overall?.p95)} ms, p99 ${f(result.overall?.p99)} ms.`)
lines.push('')
lines.push(`Data keluar dari proxy: ${f(result.bytesReceived / 1e6, 1)} MB, rata-rata ${f(result.downMbps, 2)} Mbps (batas unggah rumah sekitar 29 Mbps).`)
lines.push('')
lines.push('| Endpoint | Jumlah | p50 ms | p95 ms | p99 ms | Galat HTTP | Bisnis OK |')
lines.push('|---|---:|---:|---:|---:|---:|---:|')
for (const r of rows) lines.push(`| ${r.name} | ${r.count} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.p99)} | ${f(r.httpErr * 100, 2)}% | ${r.bizOk === null ? '-' : f(r.bizOk * 100, 1) + '%'} |`)
lines.push('')
lines.push('| Layanan | Replika | CPU puncak (100% = satu inti) | RAM puncak MiB |')
lines.push('|---|---:|---:|---:|')
for (const [k, v] of Object.entries(result.resources)) lines.push(`| ${k} | ${v.replicas} | ${v.cpuPeakPercentOfOneCore}% | ${v.memPeakMiB} |`)
lines.push('')
lines.push(`Postgres: sambungan total puncak ${result.postgres.totalPeak}, aktif puncak ${result.postgres.activePeak}, idle in transaction puncak ${result.postgres.idleInTxPeak}. PgBouncer: klien menunggu puncak ${result.pgbouncer.clientsWaitingPeak}, sambungan server aktif puncak ${result.pgbouncer.serverActivePeak}.`)
lines.push('')
lines.push(`Valkey: hit ${hits}, miss ${misses}, rasio hit ${result.valkey.hitRate === null ? '-' : f(result.valkey.hitRate * 100, 1) + '%'}. Proxy keluar: puncak ${f(txPeak, 1)} Mbps. Klip: ${result.clipCount} berkas, ${f(result.clipBytes / 1e6, 1)} MB.`)
lines.push(`GPU: pakai puncak ${result.gpu.utilPeak}%, rata-rata ${f(result.gpu.utilAvg, 1)}%, memori ${result.gpu.memMin} sampai ${result.gpu.memMax} MiB, daya puncak ${f(result.gpu.powerPeak, 0)} W (${result.gpu.samples} cuplikan). Permintaan yang sampai ke penjaga TTS: ${result.ttsSinkRequests}.`)
lines.push(`CPU seluruh PC: rata-rata ${f(result.hostCpu.avg, 0)}%, puncak ${f(result.hostCpu.peak, 0)}% (${result.hostCpu.samples} cuplikan). Kontainer lain (bukan staging) puncak ${result.otherContainersCpuPeak}% satu inti.`)
if (Object.values(result.signup).some(Boolean)) lines.push('Pendaftaran: ' + JSON.stringify(result.signup))
if (stepRows.length) {
  lines.push('')
  lines.push('| Anak tangga (VU) | Permintaan | p50 ms | p95 ms | p99 ms | Galat HTTP | Bisnis OK | Today p95 | Simpan jawaban p95 |')
  lines.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const s of stepRows) lines.push(`| ${s.vus} | ${s.count} | ${f(s.p50)} | ${f(s.p95)} | ${f(s.p99)} | ${f(s.httpErr * 100, 2)}% | ${s.bizOk === null ? '-' : f(s.bizOk * 100, 1) + '%'} | ${f(s.todayP95)} | ${f(s.saveP95)} |`)
}
writeFileSync(join(outDir, 'result.md'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
