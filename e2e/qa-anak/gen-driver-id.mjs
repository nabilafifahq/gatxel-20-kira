import { readFileSync, writeFileSync } from 'node:fs'
let s = readFileSync('qa-soal/driver.ts', 'utf8')
const R = [
  [`section[aria-label="Your answer"]`, `section[aria-label="Jawabanmu"]`],
  [`section[aria-label="Question"]`, `section[aria-label="Soal"]`],
  [`{ name: 'Answers' }`, `{ name: 'Jawaban' }`],
  [`'Decimal point'`, `'Tanda desimal'`], [`'Minus sign'`, `'Tanda minus'`],
  [`{ name: 'Your answer' }`, `{ name: 'Jawabanmu' }`],
  [`/^(Gap \\d+ of \\d+)$/`, `/^(Bagian kosong \\d+ dari \\d+)$/`],
  ['`Card ${item.items[seq[k]!]}`', '`Kartu ${item.items[seq[k]!]}`'],
  [`const ords = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']`, `const ords = ['ke-1', 'ke-2', 'ke-3', 'ke-4', 'ke-5', 'ke-6', 'ke-7', 'ke-8']`],
  ['`^${ords[k]}, empty`', '`^${ords[k]}, kosong`'],
  [`section[aria-label="Cards to sort"]`, `section[aria-label="Kartu yang perlu dikelompokkan"]`],
  ['`Put ${c.text} in ${item.groups[dest]}`', '`Masukkan ${c.text} ke ${item.groups[dest]}`'],
  [`'Hour forward'`, `'Majukan jam'`], [`'Hour back'`, `'Mundurkan jam'`], ['`Minutes forward by ${step}`', '`Majukan ${step} menit`'],
  ['`Part ${k + 1} of ${item.parts}`', '`Bagian ${k + 1} dari ${item.parts}`'],
  ['`^Question ${k + 1}`', '`^Soal ${k + 1}`'],
  [`'Word cards'`, `'Kartu kata'`], [`name: 'Letters'`, `name: 'Huruf'`], [`'Numbers' : 'Letters'`, `'Angka' : 'Huruf'`],
  [`'Hyphen'`, `'Tanda hubung'`], [`'Apostrophe'`, `'Apostrof'`], [`'Space'`, `'Spasi'`], [`'Point'`, `'Titik'`],
  [`name: 'Numbers'`, `name: 'Angka'`],
  [`'Places in the picture'`, `'Tempat di gambar'`], [`name: 'Labels'`, `name: 'Label'`], [`'Places to label'`, `'Tempat untuk label'`],
  ['`Place ${s + 1}, empty`', '`Tempat ${s + 1}, kosong`'],
  ['`${head}, row ${bl.row + 1}: empty`', '`${head}, baris ${bl.row + 1}: kosong`'],
  [`?? 'Column'`, `?? 'Kolom'`],
  ['`^Row ${r + 1}, column ${c + 1}:`', '`^Baris ${r + 1}, kolom ${c + 1}:`'],
  [`const names = { h: 'hundred', t: 'ten', o: 'one' } as const`, `const names = { h: 'ratusan', t: 'puluhan', o: 'satuan' } as const`],
  ['`Add one ${names[p]}`', '`Tambah 1 ${names[p]}`'], ['`Take away one ${names[p]}`', '`Kurangi 1 ${names[p]}`'],
  [`'Add one one'`, `'Tambah 1 satuan'`], [`'Take away one one'`, `'Kurangi 1 satuan'`],
  ['`section[aria-label="Bar ${i + 1}"]`', '`section[aria-label="Batang ${i + 1}"]`'],
  ['`^Part ${bar.shaded} of ${bar.den}(,|$)`', '`^Bagian ${bar.shaded} dari ${bar.den}(,|$)`'],
  [`name: 'Add bar'`, `name: 'Tambah batang'`], ['`Label for bar ${i + 1}`', '`Label batang ${i + 1}`'],
  ['`More units in bar ${i + 1}`', '`Tambah unit di batang ${i + 1}`'], ['`Fewer units in bar ${i + 1}`', '`Kurangi unit di batang ${i + 1}`'],
  [`'More value by 10'`, `'Tambah nilai sebanyak 10'`], [`'More value by 1'`, `'Tambah nilai sebanyak 1'`],
  [`'Tray of pieces'`, `'Kumpulan keping'`], [`'Turn'`, `'Putar'`], [`'Flip'`, `'Balik'`],
  ['`^Place ${s + 1} of ${item.slots.length}`', '`^Tempat ${s + 1} dari ${item.slots.length}`'],
  ['`^Peg column ${x + 1}, row ${y + 1}(,|$)`', '`^Paku kolom ${x + 1}, baris ${y + 1}(,|$)`'],
  [`const name = PIECE_NAME[item.pieces[p]!]`, `const name = ({ L: 'segitiga besar', M: 'segitiga sedang', S: 'segitiga kecil', Q: 'persegi', P: 'jajar genjang' } as Record<string, string>)[item.pieces[p]!]!`],
  [`al.replace(/, matched$/, '')`, `al.replace(/, sudah dipasangkan$/, '')`],
]
for (const [a, b] of R) {
  if (!s.includes(a)) console.log('TIDAK KETEMU', a)
  s = s.split(a).join(b)
}
s = s.replace(`from '../../packages/content/src/check'`, `from '../../packages/content/src/check'`)
writeFileSync('qa-anak/driver-id.ts', s)
