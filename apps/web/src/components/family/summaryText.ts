import type { ArenaWeekDTO, Subject, WeekSummaryDTO } from '@/lib/dto'

/** Kalimat ringkasan minggu yang sama untuk halaman orang tua, laporan konsol, dan email. */

export const SUBJECT_NAME: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

export function hoursMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h === 0) return `${m} menit`
  if (m === 0) return `${h} jam`
  return `${h} jam ${m} menit`
}

export function activeDays(s: WeekSummaryDTO): number {
  return s.minutesPerDay.filter((d) => d.minutes > 0).length
}

export function studyLine(s: WeekSummaryDTO): string {
  const days = activeDays(s)
  if (s.minutes === 0 || days === 0) return 'Belum ada waktu belajar tercatat minggu ini.'
  if (days === 1) return `Belajar ${hoursMinutes(s.minutes)} dalam 1 hari.`
  return `Belajar ${hoursMinutes(s.minutes)} dalam ${days} hari, rata-rata ${Math.round(s.minutes / days)} menit sehari.`
}

export function questLine(s: WeekSummaryDTO): string {
  if (s.questsPlanned === 0) return 'Belum ada sesi yang direncanakan minggu ini.'
  return `Sesi wajib selesai ${s.questsDone} dari ${s.questsPlanned}.`
}

export function emailSubject(s: WeekSummaryDTO): string {
  if (s.firstWeek) return `Minggu pertama ${s.learnerName} di Kira`
  return `Minggu ini, ${s.learnerName} belajar ${hoursMinutes(s.minutes)}`
}

export function starsLine(stars: number): string {
  return stars >= 3 ? 'sekarang dikuasai, 3 bintang' : `sekarang ${stars} bintang`
}

/** Paragraf pendek tentang arena untuk orang tua; null bila minggu ini tidak ada kegiatan arena dan belum ada topik dicoba. */
export function arenaParagraph(a: ArenaWeekDTO | null | undefined): string | null {
  if (!a) return null
  const parts: string[] = []
  if (a.qmRounds > 0) {
    parts.push(
      a.qmBestPpm !== null
        ? `Di Quick Maths, kecepatan terbaik minggu ini ${Math.round(a.qmBestPpm)} soal per menit dalam ${a.qmRounds} ronde.`
        : `Quick Maths dimainkan ${a.qmRounds} ronde minggu ini.`,
    )
  }
  if (a.topicsTried > 0) {
    const weekly = a.quizRounds > 0 ? `${a.quizRounds} ronde minggu ini. ` : ''
    parts.push(`Di Quiz Arena, ${weekly}${a.topicsTried} dari ${a.topicsTotal} topik sudah dicoba dan ${a.factsKnown} dari ${a.factsTotal} fakta sudah dikenal.`)
  }
  return parts.length ? parts.join(' ') : null
}
