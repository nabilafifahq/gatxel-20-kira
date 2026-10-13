import type { Drawn, Spec } from './kit'

/** Ukuran terbesar potongan gambar di layar; rasio tetap. */
const MAX_W = 520
const MAX_H = 380

/**
 * Potongan gambar dari halaman paper. Berkasnya media org (`/api/media/<id>`) dari server sendiri,
 * jadi tidak ada aset pihak ketiga. Hanya dipakai soal hasil impor paket resmi keluarga.
 */
export function drawClip(spec: Spec<'clip'>): Drawn {
  const scale = Math.min(1, MAX_W / spec.width, MAX_H / spec.height)
  const w = Math.max(48, Math.round(spec.width * scale))
  const h = Math.max(48, Math.round(spec.height * scale))
  return {
    w,
    h,
    el: <image href={`/api/media/${spec.mediaId}`} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid meet" />,
  }
}
