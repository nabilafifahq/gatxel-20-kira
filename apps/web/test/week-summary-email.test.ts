import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmailBody, renderWeekSummaryEmail } from '@/components/family/WeekSummaryEmail'
import { renderStaticMarkup, styleToCss } from '@/components/family/staticMarkup'
import { weekSummary, weekSummaryFirst } from '@/dev/fixtures/family'
import type { WeekSummaryDTO } from '@/lib/dto'

const OPTS = { reportUrl: 'https://kira-rumah.test/keluarga?learner=a&minggu=2026-10-12', privacyUrl: 'https://kira-rumah.test/keluarga/privasi', controller: 'Kira, dikelola Keluarga Wiratama, Malang' }

describe('renderStaticMarkup', () => {
  it('sama persis dengan react-dom/server untuk email laporan', () => {
    const tricky: WeekSummaryDTO = { ...weekSummary, learnerName: 'Ana & "Bo" <b>', tutorNote: "Baris 1\nBaris 2 dengan 'kutip' & <tag>", skillsToRepeat: [], nextCompetition: null }
    for (const s of [weekSummary, weekSummaryFirst, tricky]) {
      for (const opts of [{}, OPTS]) {
        const el = createElement(EmailBody, { s, opts })
        expect(renderStaticMarkup(el)).toBe(renderToStaticMarkup(el))
      }
    }
  })

  it('menangani fragment, angka, void, dan atribut boolean seperti React', () => {
    const el = createElement(
      'div',
      { className: 'a', hidden: true, 'aria-hidden': true, title: 'x"y', onClick: () => undefined, style: { marginTop: 4, zIndex: 2, opacity: 0, WebkitTextSizeAdjust: '100%', msFlex: 1 } },
      createElement(Fragment, null, 'a < b', 3, null, false, createElement('br')),
    )
    expect(renderStaticMarkup(el)).toBe(renderToStaticMarkup(el))
  })

  it('style tanpa nilai dilewati', () => {
    expect(styleToCss({ color: undefined, margin: '', padding: 0 })).toBe('padding:0')
  })
})

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
})
