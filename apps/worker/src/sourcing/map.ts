import type { Skill } from '@kira/content'
import type { Candidate, Mapping } from './types'

/**
 * Pemetaan soal dari sumber luar ke skill dan kelas Kira (rencana 10.7). Aturan kata kunci sederhana dan bisa dibaca:
 * satu topik dipilih dari teks soal dan petunjuk sumber, lalu skill di kelas itu yang cocok dengan topiknya.
 * Soal yang tidak punya skill yang cocok di kelasnya dikembalikan null dan tidak dipublikasikan.
 */

/** skillSlugs: urutan pilihan; skill pertama yang ada di kelas itu dipakai. */
type MathTopic = { name: string; test: RegExp; skillSlugs: RegExp[] }

// Urutan penting: topik yang lebih khusus lebih dulu.
const MATH_TOPICS: MathTopic[] = [
  { name: 'percent', test: /%|\bpercent\b|\bdiscount\b/i, skillSlugs: [/percent/, /fdp/] },
  { name: 'ratio', test: /\bratio\b|\bproportion\b|\bfor every\b/i, skillSlugs: [/ratio/] },
  { name: 'decimals', test: /\d\.\d/, skillSlugs: [/decimal/] },
  { name: 'fractions', test: /\bhalf\b|\bquarter\b|\bthirds?\b|\bfractions?\b|\d\/\d/i, skillSlugs: [/fractions-of-amounts/, /^fractions$/, /halves/, /quarters/, /fraction/] },
  { name: 'money', test: /\$|\bdollars?\b|\bcents?\b|\bprice\b|\bcosts?\b|\bpaid\b|\bpay\b|\bchange\b|\bcoins?\b|\bspent\b|\bbought\b|\bsold\b|\bsells?\b|\bearns?\b/i, skillSlugs: [/money/] },
  { name: 'time', test: /o'clock|\bminutes?\b|\bhours?\b|\bclock\b|\bschedule\b|\bcalendar\b/i, skillSlugs: [/time|clock|oclock/, /days-months/] },
  { name: 'measure', test: /\bmeters?\b|\bmetres?\b|\bcentimet\w+|\bkilogram\w*|\bkg\b|\bcm\b|\bliters?\b|\blitres?\b|\bgrams?\b|\bml\b|\binch(?:es)?\b|\bfeet\b|\bfoot\b|\byards?\b|\bmiles?\b|\bpounds?\b|\bweigh\w*|\btall\b|\bheavy\b/i, skillSlugs: [/length/, /mass/, /measure/, /capacity/, /convert/, /temperature/] },
  { name: 'geometry', test: /\bperimeter\b|\barea\b|\brectangle\b|\bsquare\b|\btriangle\b|\bcircle\b/i, skillSlugs: [/perimeter/, /area/, /shapes/] },
  { name: 'division', test: /\bshared? equally\b|\bdivided?\b|\bsplit\b|\bgroups?\b|\bin each\b|\bper (?:box|bag|day|week|row)\b/i, skillSlugs: [/^division/, /divide/] },
  { name: 'multiplication', test: /\beach\b|\bevery\b|\btimes\b|\bpacks? of\b|\bboxes of\b|\brows? of\b|\bmultipl\w+/i, skillSlugs: [/times-tables/, /multiply/, /multiplication/] },
]

const TAKES_AWAY = /subtract|difference|\bleft\b|\bremain\w*|\bfewer\b|\bgave away\b|\bgives? away\b|\blost\b|\bbroke\w*|\bate\b|\beats?\b|\bfly away\b|\bflew away\b|\btook\b|\bspent\b|\bsold\b/i

function bySlug(skills: readonly Skill[], re: RegExp): Skill | undefined {
  return [...skills].sort((a, b) => a.order - b.order).find((s) => re.test(s.id.split('.').slice(1).join('.')))
}

function firstSlug(skills: readonly Skill[], slugs: readonly RegExp[]): Skill | undefined {
  for (const re of slugs) {
    const s = bySlug(skills, re)
    if (s) return s
  }
  return undefined
}

/** Skill tambah atau kurang di kelas itu; arah hitungan dari petunjuk sumber dan kata di soal. */
function addSubSkill(skills: readonly Skill[], c: Pick<Candidate, 'prompt' | 'topicHint'>): Skill | undefined {
  const subtract = !/addition/i.test(c.topicHint ?? '') && TAKES_AWAY.test(`${c.topicHint ?? ''} ${c.prompt}`)
  const order = subtract
    ? [/subtract/, /add-sub|add-subtract/, /addition|add-within|^add$/, /number-bonds/]
    : [/addition|add-within|^add$/, /add-sub|add-subtract/, /subtract/, /number-bonds/]
  return firstSlug(skills, order)
}

export function mathTopic(c: Pick<Candidate, 'prompt' | 'topicHint'>): string {
  const text = `${c.topicHint ?? ''} ${c.prompt}`
  const hit = MATH_TOPICS.find((t) => t.test.test(text))
  if (hit) return hit.name
  if (/division/i.test(c.topicHint ?? '')) return 'division'
  if (/multiplication|ratio|common-division/i.test(c.topicHint ?? '')) return 'multiplication'
  return 'add-sub'
}

type ScienceRule = { name: string; test: RegExp; strands: string[] }

const SCIENCE_RULES: ScienceRule[] = [
  { name: 'habitat', test: /\bhabitats?\b|\bfood chains?\b|\bfood webs?\b|\bpredators?\b|\bprey\b|\becosystems?\b|\bproducers?\b|\bconsumers?\b|\bdeserts?\b|\bforests?\b|\bocean\b/gi, strands: ['Be'] },
  { name: 'plants', test: /\bplants?\b|\bseeds?\b|\bleaf\b|\bleaves\b|\broots?\b|\bflowers?\b|\bstems?\b|\btrees?\b|\bphotosynth\w*|\bpollen\b|\bfruits?\b/gi, strands: ['Bs', 'Bp'] },
  { name: 'animals-body', test: /\banimals?\b|\bbirds?\b|\bfish\b|\binsects?\b|\bmammals?\b|\breptiles?\b|\bamphibians?\b|\bbones?\b|\bmuscles?\b|\bheart\b|\blungs?\b|\bteeth\b|\btooth\b|\bdigest\w*|\bskeleton\b|\bbody\b|\bskin\b/gi, strands: ['Bs', 'Bp'] },
  { name: 'life', test: /\bbreath\w*|\bgrow\w*|\breproduc\w*|\boffspring\b|\blife cycles?\b|\bnutrient\w*|\bvitamins?\b|\bhealthy\b|\bexercise\b|\bfood\b/gi, strands: ['Bp'] },
  { name: 'materials', test: /\bmaterials?\b|\bmetals?\b|\bplastic\b|\bwood\b|\bglass\b|\brubber\b|\bsolids?\b|\bliquids?\b|\bgas(?:es)?\b|\bmelt\w*|\bfreez\w*|\bboil\w*|\bevaporat\w*|\bcondens\w*|\bdissolv\w*|\bmixture\b|\brust\w*|\bburn\w*/gi, strands: ['Cm', 'Cp', 'Cc'] },
  { name: 'electricity', test: /\belectric\w*|\bcircuits?\b|\bbatter\w+|\bmagnet\w*|\bcurrent\b|\bconductors?\b|\binsulators?\b/gi, strands: ['Pe', 'Cp'] },
  { name: 'light-sound', test: /\blight\b|\bshadows?\b|\bsound\b|\bvibrat\w*|\bmirrors?\b|\breflect\w*|\blens\b|\bpitch\b|\becho\b|\beyes?\b|\bloud\b/gi, strands: ['Pl'] },
  { name: 'forces', test: /\bforces?\b|\bpush\b|\bpull\b|\bgravity\b|\bfriction\b|\bmotion\b|\bspeed\b|\benergy\b|\bheat\b|\btemperature\b|\bmachines?\b|\blever\b|\bweight\b|\bmass\b/gi, strands: ['Pf'] },
  { name: 'space', test: /\bsun\b|\bmoon\b|\bplanets?\b|\bstars?\b|\borbit\w*|\bsolar\b|\bgalax\w+|\bday and night\b/gi, strands: ['ESs'] },
  { name: 'earth', test: /\brocks?\b|\bsoil\b|\bminerals?\b|\bvolcano\w*|\bearthquake\w*|\bfossils?\b|\bwater cycle\b|\brain\b|\bclouds?\b|\bweather\b|\bseasons?\b|\bclimate\b|\brivers?\b|\berosion\b|\batmosphere\b|\bcontinents?\b|\bmountains?\b/gi, strands: ['ESp', 'ESc'] },
  { name: 'inquiry', test: /\bexperiments?\b|\binvestigat\w*|\bvariables?\b|\bmeasur\w*|\bpredict\w*|\bhypothes\w*|\bscientists?\b|\bobserv\w*/gi, strands: ['TWS'] },
]

/**
 * Aturan Science dengan kata kunci paling banyak; kata di soal bernilai empat kali kata di opsi, seri dimenangkan aturan yang
 * lebih dulu. Soal tanpa satu pun kata kunci tidak dipetakan (null): lebih baik dibuang daripada salah skill.
 */
export function scienceRule(c: Pick<Candidate, 'prompt' | 'options' | 'topicHint'>): ScienceRule | null {
  const stem = `${c.topicHint ?? ''} ${c.prompt}`
  const options = (c.options ?? []).join(' ')
  let best: { rule: ScienceRule; hits: number } | null = null
  for (const rule of SCIENCE_RULES) {
    const hits = 4 * (stem.match(rule.test) ?? []).length + (options.match(rule.test) ?? []).length
    if (hits > (best?.hits ?? 0)) best = { rule, hits }
  }
  return best?.rule ?? null
}

function overlap(skill: Skill, text: string): number {
  // Akar kata sederhana (buang "s" di akhir) supaya "conductors" cocok dengan "conductor".
  const stem = (w: string) => w.replace(/s$/, '')
  const words = new Set(text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).map(stem))
  return `${skill.title} ${skill.canDo}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && words.has(stem(w))).length
}

/** `skills` = semua skill mapel dan kelas yang dituju. Null bila tidak ada skill yang cocok. */
export function mapCandidate(c: Candidate, skillsOf: (subject: Candidate['subject'], grade: number) => readonly Skill[]): Mapping | null {
  if (c.grade === null) return null
  const skills = skillsOf(c.subject, c.grade)
  if (skills.length === 0) return null
  if (c.skillHint) return skills.some((s) => s.id === c.skillHint) ? { skillId: c.skillHint, grade: c.grade } : null

  if (c.subject === 'math') {
    if (c.topicHint === 'computational thinking') {
      const oly = bySlug(skills, /oly-logic/) ?? skills.find((s) => s.strand === 'Oly')
      return oly ? { skillId: oly.id, grade: c.grade } : null
    }
    if (c.topicHint === 'table-data') {
      // Soal berbentuk tabel: skill data, grafik, atau tabel di kelas itu bila ada; kalau tidak, jatuh ke topik biasa.
      const data = firstSlug(skills, [/charts?$|graphs?|-charts/, /pictogram/, /tally/, /data/])
      if (data) return { skillId: data.id, grade: c.grade }
    }
    const topic = MATH_TOPICS.find((t) => t.name === mathTopic(c))
    const pick = (topic ? firstSlug(skills, topic.skillSlugs) : undefined) ?? addSubSkill(skills, c)
    // Soal cerita yang tidak punya skill topik di kelasnya jatuh ke teka-teki angka olimpiade bila ada.
    const fallback = pick ?? bySlug(skills, /oly-number-puzzles/)
    return fallback ? { skillId: fallback.id, grade: c.grade } : null
  }

  if (c.subject === 'science') {
    const rule = scienceRule(c)
    if (!rule) return null
    const text = `${c.prompt} ${(c.options ?? []).join(' ')}`
    const pool = skills.filter((s) => rule.strands.includes(s.strand))
    const pick = [...pool].sort((a, b) => overlap(b, text) - overlap(a, text) || rule.strands.indexOf(a.strand) - rule.strands.indexOf(b.strand) || a.order - b.order)[0]
    return pick ? { skillId: pick.id, grade: c.grade } : null
  }
  return null
}
