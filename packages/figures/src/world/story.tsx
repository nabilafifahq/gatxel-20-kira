import type { ReactElement, ReactNode } from 'react'
import { DANGER, DIVIDER, ENGLISH, INK, KNOWLEDGE, KNOWLEDGE_50, LILAC, MATH, MATH_50, MUTED, SCIENCE_50, SKY, STAR, SUCCESS, WARN, WARN_50, WHITE, YELLOW } from '../palette'
import { Icon } from '../icons'

/**
 * Gambar cerita "Kira and the Lost Library". Setiap bab satu adegan lebar 600 x 300; halaman cerita
 * menggeser dan memperbesar jendela (viewBox) ke bagian yang sedang dibaca, jadi satu gambar membawa
 * seluruh bab. Kira adalah tokoh utama, Lumi kunang-kunang yang selalu menunjuk arah berikutnya.
 */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const W = 600
const H = 300
const LAVENDER_SKY = MATH_50

export const STORY_SCENES = ['library', 'inside', 'forest', 'river', 'windmill', 'harbour', 'mountain', 'sky', 'finale'] as const
export type StorySceneId = (typeof STORY_SCENES)[number]

function Tree({ x, y, s = 1, tone = SUCCESS }: { x: number; y: number; s?: number; tone?: string }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      <rect x="-5" y="-30" width="10" height="30" rx="2" fill={WARN} />
      <circle cx="0" cy="-48" r="26" fill={tone} />
      <circle cx="-14" cy="-36" r="16" fill={tone} />
      <circle cx="14" cy="-36" r="16" fill={tone} />
    </g>
  )
}

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      <rect x="-4" y="-14" width="8" height="14" fill={WARN} />
      <path d="M0 -70L-20 -34h40z" fill={SUCCESS} />
      <path d="M0 -50L-26 -14h52z" fill={SUCCESS} />
    </g>
  )
}

function Cloud({ x, y, s = 1, drift }: { x: number; y: number; s?: number; drift?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={drift ? 'kw-drift' : undefined} {...line} fill={WHITE}>
        <path d="M-30 0a14 14 0 0 1 4-26a18 18 0 0 1 34-2a14 14 0 0 1 20 14a10 10 0 0 1 -2 14z" />
      </g>
    </g>
  )
}

function Hill({ y, tone, bump = 60 }: { y: number; tone: string; bump?: number }): ReactElement {
  return <path d={`M0 ${y}q150 -${bump} 300 -${bump / 4}t300 0V${H}H0z`} fill={tone} {...line} />
}

function Library({ lit, x = 300 }: { lit: boolean; x?: number }): ReactElement {
  return (
    <g transform={`translate(${x} 230)`} {...line}>
      <rect x="-90" y="-100" width="180" height="100" fill={WARN_50} />
      <path d="M-104 -100L0 -150L104 -100z" fill={ENGLISH} />
      <rect x="-18" y="-58" width="36" height="58" rx="3" fill={lit ? STAR : MUTED} />
      <rect x="-72" y="-82" width="34" height="34" rx="3" fill={lit ? STAR : KNOWLEDGE_50} />
      <rect x="38" y="-82" width="34" height="34" rx="3" fill={lit ? STAR : KNOWLEDGE_50} />
      <path d="M-55 -82v34M-72 -65h34M55 -82v34M38 -65h34" strokeWidth="1.800" />
      <circle cx="0" cy="-122" r="12" fill={lit ? STAR : MUTED} />
      {lit ? <circle cx="0" cy="-122" r="26" fill={STAR} fillOpacity="0.25" stroke="none" className="kw-twinkle" /> : null}
      <path d="M0 -150v-12" />
    </g>
  )
}

