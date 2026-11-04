import { describe, expect, it } from 'vitest'
import { emailSendAllowed } from '@/server/auth/ratelimit'

describe('batas email per alamat', () => {
  it('izinkan 5 per jam per jenis, lalu menahan', () => {
    const e = 'budget-uji@example.test'
    for (let i = 0; i < 5; i++) expect(emailSendAllowed('reset', e)).toBe(true)
    expect(emailSendAllowed('reset', e)).toBe(false)
    expect(emailSendAllowed('reset', 'BUDGET-UJI@example.test')).toBe(false)
    expect(emailSendAllowed('verify', e)).toBe(true)
    expect(emailSendAllowed('reset', 'lain@example.test')).toBe(true)
  })
})
