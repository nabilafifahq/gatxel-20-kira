'use client'

import type { ReactElement } from 'react'
import type { RunnerActions, RunnerDTO } from '@/lib/dto'
import { ToastProvider } from '@/components/ui/Toast'
import { PracticeRunner } from './runner/PracticeRunner'
import type { RunnerUpload } from './runner/shared'
import { SprintRunner } from './runner/SprintRunner'
import { TestRunner } from './runner/TestRunner'

export type { RunnerUpload } from './runner/shared'

/**
 * L04, L05, L06 Runner. Mode kilat memakai runner sprint 60 detik; mode tanpa umpan balik
 * (tes, simulasi) memakai runner tes berwaktu; selain itu runner latihan satu soal per layar.
 *
 * `onUpload` di luar RunnerActions: unggah rekaman suara dan gambar untuk soal bicara dan
 * gambar. Tanpa fungsi ini kedua widget menampilkan keadaan "dimatikan" dan bisa dilewati.
 */
export function RunnerScreen({ data, actions, onUpload }: { data: RunnerDTO; actions: RunnerActions; onUpload?: RunnerUpload }): ReactElement {
  let body: ReactElement
  if (data.mode === 'kilat') body = <SprintRunner data={data} actions={actions} />
  else if (!data.showFeedback) body = <TestRunner data={data} actions={actions} onUpload={onUpload} />
  else body = <PracticeRunner data={data} actions={actions} onUpload={onUpload} />
  return <ToastProvider area="learner">{body}</ToastProvider>
}
