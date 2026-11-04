/**
 * "Kira and the Lost Library": delapan bab, satu bab terbuka setiap minggu tujuan tercapai. Teks asli.
 *
 * Aturan menulis ada di docs/riset-cerita-bergambar.md. Ringkasnya: masalah sebesar anak (Kira ingin meminjam buku),
 * tiga kali coba, refrein yang berubah menurut bab, tanya di satu halaman dan jawab setelah dibalik, halaman tenang
 * sebelum puncak, dan akhir bab yang membuat penasaran tanpa tekanan.
 *
 * Gambar membawa sebagian cerita. Lumi selalu menunjuk arah berikutnya dan makin terang tiap buku pulang. Tikus kecil
 * Pip bersembunyi di gambar setiap halaman dan baru disebut teks di bab terakhir, jadi posisinya ada di data `pip`.
 */

export const STORY_SCENE_IDS = ['library', 'inside', 'forest', 'river', 'windmill', 'harbour', 'mountain', 'sky', 'finale'] as const
export type StorySceneName = (typeof STORY_SCENE_IDS)[number]

export type StoryKira = { x: number; y: number; flip?: boolean; read?: boolean; worry?: boolean }

export type StoryPage = {
  text: string
  /** Jendela gambar: tengah x dan zoom. `cy` (persen) dipakai bila jendela tidak menempel ke bawah. */
  look: { cx: number; zoom: number; cy?: number }
  /** Posisi kunang-kunang Lumi di adegan (persen). */
  lumi: { x: number; y: number }
  /** Posisi tikus kecil Pip (persen). Ada di setiap halaman, juga sebelum Pip disebut di teks. */
  pip: { x: number; y: number }
  /** Posisi Kira (persen, kaki). */
  kira: StoryKira
  /** Hal yang berubah di gambar halaman ini, misalnya log yang sudah terpasang. Digambar di @kira/figures. */
  show: readonly string[]
  /** Adegan khusus halaman ini bila beda dari adegan bab. */
  scene?: StorySceneName
}

export type StoryChapter = {
  n: number
  title: string
  scene: StorySceneName
  pages: readonly StoryPage[]
  /** Sobekan surat yang ditemukan di bab ini. Disimpan di layar cerita sebagai surat yang makin lengkap. */
  scrap: string
  /** Satu pertanyaan untuk ditebak bersama. Semua jawaban benar. */
  wonder: string
  /** Satu kalimat yang mengintip bab berikutnya. Bab terakhir mengundang membaca ulang. */
  tease: string
}

/** Jendela gambar dalam persen adegan. Rumusnya sama dengan StoryScene di @kira/figures. */
export function storyWindow(look: StoryPage['look']): { x0: number; x1: number; y0: number; y1: number } {
  const w = 100 / look.zoom
  const x0 = Math.min(100 - w, Math.max(0, look.cx - w / 2))
  const y0 = look.cy === undefined ? 100 - w : Math.min(100 - w, Math.max(0, look.cy - w / 2))
  return { x0, x1: x0 + w, y0, y1: y0 + w }
}

/**
 * Teks bab 8 berkata Pip ada di setiap gambar, jadi posisinya selalu dijaga di dalam jendela: digeser ke samping bila
 * perlu, dan bila tanahnya di luar jendela dia mengintip dari tepi bawah.
 */
function pipInView(look: StoryPage['look'], pip: { x: number; y: number }): { x: number; y: number } {
  const v = storyWindow(look)
  const marginX = (v.x1 - v.x0) * 0.08
  return { x: Math.min(v.x1 - marginX, Math.max(v.x0 + marginX, pip.x)), y: Math.min(v.y1 + 1, Math.max(v.y0 + 12, pip.y)) }
}

type Opt = { kira: StoryKira; show?: readonly string[]; scene?: StorySceneName; cy?: number }

/** Teks, tengah jendela, zoom, Lumi x, Lumi y, Pip x, Pip y, lalu Kira dan pilihan gambar. */
function p(text: string, cx: number, zoom: number, lx: number, ly: number, px: number, py: number, o: Opt): StoryPage {
  return {
    text,
    look: { cx, zoom, ...(o.cy !== undefined ? { cy: o.cy } : {}) },
    lumi: { x: lx, y: ly },
    pip: pipInView({ cx, zoom, ...(o.cy !== undefined ? { cy: o.cy } : {}) }, { x: px, y: py }),
    kira: o.kira,
    show: o.show ?? [],
    ...(o.scene ? { scene: o.scene } : {}),
  }
}

