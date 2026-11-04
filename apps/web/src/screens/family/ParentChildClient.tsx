'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '@kira/figures'
import type { AvatarName, ConsoleShell, PinPicture, Subject } from '@/lib/dto'
import type { ParentChildDTO, ParentSessionDTO, ParentWorkDTO } from '@/lib/dto-parent'
import { Button, ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { DayRulesEditor, StreakResetControl, changeMessage } from '@/components/console/DayRulesEditor'
import { ConfirmDialog } from '@/components/console/Dialog'
import { ActionError, InlineAlert } from '@/components/console/Feedback'
import { RadioGroup, Select, Switch, TextField } from '@/components/console/Field'
import { PinChooser, pinProblem } from '@/components/console/PinChooser'
import { FAMILY_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { UiIcon } from '@/components/ui/icons'
import { useAction } from '@/components/console/useAction'
import { ChangeSkill } from '@/components/family/ChangeSkill'
import { FeatureChecklist } from '@/components/family/FeatureChecklist'
import { activeSubjects, type FeatureMap } from '@kira/core/features'
import { FamilyShell } from '@/components/family/FamilyShell'
import { UiLangChoice } from '@/components/family/UiLangChoice'
import type { UiLang } from '@/lib/i18n/lang'
import { WeekSummary } from '@/components/family/WeekSummary'
import { PlacementSection } from './PlacementSection'
import { AvatarPicker } from '@/screens/console/LearnersScreen'
import {
  parentAddOptionalAction,
  parentEditChildAction,
  parentMarkWorkAction,
  parentPrepareTodayAction,
  parentRemoveSessionAction,
  parentResetPinAction,
  parentResetStreakAction,
  parentSaveDayRulesAction,
  parentSaveLimitsAction,
  parentSaveSoundAction,
  parentSaveUiLangAction,
  parentSetQuestionCountAction,
  parentSetSessionRequiredAction,
  parentUnlockAction,
} from '@/server/actions/parent'

/**
 * Halaman satu anak untuk orang tua: sesi hari ini dengan kontrolnya, hasil per soal, peta skill, Buku Salah,
 * Quick Maths dan Quiz, laporan minggu, hasil tulisan, dan semua pengaturan. Untuk HP: satu kolom, bagian
 * yang panjang bisa dilipat, tombol 48px. Teks hangat dan jelas tentang apa yang terjadi pada streak.
 */

const SUBJECT_NAME: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function Section({ id, title, hint, open, children }: { id: string; title: string; hint?: string; open?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  // Tautan "Pengaturan" dan "Mapel dan fitur" dari beranda membuka bagian ini langsung.
  useEffect(() => {
    const hash = window.location.hash
    const target = /^#[a-z-]+$/.test(hash) ? ref.current?.querySelector(hash) : null
    if (target && ref.current) {
      ref.current.open = true
      target.scrollIntoView({ block: 'start' })
    }
  }, [id])
  return (
    <details ref={ref} open={open} className="group rounded-card border border-divider bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <h2 id={id} className="m-0 text-h3 font-bold">
            {title}
          </h2>
          {hint ? <span className="text-small text-fg-muted">{hint}</span> : null}
        </span>
        <UiIcon name="chevron-right" size={20} className="text-fg-muted transition-transform duration-150 ease-kira group-open:rotate-90" />
      </summary>
      <div aria-labelledby={id} className="flex flex-col gap-4 border-t border-divider px-4 py-4">
        {children}
      </div>
    </details>
  )
}

function Pill({ tone, children }: { tone: 'wajib' | 'opsional' | 'selesai'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center rounded-pill px-3 text-small font-bold',
        tone === 'wajib' && 'bg-fg text-surface',
        tone === 'opsional' && 'border-2 border-border text-fg',
        tone === 'selesai' && 'bg-success-50 text-success',
      )}
    >
      {children}
    </span>
  )
}

export function ParentChildClient({ shell, data }: { shell: ConsoleShell; data: ParentChildDTO }) {
  const c = data.card
  const toast = useToast()
  const [note, setNote] = useState<string | null>(null)

  const required = data.today.sessions.filter((s) => s.required)
  const optional = data.today.sessions.filter((s) => !s.required)

  return (
    <FamilyShell shell={shell} active="home" learnerName={c.name}>
      <Link href={FAMILY_ROUTES.home} className="inline-flex h-11 items-center self-start text-body font-bold">
        ‹ Semua anak
      </Link>
      <div className="flex items-center gap-3">
        <Avatar name={c.avatar} size={64} className="flex-none" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-h2 font-bold">{c.name}</h1>
          <span className="text-body text-fg-muted">
            Kelas {c.grade}, streak {c.streak} hari, {c.minutesToday} dari {c.screenLimitMin} menit hari ini
          </span>
        </div>
      </div>
      <p role="status" className="m-0 rounded-card border border-divider bg-surface p-4 text-body font-semibold">
        {c.statusLabel}
      </p>

      <Section id="hari-ini" title="Sesi hari ini" hint="Wajib dulu, lalu opsional. Hanya sesi wajib yang dihitung untuk streak." open>
        {data.today.sessions.length === 0 ? <PrepareToday learnerId={c.id} name={c.name} canPrepare={c.active && c.status !== 'rest'} /> : null}
        {note ? <InlineAlert tone="success" title={note} /> : null}
        <SessionList title="Wajib" sessions={required} onNote={setNote} learnerId={c.id} />
        <SessionList title="Opsional" sessions={optional} onNote={setNote} learnerId={c.id} />
        <AddOptional learnerId={c.id} features={data.controls.features} onNote={setNote} />
      </Section>

      <Section id="hasil" title="Hasil terbaru" hint="Buka satu sesi untuk melihat soal, jawaban anak, jawaban benar, dan penjelasan.">
        {data.attempts.length === 0 ? (
          <p className="m-0 text-body text-fg-muted">Belum ada sesi yang selesai.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.attempts.slice(0, 12).map((a) => (
              <li key={a.id} className="border-b border-divider last:border-b-0">
                <Link href={a.href} className="flex min-h-14 flex-col justify-center py-2 no-underline hover:no-underline">
                  <span className="text-body font-bold text-fg">{a.title}</span>
                  <span className="text-small text-fg-muted">
                    {SUBJECT_NAME[a.subject]}, {a.score}, {a.minutes} menit
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.work.length > 0 ? (
        <Section id="tulisan" title="Hasil tulis, bicara, gambar, dan foto" hint="Boleh dilihat dan dinilai. Tidak memengaruhi skor atau streak.">
          {data.work.map((w) => (
            <WorkCard key={w.responseId} w={w} hasTutor={data.hasTutor} />
          ))}
        </Section>
      ) : null}

      <Section id="skill" title="Peta skill" hint="Penguasaan per mata pelajaran">
        {data.skillMap.map((g) => (
          <details key={g.subject} className="rounded-control border border-divider p-3">
            <summary className="cursor-pointer text-body font-bold">
              {g.label}, {g.skills.filter((s) => s.state === 'dikuasai').length} dari {g.skills.length} dikuasai
            </summary>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
              {g.skills.map((s) => (
                <li key={s.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 text-body">{s.title}</span>
                    <span className="flex-none text-small text-fg-muted">{s.answered === 0 ? 'belum dicoba' : s.state}</span>
                  </div>
                  <div role="img" aria-label={`${s.title}, penguasaan ${s.mastery} persen`} className="flex h-2 overflow-hidden rounded-pill bg-divider">
                    <span className={s.state === 'diulang' ? 'bg-warn' : 'bg-success'} style={{ width: `${s.mastery}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Section>

      {data.placement.enabled ? (
        <Section id="penempatan" title="Tes penempatan" hint="Titik awal belajar per mata pelajaran">
          <PlacementSection data={data.placement} learnerId={c.id} name={c.name} />
        </Section>
      ) : null}

      <Section id="ulang" title="Perlu diulang dan Buku Salah" hint={`${data.fixIt.open} soal menunggu diperbaiki`}>
        {data.weakSkills.length === 0 && data.fixIt.open === 0 ? (
          <p className="m-0 text-body text-fg-muted">Belum ada yang perlu diulang. Kabar baik.</p>
        ) : null}
        {data.weakSkills.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.weakSkills.map((w) => (
              <li key={`${w.subject}-${w.title}`} className="flex flex-col">
                <span className="text-body font-bold">{w.title}</span>
                <span className="text-small text-fg-muted">
                  {SUBJECT_NAME[w.subject]}. {w.note}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {data.fixIt.open > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-body">
              Buku Salah berisi {data.fixIt.open} soal yang dijawab salah di Tes atau Paper. {c.name} memperbaikinya di sesi Fix-it, 10 soal sekali jalan.
            </p>
            <ul className="m-0 list-none p-0 text-small text-fg-muted">
              {data.fixIt.bySkill.map((s) => (
                <li key={s.title}>
                  {s.title}: {s.count} soal
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {data.arena ? (
        <Section id="arena" title="Quick Maths dan Quiz" hint="Latihan cepat dan kuis pengetahuan">
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Jalur XP">
            {data.arena.tracks.map((t) => (
              <li key={t.track} className="text-body">
                {t.nama}: level {t.level}, {t.xp} XP
              </li>
            ))}
          </ul>
          <p className="m-0 text-body">
            Quick Maths: {data.arena.hitung.ronde} ronde
            {data.arena.hitung.akurasi !== null ? `, akurasi ${data.arena.hitung.akurasi}%` : ''}
            {data.arena.hitung.soalPerMenit !== null ? `, ${data.arena.hitung.soalPerMenit} soal per menit` : ''}
            {data.arena.hitung.rekorSprint !== null ? `, rekor sprint ${data.arena.hitung.rekorSprint}` : ''}.
          </p>
          <p className="m-0 text-body">
            Quiz Arena: {data.arena.pengetahuan.ronde} ronde, {data.arena.pengetahuan.topik.filter((t) => t.dikenal > 0).length} dari {data.arena.pengetahuan.topik.length} topik sudah dicoba.
          </p>
        </Section>
      ) : null}

      <Section id="minggu" title="Laporan minggu ini" hint="Sama dengan email mingguan">
        <WeekSummary summary={data.week} compact headingLevel={3} />
        <ButtonLink href={`${FAMILY_ROUTES.week}?learner=${encodeURIComponent(c.id)}`} variant="secondary" className="h-12">
          Lihat minggu-minggu sebelumnya
        </ButtonLink>
      </Section>

      <Section id="atur" title="Pengaturan" hint="Aturan hari, waktu layar, suara, PIN, dan profil">
        <h3 id="fitur" className="m-0 text-body font-bold">Fitur yang dipakai</h3>
        <p className="m-0 text-small text-fg-muted">Matikan mapel atau fitur yang belum dipakai {c.name}. Mapel yang dimatikan tidak muncul di hari belajar dan tidak dihitung untuk streak.</p>
        <FeatureChecklist learnerId={c.id} name={c.name} initial={data.controls.features} />
        <h3 className="m-0 border-t border-divider pt-4 text-body font-bold">Aturan hari</h3>
        <DayRulesEditor
          learnerName={c.name}
          preset={data.controls.dayPreset}
          rules={data.controls.dayRules}
          onSave={(v) => parentSaveDayRulesAction({ learnerId: c.id, ...v })}
        />
        <Limits c={data.controls} learnerId={c.id} name={c.name} onSaved={() => toast({ tone: 'success', title: 'Batas waktu layar tersimpan.' })} />
        <Sound c={data.controls} learnerId={c.id} onSaved={() => toast({ tone: 'success', title: 'Pilihan suara tersimpan.' })} />
        <UiLangSettings c={data.controls} learnerId={c.id} name={c.name} onSaved={() => toast({ tone: 'success', title: 'Bahasa tampilan tersimpan.' })} />
        <PinTools learnerId={c.id} name={c.name} onDone={(t) => toast({ tone: 'success', title: t })} />
        <EditProfile learnerId={c.id} name={c.name} grade={data.controls.grade} avatar={data.controls.avatar} />
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-body font-bold">Streak</h3>
          <StreakResetControl learnerName={c.name} streak={data.controls.streak} onReset={(v) => parentResetStreakAction({ learnerId: c.id, ...v })} />
        </div>
        <ButtonLink href={`${FAMILY_ROUTES.privacy}?learner=${encodeURIComponent(c.id)}`} variant="secondary" className="h-12">
          Persetujuan, ekspor, dan hapus data {c.name}
        </ButtonLink>
      </Section>
    </FamilyShell>
  )
}

function SessionList({ title, sessions, onNote, learnerId }: { title: string; sessions: ParentSessionDTO[]; onNote: (n: string | null) => void; learnerId: string }) {
  if (sessions.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-body font-bold">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {sessions.map((s) => (
          <SessionRow key={s.questId} s={s} onNote={onNote} learnerId={learnerId} />
        ))}
      </ul>
    </div>
  )
}

function SessionRow({ s, onNote }: { s: ParentSessionDTO; onNote: (n: string | null) => void; learnerId: string }) {
  const toggle = useAction(parentSetSessionRequiredAction)
  const remove = useAction(parentRemoveSessionAction)
  const count = useAction(parentSetQuestionCountAction)
  const [n, setN] = useState(String(s.questionCount ?? 10))
  const [confirm, setConfirm] = useState(false)
  const busy = toggle.pending || remove.pending || count.pending
  const state = s.state === 'done' ? 'selesai' : s.state === 'in-progress' ? 'sedang dikerjakan' : 'belum mulai'

  async function run(p: Promise<{ ok: true; data: import('@/lib/dto').PlanChangeResult } | { ok: false }>) {
    const r = await p
    if (r.ok) onNote(changeMessage(r.data) ?? 'Tersimpan.')
  }

  return (
    <li className="flex flex-col gap-2 rounded-control border border-divider p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body font-bold">
          {SUBJECT_NAME[s.subject]}, {s.label}
        </span>
        <Pill tone={s.state === 'done' ? 'selesai' : s.required ? 'wajib' : 'opsional'}>{s.required ? 'Wajib' : 'Opsional'}</Pill>
        <span className="text-small text-fg-muted">{state}</span>
        {s.score ? <span className="text-small font-bold">{s.score}</span> : null}
      </div>
      {s.skill ? (
        <p className="m-0 flex flex-col">
          <span className="text-body">{s.skill.title}</span>
          <span className="text-small text-fg-muted">{s.skill.titleEn}</span>
        </p>
      ) : s.contentTitle ? (
        <p className="m-0 flex flex-col">
          <span className="text-body">{s.contentTitle}</span>
          {s.session === 'paper' ? <span className="text-small text-fg-muted">Campuran beberapa topik</span> : null}
        </p>
      ) : null}
      {s.skillNote ? <p className="m-0 text-small text-fg-muted">{s.skillNote}</p> : null}
      {s.canChangeSkill ? <ChangeSkill questId={s.questId} label={`${s.label} ${SUBJECT_NAME[s.subject]}`} disabled={busy} onNote={onNote} /> : null}
      {s.resultHref ? (
        <Link href={s.resultHref} className="text-small font-bold">
          Lihat soal dan jawaban
        </Link>
      ) : null}
      {s.core ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="secondary" size="S" disabled={busy} loading={toggle.pending} onClick={() => void run(toggle.run({ questId: s.questId, required: !s.required }))}>
            {s.required ? 'Jadikan opsional' : 'Jadikan wajib'}
          </Button>
          {!s.started ? (
            <Button variant="quiet" size="S" tone="danger" disabled={busy} onClick={() => setConfirm(true)}>
              Hapus sesi
            </Button>
          ) : s.skillNote ? null : (
            <span className="text-small text-fg-muted">Sudah dimulai: isi dan jawaban tetap, hanya wajib atau opsional yang bisa berubah.</span>
          )}
          {!s.started && s.session !== 'paper' ? (
            <div className="flex items-end gap-2">
              <TextField label="Jumlah soal" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} className="w-24" />
              <Button
                variant="secondary"
                size="S"
                disabled={busy || Number(n) === s.questionCount}
                loading={count.pending}
                onClick={() => void run(count.run({ questId: s.questId, questionCount: Number(n) }))}
              >
                Ubah
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <ActionError error={toggle.error ?? remove.error ?? count.error} />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Hapus ${s.label} ${SUBJECT_NAME[s.subject]} hari ini?`}
        body="Sesi ini hilang dari hari ini. Hari-hari berikutnya mengikuti aturan hari seperti biasa."
        confirmLabel="Hapus sesi"
        onConfirm={async () => {
          const r = await remove.run({ questId: s.questId })
          if (r.ok) {
            setConfirm(false)
            onNote(changeMessage(r.data) ?? 'Sesi dihapus.')
          }
        }}
        error={remove.error ? remove.error.message : undefined}
      />
    </li>
  )
}

function PrepareToday({ learnerId, name, canPrepare }: { learnerId: string; name: string; canPrepare: boolean }) {
  const prepare = useAction(parentPrepareTodayAction)
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-body text-fg-muted">
        Belum ada sesi hari ini. Sesi dibuat otomatis saat {name} membuka layar Hari Ini.
        {canPrepare ? ' Bisa juga disiapkan sekarang supaya pelajarannya bisa diganti lebih dulu.' : ''}
      </p>
      {canPrepare ? (
        <Button variant="secondary" className="self-start" loading={prepare.pending} onClick={() => void prepare.run({ learnerId })}>
          Siapkan sesi hari ini
        </Button>
      ) : null}
      <ActionError error={prepare.error} />
    </div>
  )
}

function AddOptional({ learnerId, features, onNote }: { learnerId: string; features: FeatureMap; onNote: (n: string | null) => void }) {
  const subjects = activeSubjects(features)
  const [picked, setSubject] = useState<Subject | null>(null)
  const subject = picked && subjects.includes(picked) ? picked : (subjects[0] ?? 'math')
  const [session, setSession] = useState<'latihan' | 'tes' | 'paper'>('latihan')
  const add = useAction(parentAddOptionalAction)
  return (
    <div className="flex flex-col gap-2 border-t border-divider pt-3">
      <h3 className="m-0 text-body font-bold">Tambah sesi opsional</h3>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Mata pelajaran"
          value={subject}
          onChange={(e) => setSubject(e.target.value as Subject)}
          options={subjects.map((s) => ({ value: s, label: SUBJECT_NAME[s] }))}
        />
        <Select
          label="Jenis"
          value={session}
          onChange={(e) => setSession(e.target.value as 'latihan' | 'tes' | 'paper')}
          options={[
            { value: 'latihan', label: 'Latihan' },
            { value: 'tes', label: 'Tes' },
            { value: 'paper', label: 'Paper' },
          ]}
        />
      </div>
      <Button
        variant="secondary"
        className="h-12 self-start"
        loading={add.pending}
        onClick={async () => {
          const r = await add.run({ learnerId, subject, session })
          if (r.ok) onNote(changeMessage(r.data) ?? 'Sesi opsional ditambahkan untuk hari ini.')
        }}
      >
        Tambah untuk hari ini
      </Button>
      <span className="text-small text-fg-muted">Paling banyak 10 sesi opsional tambahan per hari. Sesi opsional tidak memengaruhi streak.</span>
      <ActionError error={add.error} />
    </div>
  )
}

function Limits({ c, learnerId, name, onSaved }: { c: ParentChildDTO['controls']; learnerId: string; name: string; onSaved: () => void }) {
  const [minutes, setMinutes] = useState(String(c.screenLimitMin))
  const [rest, setRest] = useState<number[]>(c.restWeekdays)
  const [err, setErr] = useState<string | null>(null)
  const save = useAction(parentSaveLimitsAction)
  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <h3 className="m-0 text-body font-bold">Batas waktu layar</h3>
      <TextField label="Paling lama per hari (menit)" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} hint="Antara 15 dan 180 menit. Berlaku mulai besok." />
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-small font-bold">Hari istirahat</legend>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = rest.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => setRest(on ? rest.filter((x) => x !== d) : [...rest, d])}
              className={cx('h-11 min-w-12 rounded-control border-2 px-3 text-body font-bold', on ? 'border-fg bg-fg text-surface' : 'border-border bg-surface')}
            >
              {DAY[d]}
            </button>
          )
        })}
      </fieldset>
      {err ? <InlineAlert tone="danger" title={err} /> : null}
      <ActionError error={save.error} />
      <Button
        variant="secondary"
        className="h-12 self-start"
        loading={save.pending}
        onClick={async () => {
          const m = Number(minutes)
          if (!Number.isInteger(m) || m < 15 || m > 180) return setErr(`Batas ${name} harus 15 sampai 180 menit.`)
          if (rest.length >= 7) return setErr('Sisakan paling sedikit satu hari belajar.')
          setErr(null)
          const r = await save.run({ learnerId, screenLimitMin: m, restWeekdays: rest })
          if (r.ok) onSaved()
        }}
      >
        Simpan batas
      </Button>
    </div>
  )
}

function Sound({ c, learnerId, onSaved }: { c: ParentChildDTO['controls']; learnerId: string; onSaved: () => void }) {
  const [sound, setSound] = useState(c.soundEnabled)
  const [music, setMusic] = useState(c.musicEnabled)
  const save = useAction(parentSaveSoundAction)
  async function commit(s: boolean, m: boolean) {
    setSound(s)
    setMusic(m)
    const r = await save.run({ learnerId, soundEnabled: s, musicEnabled: m })
    if (r.ok) onSaved()
  }
  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <h3 className="m-0 text-body font-bold">Suara dan musik</h3>
      <div className="flex items-center gap-3">
        <span id="snd" className="flex-1 text-body">
          Efek suara
        </span>
        <Switch checked={sound} onChange={(v) => void commit(v, music)} labelledBy="snd" busy={save.pending} />
      </div>
      <div className="flex items-center gap-3">
        <span id="mus" className="flex-1 text-body">
          Musik latar
        </span>
        <Switch checked={music} onChange={(v) => void commit(sound, v)} labelledBy="mus" busy={save.pending} />
      </div>
      <ActionError error={save.error} />
    </div>
  )
}

function UiLangSettings({ c, learnerId, name, onSaved }: { c: ParentChildDTO['controls']; learnerId: string; name: string; onSaved: () => void }) {
  const [lang, setLang] = useState<UiLang>(c.uiLang)
  const [allow, setAllow] = useState(c.uiLangSwitch)
  const save = useAction(parentSaveUiLangAction)
  async function commit(l: UiLang, a: boolean) {
    setLang(l)
    setAllow(a)
    const r = await save.run({ learnerId, uiLang: l, uiLangSwitch: a })
    if (r.ok) onSaved()
  }
  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <UiLangChoice name="bahasa-anak" value={lang} onChange={(v) => void commit(v, allow)} disabled={save.pending} />
      <div className="flex items-center gap-3">
        <span id="bahasa-izin" className="flex-1 text-body">
          {name} boleh mengganti bahasa sendiri
        </span>
        <Switch checked={allow} onChange={(v) => void commit(lang, v)} labelledBy="bahasa-izin" busy={save.pending} />
      </div>
      <ActionError error={save.error} />
    </div>
  )
}

function PinTools({ learnerId, name, onDone }: { learnerId: string; name: string; onDone: (title: string) => void }) {
  const [pin, setPin] = useState<PinPicture[]>([])
  const [err, setErr] = useState<string | null>(null)
  const reset = useAction(parentResetPinAction)
  const unlock = useAction(parentUnlockAction)
  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <h3 className="m-0 text-body font-bold">PIN {name}</h3>
      <PinChooser value={pin} onChange={setPin} legend={`PIN gambar baru untuk ${name}`} />
      {err ? <InlineAlert tone="danger" title={err} /> : null}
      <ActionError error={reset.error ?? unlock.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="h-12"
          loading={reset.pending}
          onClick={async () => {
            const p = pinProblem(pin)
            if (p) return setErr(p)
            setErr(null)
            const r = await reset.run({ learnerId, pin })
            if (r.ok) {
              setPin([])
              onDone(`PIN ${name} diganti. Tablet yang sedang masuk keluar otomatis.`)
            }
          }}
        >
          Ganti PIN
        </Button>
        <Button
          variant="secondary"
          className="h-12"
          loading={unlock.pending}
          onClick={async () => {
            const r = await unlock.run({ learnerId })
            if (r.ok) onDone(`PIN ${name} dibuka kuncinya. Coba masuk lagi.`)
          }}
        >
          Buka kunci PIN
        </Button>
      </div>
      <span className="text-small text-fg-muted">Buka kunci kalau {name} salah memasukkan PIN beberapa kali dan terkunci sementara.</span>
    </div>
  )
}

function EditProfile({ learnerId, name, grade, avatar }: { learnerId: string; name: string; grade: number; avatar: AvatarName }) {
  const [n, setN] = useState(name)
  const [g, setG] = useState(String(grade))
  const [a, setA] = useState<AvatarName>(avatar)
  const save = useAction(parentEditChildAction)
  const [done, setDone] = useState(false)
  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <h3 className="m-0 text-body font-bold">Nama, kelas, dan avatar</h3>
      <TextField label="Nama" value={n} onChange={(e) => (setN(e.target.value), setDone(false))} maxLength={40} />
      <RadioGroup name="kelas-ubah" legend="Kelas" value={g} onChange={(v) => (setG(v), setDone(false))} options={['1', '2', '3', '4', '5', '6'].map((x) => ({ value: x, label: `Kelas ${x}` }))} layout="row" />
      <AvatarPicker value={a} onChange={(v) => (setA(v), setDone(false))} taken={{}} />
      {Number(g) !== grade ? <InlineAlert tone="info" title="Mengganti kelas mengubah soal yang diberikan mulai hari berikutnya." live="none" /> : null}
      {done ? <InlineAlert tone="success" title="Profil tersimpan." /> : null}
      <ActionError error={save.error} />
      <Button
        variant="secondary"
        className="h-12 self-start"
        loading={save.pending}
        onClick={async () => {
          const r = await save.run({ learnerId, name: n.trim(), grade: Number(g), avatar: a })
          if (r.ok) setDone(true)
        }}
      >
        Simpan profil
      </Button>
    </div>
  )
}

function WorkCard({ w, hasTutor }: { w: ParentWorkDTO; hasTutor: boolean }) {
  const mark = useAction(parentMarkWorkAction)
  const [feedback, setFeedback] = useState(w.feedback ?? '')
  const label = { write: 'Tulisan', speak: 'Rekaman suara', draw: 'Gambar', photo: 'Foto' }[w.type]
  return (
    <article className="flex flex-col gap-2 rounded-control border border-divider p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body font-bold">{label}</span>
        <span className="text-small text-fg-muted">{SUBJECT_NAME[w.subject]}, {w.title}</span>
        <Pill tone={w.status === 'pending' ? 'opsional' : 'selesai'}>{w.status === 'pending' ? 'Belum dinilai' : w.status === 'correct' ? 'Bagus' : 'Coba lagi'}</Pill>
      </div>
      <p className="m-0 text-small text-fg-muted">{w.prompt}</p>
      {w.text ? <p className="m-0 rounded-control bg-bg p-3 font-reading text-body">{w.text}</p> : null}
      {w.mediaId ? (
        w.type === 'speak' ? (
          <audio controls src={`/api/media/${w.mediaId}`} className="w-full" />
        ) : (
          <img src={`/api/media/${w.mediaId}`} alt={`${label} anak`} className="max-h-72 w-full rounded-control object-contain" />
        )
      ) : null}
      {w.criteria.length > 0 ? (
        <>
          <TextField label="Catatan untuk anak (boleh kosong)" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={500} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="S" loading={mark.pending} onClick={() => void mark.run({ responseId: w.responseId, verdict: 'good', feedback })}>
              Bagus
            </Button>
            <Button variant="secondary" size="S" loading={mark.pending} onClick={() => void mark.run({ responseId: w.responseId, verdict: 'again', feedback })}>
              Coba lagi
            </Button>
          </div>
        </>
      ) : null}
      <ActionError error={mark.error} />
      <span className="text-small text-fg-muted">
        {hasTutor ? 'Tutor juga bisa menilai ini.' : 'Menilai itu pilihan. Anak tidak menunggu penilaian, dan skor serta streak tidak berubah.'}
      </span>
    </article>
  )
}
