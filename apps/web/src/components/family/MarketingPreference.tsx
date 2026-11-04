'use client'

import { useState } from 'react'
import { ActionError } from '@/components/console/Feedback'
import { Switch } from '@/components/console/Field'
import { useAction } from '@/components/console/useAction'
import type { ActionResult } from '@/lib/dto'

/** Pilihan email kabar produk di halaman Privasi keluarga. Berlaku untuk akun orang tua, bukan per anak. */
export function MarketingPreference({ initial, setMarketing }: { initial: boolean; setMarketing: (input: { optIn: boolean }) => Promise<ActionResult<{ optIn: boolean }>> }) {
  const [optIn, setOptIn] = useState(initial)
  const save = useAction(setMarketing)
  return (
    <section aria-labelledby="kabar-produk" className="flex flex-col gap-3">
      <h2 id="kabar-produk" className="m-0 text-h3 font-bold">
        Email kabar produk
      </h2>
      <div className="flex items-start gap-4 rounded-card bg-surface p-4 shadow-soft">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span id="kabar-produk-label" className="text-body font-semibold">
            Kabar produk, tips belajar, dan penawaran dari Kira lewat email (opsional)
          </span>
          <span id="kabar-produk-isi" className="text-small text-fg-muted">
            {optIn ? 'Aktif. ' : 'Tidak aktif. '}Bisa diubah kapan saja. Laporan belajar dan email penting soal akun tidak terpengaruh.
          </span>
        </div>
        <Switch
          checked={optIn}
          labelledBy="kabar-produk-label"
          describedBy="kabar-produk-isi"
          busy={save.pending}
          onChange={async (next) => {
            const r = await save.run({ optIn: next })
            if (r.ok) setOptIn(r.data.optIn)
          }}
        />
      </div>
      <ActionError error={save.error} />
    </section>
  )
}
