// apps/web/src/server/dal/learner-features.ts
import type { FeatureKey } from '@kira/core/features'
export async function isFeatureOn(_learnerId: string, _key: FeatureKey): Promise<boolean> { return true }
