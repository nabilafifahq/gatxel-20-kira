import type { ArenaTutorDTO } from '@/lib/dto-arena'
import { num } from './format'
import { Card } from './Layout'

/**
 * Laporan arena untuk tutor (T02 Detail learner): XP per jalur, statistik Quick Maths (soal per menit,
 * akurasi, rekor, grafik mingguan, jenis soal paling lambat) dan kemajuan Quiz Arena per topik.
 */
export function ArenaReport({ data }: { data: ArenaTutorDTO }) {
  const h = data.hitung
  const q = data.pengetahuan
  const max = Math.max(1, ...h.minggu.map((d) => d.benar))
  return (
    <section aria-labelledby="arena" className="flex flex-col gap-4">
      <h2 id="arena" className="m-0 text-h2 font-bold max-sm:text-h3">
        Arena: Quick Maths dan Quiz Arena
      </h2>
      <Card className="flex flex-col gap-5">
        <ul aria-label="XP per jalur" className="m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0 text-body">
          {data.tracks.map((t) => (
            <li key={t.track} className="tabular">
              <strong>{t.nama}</strong>: level {t.level}, {num(t.xp)} XP
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-h3 font-bold">Quick Maths</h3>
          {h.ronde === 0 ? (
            <p className="m-0 text-body text-fg-muted">Belum ada ronde Quick Maths yang selesai.</p>
          ) : (
            <>
              <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  ['Ronde selesai', num(h.ronde)],
                  ['Akurasi', h.akurasi === null ? '-' : `${h.akurasi} persen`],
                  ['Soal benar per menit', h.soalPerMenit === null ? '-' : String(h.soalPerMenit)],
                  ['Rekor sprint', h.rekorSprint === null ? '-' : `${h.rekorSprint} per menit`],
                  ['Rekor Target 20', h.rekorTarget === null ? '-' : `${h.rekorTarget} detik`],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col rounded-control bg-bg px-3 py-2">
                    <dt className="text-small text-fg-muted">{k}</dt>
                    <dd className="m-0 text-h3 font-bold tabular">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-body text-fg-muted tabular">
                Level otomatis: {h.level.map((l) => `${l.operasi} ${l.level}`).join(', ')}. Flash Anzan level {h.flashLevel}. Pelajaran strategi selesai {h.strategi} dari 7. Misi harian selesai {h.misiHari} hari.
              </p>
              <ul aria-label="Soal benar tujuh hari terakhir" className="m-0 flex h-28 list-none items-end gap-2 p-0">
                {h.minggu.map((d) => (
                  <li key={d.tanggal} aria-label={`${d.label}: ${d.benar} benar dalam ${d.ronde} ronde`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span aria-hidden="true" className="text-small font-bold tabular">
                      {d.benar > 0 ? d.benar : ''}
                    </span>
                    <span aria-hidden="true" className={d.benar > 0 ? 'w-full rounded-t-control bg-mental' : 'w-full rounded-t-control bg-divider'} style={{ height: `${d.benar > 0 ? Math.max(6, Math.round((d.benar / max) * 56)) : 4}px` }} />
                    <span aria-hidden="true" className="text-small text-fg-muted">
                      {d.label}
                    </span>
                  </li>
                ))}
              </ul>
              {h.palingLambat.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h4 className="m-0 text-body font-bold">Jenis soal paling lambat</h4>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                    {h.palingLambat.map((f) => (
                      <li key={f.jenis} className="tabular">
                        {f.jenis}: rata-rata {f.rataDetik} detik, {f.akurasi} persen benar ({f.jumlah} soal)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-h3 font-bold">Quiz Arena</h3>
          {q.ronde === 0 && q.topik.every((t) => t.dikenal === 0) ? (
            <p className="m-0 text-body text-fg-muted">Belum ada ronde Quiz Arena yang selesai.</p>
          ) : (
            <>
              <p className="m-0 text-body text-fg-muted tabular">
                {num(q.ronde)} ronde kuis selesai.{q.rekorSpeed > 0 ? ` Rekor speed quiz ${q.rekorSpeed} benar dalam 60 detik.` : ''}
              </p>
              <ul className="m-0 grid list-none gap-x-8 gap-y-1 p-0 text-body md:grid-cols-2">
                {q.topik.map((t) => (
                  <li key={t.judul} className="flex justify-between gap-3 tabular">
                    <span>{t.judul}</span>
                    <span className="text-fg-muted">
                      {t.dikenal} dari {t.total} dikenal
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>
    </section>
  )
}
