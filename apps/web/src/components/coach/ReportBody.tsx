import type { MonthlyReportDTO, ReportCoverageDTO, ReportSubjectDTO } from '@/lib/dto-coach'
import { cx } from '@/components/console/cx'
import { SubjectChip } from '@/components/console/Layout'
import { hoursMinutes } from '@/components/family/summaryText'

/**
 * Isi rapor bulanan (dipakai di halaman keluarga dan halaman cetak A4). Server component tanpa state.
 * Teks untuk orang tua dalam bahasa Indonesia. Cakupan "mengacu pada kerangka Cambridge Primary", tanpa klaim resmi.
 */

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-control border border-divider bg-surface p-3.5 break-inside-avoid">
      <span className="text-small font-semibold text-fg-muted">{label}</span>
      <span className="text-h3 font-bold tabular">{value}</span>
      {hint ? <span className="text-small text-fg-muted">{hint}</span> : null}
    </div>
  )
}

function stars(n: number | null): string {
  return n === null ? 'belum ada' : String(n).replace('.', ',')
}

function SubjectBlock({ s }: { s: ReportSubjectDTO }) {
  const practiced = s.answers > 0
  return (
    <article aria-label={s.label} className="flex flex-col gap-2 rounded-control border border-divider bg-surface p-4 break-inside-avoid">
      <div className="flex items-center gap-2">
        <SubjectChip subject={s.subject} size="sm" />
        <span className="ml-auto text-small text-fg-muted">{s.sessions} sesi selesai</span>
      </div>
      {practiced ? (
        <>
          <p className="m-0 text-body">
            {s.skillsPracticed} skill dilatih, {s.answers} jawaban dengan {s.accuracyPct}% benar. Rata-rata bintang naik dari {stars(s.starsBefore)} ke {stars(s.starsAfter)} (dari 3).
          </p>
          <p className="m-0 text-body">
            {s.starsUp > 0 ? `${s.starsUp} skill naik bintang` : 'Belum ada skill yang naik bintang bulan ini'}
            {s.newlyMastered > 0 ? `, ${s.newlyMastered} di antaranya sekarang dikuasai.` : '.'}
          </p>
          {s.highlights.length > 0 ? (
            <ul className="m-0 list-disc pl-5 text-body">
              {s.highlights.map((h) => (
                <li key={h.title}>
                  {h.title}: dari {h.from} ke {h.to} bintang
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-body text-fg-muted">Belum ada latihan {s.label} bulan ini.</p>
      )}
    </article>
  )
}

const SEGMENTS: { key: 'strong' | 'inProgress' | 'notYet' | 'noSkill'; label: string; className: string }[] = [
  { key: 'strong', label: 'kuat', className: 'bg-success' },
  { key: 'inProgress', label: 'sedang dilatih', className: 'bg-math' },
  { key: 'notYet', label: 'belum disentuh', className: 'bg-divider' },
  { key: 'noSkill', label: 'belum ada latihannya di Kira', className: 'bg-border' },
]

function CoverageRow({ c }: { c: ReportCoverageDTO }) {
  const summary = SEGMENTS.map((s) => `${c[s.key]} ${s.label}`).join(', ')
  return (
    <article aria-label={`Cakupan ${c.label}`} className="flex flex-col gap-2 break-inside-avoid">
      <p className="m-0 text-body font-bold">
        {c.frameworkTitle}, tahap {c.stage}
      </p>
      {c.total > 0 ? (
        <>
          <div role="img" aria-label={`${c.total} tujuan belajar: ${summary}`} className="flex h-4 overflow-hidden rounded-pill bg-divider">
            {SEGMENTS.map((s) => (c[s.key] > 0 ? <span key={s.key} className={s.className} style={{ width: `${(100 * c[s.key]) / c.total}%` }} /> : null))}
          </div>
          <p className="m-0 text-small text-fg-muted">
            {c.total} tujuan: {summary}.
          </p>
        </>
      ) : (
        <p className="m-0 text-small text-fg-muted">Daftar tujuan untuk tahap ini belum tersedia.</p>
      )}
    </article>
  )
}

export function ReportBody({ r, className }: { r: MonthlyReportDTO; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <section aria-label="Ringkasan bulan" className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <Tile label="Waktu belajar" value={r.minutes > 0 ? hoursMinutes(r.minutes) : '0 menit'} hint={r.activeDays > 0 ? `rata-rata ${Math.round(r.minutes / r.activeDays)} menit per hari belajar` : undefined} />
        <Tile label="Hari belajar" value={`${r.activeDays} dari ${r.daysInMonth}`} />
        <Tile label="Sesi selesai" value={String(r.sessions)} />
      </section>
      {!r.hasData ? (
        <p role="status" className="m-0 rounded-control border border-divider bg-surface p-4 text-body">
          {r.emptyNote}
        </p>
      ) : (
        <>
          <section aria-labelledby="rapor-mapel" className="flex flex-col gap-3">
            <h2 id="rapor-mapel" className="m-0 text-h3 font-bold">
              Perubahan per mapel
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {r.subjects.map((s) => (
                <SubjectBlock key={s.subject} s={s} />
              ))}
            </div>
          </section>
          <section aria-labelledby="rapor-cakupan" className="flex flex-col gap-3">
            <h2 id="rapor-cakupan" className="m-0 text-h3 font-bold">
              Cakupan tujuan belajar
            </h2>
            {r.coverage.map((c) => (
              <CoverageRow key={c.subject} c={c} />
            ))}
            <p className="m-0 text-small text-fg-muted">{r.coverageNote}</p>
          </section>
        </>
      )}
      <section aria-labelledby="rapor-depan" className="flex flex-col gap-2 break-inside-avoid">
        <h2 id="rapor-depan" className="m-0 text-h3 font-bold">
          Yang bisa dilakukan bulan depan
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-body">
          {r.next.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
