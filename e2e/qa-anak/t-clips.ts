import { families, resolveItem, sql } from './lib'
import { itemSpeechClips, passageSpeechClips } from '../../packages/content/src/speech'
import { loadContent } from '../../packages/content/src/load'
async function main() {
  const idx = loadContent().index
  for (const f of families().filter((x) => [2, 4].includes(x.grade))) {
    const date = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
    const qs = await sql`select status, mode, attempt_id, skill_id from quest where learner_id = ${f.learnerId!} and date = ${date}`
    const open = qs.filter((q) => q.status !== 'done' && q.attempt_id)
    let items = 0, clips = 0
    const seen = new Set<string>()
    for (const q of open) {
      const [a] = await sql`select items from attempt where id = ${q.attempt_id}`
      for (const it of (a?.items ?? []) as { ref: string }[]) {
        const item = resolveItem(it.ref)
        if (!item) continue
        items++
        clips += itemSpeechClips(item).length
        if (item.passage && !seen.has(item.passage)) { seen.add(item.passage); const p = idx.passages.get(item.passage); if (p) clips += passageSpeechClips(p).length }
      }
    }
    console.log(f.grade, f.name, 'quests', qs.length, 'open', open.length, 'items', items, 'clips', clips)
  }
  await sql.end()
}
main()
