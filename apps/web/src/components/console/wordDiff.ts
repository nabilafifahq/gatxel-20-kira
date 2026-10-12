/**
 * Beda kata sederhana (LCS) antara dua teks, untuk membandingkan soal asal dan draf AI.
 * Mengembalikan potongan untuk kiri (dengan tanda 'removed') dan kanan (dengan tanda 'added').
 */
export type DiffPart = { text: string; mark: 'same' | 'added' | 'removed' }

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t.length > 0)
}

export function wordDiff(a: string, b: string): { left: DiffPart[]; right: DiffPart[] } {
  const A = tokenize(a)
  const B = tokenize(b)
  // Batasi biaya untuk teks panjang
  if (A.length * B.length > 250_000) {
    return { left: [{ text: a, mark: 'same' }], right: [{ text: b, mark: 'same' }] }
  }
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0))
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const left: DiffPart[] = []
  const right: DiffPart[] = []
  const push = (arr: DiffPart[], text: string, mark: DiffPart['mark']) => {
    const last = arr[arr.length - 1]
    if (last && last.mark === mark) last.text += text
    else arr.push({ text, mark })
  }
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      push(left, A[i]!, 'same')
      push(right, B[j]!, 'same')
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push(left, A[i]!, /^\s+$/.test(A[i]!) ? 'same' : 'removed')
      i++
    } else {
      push(right, B[j]!, /^\s+$/.test(B[j]!) ? 'same' : 'added')
      j++
    }
  }
  while (i < A.length) push(left, A[i++]!, 'removed')
  while (j < B.length) push(right, B[j++]!, 'added')
  return { left, right }
}
