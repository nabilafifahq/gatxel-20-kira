import type { CSSProperties, ReactNode } from 'react'
import { BG, DIVIDER, INK, MATH, MATH_50, MUTED, WHITE } from '@kira/figures/palette'
import type { WeekSummaryDTO } from '@/lib/dto'
import type { CoachDTO } from '@/lib/dto-coach'
import { dateId } from '@/components/console/format'
import { renderStaticMarkup } from './staticMarkup'
import { arenaParagraph, emailSubject, questLine, starsLine, studyLine, SUBJECT_NAME } from './summaryText'

/**
 * Email laporan mingguan untuk orang tua (papan EmailLaporan). HTML berbasis tabel dengan
 * gaya inline saja, tanpa gambar, skrip, atau font dari luar, supaya terbaca di Gmail dan
 * aplikasi email HP. Warna dari palet figur (sama dengan token DESIGN.md).
 *
 * `opts` opsional: alamat absolut halaman laporan dan privasi (DTO tidak membawa origin)
 * dan baris identitas pengendali data untuk footer.
 *
 * HTML dibuat dengan renderStaticMarkup (./staticMarkup), bukan react-dom/server, karena
 * Next.js menolak react-dom/server di Server Action dan Route Handler tempat email ini dibuat.
 */

export type WeekSummaryEmailOptions = {
  reportUrl?: string
  privacyUrl?: string
  controller?: string
  /** Pelatih Orang Tua: kegiatan rumah mingguan dari data nyata. Dilewati bila kosong. */
  coach?: CoachDTO | null
  coachUrl?: string
}

const FONT = "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif"
const DISPLAY = "Mohave, 'Arial Narrow', Arial, sans-serif"

const p = (extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FONT, fontSize: 16, lineHeight: '26px', color: INK, ...extra })

function Row({ children, pad = '0 0 22px 0' }: { children: ReactNode; pad?: string }) {
  return (
    <tr>
      <td style={{ padding: pad }}>{children}</td>
    </tr>
  )
}

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: '0 0 8px 0', fontFamily: FONT, fontSize: 18, lineHeight: '26px', fontWeight: 700, color: INK }}>{children}</h2>
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td width={18} valign="top" style={p({ fontWeight: 700, color: MUTED, paddingBottom: 8 })}>
              {'•'}
            </td>
            <td valign="top" style={p({ paddingBottom: 8 })}>
              {it}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CoachEmailSection({ coach, url }: { coach: CoachDTO; url?: string }) {
  return (
    <>
      <H2>Pelatih minggu ini: 10 menit di rumah</H2>
      {coach.note ? <p style={p({ color: MUTED, paddingBottom: 10 })}>{coach.note}</p> : null}
      {coach.weak.length ? (
        <List
          items={coach.weak.map((w) => (
            <>
              <strong>{w.title}</strong>, {w.subjectLabel}. {w.plain} {w.accuracyLine}
              {w.activity ? (
                <>
                  <br />
                  <strong>Coba: {w.activity.title}.</strong> Siapkan {w.activity.materials.join(', ')}. {w.activity.steps.join(' ')} Pertanyaan untuk anak: {w.activity.ask}
                </>
              ) : null}
            </>
          ))}
        />
      ) : coach.starter ? (
        <p style={p()}>
          <strong>Coba dulu: {coach.starter.title}.</strong> Siapkan {coach.starter.materials.join(', ')}. {coach.starter.steps.join(' ')}
        </p>
      ) : null}
      {coach.strength ? (
        <p style={p({ paddingTop: 6 })}>
          <strong>Yang patut dipuji:</strong> {coach.strength.title}, {coach.strength.subjectLabel}.
        </p>
      ) : null}
      <p style={p({ background: MATH_50, borderRadius: 12, padding: '14px 16px', marginTop: 8 })}>
        <strong>Kalimat untuk anak:</strong> {coach.praise}
      </p>
      {url ? (
        <p style={p({ paddingTop: 8 })}>
          <a href={url} style={{ color: MATH, fontWeight: 700 }}>
            Lihat semua kegiatan dan lembar kerja
          </a>
        </p>
      ) : null}
    </>
  )
}

