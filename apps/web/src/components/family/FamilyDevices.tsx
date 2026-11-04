'use client'

import { useState } from 'react'
import { Button } from '@/components/console/Button'
import { Dialog } from '@/components/console/Dialog'
import { ActionError } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { revokeFamilyDeviceAction } from '@/server/actions/family-code'
import type { FamilyDevice } from '@/server/dal/family-code'

function lastSeen(iso: string | null): string {
  if (!iso) return 'Belum pernah dipakai'
  return `Terakhir dipakai ${new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })}`
}

/** Perangkat yang dipakai anak, termasuk yang masuk dengan kode keluarga. Mencabut langsung mengakhiri sesi anak di sana. */
export function FamilyDevices({ devices }: { devices: FamilyDevice[] }) {
  const [list, setList] = useState(devices)
  const [revoking, setRevoking] = useState<FamilyDevice | null>(null)
  const revoke = useAction(revokeFamilyDeviceAction)

  async function confirm() {
    if (!revoking) return
    const r = await revoke.run({ deviceId: revoking.id })
    if (!r.ok) return
    setList((l) => l.filter((d) => d.id !== revoking.id))
    setRevoking(null)
  }

  return (
    <section aria-labelledby="perangkat-anak" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-soft">
      <h2 id="perangkat-anak" className="m-0 text-h3 font-bold">
        Perangkat anak
      </h2>
      {list.length === 0 ? (
        <p className="m-0 text-body text-fg-muted">Belum ada perangkat. Perangkat muncul di sini setelah anak masuk.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.map((d) => (
            <li key={d.id} data-testid="family-device" className="flex flex-wrap items-center gap-3 rounded-control border border-divider p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-bold break-words">{d.name}</span>
                <span className="text-small text-fg-muted">
                  {d.learners.join(', ')}. {lastSeen(d.lastSeenAt)}.
                </span>
              </div>
              <Button variant="secondary" onClick={() => (revoke.reset(), setRevoking(d))} aria-label={`Cabut ${d.name}`}>
                Cabut
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-small text-fg-muted">Bila perangkat hilang, cabut perangkatnya lalu ganti kode keluarga.</p>
      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        dismissible={!revoke.pending}
        title={`Cabut ${revoking?.name ?? 'perangkat'}?`}
        description="Anak yang sedang memakainya langsung keluar. Perangkat itu perlu kode keluarga lagi untuk masuk."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)} disabled={revoke.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={confirm} loading={revoke.pending}>
              Cabut perangkat
            </Button>
          </>
        }
      >
        <ActionError error={revoke.error} />
      </Dialog>
    </section>
  )
}
