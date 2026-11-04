import { weekReportEmail } from '@kira/core/email-templates'
import type { WeekSummaryDTO } from '@/lib/dto'
import type { CoachDTO } from '@/lib/dto-coach'
import { dateId } from '@/components/console/format'
import { emailIdentity } from '@/server/email'
import { arenaParagraph, emailSubject, questLine, starsLine, studyLine, SUBJECT_NAME } from './summaryText'

/**
 * Email laporan mingguan untuk orang tua, lewat tata letak email bersama (@kira/core/email).
 * `opts` opsional: alamat absolut halaman laporan dan privasi (DTO tidak membawa origin)
 * dan baris identitas pengendali data untuk footer.
 */

export type WeekSummaryEmailOptions = {
  reportUrl?: string
  privacyUrl?: string
  controller?: string
  /** Pelatih Orang Tua: kegiatan rumah mingguan dari data nyata. Dilewati bila kosong. */
  coach?: CoachDTO | null
  coachUrl?: string
}

function coachInput(c: CoachDTO, url?: string) {
  return {
    note: c.note ?? null,
    items: c.weak.map((w) => ({
      lead: `${w.title},`,
      text: `${w.subjectLabel}. ${w.plain} ${w.accuracyLine}${w.activity ? `\nCoba: ${w.activity.title}. Siapkan ${w.activity.materials.join(', ')}. ${w.activity.steps.join(' ')} Pertanyaan untuk anak: ${w.activity.ask}` : ''}`,
    })),
    starter: c.starter ? { lead: `Coba dulu: ${c.starter.title}.`, text: `Siapkan ${c.starter.materials.join(', ')}. ${c.starter.steps.join(' ')}` } : null,
    strength: c.strength ? `${c.strength.title}, ${c.strength.subjectLabel}` : null,
    praise: c.praise,
    url: url ?? null,
  }
}

export function renderWeekSummaryEmail(dto: WeekSummaryDTO, opts: WeekSummaryEmailOptions = {}): { subject: string; html: string; text: string } {
  return weekReportEmail(emailIdentity(), {
    subject: emailSubject(dto),
    weekLabel: dto.weekLabel,
    firstWeekNote: dto.firstWeek ? `Ini minggu pertama ${dto.learnerName} di Kira. Ringkasan lengkap datang Senin depan, setelah 7 hari data.` : null,
    studyLine: studyLine(dto),
    questLine: questLine(dto),
    skillsUp: dto.skillsUp.map((u) => ({ lead: `${u.title},`, text: `${SUBJECT_NAME[u.subject]}, ${starsLine(u.stars)}` })),
    skillsUpEmpty: dto.firstWeek ? 'Belum ada pembanding. Minggu ini menjadi titik awal.' : 'Belum ada skill yang naik bintang minggu ini.',
    skillsToRepeat: dto.skillsToRepeat.map((d) => ({ lead: `${d.title},`, text: `${SUBJECT_NAME[d.subject]}, ${d.note}` })),
    skillsToRepeatEmpty: 'Tidak ada skill yang perlu diulang minggu ini.',
    arena: arenaParagraph(dto.arena),
    tutorNote: dto.tutorNote ?? null,
    nextCompetition: dto.nextCompetition ? { name: dto.nextCompetition.name, dateLabel: dateId(dto.nextCompetition.date, true) } : null,
    coach: opts.coach ? coachInput(opts.coach, opts.coachUrl) : null,
    reportUrl: opts.reportUrl ?? null,
    privacyUrl: opts.privacyUrl ?? null,
    controller: opts.controller ?? null,
  })
}
