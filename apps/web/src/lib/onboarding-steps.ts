import type { SetupPath } from '@kira/core/recommendation'

export type OnboardingStep = 1 | 2 | 3

export const ONBOARDING_STEPS: { step: OnboardingStep; label: string }[] = [
  { step: 1, label: 'Tambah anak' },
  { step: 2, label: 'Pilih jalur' },
  { step: 3, label: 'Cara anak masuk' },
]

/** Langkah paling jauh yang sudah terbuka, dari data server. */
export function naturalStep(children: readonly { setupPath: SetupPath | null }[]): OnboardingStep {
  if (children.length === 0) return 1
  return children.some((c) => c.setupPath === null) ? 2 : 3
}

/**
 * Langkah yang ditampilkan. Tanpa permintaan: langkah paling jauh yang terbuka, jadi muat ulang melanjutkan di tempat yang benar.
 * Mundur selalu boleh. Maju melewati langkah yang belum selesai diarahkan ke langkah itu, jadi tidak pernah buntu.
 */
export function resolveStep(children: readonly { setupPath: SetupPath | null }[], requested: string | null | undefined): OnboardingStep {
  const natural = naturalStep(children)
  const n = Number(requested)
  if (n !== 1 && n !== 2 && n !== 3) return natural
  return Math.min(n, natural) as OnboardingStep
}
