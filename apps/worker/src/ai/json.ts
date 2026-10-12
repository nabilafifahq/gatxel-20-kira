/**
 * Ambil satu objek JSON dari teks jawaban model, untuk provider yang tidak mendukung keluaran
 * terstruktur. Mencoba seluruh teks, lalu blok ```json, lalu objek pertama yang seimbang kurungnya.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const direct = tryParse(trimmed)
  if (direct !== undefined) return direct
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fence?.[1]) {
    const inFence = tryParse(fence[1].trim())
    if (inFence !== undefined) return inFence
  }
  for (let start = trimmed.indexOf('{'); start !== -1; start = trimmed.indexOf('{', start + 1)) {
    const end = balancedEnd(trimmed, start)
    if (end === -1) continue
    const candidate = tryParse(trimmed.slice(start, end + 1))
    if (candidate !== undefined) return candidate
  }
  return undefined
}

function tryParse(s: string): unknown {
  try {
    const v: unknown = JSON.parse(s)
    return v !== null && typeof v === 'object' ? v : undefined
  } catch {
    return undefined
  }
}

function balancedEnd(s: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
