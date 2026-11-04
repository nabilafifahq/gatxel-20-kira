/**
 * "Kira and the Lost Library": delapan bab, satu bab terbuka setiap minggu tujuan tercapai. Teks asli.
 * Gaya buku bergambar: kalimat pendek, irama tiga, pengulangan ("One page at a time."), anak sebagai pelaku,
 * dan akhir halaman yang membuat ingin membalik. Gambar membawa sebagian cerita: kunang-kunang Lumi selalu
 * menunjuk ke arah berikutnya, dan posisinya di tiap halaman ada di data `lumi`.
 */

export type StoryPage = {
  text: string
  /** Jendela gambar bab: tengah x (0 sampai 100 persen dari lebar adegan) dan zoom. */
  look: { cx: number; zoom: number }
  /** Posisi kunang-kunang Lumi di adegan (persen). */
  lumi: { x: number; y: number }
}

export type StoryChapter = {
  n: number
  title: string
  scene: 'library' | 'forest' | 'river' | 'windmill' | 'harbour' | 'mountain' | 'sky' | 'finale'
  pages: readonly StoryPage[]
  /** Satu kalimat yang mengintip bab berikutnya. Bab terakhir mengundang petualangan baru. */
  tease: string
}

const p = (text: string, cx: number, zoom: number, lx: number, ly: number): StoryPage => ({ text, look: { cx, zoom }, lumi: { x: lx, y: ly } })

export const STORY_TITLE = 'Kira and the Lost Library'