function Windmill({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`} {...line}>
      <path d="M-30 0L-18 -90h36L30 0z" fill={WARN_50} />
      <rect x="-10" y="-30" width="20" height="30" rx="3" fill={WARN} />
      <path d="M-22 -90L0 -110L22 -90z" fill={ENGLISH} />
      <g transform="translate(0 -88)">
        <g className="kw-spin">
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <rect x="-4" y="-62" width="8" height="62" fill={WARN} />
              <rect x="4" y="-62" width="22" height="44" fill={WHITE} />
            </g>
          ))}
        </g>
        <circle r="6" fill={STAR} />
      </g>
    </g>
  )
}

function Lighthouse({ x, y, bright = false }: { x: number; y: number; bright?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`} {...line}>
      <path d="M-24 0L-14 -120h28L24 0z" fill={WHITE} />
      <path d="M-20 -30h40l-3 22h-34zM-17 -80h34l-2.500 22h-29z" fill={ENGLISH} />
      <rect x="-16" y="-142" width="32" height="22" rx="3" fill={bright ? STAR : WARN_50} />
      <path d="M-20 -142L0 -164L20 -142z" fill={ENGLISH} />
      {bright ? <path d="M-16 -131l-200 -46v92z" fill={STAR} fillOpacity="0.55" stroke="none" className="kw-twinkle" /> : <path d="M-16 -131l-40 -8v16z" fill={STAR} fillOpacity="0.4" stroke="none" />}
    </g>
  )
}

function Mountain({ x, y, s = 1, snow = true }: { x: number; y: number; s?: number; snow?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      <path d="M-110 0L0 -170L110 0z" fill={KNOWLEDGE} />
      {snow ? <path d="M-34 -118L0 -170L34 -118l-14 10l-20 -10l-20 10z" fill={WHITE} /> : null}
    </g>
  )
}

function Rainbow({ x, y }: { x: number; y: number }): ReactElement {
  const cols = [DANGER, YELLOW, SUCCESS, SKY, LILAC]
  return (
    <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round">
      {cols.map((c, i) => (
        <path key={c + i} d={`M${-150 + i * 9} 0a${150 - i * 9} ${150 - i * 9} 0 0 1 ${(150 - i * 9) * 2} 0`} stroke={c} strokeWidth="9" />
      ))}
    </g>
  )
}

function Book({ x, y, tone = ENGLISH, s = 1, fly }: { x: number; y: number; tone?: string; s?: number; fly?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={fly ? 'kw-bob' : undefined} {...line}>
        <rect x="-12" y="-9" width="24" height="18" rx="2" fill={tone} />
        <path d="M0 -9v18" strokeWidth="1.800" />
        <path d="M-7 -3h4M3 -3h4" strokeWidth="1.500" stroke={WHITE} />
      </g>
    </g>
  )
}

/** Kira: anak berkepang dua dengan syal merah dan gaun hijau, digambar dari bentuk bulat. Tinggi sekitar 70. */
export function Kira({ x, y, s = 1, flip = false, read = false, worry = false, sit = false }: { x: number; y: number; s?: number; flip?: boolean; read?: boolean; worry?: boolean; sit?: boolean }): ReactElement {
  return (
    <g transform={'translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')'} {...line}>
      <ellipse cx="0" cy="2" rx="16" ry="3.500" fill={DIVIDER} stroke="none" />
      {sit ? (
        <>
          <path d="M-6 -16l-9 12M6 -16l9 12" strokeWidth="5" stroke={WARN_50} />
          <path d="M-6 -16l-9 12M6 -16l9 12" strokeWidth="1.800" />
          <ellipse cx="-16" cy="-3" rx="6" ry="3" fill={MATH} />
          <ellipse cx="16" cy="-3" rx="6" ry="3" fill={MATH} />
        </>
      ) : (
        <>
          <path d="M-6 -16v14M6 -16v14" strokeWidth="5" stroke={WARN_50} />
          <path d="M-6 -16v14M6 -16v14" strokeWidth="1.800" />
          <ellipse cx="-7" cy="-1" rx="6" ry="3" fill={MATH} />
          <ellipse cx="7" cy="-1" rx="6" ry="3" fill={MATH} />
        </>
      )}
      <path d="M-10 -17L-15 -36q15 -8 30 0L10 -17z" fill={SUCCESS} />
      <path d="M-11 -35q12 8 21 15" fill="none" strokeWidth="1.800" />
      <rect x="8" y="-25" width="11" height="12" rx="2.500" fill={LILAC} strokeWidth="1.800" />
      <path d="M-13 -35q13 6 26 0l-2 6q-11 5 -22 0z" fill={DANGER} />
      {read ? (
        <>
          <path d="M-17 -31l9 7M17 -31l-9 7" strokeWidth="4" stroke={WARN_50} />
          <path d="M-17 -31l9 7M17 -31l-9 7" strokeWidth="1.600" />
          <path d="M0 -26q-7 -4 -14 -1v10q7 -3 14 1q7 -4 14 -1v-10q-7 -3 -14 1z" fill={WHITE} strokeWidth="1.800" />
          <path d="M0 -26v10" strokeWidth="1.400" />
        </>
      ) : (
        <>
          <path d="M-17 -31l-7 11M17 -31l7 11" strokeWidth="4" stroke={WARN_50} />
          <path d="M-17 -31l-7 11M17 -31l7 11" strokeWidth="1.600" />
        </>
      )}
      <circle cx="0" cy="-48" r="13" fill={WARN_50} />
      <path d="M-13 -50a13 13 0 0 1 26 0q-6 -7 -13 -5q-8 -3 -13 5z" fill={INK} />
      <circle cx="-15" cy="-46" r="4.500" fill={INK} />
      <circle cx="15" cy="-46" r="4.500" fill={INK} />
      <circle cx="-4.500" cy="-47" r="1.800" fill={INK} stroke="none" />
      <circle cx="4.500" cy="-47" r="1.800" fill={INK} stroke="none" />
      <path d={worry ? 'M-3.500 -39.500q3.500 -3 7 0' : 'M-3.500 -41q3.500 3.500 7 0'} fill="none" strokeWidth="1.800" />
    </g>
  )
}

