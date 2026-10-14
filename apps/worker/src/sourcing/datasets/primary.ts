import { createHash } from 'node:crypto'

/**
 * Penyaring tingkat SD untuk dataset Science yang tidak berlabel kelas (SciQ, QASC). Aturan sederhana dan bisa dibaca:
 * soal pendek, kata pendek, tanpa istilah SMP atau SMA. Lebih baik membuang soal bagus daripada meloloskan yang terlalu sulit.
 * Mengembalikan kelas perkiraan 3 sampai 5, atau null bila bukan tingkat SD.
 */

const ADVANCED = new RegExp(
  `(${[
    'atom\\w*', 'molecul\\w*', 'electron\\w*', 'proton\\w*', 'neutron\\w*', 'isotop\\w*', 'enzym\\w*', 'chromosom\\w*', 'mitosis', 'meiosis', '\\bdna\\b', '\\brna\\b', 'covalent', 'ionic', '\\bions?\\b',
    'hydro\\w*', 'oxid\\w*', 'carbon\\w*', 'nitrogen\\w*', 'protein\\w*', 'lipid\\w*', 'cytoplasm', 'organelle\\w*', 'nucleus', 'nuclei', 'prokaryot\\w*', 'eukaryot\\w*', 'bacteri\\w*', 'virus\\w*',
    'quantum', 'relativity', 'wavelength', 'frequency', 'amplitude', 'velocity', 'acceleration', 'momentum', 'kinetic', 'potential energy', 'thermodynamic\\w*', 'entropy', 'photon\\w*', 'radiation',
    'genotype', 'phenotype', 'allele\\w*', 'mutation\\w*', 'evolution\\w*', 'natural selection', 'taxonom\\w*', 'phylum', 'metabol\\w*', 'respiration', 'synaps\\w*', 'neuron\\w*', 'hormone\\w*',
    'stoichiometr\\w*', 'molarity', 'titration', 'equilibrium', 'catalyst\\w*', 'polymer\\w*', 'isomer\\w*', 'alkane\\w*', '\\bph\\b', 'tectonic\\w*', 'lithosphere', 'asthenosphere', 'magma', 'sedimentary',
    'pituitary', 'thyroid', 'arthropod\\w*', 'vascular', 'dialysis', 'meteoroid', 'endosperm', 'amorphous', 'refract\\w*', 'gland\\w*', 'tissue\\w*', 'organism\\w*', 'which of the following', 'percent', 'ratio', 'equation', 'formula', 'calculate',
  ].join('|')})`,
  'i',
)

const words = (s: string): string[] => s.split(/[^A-Za-z']+/).filter(Boolean)

export function primaryGrade(question: string, options: readonly string[]): number | null {
  const q = words(question)
  if (q.length < 4 || q.length > 20) return null
  if (ADVANCED.test(question) || options.some((o) => ADVANCED.test(o))) return null
  const all = [...q, ...options.flatMap(words)]
  if (all.some((w) => w.length > 12)) return null
  const avg = q.reduce((a, w) => a + w.length, 0) / q.length
  if (avg > 5.6) return null
  if (options.some((o) => words(o).length > 5)) return null
  return q.length <= 10 ? 3 : q.length <= 14 ? 4 : 5
}

/** Susun opsi dengan urutan tetap untuk soal yang sama (diacak dari hash teks soal). */
export function arrangeOptions(correct: string, wrong: readonly string[], seed: string): { options: string[]; answer: number } {
  const all = [correct, ...wrong]
  const h = createHash('sha256').update(seed).digest()
  const order = all.map((_, i) => i).sort((a, b) => h[a % h.length]! - h[b % h.length]! || a - b)
  const options = order.map((i) => all[i]!)
  return { options, answer: options.indexOf(correct) }
}

export type HfRowsPage = { rows?: { row_idx?: number; row?: Record<string, unknown> }[]; num_rows_total?: number }
