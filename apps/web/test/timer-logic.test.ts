import { describe, expect, it } from 'vitest'
import {
  RING_CIRCUMFERENCE,
  URGENT_SECONDS,
  formatClock,
  isUrgent,
  remainingFraction,
  ringOffset,
  smoothRemaining,
  spokenDuration,
  timerSound,
  toneForFraction,
} from '@/components/learner/timer-logic'

describe('formatClock dan spokenDuration', () => {
  it('menulis menit dan detik', () => {
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(9, true)).toBe('00:09')
    expect(formatClock(-3)).toBe('0:00')
    expect(spokenDuration(61)).toBe('1 minute 1 second')
    expect(spokenDuration(0)).toBe('0 seconds')
  })
})

describe('warna cincin', () => {
  it('hijau di atas 50 persen, kuning sampai 20 persen, merah di bawahnya', () => {
    expect(toneForFraction(1)).toBe('green')
    expect(toneForFraction(0.51)).toBe('green')
    expect(toneForFraction(0.5)).toBe('amber')
    expect(toneForFraction(0.2)).toBe('amber')
    expect(toneForFraction(0.19)).toBe('red')
    expect(toneForFraction(0)).toBe('red')
  })
  it('menghitung bagian sisa waktu dalam batas 0 sampai 1', () => {
    expect(remainingFraction(30, 60)).toBe(0.5)
    expect(remainingFraction(90, 60)).toBe(1)
    expect(remainingFraction(-5, 60)).toBe(0)
    expect(remainingFraction(10, 0)).toBe(0)
  })
  it('sprint 60 detik: kuning dari detik ke 30, merah di bawah 12 detik', () => {
    expect(toneForFraction(remainingFraction(31, 60))).toBe('green')
    expect(toneForFraction(remainingFraction(30, 60))).toBe('amber')
    expect(toneForFraction(remainingFraction(12, 60))).toBe('amber')
    expect(toneForFraction(remainingFraction(11, 60))).toBe('red')
  })
})

describe('busur cincin', () => {
  it('penuh tanpa offset dan kosong dengan offset sepanjang lingkaran', () => {
    expect(ringOffset(1)).toBe(0)
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE)
    expect(ringOffset(0.25)).toBeCloseTo(RING_CIRCUMFERENCE * 0.75)
    expect(ringOffset(2)).toBe(0)
  })
  it('turun mulus dari detik ini ke detik berikutnya lalu menunggu', () => {
    expect(smoothRemaining(10, 0)).toBe(10)
    expect(smoothRemaining(10, 500)).toBe(9.5)
    expect(smoothRemaining(10, 1000)).toBe(9)
    expect(smoothRemaining(10, 4000)).toBe(9)
    expect(smoothRemaining(0, 300)).toBe(0)
  })
})

describe('10 detik terakhir', () => {
  it('mendesak hanya dari 10 sampai 1 detik dan tidak saat tenang', () => {
    expect(URGENT_SECONDS).toBe(10)
    expect(isUrgent(11, false)).toBe(false)
    expect(isUrgent(10, false)).toBe(true)
    expect(isUrgent(1, false)).toBe(true)
    expect(isUrgent(0, false)).toBe(false)
    expect(isUrgent(5, true)).toBe(false)
  })
  it('tik tiap detik di jendela terakhir dan bunyi habis di nol', () => {
    expect(timerSound(null, 8, false)).toBeNull()
    expect(timerSound(9, 9, false)).toBeNull()
    expect(timerSound(12, 11, false)).toBeNull()
    expect(timerSound(11, 10, false)).toBe('tick')
    expect(timerSound(2, 1, false)).toBe('tick')
    expect(timerSound(1, 0, false)).toBe('timeup')
    expect(timerSound(0, 0, false)).toBeNull()
    expect(timerSound(5, 4, true)).toBeNull()
    expect(timerSound(1, 0, true)).toBeNull()
  })
})
