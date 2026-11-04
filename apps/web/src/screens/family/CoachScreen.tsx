import type { ConsoleShell } from '@/lib/dto'
import type { CoachActivityDTO, CoachPageDTO, CoachWeakDTO } from '@/lib/dto-coach'
import { ChildPicker } from '@/components/coach/ChildPicker'
import { ButtonLink } from '@/components/console/Button'
import { EmptyState, InlineAlert } from '@/components/console/Feedback'
import { Card, SubjectChip } from '@/components/console/Layout'
import { FamilyShell } from '@/components/family/FamilyShell'
import { hoursMinutes } from '@/components/family/summaryText'

/** Pelatih Orang Tua, tampilan mingguan: tiga skill yang perlu dilatih, satu kegiatan 10 menit untuk tiap skill, satu hal untuk dipuji. */

function Activity({ a }: { a: CoachActivityDTO }) {
  return (
    <div className="flex flex-col gap-3 rounded-control bg-bg p-4">
      <p className="m-0 text-body-lg font-bold">
        Kegiatan {a.minutes} menit: {a.title}
      </p>
      <div>
        <p className="m-0 text-small font-bold text-fg-muted">Siapkan</p>
        <ul className="m-0 list-disc pl-5 text-body">
          {a.materials.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="m-0 text-small font-bold text-fg-muted">Langkah</p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-body">
          {a.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <p className="m-0 text-body">
        <strong>Tanyakan ke anak:</strong> {a.ask}
      </p>
      <p className="m-0 text-body text-fg-muted">
        <strong>Kalau terasa sulit:</strong> {a.easier}
      </p>
    </div>
  )
}

function WeakCard({ w, n, learnerId }: { w: CoachWeakDTO; n: number; learnerId: string }) {
  return (
    <Card as="article" aria-labelledby={`skill-${w.skillId}`} className="flex flex-col gap-3" padding="sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-fg text-body font-bold text-white tabular" aria-hidden="true">
          {n}
        </span>
        <SubjectChip subject={w.subject} size="sm" />
      </div>
      <h3 id={`skill-${w.skillId}`} className="m-0 text-h3 font-bold">
        {w.title}
      </h3>
      <p className="m-0 text-body">{w.plain}</p>
      <p className="m-0 text-body font-semibold">{w.accuracyLine}</p>
      {w.solid ? (
        <p className="m-0 text-body text-fg-muted">Skill ini sebenarnya sudah cukup kuat. Pelatih menyebutnya karena hanya ini yang relatif paling rendah, jadi cukup dijaga.</p>
      ) : null}
      {w.activity ? <Activity a={w.activity} /> : null}
      <div>
        <ButtonLink href={`/keluarga/lembar?learner=${encodeURIComponent(learnerId)}&skill=${encodeURIComponent(w.skillId)}`} variant="secondary" icon="printer">
          Cetak lembar kerja skill ini
        </ButtonLink>
      </div>
    </Card>
  )
}

export function CoachScreen({ shell, data }: { shell: ConsoleShell; data: CoachPageDTO }) {
  const c = data.coach
  return (
    <FamilyShell shell={shell} active="coach" {...(c ? { learnerName: c.name } : {})}>
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h2 font-bold">Pelatih orang tua</h1>
        <p className="m-0 text-body text-fg-muted">Tiga hal kecil untuk dilakukan di rumah minggu ini. Semuanya dari data belajar anak, tanpa AI.</p>
      </header>
      {!c ? (
        <EmptyState
          icon="learners"
          title="Belum ada anak di keluarga ini."
          body="Tambahkan anak lebih dulu. Setelah ia belajar beberapa hari, Pelatih menunjukkan skill yang perlu dilatih dan kegiatan 10 menit untuk dicoba di rumah."
          actions={
            <ButtonLink href="/keluarga" variant="primary">
              Ke halaman Anak saya
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ChildPicker children={data.children} selectedId={data.selectedId} href={(id) => `/keluarga/pelatih?learner=${encodeURIComponent(id)}`} />
          <p className="m-0 text-body text-fg-muted">
            Minggu {c.weekLabel}. {c.minutesThisWeek > 0 ? `${c.name} belajar ${hoursMinutes(c.minutesThisWeek)} minggu ini.` : `${c.name} belum belajar minggu ini.`}
          </p>
          {c.note ? (
            <InlineAlert tone="info" title={c.state === 'empty' ? 'Belum cukup data' : 'Data masih sedikit'} live="none">
              {c.note}
            </InlineAlert>
          ) : null}
          {c.weak.length > 0 ? (
            <section aria-labelledby="fokus" className="flex flex-col gap-3">
              <h2 id="fokus" className="m-0 text-h3 font-bold">
                {c.weak.length === 1 ? 'Satu skill untuk dilatih' : `${c.weak.length} skill untuk dilatih`}
              </h2>
              {c.weak.map((w, i) => (
                <WeakCard key={w.skillId} w={w} n={i + 1} learnerId={c.learnerId} />
              ))}
            </section>
          ) : c.starter ? (
            <section aria-labelledby="mulai" className="flex flex-col gap-3">
              <h2 id="mulai" className="m-0 text-h3 font-bold">
                Untuk dicoba dulu ({c.starter.subjectLabel})
              </h2>
              <Card padding="sm">
                <Activity a={c.starter} />
              </Card>
            </section>
          ) : null}
          <section aria-labelledby="puji" className="flex flex-col gap-3">
            <h2 id="puji" className="m-0 text-h3 font-bold">
              Yang patut dipuji
            </h2>
            <Card padding="sm" className="flex flex-col gap-2.5">
              {c.strength ? (
                <p className="m-0 text-body">
                  <strong>{c.strength.title}</strong> ({c.strength.subjectLabel}): {c.strength.line}
                </p>
              ) : (
                <p className="m-0 text-body text-fg-muted">Belum ada skill yang cukup data untuk dipuji secara khusus. Usaha tetap bisa dipuji.</p>
              )}
              <div className="rounded-control border-2 border-fg bg-surface p-4">
                <p className="m-0 text-small font-bold text-fg-muted">Kalimat yang bisa Anda ucapkan</p>
                <p className="m-0 mt-1 text-body-lg font-semibold">{c.praise}</p>
              </div>
            </Card>
          </section>
          <section aria-label="Langkah berikutnya" className="flex flex-wrap gap-2.5">
            <ButtonLink href={`/keluarga/lembar?learner=${encodeURIComponent(c.learnerId)}`} variant="primary" icon="printer">
              Buat lembar kerja
            </ButtonLink>
            <ButtonLink href={`/keluarga/rapor?learner=${encodeURIComponent(c.learnerId)}`} variant="secondary" icon="report">
              Lihat rapor bulanan
            </ButtonLink>
          </section>
        </>
      )}
    </FamilyShell>
  )
}
