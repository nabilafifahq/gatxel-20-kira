import 'server-only'
import { notFound } from 'next/navigation'
import { isFeatureOn } from './dal/learner-features'

/** Halaman Kira World hanya terbuka bila saklar fitur `kira-world` menyala untuk anak ini. */
export async function worldGate(learnerId: string): Promise<void> {
  if (!(await isFeatureOn(learnerId, 'kira-world'))) notFound()
}