/** Lumi, kunang-kunang kecil. `glow` memperbesar cahayanya tiap buku pulang. */
export function Lumi({ x, y, s = 1, glow = 1 }: { x: number; y: number; s?: number; glow?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="kw-bob">
        <circle r={16 * glow} fill={STAR} fillOpacity="0.32" className="kw-twinkle" />
        <circle r={9 * glow} fill={STAR} fillOpacity="0.4" />
        <g {...line} strokeWidth="2">
          <ellipse cx="-7" cy="-6" rx="7" ry="4" fill={WHITE} transform="rotate(-30 -7 -6)" className="kw-wing" />
          <ellipse cx="7" cy="-6" rx="7" ry="4" fill={WHITE} transform="rotate(30 7 -6)" className="kw-wing" />
          <ellipse cx="0" cy="2" rx="6" ry="8" fill={STAR} />
          <path d="M-2 -4v-4M2 -4v-4" />
        </g>
      </g>
    </g>
  )
}

/** Pip: tikus kecil dengan pensil kecil. Bersembunyi di gambar sejak halaman pertama. */
export function Pip({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} {...line} strokeWidth="1.700">
      <path d="M-12 -3q-11 2 -14 -6" fill="none" />
      <ellipse cx="0" cy="-7" rx="11" ry="8" fill={WHITE} />
      <circle cx="9" cy="-14" r="6.500" fill={WHITE} />
      <circle cx="5" cy="-20" r="3.800" fill={LILAC} />
      <circle cx="12" cy="-20.500" r="3.800" fill={LILAC} />
      <circle cx="10.500" cy="-14.500" r="1.100" fill={INK} stroke="none" />
      <circle cx="15" cy="-12.500" r="1.200" fill={DANGER} stroke="none" />
      <path d="M14 -7l7 -8" stroke={INK} strokeWidth="3.400" />
      <path d="M14 -7l7 -8" stroke={YELLOW} strokeWidth="1.800" />
    </g>
  )
}