export const STORY: readonly StoryChapter[] = [
  {
    n: 1,
    title: 'The Dark Lamp',
    scene: 'library',
    pages: [
      p('Kira loved the little library on Pine Hill.', 30, 1, 20, 30),
      p('Every morning it glowed. Every morning it hummed.', 50, 1.3, 40, 24),
      p('Today it was dark. The shelves were empty. Not one book!', 70, 1.5, 62, 40),
      p('On the desk sat a note and a tiny glowing bug. "I am Lumi," said the bug. "The Big Lamp went out. The books ran away to hide."', 78, 1.8, 80, 52),
      p('Kira took a breath. "Then I will bring them home. One page at a time."', 50, 1, 92, 20),
    ],
    tease: 'Lumi zooms off toward the whispering trees. Who is hiding in the forest?',
  },
  {
    n: 2,
    title: 'The Owl in the Forest',
    scene: 'forest',
    pages: [
      p('Lumi flew ahead. Kira ran after. Left, right, left, right.', 20, 1, 24, 40),
      p('The trees grew tall. The path grew dark. Something went hoo.', 45, 1.3, 46, 28),
      p('"Hoo is there?" "It is Kira!" "Hoo needs a book?" "I do!"', 62, 1.5, 62, 46),
      p('Old Owl blinked. One book sat under her wing. "Solve my riddle. How many stars on my cap?" Kira counted. One, two, three, four!', 78, 1.8, 76, 30),
      p('"Four!" Old Owl gave the book back. Kira put it in her bag. One page at a time.', 50, 1, 92, 20),
    ],
    tease: 'The next clue floats over the water. Is that a bridge with a gap?',
  },
  {
    n: 3,
    title: 'The Bridge Over Mirror River',
    scene: 'river',
    pages: [
      p('The river was flat and shiny like a mirror.', 25, 1, 18, 44),
      p('There was a bridge. But three planks were gone!', 50, 1.4, 44, 52),
      p('Kira looked down. Fish swam under the water. Plink, plink, plink.', 55, 1.6, 56, 62),
      p('Floating logs bobbed nearby. Kira tied them with her scarf and slid them into the gaps. One, two, three.', 70, 1.7, 70, 46),
      p('Step by step she crossed. On the far bank, a book waited in the reeds. One page at a time.', 90, 1.2, 90, 30),
    ],
    tease: 'A creak, a swish, a spin. Something big is turning on the hill.',
  },
  {
    n: 4,
    title: 'The Windmill Secret',
    scene: 'windmill',
    pages: [
      p('Swish, swish, swish went the windmill.', 30, 1, 28, 30),
      p('The wind blew pages everywhere! Flap, flap, flap.', 55, 1.3, 52, 22),
      p('A little baker ran out, waving her flour hands. "My roof is full of paper!"', 70, 1.5, 68, 48),
      p('Kira climbed the ladder. She caught one page. Then two. Then ten!', 40, 1.7, 40, 36),
      p('She stacked them neat. They made a book about the Moon. One page at a time.', 85, 1.2, 90, 16),
    ],
    tease: 'A salty smell drifts up the hill. Is that a lighthouse flashing?',
  },
  {
    n: 5,
    title: 'The Lighthouse by the Sea',
    scene: 'harbour',
    pages: [
      p('Waves went shh. Gulls went squawk.', 25, 1, 20, 36),
      p('At the end of the harbour stood a tall lighthouse. Its light was dim.', 55, 1.4, 52, 28),
      p('"I lost my glow when the lamp went out," sighed the keeper. "And my book is stuck on that rock."', 72, 1.6, 74, 50),
      p('Kira found a long pole. She hooked the book, gently, gently, and lifted it out of the spray.', 85, 1.7, 86, 56),
      p('The keeper smiled. The light blinked once, twice, three times. One page at a time.', 50, 1, 92, 18),
    ],
    tease: 'High above, a cold wind whistles. The next book is up a very steep trail.',
  },
  {
    n: 6,
    title: 'The Mountain Trail',
    scene: 'mountain',
    pages: [
      p('The trail went up. And up. And up.', 25, 1, 22, 60),
      p('Kira puffed. Kira panted. Kira did not stop.', 45, 1.3, 44, 48),
      p('Snow crunched under her boots. Crunch, crunch, crunch.', 62, 1.5, 62, 34),
      p('At the top, a cave glittered. Inside sat a book with a map on its cover.', 80, 1.8, 82, 26),
      p('"A map to the last book!" cried Lumi. It pointed to the sky. One page at a time.', 50, 1, 94, 10),
    ],
    tease: 'The map ends in the clouds. How do you reach a floating island?',
  },
  {
    n: 7,
    title: 'The Cloud Island',
    scene: 'sky',
    pages: [
      p('Rain fell. The sun came out. A rainbow grew.', 30, 1, 28, 40),
      p('"Climb on," said Lumi. The rainbow was soft as a slide.', 50, 1.4, 50, 34),
      p('Up Kira went. Past the birds. Past the clouds. Past the wind.', 65, 1.5, 66, 24),
      p('On the cloud island sat the last book, wrapped in a golden ribbon.', 82, 1.8, 84, 20),
      p('Kira hugged it close. "Now we go home." One page at a time.', 50, 1, 94, 12),
    ],
    tease: 'The bag is full. The hill is waiting. What will the lamp do?',
  },
  {
    n: 8,
    title: 'The Lamp Shines Again',
    scene: 'finale',
    pages: [
      p('Back on Pine Hill, Kira set the books on the shelves.', 20, 1, 24, 40),
      p('The owl came. The baker came. The keeper came. Even the fish waved.', 50, 1.2, 50, 30),
      p('Kira lifted Lumi to the Big Lamp. Lumi sparkled and sparkled.', 70, 1.6, 70, 26),
      p('The lamp went whoosh, and the whole library glowed gold!', 50, 1.3, 50, 20),
      p('"We did it," said Kira. "One page at a time." The end. Or maybe, the start of the next story.', 50, 1, 50, 14),
    ],
    tease: 'The shelves are full and the lamp is bright. More stories are waiting to be found.',
  },
]

export function chapterByN(n: number): StoryChapter | undefined {
  return STORY.find((c) => c.n === n)
}

/** Bab 1 terbuka sejak awal; bab k+1 terbuka setelah k minggu tujuan tercapai. */
export function chaptersOpen(goalWeeks: number): number {
  return Math.min(STORY.length, 1 + Math.max(0, goalWeeks))
}

/** Tujuan minggu: sedikitnya 4 hari dengan semua sesi wajib selesai. */
export const WEEK_GOAL_DAYS = 4
