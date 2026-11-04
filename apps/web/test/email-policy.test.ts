import { beforeEach, describe, expect, it } from 'vitest'
import { checkEmail, clearMxCache, domainAcceptsMail, emailKey, isDisposableDomain, isDisposableEmail } from '@/server/signup/email-policy'

const mx = async () => [{ exchange: 'mx.example.test' }]

describe('emailKey', () => {
  it('Gmail: titik dan +tag dibuang, googlemail disamakan', () => {
    expect(emailKey('Nabila.Fifah+kira@Gmail.com')).toBe('nabilafifah@gmail.com')
    expect(emailKey('n.a.b@googlemail.com')).toBe('nab@gmail.com')
  })
  it('domain lain: hanya +tag dibuang, titik dipertahankan', () => {
    expect(emailKey('Ibu.Budi+sd@kantor.co.id')).toBe('ibu.budi@kantor.co.id')
  })
  it('+ di awal tidak membuat bagian lokal kosong', () => {
    expect(emailKey('+a@x.id')).toBe('+a@x.id')
  })
})

describe('domain sekali pakai', () => {
  it('daftar tambahan dan snapshot', () => {
    for (const d of ['temp-mail.org', 'tmailor.com', 'tmail.pk', 'noopmail.org', 'mailinator.com']) expect(isDisposableDomain(d), d).toBe(true)
  })
  it('subdomain ikut diblokir', () => {
    expect(isDisposableDomain('abc.temp-mail.org')).toBe(true)
    expect(isDisposableDomain('a.b.tempmail.internxt.com')).toBe(true)
  })
  it('domain biasa lolos, termasuk yang hanya mirip', () => {
    for (const d of ['gmail.com', 'yahoo.co.id', 'nottemp-mail.org', 'kantor.co.id']) expect(isDisposableDomain(d), d).toBe(false)
  })
  it('isDisposableEmail membaca domain setelah @ terakhir', () => {
    expect(isDisposableEmail('x@tmailor.com')).toBe(true)
    expect(isDisposableEmail('tmailor.com@gmail.com')).toBe(false)
  })
})

describe('MX dan checkEmail', () => {
  beforeEach(() => clearMxCache())
  it('domain tanpa MX ditolak', async () => {
    const none = async () => {
      throw Object.assign(new Error('x'), { code: 'ENODATA' })
    }
    const v = await checkEmail('a@tidak-ada.test', { resolver: none })
    expect(v).toMatchObject({ ok: false, reason: 'no-mx' })
  })
  it('gangguan DNS gagal terbuka', async () => {
    const down = async () => {
      throw Object.assign(new Error('x'), { code: 'ESERVFAIL' })
    }
    expect(await domainAcceptsMail('a.test', down)).toBe(true)
  })
  it('hasil di-cache', async () => {
    let n = 0
    const counting = async () => (n++, [{ exchange: 'mx.test' }])
    await domainAcceptsMail('cache.test', counting)
    await domainAcceptsMail('cache.test', counting)
    expect(n).toBe(1)
  })
  it('bentuk salah, sekali pakai, dan lolos', async () => {
    expect(await checkEmail('bukan-email', { resolver: mx })).toMatchObject({ ok: false, reason: 'shape' })
    expect(await checkEmail('a@tmail.pk', { resolver: mx })).toMatchObject({ ok: false, reason: 'disposable' })
    expect(await checkEmail('Ibu.A+x@Gmail.com', { resolver: mx })).toEqual({ ok: true, key: 'ibua@gmail.com', email: 'ibu.a+x@gmail.com' })
  })
  it('pesan ramah tanpa tanda pisah panjang', async () => {
    const v = await checkEmail('a@tmail.pk', { resolver: mx })
    expect(v.ok ? '' : v.message).not.toMatch(new RegExp(`[${String.fromCharCode(8212, 8211)}]`))
  })
})
