// Gangguan terjadwal selama uji beban (staging saja): mematikan Valkey, satu replika web, lalu PgBouncer sebentar.
// Pemakaian (jalankan bersamaan dengan run.mjs): node deploy/load/chaos.mjs [project]
import { execFileSync } from 'node:child_process'

const project = process.argv[2] ?? 'kirastg'
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000))
const docker = (...a) => {
  try {
    return execFileSync('docker', a, { encoding: 'utf8', timeout: 60000 }).trim()
  } catch (e) {
    return `gagal: ${e.message}`
  }
}
const log = (m) => console.log(new Date().toISOString(), m)

await wait(100)
log('mematikan valkey 25 detik')
docker('stop', `${project}-valkey-1`)
await wait(25)
docker('start', `${project}-valkey-1`)
log('valkey hidup lagi')
await wait(30)
log('mematikan replika web 2 (docker kill)')
docker('kill', `${project}-web-2`)
await wait(40)
docker('start', `${project}-web-2`)
log('web-2 dihidupkan lagi')
await wait(45)
log('memulai ulang pgbouncer')
docker('restart', `${project}-pgbouncer-1`)
log('selesai')
