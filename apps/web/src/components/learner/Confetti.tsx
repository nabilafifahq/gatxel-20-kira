'use client'

import { useEffect, useRef, type ReactElement } from 'react'

/**
 * Confetti di kanvas, tanpa pustaka dan tanpa aset dari luar. Hanya dipasang di akhir sesi
 * (SessionCelebration), sekitar 2,6 detik, tidak menangkap sentuhan, dan tidak jalan sama
 * sekali bila perangkat meminta reduced motion. Warna diambil dari token DESIGN.md.
 */

const TOKENS = ['--color-star', '--color-math', '--color-english', '--color-science', '--color-success', '--color-warn']
const COUNT = 72
const DURATION_MS = 2600

type Piece = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string }

export function Confetti({ onDone }: { onDone?: () => void }): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current?.()
      return
    }
    const g = el.getContext('2d')
    if (!g) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = window.innerWidth
    const height = window.innerHeight
    el.width = Math.round(width * dpr)
    el.height = Math.round(height * dpr)
    g.scale(dpr, dpr)
    const css = getComputedStyle(document.documentElement)
    const colors = TOKENS.map((t) => css.getPropertyValue(t).trim()).filter(Boolean)
    if (colors.length === 0) return
    const pieces: Piece[] = Array.from({ length: COUNT }, (_, i) => ({
      x: width * (0.15 + Math.random() * 0.7),
      y: -20 - Math.random() * height * 0.25,
      vx: (Math.random() - 0.5) * 3.2,
      vy: 2.2 + Math.random() * 3,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      color: colors[i % colors.length] ?? colors[0] ?? '',
    }))
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = now - start
      g.clearRect(0, 0, width, height)
      const fade = t > DURATION_MS - 600 ? Math.max(0, (DURATION_MS - t) / 600) : 1
      g.globalAlpha = fade
      for (const p of pieces) {
        p.vy += 0.06
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.fillStyle = p.color
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        g.restore()
      }
      if (t < DURATION_MS) raf = requestAnimationFrame(frame)
      else {
        g.clearRect(0, 0, width, height)
        done.current?.()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-svh w-full" />
}