export function EmailBody({ s, opts }: { s: WeekSummaryDTO; opts: WeekSummaryEmailOptions }) {
  const subject = emailSubject(s)
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ background: BG, borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td align="center" style={{ padding: '28px 12px 40px' }}>
            <table role="presentation" width={600} cellPadding={0} cellSpacing={0} style={{ width: '100%', maxWidth: 600, background: WHITE, borderRadius: 12, borderCollapse: 'separate' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '32px 36px' }}>
                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        <Row pad="0 0 16px 0">
                          <span style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: '30px', fontWeight: 700, color: INK }}>Kira</span>
                          <span style={{ fontFamily: FONT, fontSize: 14, lineHeight: '22px', color: MUTED }}>&nbsp;&nbsp;Laporan keluarga</span>
                        </Row>
                        <tr>
                          <td style={{ borderTop: `1px solid ${DIVIDER}`, padding: '22px 0 0 0' }} />
                        </tr>
                        <Row>
                          <h1 style={{ margin: 0, fontFamily: FONT, fontSize: 26, lineHeight: '34px', fontWeight: 700, color: INK }}>{subject}</h1>
                          <p style={p({ color: MUTED })}>{s.weekLabel}</p>
                        </Row>
                        {s.firstWeek ? (
                          <Row>
                            <p style={p({ background: MATH_50, border: `2px solid ${MATH}`, borderRadius: 12, padding: '14px 16px' })}>
                              Ini minggu pertama {s.learnerName} di Kira. Ringkasan lengkap datang Senin depan, setelah 7 hari data.
                            </p>
                          </Row>
                        ) : null}
                        <Row>
                          <p style={p({ fontWeight: 600, paddingBottom: 6 })}>{studyLine(s)}</p>
                          <p style={p({ fontWeight: 600 })}>{questLine(s)}</p>
                        </Row>
                        <Row>
                          <H2>Naik minggu ini</H2>
                          {s.skillsUp.length ? (
                            <List
                              items={s.skillsUp.map((u) => (
                                <>
                                  <strong>{u.title}</strong>, {SUBJECT_NAME[u.subject]}, {starsLine(u.stars)}
                                </>
                              ))}
                            />
                          ) : (
                            <p style={p({ color: MUTED })}>{s.firstWeek ? 'Belum ada pembanding. Minggu ini menjadi titik awal.' : 'Belum ada skill yang naik bintang minggu ini.'}</p>
                          )}
                        </Row>
                        <Row>
                          <H2>Perlu diulang</H2>
                          {s.skillsToRepeat.length ? (
                            <List
                              items={s.skillsToRepeat.map((d) => (
                                <>
                                  <strong>{d.title}</strong>, {SUBJECT_NAME[d.subject]}, {d.note}
                                </>
                              ))}
                            />
                          ) : (
                            <p style={p({ color: MUTED })}>Tidak ada skill yang perlu diulang minggu ini.</p>
                          )}
                        </Row>
                        {arenaParagraph(s.arena) ? (
                          <Row>
                            <H2>Arena</H2>
                            <p style={p()}>{arenaParagraph(s.arena)}</p>
                          </Row>
                        ) : null}
                        {s.tutorNote ? (
                          <Row>
                            <H2>Catatan tutor</H2>
                            <p style={p({ background: BG, borderRadius: 12, padding: '14px 16px', whiteSpace: 'pre-line' })}>{s.tutorNote}</p>
                          </Row>
                        ) : null}
                        {s.nextCompetition ? (
                          <Row>
                            <H2>Lomba berikutnya</H2>
                            <p style={p()}>
                              <strong>{s.nextCompetition.name}:</strong> {dateId(s.nextCompetition.date, true)}.
                            </p>
                          </Row>
                        ) : null}
                        {opts.coach ? (
                          <Row>
                            <CoachEmailSection coach={opts.coach} url={opts.coachUrl} />
                          </Row>
                        ) : null}
                        {opts.reportUrl ? (
                          <Row>
                            <a
                              href={opts.reportUrl}
                              style={{
                                display: 'inline-block',
                                background: INK,
                                color: WHITE,
                                fontFamily: FONT,
                                fontSize: 16,
                                lineHeight: '48px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                borderRadius: 12,
                                padding: '0 24px',
                              }}
                            >
                              Buka laporan lengkap
                            </a>
                          </Row>
                        ) : null}
                        <tr>
                          <td style={{ borderTop: `1px solid ${DIVIDER}`, padding: '16px 0 0 0' }}>
                            <p style={p({ fontSize: 14, lineHeight: '22px', color: MUTED, paddingBottom: 6 })}>
                              Email ini dikirim karena persetujuan laporan kemajuan lewat email aktif.{' '}
                              {opts.privacyUrl ? (
                                <a href={opts.privacyUrl} style={{ color: MATH, fontWeight: 700 }}>
                                  Atur di halaman Privasi keluarga
                                </a>
                              ) : (
                                'Atur di halaman Privasi keluarga di Kira'
                              )}
                              .
                            </p>
                            {opts.controller ? <p style={p({ fontSize: 14, lineHeight: '22px', color: MUTED })}>{opts.controller}</p> : null}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function coachText(c: CoachDTO, url?: string): string[] {
  const out: string[] = ['PELATIH MINGGU INI: 10 MENIT DI RUMAH']
  if (c.note) out.push(c.note)
  for (const w of c.weak) {
    out.push(`- ${w.title}, ${w.subjectLabel}. ${w.plain} ${w.accuracyLine}`)
    if (w.activity) out.push(`  Coba: ${w.activity.title}. Siapkan ${w.activity.materials.join(', ')}. ${w.activity.steps.join(' ')} Pertanyaan untuk anak: ${w.activity.ask}`)
  }
  if (!c.weak.length && c.starter) out.push(`Coba dulu: ${c.starter.title}. Siapkan ${c.starter.materials.join(', ')}. ${c.starter.steps.join(' ')}`)
  if (c.strength) out.push(`Yang patut dipuji: ${c.strength.title}, ${c.strength.subjectLabel}.`)
  out.push(`Kalimat untuk anak: ${c.praise}`)
  if (url) out.push(`Lihat semua kegiatan dan lembar kerja: ${url}`)
  return out
}