/** Sobekan surat dengan gigitan kecil di tepinya. */
function Scrap({ x, y, s = 1 }: { x: number; y: number; s?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(-8)`} {...line} strokeWidth="1.800">
      <path d="M-15 -11h6a2 2 0 0 0 4 0h9a2 2 0 0 0 4 0h7v8a2 2 0 0 0 0 4v10h-7a2 2 0 0 0 -4 0h-9a2 2 0 0 0 -4 0h-6v-7a2 2 0 0 0 0 -4z" fill={WHITE} />
      <path d="M-9 -4h17M-9 1h19M-9 6h11" strokeWidth="1.300" />
    </g>
  )
}

function Note({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={INK} strokeWidth="2.200" strokeLinecap="round">
      <path d="M0 0v-14l9 -3v13" />
      <circle cx="-3" cy="0" r="3" fill={INK} />
      <circle cx="6" cy="-3" r="3" fill={INK} />
    </g>
  )
}

const BOOK_COLOURS = [SKY, SUCCESS, WHITE, LILAC, DANGER, YELLOW]

function Person({ x, y, tone, head, flip = false }: { x: number; y: number; tone: string; head: string; flip?: boolean }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} {...line}>
      <rect x="-14" y="-52" width="28" height="52" rx="8" fill={tone} />
      <circle cx="0" cy="-64" r="13" fill={WARN_50} />
      <path d="M-13 -66a13 13 0 0 1 26 0z" fill={head} />
      <circle cx="-4" cy="-63" r="1.700" fill={INK} stroke="none" />
      <circle cx="4" cy="-63" r="1.700" fill={INK} stroke="none" />
      <path d="M-3 -58q3 3 6 0" fill="none" strokeWidth="1.600" />
    </g>
  )
}

function Star5({ x, y, r, fill = STAR }: { x: number; y: number; r: number; fill?: string }): ReactElement {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const d = i % 2 === 0 ? r : r * 0.45
    return `${(x + d * Math.cos(a)).toFixed(1)} ${(y + d * Math.sin(a)).toFixed(1)}`
  })
  return <path d={`M${pts.join('L')}z`} fill={fill} stroke={INK} strokeWidth="1.500" strokeLinejoin="round" />
}

type Show = (flag: string) => boolean

function sceneBody(scene: StorySceneId, has: Show): { sky: string; node: ReactNode } {
  switch (scene) {
    case 'library':
      return {
        sky: has('lit') ? SKY : LAVENDER_SKY,
        node: (
          <>
            <Cloud x={90} y={70} drift />
            <Cloud x={470} y={50} s={0.8} drift />
            <Hill y={210} tone={SCIENCE_50} />
            <Pine x={70} y={250} s={1.1} />
            <Pine x={520} y={252} />
            <Library lit={has('lit')} />
            {has('door') ? <rect x="282" y="172" width="36" height="58" rx="3" fill={INK} /> : null}
            {has('road') ? (
              <g fill="none" strokeLinecap="round">
                <path d="M320 232q120 6 160 26t130 12" stroke={INK} strokeWidth="13" />
                <path d="M320 232q120 6 160 26t130 12" stroke={WHITE} strokeWidth="8" />
              </g>
            ) : null}
            {has('hum') ? (
              <g className="kw-bob">
                <Note x={395} y={100} />
                <Note x={205} y={110} />
                <Note x={430} y={60} />
              </g>
            ) : null}
          </>
        ),
      }
    case 'inside':
      return {
        sky: LAVENDER_SKY,
        node: (
          <>
            {/* Dinding, jendela, pintu, dan lantai */}
            <g {...line}>
              <circle cx="110" cy="62" r="30" fill={SKY} />
              <circle cx="490" cy="62" r="30" fill={SKY} />
              <path d="M110 32v60M80 62h60M490 32v60M460 62h60" strokeWidth="1.800" />
              <rect x="14" y="150" width="58" height="118" rx="4" fill={LILAC} />
              <circle cx="60" cy="212" r="3.500" fill={YELLOW} />
              <rect x="0" y="268" width="600" height="32" fill={WHITE} />
            </g>
            {/* Rak */}
            <g {...line}>
              <rect x="150" y="98" width="300" height="170" rx="4" fill={WHITE} />
              <path d="M150 154h300M150 210h300M300 98v170" strokeWidth="2" />
            </g>
            {has('six') || has('full')
              ? BOOK_COLOURS.map((c, i) => <rect key={c} x={158 + i * 22} y="108" width="19" height="45" rx="2" fill={c} {...line} strokeWidth="2" />)
              : null}
            {has('full')
              ? Array.from({ length: 48 }, (_, i) => {
                  const row = i % 3
                  const col = Math.floor(i / 3)
                  const x = row === 0 ? 306 + col * 9 : 156 + ((col * 18) % 288)
                  const y = row === 0 ? 116 : row === 1 ? 170 : 226
                  return <rect key={i} x={x} y={y} width="13" height={row === 0 ? 37 : 39} rx="1.500" fill={BOOK_COLOURS[i % 6]} stroke={INK} strokeWidth="1.500" />
                })
              : null}
            {/* Meja */}
            <g {...line}>
              <rect x="460" y="222" width="130" height="10" rx="3" fill={LILAC} />
              <path d="M472 232v36M578 232v36" />
            </g>
            {has('note') ? <Scrap x={525} y={210} s={1.1} /> : null}
            {/* Lampu Besar */}
            <path d="M300 0v26" {...line} />
            {has('glow3') ? <rect width={W} height={H} fill={YELLOW} fillOpacity="0.42" /> : null}
            {has('glow3') ? <circle cx="300" cy="46" r="130" fill={YELLOW} fillOpacity="0.6" className="kw-twinkle" /> : null}
            {has('glow2') ? <circle cx="300" cy="46" r="70" fill={YELLOW} fillOpacity="0.5" className="kw-twinkle" /> : null}
            {has('glow1') ? <circle cx="300" cy="46" r="30" fill={YELLOW} fillOpacity="0.55" className="kw-twinkle" /> : null}
            <g {...line}>
              <path d="M276 54q0 -28 24 -28t24 28z" fill={has('glow1') || has('glow2') || has('glow3') ? YELLOW : LILAC} />
              <path d="M272 54h56" />
            </g>
            {has('burst')
              ? Array.from({ length: 12 }, (_, i) => <path key={i} d="M300 -2v-34" stroke={YELLOW} strokeWidth="6" strokeLinecap="round" transform={`rotate(${i * 30} 300 46)`} />)
              : null}
            {has('owl') ? (
              <g transform="translate(112 200)">
                <Icon name="owl" size={68} />
              </g>
            ) : null}
            {has('baker') ? <Person x={214} y={268} tone={WHITE} head={WHITE} /> : null}
            {has('keeper') ? <Person x={392} y={268} tone={SKY} head={INK} flip /> : null}
            {has('hum') ? (
              <g className="kw-bob">
                <Note x={236} y={150} />
                <Note x={380} y={140} />
                <Note x={160} y={90} />
              </g>
            ) : null}
            {has('fly')
              ? [
                  [70, 40], [140, 30], [190, 74], [250, 34], [350, 70], [410, 30], [470, 90], [540, 44], [560, 120], [30, 110],
                ].map(([x, y], i) => <Book key={i} x={x!} y={y!} tone={BOOK_COLOURS[i % 6]!} s={0.8} fly />)
              : null}
          </>
        ),
      }
    case 'forest':
      return {
        sky: LAVENDER_SKY,
        node: (
          <>
            <Hill y={200} tone={SCIENCE_50} />
            {[40, 150, 260, 380, 490, 570].map((x, i) => (
              <Pine key={x} x={x} y={255 + (i % 2) * 8} s={1.1 + (i % 3) * 0.15} />
            ))}
            <g {...line}>
              <path d="M340 186q70 -14 150 -2" fill="none" strokeWidth="7" />
              <path d="M340 186q70 -14 150 -2" fill="none" strokeWidth="3" stroke={WARN_50} />
            </g>
            {has('owl') ? (
              <g transform="translate(398 112)">
                <Icon name="owl" size={76} />
              </g>
            ) : null}
            {has('hat') ? (
              <g>
                {has('hat-lit') ? <circle cx="436" cy="82" r="48" fill={YELLOW} fillOpacity="0.4" /> : null}
                <path d="M406 118q30 -8 60 0L436 44z" fill={LILAC} {...line} />
                <Star5 x={436} y={66} r={6.500} />
                <Star5 x={427} y={84} r={6.500} />
                <Star5 x={446} y={84} r={6.500} />
                <Star5 x={419} y={103} r={6.500} />
                <Star5 x={453} y={103} r={6.500} />
              </g>
            ) : null}
            {has('book') ? <Book x={486} y={166} tone={SKY} s={1.1} /> : null}
          </>
        ),
      }
    case 'river':
      return {
        sky: SKY,
        node: (
          <>
            <Cloud x={120} y={60} drift />
            <Cloud x={470} y={70} s={0.8} drift />
            <rect x="0" y="210" width={W} height="90" fill={MATH} {...line} />
            <path d="M210 240q10 -6 20 0t20 0M300 266q10 -6 20 0t20 0M370 236q10 -6 20 0t20 0" fill="none" stroke={WHITE} strokeWidth="2.500" strokeLinecap="round" className="kw-wave" />
            <path d="M-4 188H136q38 40 44 116H-4z" fill={SCIENCE_50} {...line} />
            <path d="M604 188H470q-38 40 -44 116H604z" fill={SCIENCE_50} {...line} />
            <g {...line}>
              {[120, 158].map((x) => (
                <rect key={x} x={x} y="186" width="36" height="9" rx="2" fill={LILAC} />
              ))}
              {[372, 410, 448].map((x) => (
                <rect key={x} x={x} y="186" width="36" height="9" rx="2" fill={LILAC} />
              ))}
              <path d="M124 186v-22M188 186v-22M124 168h64M378 186v-22M480 186v-22M378 168h102" />
            </g>
            {!has('log1') ? <rect x="210" y="226" width="52" height="11" rx="5.500" fill={YELLOW} {...line} className="kw-bob" /> : <rect x="198" y="184" width="54" height="11" rx="5.500" fill={YELLOW} {...line} />}
            {!has('log2') ? <rect x="282" y="236" width="48" height="11" rx="5.500" fill={YELLOW} {...line} className="kw-bob" /> : <rect x="256" y="184" width="54" height="11" rx="5.500" fill={YELLOW} {...line} />}
            {!has('log3') ? <rect x="350" y="228" width="50" height="11" rx="5.500" fill={YELLOW} {...line} className="kw-bob" /> : <rect x="314" y="184" width="54" height="11" rx="5.500" fill={YELLOW} {...line} />}
            {has('fish') ? (
              <g>
                <g transform="translate(232 240)">
                  <Icon name="fish" size={30} />
                </g>
                <g transform="translate(330 252)">
                  <Icon name="fish" size={30} />
                </g>
              </g>
            ) : null}
            {has('scarf') ? <path d="M190 158q30 40 42 72" fill="none" stroke={DANGER} strokeWidth="3.500" strokeLinecap="round" /> : null}
            <Tree x={70} y={188} />
            <Tree x={556} y={188} s={0.9} />
            <g {...line}>
              <path d="M504 188q-3 -18 -7 -28M514 188q0 -18 2 -32M534 188q2 -16 7 -24" fill="none" stroke={SUCCESS} strokeWidth="3.500" />
            </g>
            {!has('scrap') ? <Book x={520} y={178} tone={SUCCESS} /> : null}
          </>
        ),
      }
    case 'windmill':
      return {
        sky: SKY,
        node: (
          <>
            <Cloud x={80} y={60} drift />
            <Hill y={215} tone={SCIENCE_50} />
            <Windmill x={300} y={250} />
            {has('pages-many') || has('pages-few')
              ? (has('pages-many') ? [[120, 70], [190, 118], [440, 70], [500, 130], [400, 150], [70, 150], [545, 50], [240, 40], [360, 36], [150, 190]] : [[230, 112], [172, 66], [110, 92]]).map(([x, y], i) => (
                  <g key={i} transform={`translate(${x} ${y})`} className="kw-bob">
                    <rect x="-9" y="-12" width="18" height="24" rx="2" fill={WHITE} {...line} strokeWidth="2" transform={`rotate(${i * 25 - 40})`} />
                  </g>
                ))
              : null}
            {has('baker') ? <Person x={470} y={250} tone={WHITE} head={WHITE} flip /> : null}
            {has('book') ? <Book x={410} y={262} tone={WHITE} s={1.1} /> : null}
          </>
        ),
      }
    case 'harbour':
      return {
        sky: SKY,
        node: (
          <>
            <Cloud x={110} y={60} drift />
            <rect x="0" y="190" width={W} height="110" fill={MATH} {...line} />
            <path d="M30 220q10 -6 20 0t20 0M180 250q10 -6 20 0t20 0M330 224q10 -6 20 0t20 0M90 268q10 -6 20 0t20 0" fill="none" stroke={WHITE} strokeWidth="2.500" strokeLinecap="round" className="kw-wave" />
            <path d="M360 304q30 -90 140 -82t110 82z" fill={WARN_50} {...line} />
            <Lighthouse x={510} y={240} bright={has('bright')} />
            {has('keeper') ? <Person x={464} y={246} tone={SKY} head={INK} flip /> : null}
            <g {...line}>
              <path d="M222 262q10 -38 40 -38t44 38z" fill={INK} />
            </g>
            {!has('no-book') ? <Book x={262} y={216} tone={LILAC} s={1.15} /> : null}
            {has('bigwave') ? <path d="M250 300q10 -74 66 -74q34 0 46 34q-22 -18 -34 -2q10 14 10 42z" fill={WHITE} {...line} className="kw-bob" /> : null}
            {has('waves-count') ? (
              <g fill={WHITE} {...line} strokeWidth="2">
                <path d="M60 240q18 -34 44 -6q-14 -4 -16 6z" />
                <path d="M130 240q10 -16 24 -3q-8 -2 -9 3z" />
                <path d="M178 240q10 -16 24 -3q-8 -2 -9 3z" />
              </g>
            ) : null}
            {has('pole') ? <path d="M400 214L312 196" {...line} strokeWidth="4" /> : null}
            {has('splash') ? (
              <g fill={WHITE} {...line} strokeWidth="1.600">
                <circle cx="370" cy="204" r="5" />
                <circle cx="350" cy="222" r="4" />
                <circle cx="388" cy="190" r="3.500" />
                <circle cx="438" cy="204" r="4" />
              </g>
            ) : null}
            {has('boat-home') ? (
              <g transform="translate(120 226)" className="kw-bob" {...line}>
                <path d="M-34 0h68l-12 18h-44z" fill={LILAC} />
                <path d="M0 0v-52l26 40z" fill={WHITE} />
              </g>
            ) : null}
            <g transform="translate(80 90)" {...line} fill="none" strokeWidth="2.500">
              <path d="M0 0q8 -9 16 0q8 -9 16 0" />
            </g>
          </>
        ),
      }
    case 'mountain':
      return {
        sky: has('gold') ? YELLOW : LAVENDER_SKY,
        node: (
          <>
            <Mountain x={120} y={270} s={0.9} />
            <Mountain x={300} y={270} s={1.3} />
            <Mountain x={500} y={270} s={1} />
            <path d="M0 270h600v30H0z" fill={WHITE} {...line} />
            {has('rest') ? <path d="M268 270q4 -18 32 -18t32 18z" fill={LILAC} {...line} /> : null}
            {has('cave') ? (
              <g {...line}>
                <path d="M420 270q0 -66 56 -66t56 66z" fill={INK} />
                <Star5 x={444} y={232} r={4} />
                <Star5 x={508} y={226} r={3.500} />
                <Star5 x={478} y={216} r={3} />
              </g>
            ) : null}
            {has('book') ? (
              <g>
                <Book x={476} y={252} tone={DANGER} s={1.2} />
                <path d="M468 250l5 -3l5 3l5 -3" fill="none" stroke={WHITE} strokeWidth="1.500" strokeLinecap="round" />
              </g>
            ) : null}
            {has('scrap') ? <path d="M476 200q40 -60 60 -180" fill="none" stroke={INK} strokeWidth="2.500" strokeDasharray="2 9" strokeLinecap="round" /> : null}
            {has('wind') ? (
              <g fill="none" stroke={WHITE} strokeWidth="3" strokeLinecap="round" className="kw-wave">
                <path d="M160 120q30 -12 60 0t60 0" />
                <path d="M330 90q30 -12 60 0t60 0" />
                <path d="M210 190q30 -12 60 0t60 0" />
              </g>
            ) : null}
            {has('snowfall') ? (
              <g fill={WHITE} stroke={INK} strokeWidth="1" className="kw-bob">
                {[[60, 40], [130, 90], [200, 34], [260, 120], [320, 60], [390, 110], [450, 44], [520, 96], [570, 40], [100, 170], [430, 180]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4.500 : 3.200} />
                ))}
              </g>
            ) : null}
          </>
        ),
      }
    case 'sky':
      return {
        sky: has('rain') ? LAVENDER_SKY : SKY,
        node: (
          <>
            {has('rain') ? null : <Rainbow x={230} y={260} />}
            {has('rain') ? (
              <g stroke={INK} strokeWidth="2" strokeLinecap="round">
                {[60, 120, 180, 240, 300, 360, 420, 480, 540].map((x, i) => (
                  <path key={x} d={`M${x} ${60 + (i % 3) * 30}l-5 18`} />
                ))}
              </g>
            ) : (
              <circle cx="530" cy="56" r="30" fill={YELLOW} {...line} />
            )}
            <Cloud x={70} y={230} s={1.3} drift />
            <Cloud x={160} y={90} drift />
            <Cloud x={420} y={110} s={1.2} drift />
            <path d="M-4 304V272q70 -22 120 -6t90 38z" fill={WHITE} {...line} />
            {has('birds') ? (
              <g fill="none" stroke={INK} strokeWidth="2.500" strokeLinecap="round">
                <path d="M300 60q7 -8 14 0q7 -8 14 0M350 90q7 -8 14 0q7 -8 14 0M120 60q7 -8 14 0q7 -8 14 0" />
              </g>
            ) : null}
            {has('island') ? (
              <g transform="translate(500 212) scale(1.3)" {...line}>
                <path d="M-70 40q-4 -30 18 -34q8 -24 38 -12q22 -16 40 6q22 8 14 40z" fill={WHITE} />
              </g>
            ) : null}
            {has('book') ? (
              <g>
                <Book x={530} y={196} tone={YELLOW} s={1.2} />
                <path d="M516 194h28M530 184v22" stroke={DANGER} strokeWidth="3" strokeLinecap="round" />
              </g>
            ) : null}
            {has('slide') ? (
              <g fill="none" stroke={INK} strokeWidth="2.200" strokeLinecap="round">
                <path d="M120 200l-14 18M136 222l-14 16M152 188l-12 16" />
              </g>
            ) : null}
          </>
        ),
      }
    default:
      return {
        sky: STAR,
        node: (
          <>
            <rect width={W} height={H} fill={WARN_50} />
            <circle cx="300" cy="150" r="140" fill={STAR} fillOpacity="0.5" className="kw-twinkle" />
            <Hill y={225} tone={SCIENCE_50} />
            <Library lit />
          </>
        ),
      }
  }
}

export type StorySceneProps = {
  scene: string
  cx?: number
  /** Tengah vertikal jendela (persen). Kosong: jendela menempel ke bawah. */
  cy?: number | undefined
  zoom?: number
  lumi: { x: number; y: number }
  /** Besar cahaya Lumi. */
  glow?: number
  pip?: { x: number; y: number } | undefined
  kira?: { x: number; y: number; flip?: boolean | undefined; read?: boolean | undefined; worry?: boolean | undefined } | undefined
  show?: readonly string[] | undefined
  title?: string
  className?: string
}

export function StoryScene({ scene, cx = 50, cy, zoom = 1, lumi, glow = 1, pip, kira, show = [], title, className }: StorySceneProps): ReactElement {
  const id = (STORY_SCENES as readonly string[]).includes(scene) ? (scene as StorySceneId) : 'library'
  const has: Show = (f) => show.includes(f)
  const body = sceneBody(id, has)
  const vw = W / zoom
  const vh = H / zoom
  const vx = Math.min(W - vw, Math.max(0, (cx / 100) * W - vw / 2))
  const vy = cy === undefined ? H - vh : Math.min(H - vh, Math.max(0, (cy / 100) * H - vh / 2))
  const kiraX = kira ? (kira.x / 100) * W : Math.min(W - 40, Math.max(40, (cx / 100) * W - 40))
  const kiraY = kira ? (kira.y / 100) * H : 272
  const kiraS = 1.2
  const pipBig = has('pip-big') ? 3.2 : has('pip-desk') ? 1.5 : 1
  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} width="100%" className={className} preserveAspectRatio="xMidYMax slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <rect x="0" y="0" width={W} height={H} fill={body.sky} />
      {body.node}
      {has('dark') ? <rect width={W} height={H} fill={INK} fillOpacity="0.55" /> : null}
      {has('dusk') ? <rect width={W} height={H} fill={INK} fillOpacity="0.28" /> : null}
      {has('gold') ? <circle cx={kiraX} cy={kiraY - 40} r="120" fill={YELLOW} fillOpacity="0.5" className="kw-twinkle" /> : null}
      {has('eyes') ? (
        <g stroke={INK} strokeWidth="2.500">
          <circle cx="418" cy="140" r="17" fill={WHITE} />
          <circle cx="456" cy="140" r="17" fill={WHITE} />
          <circle cx="421" cy="143" r="7" fill={INK} />
          <circle cx="453" cy="143" r="7" fill={INK} />
        </g>
      ) : null}
      {pip ? <Pip x={(pip.x / 100) * W} y={(pip.y / 100) * H} s={pipBig} /> : null}
      {has('cover') ? <rect x={kiraX + 8} y={kiraY - 72} width="42" height="30" rx="3" fill={WHITE} {...line} /> : null}
      {has('bun') ? (
        <g transform={`translate(${kiraX + 14} ${kiraY - 66})`}>
          <Icon name="bread" size={34} />
        </g>
      ) : null}
      <Kira x={kiraX} y={kiraY} s={kiraS} {...(kira?.flip ? { flip: true } : {})} {...(kira?.read ? { read: true } : {})} {...(kira?.worry ? { worry: true } : {})} {...(has('rest') ? { sit: true } : {})} />
      {has('scrap') ? <Scrap x={kiraX + 42} y={kiraY - 58} s={1.15} /> : null}
      <Lumi x={(lumi.x / 100) * W} y={(lumi.y / 100) * H} s={1.1} glow={glow} />
    </svg>
  )
}
