'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useReducedMotion } from './hooks'

/** Nilai yang naik dari 0 ke target dengan kurva melambat. Murni data, bukan hiasan transform. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target
  const t = Math.max(0, elapsedMs / durationMs)
  const eased = 1 - (1 - t) ** 3
  return Math.round(target * eased)
}

/**
 * Angka yang menghitung naik saat muncul (hasil sesi), sekitar satu detik. Satu elemen saja, jadi teks akhirnya
 * sama dengan tanpa animasi. Reduced motion dan `animate={false}` langsung ke nilai akhir.
 */
export function CountUp({
  value,
  durationMs = 900,
  delayMs = 250,
  animate = true,
}: {
  value: number
  durationMs?: number
  delayMs?: number
  animate?: boolean
}): ReactElement {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(animate ? 0 : value)
  useEffect(() => {
    if (!animate || reduce) {
      setShown(value)
      return
    }
    let raf = 0
    let start = 0
    const begin = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const v = countUpValue(value, now - start, durationMs)
        setShown(v)
        if (v < value) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delayMs)
    return () => {
      window.clearTimeout(begin)
      cancelAnimationFrame(raf)
    }
  }, [value, durationMs, delayMs, animate, reduce])
  return <span data-value={value}>{shown}</span>
}
