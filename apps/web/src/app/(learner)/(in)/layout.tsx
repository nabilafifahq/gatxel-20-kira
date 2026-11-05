import { LearnerRuntime } from '@/components/runtime/LearnerRuntime'
import { SoundRuntime } from '@/components/learner/SoundRuntime'
import { PageTransition } from '@/components/learner/PageTransition'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { inOrg } from '@/server/db'
import { soundPolicyOf } from '@/server/dal/learner-motion'
import { DictionaryProvider } from '@/components/learner/DictionaryProvider'
import { ExplainLangProvider } from '@/components/learner/explain-lang'
import { isFeatureOn } from '@/server/dal/learner-features'
import { savedWordSet } from '@/server/dal/vocab'

// Pilihan suara jarang berubah: simpan 20 detik per proses supaya tiap pindah layar tidak membuka transaksi.
const soundCache = new Map<string, { at: number; policy: { sfx: boolean; music: boolean } }>()

/** Semua layar learner yang butuh sesi anak. */
export default async function LearnerInLayout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor(['learner'])
  // Pilihan suara dan musik dari tutor mengalahkan pilihan perangkat.
  const hit = soundCache.get(actor.userId)
  const policy =
    hit && Date.now() - hit.at < 20_000
      ? hit.policy
      : await inOrg(orgCtx(actor), (tx) => soundPolicyOf(tx, actor.userId)).then(
          (p) => {
            if (soundCache.size > 2000) soundCache.clear()
            soundCache.set(actor.userId, { at: Date.now(), policy: p })
            return p
          },
          () => ({ sfx: true, music: true }),
        )
  // Kamus Ketuk: saklar fitur dari orang tua atau tutor, dan kata yang sudah disimpan (untuk tombol Save).
  const dictOn = await isFeatureOn(actor.userId, 'dictionary').catch(() => false)
  const saved = dictOn ? await inOrg(orgCtx(actor), (tx) => savedWordSet(tx, actor.userId)).catch(() => []) : []
  return (
    <DictionaryProvider enabled={dictOn} initialSaved={saved}>
      <ExplainLangProvider learnerId={actor.userId} idFirst={actor.explainIdFirst ?? false}>
        <PageTransition>{children}</PageTransition>
      </ExplainLangProvider>
      <LearnerRuntime screenLimitMin={60} />
      <SoundRuntime sfx={policy.sfx} music={policy.music} />
    </DictionaryProvider>
  )
}
