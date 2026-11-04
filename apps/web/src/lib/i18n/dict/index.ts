/**
 * Kamus antarmuka anak (Indonesia dan Inggris).
 *
 * Cara menambah teks:
 * 1. Tulis di file area yang cocok (dict/shell.ts, runner.ts, widgets.ts, dan seterusnya), di objek `en` dan `id`.
 *    Kunci yang hanya ada di satu bahasa membuat `pnpm typecheck` gagal.
 * 2. Pakai di layar. Komponen klien: `const t = useT()` dari '@/lib/i18n/client'. Server Component, metadata, dan
 *    pesan error di server: `const t = await getT()` dari '@/lib/i18n/server', atau `dictFor(actor.uiLang)`.
 * 3. Teks dengan angka atau nama berupa fungsi dengan parameter posisi: `xpLagi: (n: number) => `${n} XP lagi``.
 *    Fungsi tidak bisa dikirim dari server ke komponen klien, jadi jangan kirim `t` lewat prop; panggil `useT()`.
 *
 * Yang masuk kamus: navigasi, tombol, instruksi, kata umpan balik, keadaan kosong, error, kalimat maskot, hadiah.
 * Yang tidak masuk: isi soal dan pelajaran, yang tetap memakai bahasa aslinya.
 * Teks Indonesia: sapa dengan "kamu" dan "-mu", kata sehari-hari, nada guru yang hangat. Jangan dibacakan suara:
 * text-to-speech hanya untuk isi berbahasa Inggris. Pedoman ada di docs/standards/gtx/references/copy-indonesian.md.
 */
import { arena } from './arena'
import { common } from './common'
import { lessons } from './lessons'
import { reading } from './reading'
import { runner } from './runner'
import { shell } from './shell'
import { widgets } from './widgets'
import { world } from './world'

export const en = {
  common: common.en,
  shell: shell.en,
  runner: runner.en,
  widgets: widgets.en,
  lessons: lessons.en,
  arena: arena.en,
  reading: reading.en,
  world: world.en,
}

export type Dict = typeof en

export const id: Dict = {
  common: common.id,
  shell: shell.id,
  runner: runner.id,
  widgets: widgets.id,
  lessons: lessons.id,
  arena: arena.id,
  reading: reading.id,
  world: world.id,
}
