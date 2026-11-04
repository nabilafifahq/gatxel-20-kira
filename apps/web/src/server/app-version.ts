import pkg from '../../package.json'

/** Versi aplikasi yang ikut terkirim di pesan Bantuan. KIRA_APP_VERSION bisa diisi saat build; bila kosong dari package.json. */
export function appVersion(): string {
  return (process.env.KIRA_APP_VERSION?.trim() || pkg.version).slice(0, 40)
}
