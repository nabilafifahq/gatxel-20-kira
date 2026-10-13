import type { ClientItem } from '@kira/content/present'
import type { RunnerDTO, RunnerItem, SavedResponse } from '@/lib/dto'

/** Fungsi unggah media untuk widget bicara dan gambar (di luar RunnerActions). */
export type RunnerUpload = (
  blob: Blob,
  kind: 'audio' | 'drawing' | 'image',
  ctx: { attemptId: string; position: number },
) => Promise<{ mediaId: string } | null>

export function sortedItems(data: RunnerDTO): RunnerItem[] {
  return [...data.items].sort((a, b) => a.position - b.position)
}

export function savedByPosition(saved: SavedResponse[]): Map<number, SavedResponse> {
  const m = new Map<number, SavedResponse>()
  for (const s of saved) m.set(s.position, s)
  return m
}

/** Kalimat waktu untuk soal: "about 10 minutes". */
export function minutesWord(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60))
  return m === 1 ? 'about 1 minute' : `about ${m} minutes`
}

export function hintsOf(item: ClientItem): string[] {
  return item.hints ?? []
}

export function testWord(kind: RunnerDTO['kind']): string {
  switch (kind) {
    case 'test':
      return 'test'
    case 'simulation':
      return 'mock test'
    case 'paper':
      return 'paper'
    case 'quest':
      return 'quest'
    case 'review':
      return 'review'
    default:
      return 'answers'
  }
}
