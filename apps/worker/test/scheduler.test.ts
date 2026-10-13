import { describe, expect, it } from 'vitest'
import { dueCheck, latestSlotAt, SCHEDULES, type Slot } from '../src/scheduler'

const RETENTION: Slot = { kind: 'daily', hour: 3, minute: 15 }
const WEEKLY: Slot = { kind: 'weekly', weekday: 0, hour: 19, minute: 0 }
const DAY = 86_400_000
const wib = (iso: string) => new Date(`${iso}+07:00`)

describe('latestSlotAt (WIB)', () => {
  it('harian 03.15 WIB: hari ini bila sudah lewat, kemarin bila belum', () => {
    expect(latestSlotAt(RETENTION, wib('2026-10-12T10:00:00'))).toEqual(wib('2026-10-12T03:15:00'))
    expect(latestSlotAt(RETENTION, wib('2026-10-12T03:14:59'))).toEqual(wib('2026-10-11T03:15:00'))
    expect(latestSlotAt(RETENTION, wib('2026-10-12T03:15:00'))).toEqual(wib('2026-10-12T03:15:00'))
  })

  it('tengah malam UTC tetap memakai tanggal WIB', () => {
    // 2026-10-12 23.30 UTC = 13 Oktober 06.30 WIB
    expect(latestSlotAt(RETENTION, new Date('2026-10-12T23:30:00Z'))).toEqual(wib('2026-10-13T03:15:00'))
  })

  it('mingguan Minggu 19.00 WIB', () => {
    // 12 Oktober 2026 hari Senin.
    expect(latestSlotAt(WEEKLY, wib('2026-10-12T10:00:00'))).toEqual(wib('2026-10-11T19:00:00'))
    expect(latestSlotAt(WEEKLY, wib('2026-10-18T18:59:00'))).toEqual(wib('2026-10-11T19:00:00'))
    expect(latestSlotAt(WEEKLY, wib('2026-10-18T19:00:00'))).toEqual(wib('2026-10-18T19:00:00'))
    expect(latestSlotAt(WEEKLY, wib('2026-10-18T23:59:00'))).toEqual(wib('2026-10-18T19:00:00'))
  })
})

describe('dueCheck', () => {
  it('belum pernah jalan: langsung jalan', () => {
    expect(dueCheck(RETENTION, null, wib('2026-10-12T10:00:00'))).toMatchObject({ due: true, tooLate: false })
  })

  it('sudah jalan setelah slot terakhir: tidak jalan lagi (restart tidak menggandakan)', () => {
    expect(dueCheck(RETENTION, wib('2026-10-12T03:16:00'), wib('2026-10-12T23:00:00')).due).toBe(false)
  })

  it('slot terlewat karena server mati: jalan sekali saat hidup lagi', () => {
    const last = wib('2026-10-09T03:15:10')
    const first = dueCheck(RETENTION, last, wib('2026-10-12T08:00:00'))
    expect(first).toMatchObject({ due: true, slotAt: wib('2026-10-12T03:15:00') })
    // Setelah jalan pukul 08.00, slot berikutnya baru besok.
    expect(dueCheck(RETENTION, wib('2026-10-12T08:00:00'), wib('2026-10-12T20:00:00')).due).toBe(false)
  })

  it('laporan mingguan yang terlambat lebih dari 2 hari dilewati', () => {
    const late = dueCheck(WEEKLY, wib('2026-10-04T19:00:05'), wib('2026-10-14T09:00:00'), 2 * DAY)
    expect(late).toMatchObject({ due: true, tooLate: true })
    const ok = dueCheck(WEEKLY, wib('2026-10-04T19:00:05'), wib('2026-10-12T07:00:00'), 2 * DAY)
    expect(ok).toMatchObject({ due: true, tooLate: false, slotAt: wib('2026-10-11T19:00:00') })
  })

  it('jam yang disuntikkan tepat di slot', () => {
    expect(dueCheck(WEEKLY, wib('2026-10-11T19:00:00'), wib('2026-10-18T19:00:00'), 2 * DAY)).toMatchObject({ due: true, tooLate: false })
    expect(dueCheck(WEEKLY, wib('2026-10-18T19:00:00'), wib('2026-10-18T19:00:30'), 2 * DAY).due).toBe(false)
  })
})

describe('jadwal pembaruan sumber soal', () => {
  const sourcing = SCHEDULES.find((s) => s.name === 'weekly-sourcing')!

  it('terdaftar setiap Minggu 02.00 WIB, sebelum laporan mingguan, dan terlambat paling lama 3 hari', () => {
    expect(sourcing.slot).toEqual({ kind: 'weekly', weekday: 0, hour: 2, minute: 0 })
    expect(sourcing.maxLateMs).toBe(3 * DAY)
    const report = SCHEDULES.find((s) => s.name === 'weekly-report')!.slot
    expect(report.kind === 'weekly' && report.weekday === 0 && report.hour > 2).toBe(true)
    expect(new Set(SCHEDULES.map((s) => s.name)).size).toBe(SCHEDULES.length)
  })

  it('jalan sekali per Minggu dini hari dan tidak menggandakan saat worker restart', () => {
    // 18 Oktober 2026 hari Minggu.
    expect(latestSlotAt(sourcing.slot, wib('2026-10-18T01:59:00'))).toEqual(wib('2026-10-11T02:00:00'))
    expect(latestSlotAt(sourcing.slot, wib('2026-10-18T02:00:00'))).toEqual(wib('2026-10-18T02:00:00'))
    expect(dueCheck(sourcing.slot, wib('2026-10-18T02:00:30'), wib('2026-10-18T09:00:00'), sourcing.maxLateMs).due).toBe(false)
    expect(dueCheck(sourcing.slot, wib('2026-10-11T02:00:30'), wib('2026-10-18T02:05:00'), sourcing.maxLateMs)).toMatchObject({ due: true, tooLate: false })
  })

  it('server mati lebih dari 3 hari: slot dilewati, bukan dijalankan terlambat', () => {
    expect(dueCheck(sourcing.slot, wib('2026-10-11T02:00:30'), wib('2026-10-22T08:00:00'), sourcing.maxLateMs)).toMatchObject({ due: true, tooLate: true })
  })
})
