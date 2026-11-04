import { describe, expect, it } from 'vitest'
import { renderWeekSummaryEmail } from '@/components/family/WeekSummaryEmail'
import { weekSummary, weekSummaryFirst } from '@/dev/fixtures/family'
import type { WeekSummaryDTO } from '@/lib/dto'

const OPTS = { reportUrl: 'https://kira-rumah.test/keluarga?learner=a&minggu=2026-10-12', privacyUrl: 'https://kira-rumah.test/keluarga/privasi', controller: 'Kira, dikelola Keluarga Wiratama, Malang' }

describe('renderWeekSummaryEmail', () => {
  it('membuat subjek, HTML lengkap, dan versi teks tanpa em dash', () => {
    const mail = renderWeekSummaryEmail(weekSummary, OPTS)
    expect(mail.subject).toBe('Minggu ini, Alya belajar 4 jam 5 menit')
    expect(mail.html.startsWith('<!doctype html><html lang="id">')).toBe(true)
    expect(mail.html).toContain('Buka laporan lengkap')
    expect(mail.text).toContain('PERLU DIULANG')
    // En dash dan em dash dibangun dari kode karakter supaya berkas ini sendiri bersih dari keduanya.
    expect(`${mail.html}${mail.text}`).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })

  it('minggu pertama menjelaskan laporan lengkap yang akan datang', () => {
    const mail = renderWeekSummaryEmail(weekSummaryFirst, OPTS)
    expect(mail.text).toContain('Ini minggu pertama')
    expect(mail.text).toContain('Belum ada pembanding')
  })

  it('nama dan catatan tutor di-escape di HTML', () => {
    const tricky: WeekSummaryDTO = { ...weekSummary, learnerName: 'Ana & "Bo" <b>', tutorNote: "Baris 1\nBaris 2 dengan 'kutip' & <tag>", skillsToRepeat: [], nextCompetition: null }
    const mail = renderWeekSummaryEmail(tricky, OPTS)
    expect(mail.html).not.toContain('<tag>')
    expect(mail.html).not.toContain('<b>')
    expect(mail.html).toContain('&lt;tag&gt;')
    expect(mail.html).toContain('Baris 1<br>')
    expect(mail.text).toContain("Baris 2 dengan 'kutip' & <tag>")
  })
})
