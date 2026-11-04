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
const outDir = join(here, 'out', name)
mkdirSync(outDir, { recursive: true })

const envText = readFileSync(envFile, 'utf8')
const envVal = (k) => (envText.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const appPw = envVal('KIRA_APP_PASSWORD')

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024, ...opts })
  } catch (e) {
    return ''
  }
}

// --- Cuplikan sumber daya tiap 5 detik ---
const samples = []
let sampling = true
const pct = (s) => Number(String(s).replace('%', '')) || 0
const mib = (s) => {
  const m = /([\d.]+)\s*(KiB|MiB|GiB|B)/.exec(s || '')
  if (!m) return 0
  const v = Number(m[1])
  return m[2] === 'GiB' ? v * 1024 : m[2] === 'MiB' ? v : m[2] === 'KiB' ? v / 1024 : v / 1048576
}
async function sampleLoop() {
  while (sampling) {
    const t = Date.now()
    const stats = sh('docker', ['stats', '--no-stream', '--format', '{{json .}}']).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((s) => s.Name.startsWith(project + '-'))
    const pg = sh('docker', ['exec', `${project}-db-1`, 'psql', '-U', 'postgres', '-d', 'kira', '-tAF', ',', '-c', "select count(*) filter (where state='active'), count(*) filter (where state='idle'), count(*) filter (where state like 'idle in%'), count(*) from pg_stat_activity where datname='kira'"]).trim()
    const [active, idle, idleTx, total] = pg.split(',').map(Number)
    const pgb = sh('docker', ['exec', '-e', `PGPASSWORD=${appPw}`, `${project}-db-1`, 'psql', '-h', 'pgbouncer', '-p', '6432', '-U', 'kira_app', '-d', 'pgbouncer', '-tAF', ',', '-c', 'SHOW POOLS']).trim()
    let cl_waiting = 0
    let sv_active = 0
    for (const row of pgb.split('\n').filter(Boolean)) {
      const c = row.split(',')
      if (c[0] === 'kira') {
        cl_waiting += Number(c[3]) || 0
        sv_active += Number(c[4]) || 0
      }
    }
    samples.push({
      t,
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
  '-e', `SCENARIO=${scenario}`, '-e', `STAGE=${stage}`, '-e', `THINK=${think}`, '-e', `SOAK_MIN=${soakMin}`,
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
  if (!mm) continue
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
const result = {
  name, scenario, stage, think,
  seconds: Math.round((finished - started) / 1000),
  exit: code,
  requests: trend('http_reqs')?.count ?? 0,
  rps: trend('http_reqs')?.rate ?? 0,
  overall: dur ? { p50: dur.med, p95: dur['p(95)'], p99: dur['p(99)'], max: dur.max } : null,
  httpFailRate: rate('http_req_failed'),
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
lines.push('| Endpoint | Jumlah | p50 ms | p95 ms | p99 ms | Galat HTTP | Bisnis OK |')
lines.push('|---|---:|---:|---:|---:|---:|---:|')
for (const r of rows) lines.push(`| ${r.name} | ${r.count} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.p99)} | ${f(r.httpErr * 100, 2)}% | ${r.bizOk === null ? '-' : f(r.bizOk * 100, 1) + '%'} |`)
lines.push('')
lines.push('| Layanan | Replika | CPU puncak (100% = satu inti) | RAM puncak MiB |')
lines.push('|---|---:|---:|---:|')
for (const [k, v] of Object.entries(result.resources)) lines.push(`| ${k} | ${v.replicas} | ${v.cpuPeakPercentOfOneCore}% | ${v.memPeakMiB} |`)
lines.push('')
lines.push(`Postgres: sambungan total puncak ${result.postgres.totalPeak}, aktif puncak ${result.postgres.activePeak}, idle in transaction puncak ${result.postgres.idleInTxPeak}. PgBouncer: klien menunggu puncak ${result.pgbouncer.clientsWaitingPeak}, sambungan server aktif puncak ${result.pgbouncer.serverActivePeak}.`)
writeFileSync(join(outDir, 'result.md'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