export const STORY_TITLE = 'Kira and the Lost Library'

export const STORY: readonly StoryChapter[] = [
  {
    n: 1,
    title: 'The Dark Lamp',
    scene: 'library',
    scrap: 'Bring home the six big books. The little ones will follow.',
    wonder: 'Someone bit the edges of that note. Who do you think it was?',
    tease: 'Lumi zooms towards the dark trees. Something up there says hoo. Who could it be?',
    pages: [
      p('Saturday was book day. Up Pine Hill ran Kira, with a bag on her back.', 22, 1, 12, 24, 5, 88, { show: ['lit', 'hum'], kira: { x: 20, y: 90 } }),
      p('Every Saturday, the little library glowed. Every Saturday, it hummed.', 50, 1.25, 72, 20, 73, 86, { show: ['lit', 'hum'], kira: { x: 36, y: 90 } }),
      p('This Saturday, there was no glow. There was no hum.', 50, 1.25, 70, 22, 72, 86, { kira: { x: 36, y: 90, worry: true } }),
      p('Kira pushed the door. Creeeak.', 50, 1.7, 44, 40, 60, 90, { show: ['door'], kira: { x: 42, y: 92 } }),
      p('The shelves were empty.', 50, 1, 20, 20, 92, 90, { scene: 'inside', show: ['dark'], kira: { x: 12, y: 90, worry: true } }),
      p('No big books. No small books. Not even the book about socks.', 50, 1.3, 36, 24, 85, 90, { scene: 'inside', show: ['dark'], kira: { x: 24, y: 90, worry: true } }),
      p('Then something blinked in the dark. Blink. Blink. Blink.', 62, 1.7, 60, 42, 92, 92, { scene: 'inside', show: ['dark'], kira: { x: 40, y: 92 } }),
      p('“I am Lumi,” said a very small voice. “The Big Lamp went out in the night. The books took fright, and off they ran!”', 60, 1.5, 60, 38, 94, 90, { scene: 'inside', show: ['dark'], kira: { x: 42, y: 92 } }),
      p('On the desk lay a scrap of paper. Its edges were full of tiny bites. Kira read it out loud.', 76, 1.7, 86, 40, 71, 90, { scene: 'inside', show: ['dark', 'note'], kira: { x: 58, y: 92, read: true } }),
      p('“Bring home the six big books. The little ones will follow.”', 80, 2.2, 90, 44, 69, 90, { scene: 'inside', show: ['dark', 'note'], kira: { x: 64, y: 92 } }),
      p('Kira looked at her bag. It was small. She looked at the road. It was long.', 28, 1.1, 66, 30, 8, 88, { kira: { x: 34, y: 90 }, show: ['door'] }),
      p('She took a deep breath. “One step at a time,” she said. And out she went.', 40, 1, 88, 22, 61, 88, { kira: { x: 72, y: 90 }, show: ['door'] }),
    ],
  },
  {
    n: 2,
    title: 'Who Is There?',
    scene: 'forest',
    scrap: 'The Big Lamp is only sleeping.',
    wonder: 'Old Owl has no tiny teeth. So who keeps biting the paper?',
    tease: 'Kira can hear rushing water. And is that a bridge with no middle?',
    pages: [
      p('Left, right, left, right went Kira’s boots.', 18, 1, 28, 40, 3, 92, { kira: { x: 14, y: 90 } }),
      p('The trees grew tall. The path grew thin. The dark grew deep.', 40, 1.2, 50, 34, 22, 92, { show: ['dusk'], kira: { x: 34, y: 90 } }),
      p('Then, from high above, came a sound. Hoo.', 50, 1.4, 54, 30, 33, 92, { show: ['dark'], kira: { x: 48, y: 90, worry: true } }),
      p('“Hoo is there?” “It’s Kira,” said Kira.', 50, 1.4, 56, 34, 34, 92, { show: ['dark'], kira: { x: 48, y: 90 } }),
      p('“Hoo?” “Kira!” “HOO?” “KI-RA!”', 56, 1.6, 50, 44, 42, 92, { show: ['dark'], kira: { x: 52, y: 90 } }),
      p('Two round eyes opened in the dark. They were as big as plates. Kira stepped back.', 68, 1.8, 54, 34, 96, 92, { show: ['dark', 'eyes'], cy: 42, kira: { x: 52, y: 90, worry: true } }),
      p('It was Old Owl, in a very old hat. And under her wing lay a big blue book!', 68, 1.5, 58, 40, 94, 92, { show: ['dusk', 'owl', 'hat', 'book'], cy: 45, kira: { x: 50, y: 90 } }),
      p('“You may have it,” said Old Owl, “when you can tell me how many stars are on my hat.”', 72, 1.9, 54, 26, 96, 90, { show: ['dark', 'owl', 'hat', 'book'], cy: 40, kira: { x: 56, y: 90 } }),
      p('“Three!” said Kira. “Hoo, hoo,” laughed Old Owl. “Look again.”', 68, 1.5, 56, 30, 96, 92, { show: ['dark', 'owl', 'hat', 'book'], cy: 45, kira: { x: 52, y: 90 } }),
      p('“Four!” said Kira. “Hoo, hoo. Look again.”', 68, 1.5, 54, 40, 95, 92, { show: ['dark', 'owl', 'hat', 'book'], cy: 45, kira: { x: 52, y: 90, worry: true } }),
      p('It was too dark to see. So Lumi flew up and sat on the hat. How many stars can you count?', 72, 2.2, 73, 15, 96, 90, { show: ['dusk', 'owl', 'hat', 'book', 'hat-lit'], cy: 34, kira: { x: 56, y: 90 } }),
      p('“One star at a time,” said Kira. “One, two, three, four, five. Five stars!”', 70, 1.6, 73, 15, 94, 92, { show: ['dusk', 'owl', 'hat', 'book', 'hat-lit'], cy: 40, kira: { x: 54, y: 90 } }),
      p('Old Owl lifted her wing. The blue book felt warm in Kira’s bag. And Lumi glowed a little brighter.', 56, 1.2, 60, 30, 30, 92, { show: ['dusk', 'owl', 'hat', 'wing'], kira: { x: 52, y: 90 } }),
      p('Out of the book fell a scrap of paper. It had tiny bites around the edges.', 40, 1.5, 56, 34, 22, 92, { show: ['dusk', 'owl', 'hat', 'wing', 'scrap'], kira: { x: 38, y: 90, read: true } }),
    ],
  },
  {
    n: 3,
    title: 'The Bridge with No Middle',
    scene: 'river',
    scrap: 'It will wake for one small sound.',
    wonder: 'What small sound could wake a lamp? What do you think?',
    tease: 'Swish, swish, swish. Something big is turning on the hill. And what is all that white stuff in the sky?',
    pages: [
      p('The river was flat and still. It shone like a mirror. Kira could see her own nose in it.', 22, 1.1, 30, 30, 6, 56, { kira: { x: 14, y: 62 } }),
      p('There was a bridge. It had a beginning. It had an end.', 50, 1, 34, 24, 3, 58, { kira: { x: 14, y: 62 } }),
      p('It had no middle!', 50, 1.8, 50, 44, 72, 60, { cy: 52, kira: { x: 30, y: 62, worry: true } }),
      p('Far across the water, something green sat in the reeds. A big green book!', 84, 1.7, 80, 36, 96, 62, { cy: 52, kira: { x: 30, y: 62 } }),
      p('“I can jump it,” said Kira. She ran. She stopped. “I cannot jump it,” said Kira.', 36, 1.6, 44, 34, 20, 58, { cy: 52, kira: { x: 36, y: 62, worry: true } }),
      p('“I can swim it,” said Kira. She dipped in one toe. Brrr! “I cannot swim it,” said Kira.', 22, 1.5, 30, 42, 3, 58, { cy: 52, kira: { x: 14, y: 62, worry: true } }),
      p('So Kira sat down and looked. Plink. Plink. Plink. Little fish were bumping something.', 40, 1.5, 44, 66, 8, 58, { cy: 52, show: ['fish'], kira: { x: 18, y: 62 } }),
      p('Three logs were floating by. Kira took off her red scarf.', 44, 1.8, 42, 62, 12, 58, { cy: 52, show: ['fish', 'scarf'], kira: { x: 28, y: 62 } }),
      p('She tied it to the first log and pulled. Heave! One log.', 44, 1.5, 40, 50, 12, 58, { cy: 52, show: ['log1', 'scarf'], kira: { x: 32, y: 62 } }),
      p('“One log at a time,” said Kira. Heave! Two logs. Heave! Three logs.', 50, 1.4, 56, 50, 8, 58, { cy: 52, show: ['log1', 'log2', 'log3'], kira: { x: 32, y: 62 } }),
      p('Step. Wobble. Step. Wobble. Step.', 50, 1.6, 66, 40, 22, 58, { cy: 52, show: ['log1', 'log2', 'log3'], kira: { x: 50, y: 62 } }),
      p('The green book was safe in her bag. Lumi glowed a little brighter. And inside the cover was another bitten scrap.', 80, 1.4, 86, 34, 66, 58, { cy: 52, show: ['log1', 'log2', 'log3', 'scrap'], kira: { x: 80, y: 66, read: true } }),
    ],
  },
  {
    n: 4,
    title: 'Pages on the Wind',
    scene: 'windmill',
    scrap: 'It is a sound you know very well.',
    wonder: 'Why do you think the pages came when Kira stood still?',
    tease: 'A salty smell drifts up the hill. Far away, a light is blinking. Who is making it blink?',
    pages: [
      p('Swish, swish, swish went the windmill.', 40, 1, 20, 30, 8, 86, { kira: { x: 18, y: 90 } }),
      p('Flap, flap, flap went something in the sky. Was it birds? Was it snow?', 50, 1, 62, 18, 64, 88, { kira: { x: 24, y: 90, worry: true } }),
      p('It was paper! Pages and pages and pages!', 50, 1.15, 66, 16, 10, 88, { show: ['pages-many'], kira: { x: 28, y: 90 } }),
      p('A baker ran out with flour in her hair. “The white book burst!” she cried. “Its pages are in my buns!”', 74, 1.5, 62, 30, 96, 88, { show: ['pages-many', 'baker'], kira: { x: 58, y: 90 } }),
      p('Kira ran after a page. The page flew faster.', 26, 1.3, 40, 30, 54, 88, { show: ['pages-many', 'baker'], kira: { x: 22, y: 90 } }),
      p('Kira jumped for a page. The page flew higher.', 40, 1.3, 50, 22, 56, 88, { show: ['pages-many', 'baker'], kira: { x: 36, y: 86 } }),
      p('Kira shouted at a page. The page did not care.', 50, 1.3, 58, 26, 60, 88, { show: ['pages-many', 'baker'], kira: { x: 44, y: 90, worry: true } }),
      p('So Kira stopped. She took the empty cover, stood very still and held it open.', 40, 1.5, 30, 36, 64, 88, { show: ['pages-many', 'baker', 'cover'], kira: { x: 38, y: 90 } }),
      p('The wind went quiet. One page floated down. It landed on the cover.', 40, 1.9, 30, 44, 56, 90, { show: ['pages-few', 'baker', 'cover'], kira: { x: 38, y: 90 } }),
      p('“One page at a time,” said Kira. Two pages. Ten pages. A hundred pages.', 45, 1.4, 34, 30, 8, 88, { show: ['pages-few', 'baker', 'cover'], kira: { x: 38, y: 90 } }),
      p('The baker stitched them in with a long thread. Then she gave Kira a warm bun.', 68, 1.5, 58, 30, 90, 88, { show: ['baker', 'bun', 'book'], kira: { x: 64, y: 90 } }),
      p('The white book was whole again. Lumi glowed a little brighter. And on the last page sat a bitten scrap.', 66, 1.3, 72, 22, 88, 88, { show: ['baker', 'book', 'scrap'], kira: { x: 62, y: 90, read: true } }),
    ],
  },
  {
    n: 5,
    title: 'The Rock in the Waves',
    scene: 'harbour',
    scrap: 'It is softer than the sea.',
    wonder: 'Lumi keeps getting brighter. Why do you think that is?',
    tease: 'High above, a cold wind whistles. The next book is at the very top of a snowy mountain.',
    pages: [
      p('Shhh went the waves. Squawk went the gulls.', 30, 1, 30, 28, 86, 68, { kira: { x: 74, y: 80 } }),
      p('At the end of the harbour stood a tall lighthouse. Its light was thin and tired.', 76, 1.3, 70, 22, 96, 76, { kira: { x: 66, y: 80 }, show: ['keeper'] }),
      p('“My light went low when the Big Lamp went out,” sighed the keeper. “And look. Look out there.”', 76, 1.6, 62, 30, 93, 72, { kira: { x: 68, y: 80, worry: true }, show: ['keeper'] }),
      p('Out on a dark rock, in the spray, sat a big purple book.', 42, 1.8, 54, 32, 74, 74, { kira: { x: 70, y: 80 } }),
      p('Kira found a long pole. She held it out as far as she could. The pole was too short.', 56, 1.6, 50, 34, 82, 76, { kira: { x: 66, y: 80, worry: true }, show: ['pole'] }),
      p('“I can run out when the water goes back,” said Kira. She ran. The water came back first.', 52, 1.5, 44, 30, 80, 74, { kira: { x: 56, y: 82 }, show: ['bigwave'] }),
      p('Whoosh! Wet hair. Wet socks. Wet everything.', 60, 1.7, 56, 26, 84, 76, { kira: { x: 66, y: 80, worry: true }, show: ['splash'] }),
      p('Kira sat on the sand and squeezed her socks. She watched the waves. In. Out. In. Out.', 62, 1.3, 58, 34, 88, 74, { kira: { x: 68, y: 80 } }),
      p('Big, small, small. Big, small, small. Did you hear it too?', 50, 1.1, 46, 30, 86, 72, { kira: { x: 68, y: 80 }, show: ['waves-count'] }),
      p('After the next big wave, she ran. “One wave at a time,” puffed Kira. One small wave. Two small waves.', 50, 1.5, 42, 30, 84, 76, { kira: { x: 50, y: 84 }, show: ['waves-count'] }),
      p('She grabbed the book and ran back, with the big wave splashing at her heels.', 60, 1.5, 52, 28, 90, 74, { kira: { x: 66, y: 80 }, show: ['no-book', 'splash'] }),
      p('Lumi flew to the top of the lighthouse. The light blinked once. Twice. Three times. Far out at sea, a small boat turned for home.', 56, 1, 83, 12, 94, 72, { kira: { x: 70, y: 80 }, show: ['bright', 'no-book', 'keeper', 'boat-home'] }),
      p('The keeper smiled. Lumi glowed a little brighter. And tucked in the purple book was another bitten scrap.', 74, 1.4, 80, 22, 92, 74, { kira: { x: 70, y: 80, read: true }, show: ['bright', 'no-book', 'keeper', 'scrap'] }),
    ],
  },
  {
    n: 6,
    title: 'Up and Up',
    scene: 'mountain',
    scrap: 'It is warmer than a coat.',
    wonder: 'Something happened when Kira read out loud. Did you see it?',
    tease: 'The map ends in the clouds. How can anyone climb up to a cloud?',
    pages: [
      p('The path went up. And up. And up.', 25, 1, 20, 50, 6, 92, { kira: { x: 12, y: 90 } }),
      p('Kira puffed. Kira panted. Kira kept going.', 35, 1.2, 40, 44, 14, 92, { kira: { x: 28, y: 90 } }),
      p('Crunch, crunch, crunch went the snow.', 42, 1.3, 46, 40, 24, 92, { show: ['snowfall'], kira: { x: 38, y: 90 } }),
      p('The wind blew. The snow blew. Lumi’s light was the only warm thing left.', 48, 1.4, 52, 54, 30, 92, { show: ['snowfall', 'wind'], kira: { x: 44, y: 90, worry: true } }),
      p('Her boots felt heavy. Her bag felt heavy. Even her eyelids felt heavy.', 50, 1.8, 54, 48, 34, 92, { show: ['snowfall', 'wind'], kira: { x: 50, y: 90, worry: true } }),
      p('She sat down on a rock. “I can’t,” she said, very quietly.', 50, 1.5, 58, 44, 32, 92, { show: ['snowfall', 'rest'], kira: { x: 50, y: 84, worry: true } }),
      p('Lumi said nothing. Lumi sat on her knee.', 50, 2, 55, 79, 36, 92, { show: ['snowfall', 'rest'], kira: { x: 50, y: 84, worry: true } }),
      p('Kira opened the blue book, just to look at something nice. She read the first line out loud.', 50, 1.8, 60, 70, 38, 92, { show: ['snowfall', 'rest'], kira: { x: 50, y: 84, read: true } }),
      p('Her voice was small. Lumi glowed. All around them, the snow turned gold.', 50, 1.3, 56, 56, 34, 92, { show: ['rest', 'gold'], kira: { x: 50, y: 84, read: true } }),
      p('Kira read one more page. She felt warmer. “Hmm,” said Kira. She closed the book and stood up.', 50, 1.5, 58, 52, 40, 92, { show: ['rest', 'gold'], kira: { x: 50, y: 84 } }),
      p('“One boot at a time,” she said. One boot. The other boot. One boot. The other boot.', 62, 1.3, 70, 36, 44, 92, { kira: { x: 64, y: 90 } }),
      p('At the very top, in a glittering cave, sat a big red book. On its cover was a map.', 80, 1.7, 82, 44, 62, 92, { show: ['cave', 'book'], kira: { x: 66, y: 90 } }),
      p('Inside was another bitten scrap. And the map did not stop at the top of the mountain. It went on, up into the sky.', 76, 1.2, 88, 12, 58, 92, { show: ['cave', 'scrap'], kira: { x: 66, y: 90, read: true } }),
    ],
  },
  {
    n: 7,
    title: 'The Cloud Island',
    scene: 'sky',
    scrap: 'It is the sound of a story, read out loud.',
    wonder: 'What story would you read to a sleeping lamp?',
    tease: 'Six big books. One dark lamp. One small girl with one small voice. Will the lamp hear her?',
    pages: [
      p('Drip. Drop. Drip. Rain fell on the mountain.', 25, 1, 20, 40, 4, 90, { show: ['rain'], kira: { x: 14, y: 90 } }),
      p('Then the sun came out, and a rainbow grew, right from Kira’s boots to the clouds.', 40, 1, 26, 30, 3, 90, { kira: { x: 14, y: 90 } }),
      p('“Climb on,” said Lumi. Kira took one step. Wheee! Bump.', 20, 1.3, 24, 50, 6, 90, { kira: { x: 18, y: 88 }, show: ['slide'] }),
      p('Kira took a run. Up she went. Wheee! Bump.', 22, 1.3, 30, 44, 8, 90, { kira: { x: 16, y: 88 }, show: ['slide'] }),
      p('Kira took a bigger run. Up, up she went. Wheee! Bump! Kira laughed and laughed.', 24, 1.2, 36, 40, 5, 90, { kira: { x: 14, y: 90 }, show: ['slide'] }),
      p('Then she stopped running. She looked at the stripes, soft and bright, side by side. She put one foot on the red.', 28, 1.5, 30, 54, 10, 90, { kira: { x: 18, y: 86 } }),
      p('“One stripe at a time,” said Kira. Red. Yellow. Green. Blue. Purple.', 36, 1.2, 44, 22, 14, 90, { kira: { x: 30, y: 54 } }),
      p('Up past the birds. Up past the clouds. Up past the wind.', 42, 1, 50, 14, 22, 88, { kira: { x: 38, y: 40 }, show: ['birds'] }),
      p('And there it was. An island made of cloud, as soft as a pillow. Nobody was there.', 82, 1.5, 78, 26, 64, 74, { kira: { x: 72, y: 72 }, cy: 55, show: ['island'] }),
      p('In the very middle lay the last big book, gold as the sun, tied up with a ribbon.', 84, 1.9, 88, 40, 66, 74, { kira: { x: 74, y: 72 }, cy: 60, show: ['island', 'book'] }),
      p('Kira pulled the ribbon. Out fell a scrap. “It is the sound of a story, read out loud,” she read.', 84, 1.9, 92, 40, 67, 74, { kira: { x: 78, y: 72, read: true }, cy: 60, show: ['island', 'scrap'] }),
      p('She read it again. “Lumi! It’s reading! The sound is reading!” Far, far down, Pine Hill was getting dark.', 76, 1.2, 62, 28, 66, 74, { kira: { x: 76, y: 72 }, cy: 55, show: ['island'] }),
      p('“Wheee?” said Lumi. “Wheee!” said Kira.', 40, 1, 34, 20, 60, 74, { kira: { x: 40, y: 34 }, show: ['island', 'slide'] }),
    ],
  },
  {
    n: 8,
    title: 'The Lamp Wakes',
    scene: 'inside',
    scrap: 'Thank you, brave reader. Love from P.',
    wonder: 'Which book would you borrow first?',
    tease: 'Open any chapter and look closely. Pip is waiting behind a tree, under a bridge, beside a boot. Can you find her in every picture?',
    pages: [
      p('It was night on Pine Hill. The library was as dark as the inside of a boot.', 50, 1, 16, 24, 90, 90, { kira: { x: 14, y: 90 }, show: ['dark'] }),
      p('Kira put the six big books on the shelf. Blue. Green. White. Purple. Red. Gold.', 44, 1.4, 58, 26, 92, 90, { kira: { x: 40, y: 90 }, show: ['dark', 'six'] }),
      p('She looked up at the Big Lamp. It did not move.', 50, 1.6, 36, 30, 88, 90, { cy: 30, kira: { x: 44, y: 92, worry: true }, show: ['dark', 'six'] }),
      p('She opened the blue book. Her hands were cold. Her voice was small. “Once upon a time,” she read.', 44, 1.7, 52, 58, 90, 90, { kira: { x: 44, y: 90, read: true }, show: ['dark', 'six'] }),
      p('Nothing.', 50, 1, 56, 50, 88, 90, { kira: { x: 44, y: 90, read: true }, show: ['dark', 'six'] }),
      p('She read one page. Far up in the dark, the lamp went tick.', 50, 1.5, 58, 36, 86, 90, { cy: 30, kira: { x: 44, y: 92, read: true }, show: ['dark', 'six', 'glow1'] }),
      p('She read another page. Tick, tick. A thin gold line.', 50, 1.5, 56, 30, 84, 90, { cy: 30, kira: { x: 44, y: 92, read: true }, show: ['dark', 'six', 'glow1'] }),
      p('Tap, tap, tap at the door. It was Old Owl. “Hoo is reading?” she asked. Then she sat down and read too.', 32, 1.3, 54, 30, 84, 90, { kira: { x: 44, y: 90, read: true }, show: ['dusk', 'six', 'glow1', 'owl'] }),
      p('The baker came and read. The keeper came and read. And now the library began to hum.', 50, 1, 54, 28, 94, 90, { kira: { x: 44, y: 90, read: true }, show: ['dusk', 'six', 'glow2', 'owl', 'baker', 'keeper', 'hum'] }),
      p('Louder and louder they read, one page at a time. Lumi flew up, up, up, into the Big Lamp.', 50, 1.3, 50, 18, 96, 90, { cy: 40, kira: { x: 44, y: 90, read: true }, show: ['six', 'glow2', 'owl', 'baker', 'keeper', 'hum'] }),
      p('WHOOSH!', 50, 1, 50, 18, 96, 90, { kira: { x: 44, y: 90 }, show: ['six', 'glow3', 'owl', 'baker', 'keeper', 'burst'] }),
      p('And in through the windows, flap, flap, flap, came the little books. Hundreds and hundreds of them, all the way home.', 50, 1, 40, 20, 3, 92, { kira: { x: 44, y: 90 }, show: ['full', 'glow3', 'owl', 'baker', 'keeper', 'fly'] }),
      p('On the floor lay the very last scrap. “Thank you, brave reader. Love from P.” “Who is P?” said Kira. Something tickled her boot.', 50, 1.8, 54, 42, 48, 94, { kira: { x: 44, y: 92, read: true }, show: ['full', 'glow3', 'scrap'] }),
      p('It was a very small mouse with a very small pencil. “I am Pip,” she said. “I am the librarian.”', 56, 1.8, 66, 38, 56, 92, { kira: { x: 40, y: 92 }, show: ['full', 'glow3', 'pip-big'] }),
      p('“I could not carry a big book. But I could carry a small scrap. So I ran ahead of you, all the way.” All the way? Yes! Go back and look. She is in every picture.', 56, 1.4, 70, 32, 56, 92, { kira: { x: 40, y: 92 }, show: ['full', 'glow3', 'pip-big'] }),
      p('Kira laughed. “Thank you, Pip.” Then she remembered why she had come. “Please may I borrow a book?”', 70, 1.5, 62, 30, 79, 74, { kira: { x: 58, y: 92 }, show: ['full', 'glow3', 'pip-desk'] }),
      p('Pip stamped it. Thump. “One page at a time,” said Pip. “One page at a time,” said Kira. The end.', 50, 1, 62, 26, 79, 74, { kira: { x: 58, y: 92, read: true }, show: ['full', 'glow3', 'pip-desk', 'owl', 'baker', 'keeper', 'hum'] }),
    ],
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

/** Besar cahaya Lumi di bab n: makin terang tiap buku pulang. */
export function lumiGlow(n: number): number {
  return 1 + (Math.min(8, Math.max(1, n)) - 1) * 0.1
}

/** Bab yang sudah ditandai selesai, dibersihkan dari nilai yang tidak dikenal. */
export function cleanStoryDone(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= STORY.length))].sort((a, b) => a - b)
}
