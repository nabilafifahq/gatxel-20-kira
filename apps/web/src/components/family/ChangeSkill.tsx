'use client'

import { useState } from 'react'
import type { ParentSkillOptionsDTO } from '@/lib/dto-parent'
import { Button } from '@/components/console/Button'
import { Dialog } from '@/components/console/Dialog'
import { ActionError, EmptyState, InlineAlert, SkeletonRows } from '@/components/console/Feedback'
import { RadioGroup } from '@/components/console/Field'
import { useAction } from '@/components/console/useAction'
import { parentChangeSessionSkillAction, parentSkillOptionsAction } from '@/server/actions/parent'

/**
 * Tombol "Ganti pelajaran" dan dialog pilihannya: pelajaran kelas anak dan mapel sesi, dikelompokkan per topik.
 * Daftarnya dimuat saat dialog dibuka. Setelah tersimpan, halaman anak dimuat ulang oleh Server Action.
 */
export function ChangeSkill({ questId, label, disabled, onNote }: { questId: string; label: string; disabled?: boolean; onNote: (note: string) => void }) {
  const options = useAction(parentSkillOptionsAction)
  const save = useAction(parentChangeSessionSkillAction)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ParentSkillOptionsDTO | null>(null)
  const [picked, setPicked] = useState('')

  async function show() {
    setOpen(true)
    setData(null)
    save.reset()
    const r = await options.run({ questId })
    if (r.ok) {
      setData(r.data)
      setPicked(r.data.currentSkillId ?? '')
    }
  }

  async function submit() {
    const r = await save.run({ questId, skillId: picked })
    if (r.ok) {
      setOpen(false)
      onNote(r.data.note)
    }
  }

  const current = data?.currentSkillId ?? null
  return (
    <>
      <Button variant="secondary" className="self-start" disabled={disabled} onClick={() => void show()} aria-haspopup="dialog">
        Ganti pelajaran
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!save.pending}
        size="lg"
        title={`Ganti pelajaran ${label}`}
        description={data ? `Hanya untuk hari ini. Yang berganti: ${data.appliesTo}. Wajib atau opsional tetap sama, jadi hitungan streak tidak berubah.` : undefined}
        footer={
          data && data.topics.length > 0 ? (
            <>
              <Button variant="quiet" disabled={save.pending} onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" loading={save.pending} disabled={!picked || picked === current} onClick={() => void submit()}>
                Pakai pelajaran ini
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          {options.pending ? <SkeletonRows label="Memuat daftar pelajaran" /> : null}
          <ActionError error={options.error ?? save.error} />
          {data?.note ? <InlineAlert tone="info" title={data.note} /> : null}
          {data && data.topics.length === 0 ? <EmptyState compact title="Belum ada pelajaran lain untuk sesi ini." body="Mapel ini mungkin sedang dimatikan di Fitur yang dipakai." /> : null}
          {data?.topics.map((t) => (
            <RadioGroup
              key={t.id}
              name={`pelajaran-${questId}`}
              legend={t.label}
              layout="stack"
              value={picked}
              onChange={setPicked}
              options={t.skills.map((s) => ({ value: s.id, label: s.id === current ? `${s.title} (sekarang)` : s.title, description: s.titleEn }))}
            />
          ))}
        </div>
      </Dialog>
    </>
  )
}
