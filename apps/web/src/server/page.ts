import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { AppError } from './errors'
import { log } from './log'

/** Jalankan pemuat data halaman; data tidak ada menjadi 404, sesi habis menjadi halaman masuk. */
export async function load<T>(fn: () => Promise<T>, onUnauth = '/masuk'): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === 'not-found') notFound()
      if (e.code === 'unauthenticated') redirect(onUnauth)
      if (e.code === 'forbidden') notFound()
    }
    if (!(e instanceof AppError)) log.error('halaman gagal dimuat', { error: e })
    throw e
  }
}