function textVersion(s: WeekSummaryDTO, opts: WeekSummaryEmailOptions): string {
  const lines: string[] = [emailSubject(s), s.weekLabel, '']
  if (s.firstWeek) lines.push(`Ini minggu pertama ${s.learnerName} di Kira. Ringkasan lengkap datang Senin depan, setelah 7 hari data.`, '')
  lines.push(studyLine(s), questLine(s), '', 'NAIK MINGGU INI')
  if (s.skillsUp.length) s.skillsUp.forEach((u) => lines.push(`- ${u.title}, ${SUBJECT_NAME[u.subject]}, ${starsLine(u.stars)}`))
  else lines.push(s.firstWeek ? 'Belum ada pembanding. Minggu ini menjadi titik awal.' : 'Belum ada skill yang naik bintang minggu ini.')
  lines.push('', 'PERLU DIULANG')
  if (s.skillsToRepeat.length) s.skillsToRepeat.forEach((d) => lines.push(`- ${d.title}, ${SUBJECT_NAME[d.subject]}, ${d.note}`))
  else lines.push('Tidak ada skill yang perlu diulang minggu ini.')
  const arena = arenaParagraph(s.arena)
  if (arena) lines.push('', 'ARENA', arena)
  if (s.tutorNote) lines.push('', 'CATATAN TUTOR', s.tutorNote)
  if (s.nextCompetition) lines.push('', 'LOMBA BERIKUTNYA', `${s.nextCompetition.name}: ${dateId(s.nextCompetition.date, true)}.`)
  if (opts.coach) lines.push('', ...coachText(opts.coach, opts.coachUrl))
  if (opts.reportUrl) lines.push('', `Buka laporan lengkap: ${opts.reportUrl}`)
  lines.push('', '--', `Email ini dikirim karena persetujuan laporan kemajuan lewat email aktif. Atur di halaman Privasi keluarga${opts.privacyUrl ? `: ${opts.privacyUrl}` : ' di Kira'}.`)
  if (opts.controller) lines.push(opts.controller)
  return lines.join('\n')
}

export function renderWeekSummaryEmail(dto: WeekSummaryDTO, opts: WeekSummaryEmailOptions = {}): { subject: string; html: string; text: string } {
  const subject = emailSubject(dto)
  const body = renderStaticMarkup(<EmailBody s={dto} opts={opts} />)
  const html =
    '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BG};">${body}</body></html>`
  return { subject, html, text: textVersion(dto, opts) }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
