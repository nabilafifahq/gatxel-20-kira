import type { ReactElement, ReactNode } from 'react'
import { DANGER, DIVIDER, ENGLISH, ENGLISH_50, INK, KNOWLEDGE, KNOWLEDGE_50, MATH, MATH_50, MENTAL, MUTED, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'
import { Icon } from '../icons'

/**
 * Gambar cerita "Kira and the Lost Library". Setiap bab satu adegan lebar 600 x 300; halaman cerita
 * menggeser dan memperbesar jendela (viewBox) ke bagian yang sedang dibaca, jadi satu gambar membawa
 * seluruh bab. Kira adalah tokoh utama, Lumi kunang-kunang yang selalu menunjuk arah berikutnya.
 */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const W = 600
const H = 300

export const STORY_SCENES = ['library', 'forest', 'river', 'windmill', 'harbour', 'mountain', 'sky', 'finale'] as const
export type StorySceneId = (typeof STORY_SCENES)[number]

function Tree({ x, y, s = 1, tone = SCIENCE }: { x: number; y: number; s?: number; tone?: string }): ReactElement {
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
      <path d="M0 -70L-20 -34h40z" fill={SCIENCE} />
      <path d="M0 -50L-26 -14h52z" fill={SCIENCE} />
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

function Lighthouse({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`} {...line}>
      <path d="M-24 0L-14 -120h28L24 0z" fill={WHITE} />
      <path d="M-20 -30h40l-3 22h-34zM-17 -80h34l-2.500 22h-29z" fill={ENGLISH} />
      <rect x="-16" y="-142" width="32" height="22" rx="3" fill={STAR} />
      <path d="M-20 -142L0 -164L20 -142z" fill={ENGLISH} />
      <path d="M16 -131l60 -14v28z" fill={STAR} fillOpacity="0.45" stroke="none" className="kw-twinkle" />
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
  const cols = [DANGER, WARN, STAR, SCIENCE, MATH, MENTAL]
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
export function Kira({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }): ReactElement {
  return (
    <g transform={"translate(" + x + " " + y + ") scale(" + (flip ? -s : s) + " " + s + ")"} {...line}>
      <ellipse cx="0" cy="2" rx="16" ry="3.500" fill={DIVIDER} stroke="none" />
      <path d="M-6 -16v14M6 -16v14" strokeWidth="5" stroke={WARN_50} />
      <path d="M-6 -16v14M6 -16v14" strokeWidth="1.800" />
      <ellipse cx="-7" cy="-1" rx="6" ry="3" fill={MATH} />
      <ellipse cx="7" cy="-1" rx="6" ry="3" fill={MATH} />
      <path d="M-10 -17L-15 -36q15 -8 30 0L10 -17z" fill={SCIENCE} />
      <path d="M-13 -35q13 6 26 0l-2 6q-11 5 -22 0z" fill={ENGLISH} />
      <path d="M-17 -31l-7 11M17 -31l7 11" strokeWidth="4" stroke={WARN_50} />
      <path d="M-17 -31l-7 11M17 -31l7 11" strokeWidth="1.600" />
      <circle cx="0" cy="-48" r="13" fill={WARN_50} />
      <path d="M-13 -50a13 13 0 0 1 26 0q-6 -7 -13 -5q-8 -3 -13 5z" fill={INK} />
      <circle cx="-15" cy="-46" r="4.500" fill={INK} />
      <circle cx="15" cy="-46" r="4.500" fill={INK} />
      <circle cx="-4.500" cy="-47" r="1.800" fill={INK} stroke="none" />
      <circle cx="4.500" cy="-47" r="1.800" fill={INK} stroke="none" />
      <path d="M-3.500 -41q3.500 3.500 7 0" fill="none" strokeWidth="1.800" />
    </g>
  )
}

/** Lumi, kunang-kunang kecil. */
export function Lumi({ x, y, s = 1 }: { x: number; y: number; s?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="kw-bob">
        <circle r="16" fill={STAR} fillOpacity="0.28" className="kw-twinkle" />
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

function sceneBody(scene: StorySceneId): { sky: string; node: ReactNode } {
  switch (scene) {
    case 'library':
      return {
        sky: MATH_50,
        node: (
          <>
            <Cloud x={90} y={70} drift />
            <Cloud x={470} y={50} s={0.8} drift />
            <Hill y={210} tone={SCIENCE_50} />
            <Pine x={70} y={250} s={1.1} />
            <Pine x={520} y={252} />
            <Library lit={false} />
          </>
        ),
      }
    case 'forest':
      return {
        sky: SCIENCE_50,
        node: (
          <>
            <Hill y={200} tone={SCIENCE_50} />
            {[40, 150, 260, 380, 480, 570].map((x, i) => (
              <Pine key={x} x={x} y={255 + (i % 2) * 8} s={1.1 + (i % 3) * 0.15} />
            ))}
            <g transform="translate(400 150)">
              <Icon name="owl" size={64} />
            </g>
            <Book x={430} y={226} tone={MATH} />
          </>
        ),
      }
    case 'river':
      return {
        sky: MATH_50,
        node: (
          <>
            <Cloud x={120} y={60} drift />
            <rect x="0" y="180" width={W} height="120" fill={SCIENCE_50} />
            <rect x="0" y="200" width={W} height="64" fill={MATH} {...line} />
            <path d="M40 222q10 -6 20 0t20 0M300 240q10 -6 20 0t20 0M470 222q10 -6 20 0t20 0" fill="none" stroke={WHITE} strokeWidth="2.500" strokeLinecap="round" className="kw-wave" />
            <g {...line}>
              {[150, 190, 270, 310, 350].map((x) => (
                <rect key={x} x={x} y="188" width="34" height="9" rx="2" fill={WARN} />
              ))}
              <path d="M150 190v-18M360 190v-18M150 176h234" />
            </g>
            <g {...line} fill={WARN}>
              <rect x="206" y="248" width="46" height="12" rx="6" className="kw-bob" />
              <rect x="276" y="254" width="40" height="12" rx="6" className="kw-bob" />
            </g>
            <Tree x={70} y={185} />
            <Tree x={540} y={185} s={0.9} />
            <Book x={500} y={196} tone={SCIENCE} />
          </>
        ),
      }
    case 'windmill':
      return {
        sky: MATH_50,
        node: (
          <>
            <Cloud x={80} y={60} drift />
            <Hill y={215} tone={SCIENCE_50} />
            <Windmill x={300} y={250} />
            {[120, 190, 440, 500, 400].map((x, i) => (
              <g key={x} transform={`translate(${x} ${70 + (i % 3) * 38})`} className="kw-bob">
                <rect x="-9" y="-12" width="18" height="24" rx="2" fill={WHITE} {...line} strokeWidth="2" transform={`rotate(${i * 25 - 40})`} />
              </g>
            ))}
            <g transform="translate(470 250)" {...line}>
              <rect x="-14" y="-52" width="28" height="52" rx="8" fill={ENGLISH_50} />
              <circle cx="0" cy="-64" r="13" fill={WARN_50} />
              <path d="M-13 -66a13 13 0 0 1 26 0z" fill={WHITE} />
            </g>
          </>
        ),
      }
    case 'harbour':
      return {
        sky: MATH_50,
        node: (
          <>
            <Cloud x={110} y={60} drift />
            <rect x="0" y="190" width={W} height="110" fill={MATH} {...line} />
            <path d="M30 220q10 -6 20 0t20 0M180 250q10 -6 20 0t20 0M330 224q10 -6 20 0t20 0M450 256q10 -6 20 0t20 0" fill="none" stroke={WHITE} strokeWidth="2.500" strokeLinecap="round" className="kw-wave" />
            <path d="M380 300q40 -90 130 -80t90 80z" fill={WARN_50} {...line} />
            <Lighthouse x={500} y={250} />
            <g transform="translate(170 225)" className="kw-bob" {...line}>
              <path d="M-34 0h68l-12 18h-44z" fill={ENGLISH} />
              <path d="M0 0v-52l26 40z" fill={WHITE} />
            </g>
            <g transform="translate(80 90)" {...line} fill="none" strokeWidth="2.500">
              <path d="M0 0q8 -9 16 0q8 -9 16 0" />
            </g>
            <Book x={340} y={196} tone={KNOWLEDGE} />
          </>
        ),
      }
    case 'mountain':
      return {
        sky: KNOWLEDGE_50,
        node: (
          <>
            <Mountain x={120} y={270} s={0.9} />
            <Mountain x={300} y={270} s={1.3} />
            <Mountain x={500} y={270} s={1} />
            <path d="M0 270h600v30H0z" fill={WHITE} {...line} />
            <g {...line}>
              <path d="M360 270q-20 -40 0 -60" fill="none" strokeDasharray="2 9" />
              <path d="M300 118l8 -12l8 12z" fill={WHITE} />
              <path d="M430 270a22 22 0 0 1 44 0z" fill={MUTED} />
            </g>
            <Book x={452} y={258} tone={ENGLISH} />
          </>
        ),
      }
    case 'sky':
      return {
        sky: MATH_50,
        node: (
          <>
            <Rainbow x={230} y={260} />
            <Cloud x={70} y={230} s={1.3} drift />
            <Cloud x={160} y={90} drift />
            <Cloud x={420} y={110} s={1.2} drift />
            <g transform="translate(500 200)" {...line}>
              <path d="M-70 40q-4 -30 18 -34q8 -24 38 -12q22 -16 40 6q22 8 14 40z" fill={WHITE} />
            </g>
            <Book x={500} y={190} tone={STAR} />
            <path d="M486 188h28" stroke={ENGLISH} strokeWidth="3" strokeLinecap="round" />
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
            <g transform="translate(110 250)">
              <Icon name="owl" size={60} />
            </g>
            <g transform="translate(490 250)">
              <Icon name="fish" size={48} />
            </g>
            <g {...line} transform="translate(60 236)" fill={ENGLISH_50}>
              <rect x="-12" y="-44" width="24" height="44" rx="8" />
              <circle cy="-54" r="11" fill={WARN_50} />
            </g>
          </>
        ),
      }
  }
}

export function StoryScene({ scene, cx = 50, zoom = 1, lumi, title, className }: { scene: string; cx?: number; zoom?: number; lumi: { x: number; y: number }; title?: string; className?: string }): ReactElement {
  const id = (STORY_SCENES as readonly string[]).includes(scene) ? (scene as StorySceneId) : 'library'
  const body = sceneBody(id)
  const vw = W / zoom
  const vh = H / zoom
  const vx = Math.min(W - vw, Math.max(0, (cx / 100) * W - vw / 2))
  const vy = Math.min(H - vh, Math.max(0, H - vh))
  const kiraX = Math.min(W - 40, Math.max(40, (cx / 100) * W - 40))
  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} width="100%" className={className} preserveAspectRatio="xMidYMax slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <rect x="0" y="0" width={W} height={H} fill={body.sky} />
      {body.node}
      <Kira x={kiraX} y={272} s={1.5} />
      <Lumi x={(lumi.x / 100) * W} y={(lumi.y / 100) * H} s={1.1} />
    </svg>
  )
}

