import pkg from '../../package.json'

/** Versi aplikasi yang ikut terkirim di pesan Bantuan. */
export function appVersion(): string {
  return pkg.version
}
