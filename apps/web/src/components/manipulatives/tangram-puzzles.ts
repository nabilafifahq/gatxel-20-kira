import type { PieceType, Pt } from '@kira/content/manip'
import type { Dict } from '@/lib/i18n'

/**
 * Teka-teki bebas untuk halaman Alat dan langkah pelajaran. Semuanya potongan dari persegi tangram 4 x 4
 * (lihat manip.ts), jadi tiap tempat terisi persis oleh satu keping.
 */
export type TangramPuzzle = { name: keyof Dict['widgets']['tangram']['puzzles']; pieces: PieceType[]; slots: Pt[][] }

const L1: Pt[] = [[0, 0], [4, 0], [2, 2]]
const L2: Pt[] = [[4, 0], [4, 4], [2, 2]]
const M: Pt[] = [[0, 4], [0, 2], [2, 4]]
const S1: Pt[] = [[0, 0], [0, 2], [1, 1]]
const Q: Pt[] = [[0, 2], [1, 1], [2, 2], [1, 3]]
const S2: Pt[] = [[2, 2], [1, 3], [3, 3]]
const P: Pt[] = [[2, 4], [4, 4], [3, 3], [1, 3]]

export const TANGRAM_PLAY: TangramPuzzle[] = [
  { name: 'twoTriangles', pieces: ['L', 'L'], slots: [L1, L2] },
  { name: 'threePieces', pieces: ['L', 'L', 'M'], slots: [L1, L2, M] },
  { name: 'bigTriangle', pieces: ['M', 'S', 'Q', 'S', 'P'], slots: [M, S1, Q, S2, P] },
  { name: 'square', pieces: ['L', 'L', 'M', 'S', 'Q', 'S', 'P'], slots: [L1, L2, M, S1, Q, S2, P] },
]
