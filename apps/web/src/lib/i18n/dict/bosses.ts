/**
 * Kalimat bos menurut id. Nama bos tetap nama. Teks Inggrisnya ada di packages/core/src/world/boss.ts, jadi kamus Inggris
 * kosong dan layar memakai bossText. Bos baru tanpa kunci di sini tampil dengan teks Inggrisnya sampai kuncinya
 * ditambahkan (tes kamus menandainya). Jumlah attacks dan hits harus sama dengan sumbernya. Cara menambah teks ada di
 * dict/index.ts.
 */
export type BossText = {
  epithet: string
  personality: string
  weakness: string
  intro: string
  attacks: readonly string[]
  hits: readonly string[]
  defeat: string
  rematch: string
}

const en = {} as Record<string, BossText | undefined>

const id: typeof en = {
  robot: {
    epithet: 'Si tukang utak-atik yang riang',
    personality: 'Suka semua jenis teka-teki dan selalu menggosok kepalanya di sela ronde.',
    weakness: 'Sedikit dari semuanya',
    intro: 'Bip bup! Aku punya seribu teka-teki dan satu kepala yang sangat mengilap.',
    attacks: ['Puzzle Robot berbunyi bip kecil karena senang. Coba soal berikutnya, yuk!', 'Wrrr! Robot memutar telinganya ke arahmu. Tidak ada yang berkurang.', 'Robot menggosok kepalanya, lalu berkedip.'],
    hits: ['Bzzt! Roda gigiku!', 'Klontang! Baut-bautku sampai bergetar.', 'Aduh! Siapa yang menguras bateraiku?'],
    defeat: 'Mematikan daya. Manusia yang pintar sekali. Bip.',
    rematch: 'Bip! Bateraiku masih penuh. Datang lagi kapan saja, ya.',
  },
  clickerclaw: {
    epithet: 'Si kepiting penghitung',
    personality: 'Menghitung semuanya dua kali, lalu sekali lagi supaya yakin.',
    weakness: 'Berhitung dan bilangan',
    intro: 'Klik, klik, klik! Aku sudah menghitung setiap butir pasir. Dua kali.',
    attacks: ['Clickerclaw memainkan manik-maniknya ke arahmu. Klik, klik, klik!', 'Clickerclaw melambaikan capitnya dan menghitung sampai sepuluh, pelan sekali.', 'Clickerclaw berjalan menyamping sambil cekikikan.'],
    hits: ['Oh! Hitunganku jadi buyar!', 'Manik-manikku! Semuanya bergeser ke arah yang keliru!', 'Aduh! Sekarang aku harus mulai lagi dari satu.'],
    defeat: 'Sudah kuhitung dua kali. Kamu memang menang.',
    rematch: 'Sembilan, sepuluh, sebelas. Oh, kamu kembali? Nanti kita berhitung lagi, ya.',
  },
  mumblewump: {
    epithet: 'Si bola bulu pengacau kata',
    personality: 'Bola bulu yang bulat dan lembut. Setiap kata yang diucapkannya selalu tertukar.',
    weakness: 'Arti kata',
    intro: 'Selamat pagi, pisang kecilku! Eh, bintang kecilku. Eh, aduh.',
    attacks: ['Mumblewump berkata: usaha bagus, teko yang pintar!', 'Mumblewump menggembung, lalu bersin dan keluar satu kata. Katanya "sosis".', 'Mumblewump melompat-lompat sambil bersenandung lagu yang keliru.'],
    hits: ['Uf! Kata-kataku berjatuhan!', 'Aduh, buluku! Yang tadi hebat sekali!', 'Aduh! Maksudku, wah! Maksudku, aduh!'],
    defeat: 'Kamu menang dengan adil. Atau dengan kadal, ya?',
    rematch: 'Datang lagi, ya, kue lapisku! Eh, kawan manisku. Eh, temanku.',
  },
  mossback: {
    epithet: 'Si tunggul mengantuk',
    personality: 'Tunggul pohon yang sangat tua. Sudah seratus tahun ia mengamati serangga dan burung.',
    weakness: 'Makhluk hidup',
    intro: 'Mmm? Oh. Ada tamu. Aku sedang menumbuhkan lumut. Pelan sekali.',
    attacks: ['Old Mossback menguap. Seekor kumbang kecil berjalan keluar dari mulutnya.', 'Old Mossback menjatuhkan sehelai daun ke kepalamu. Pelan sekali.', 'Old Mossback mendengkur sebentar, lalu bangun.'],
    hits: ['Oh! Akar-akarku jadi terbangun!', 'Hmm! Ada tupai yang jatuh dari badanku!', 'Wah, daun-daunku sampai bergoyang.'],
    defeat: 'Wah, wah. Kamu paham makhluk hidup. Sekarang aku mau tidur sebentar.',
    rematch: 'Santai saja. Aku ini tunggul. Aku tetap di sini.',
  },
  pizzasaur: {
    epithet: 'Si dino pencinta pizza',
    personality: 'Membagi semuanya sama rata, dan sedih sekali kalau ada potongan yang terlalu besar.',
    weakness: 'Pecahan dan bagian',
    intro: 'Roar! Artinya: kamu mau setengah atau dua perempat?',
    attacks: ['Pizzasaur mengaum dengan aroma keju. Harum sekali.', 'Pizzasaur membelah udara menjadi bagian sama besar. Wus, wus.', 'Pizzasaur melempar tomat. Melesetnya jauh sekali.'],
    hits: ['Pinggiran pizzaku! Pinggiranku yang enak!', 'Aduh! Satu potong utuh jatuh!', 'Oh tidak, aku tinggal tiga perempat!'],
    defeat: 'Roar. Artinya: kamu menang. Ambil satu potong, ya.',
    rematch: 'Roar! Artinya: datang lagi kalau kamu masih lapar.',
  },
  flapdoodle: {
    epithet: 'Si kelelawar penjatuh huruf',
    personality: 'Kelelawar yang membawa huruf dalam gelap dan terus menjatuhkannya.',
    weakness: 'Ejaan dan bagian kata',
    intro: 'Ciit! Ada yang melihat huruf N-ku? Tadi jatuh waktu aku menulis "poho".',
    attacks: ['Flapdoodle menjatuhkan huruf B ke lantai. Buk.', 'Flapdoodle bergantung terbalik dan mengeja namamu dari belakang.', 'Flapdoodle terbang melewati telingamu. Ciit, ciit!'],
    hits: ['Ciit! Huruf vokalku hilang!', 'Huruf-hurufku! Berserakan di seluruh gua!', 'Oh! Ejaanmu tepat, dan rasanya sakit!'],
    defeat: 'Ci-ci-ci-ciit. Ejaanmu lebih hebat daripada terbangku. Aku menyerah.',
    rematch: 'Ciit! Aku cari dulu huruf-hurufku. Sampai ketemu kapan saja kamu mau.',
  },
  rainbow: {
    epithet: 'Si pengumpul benda',
    personality: 'Lambat, bangga, dan berkilau. Ia ingin tahu semua benda terbuat dari apa.',
    weakness: 'Bahan dan perubahannya',
    intro: 'Itu kayu? Itu logam? Diam dulu. Aku datang. Pelan-pelan.',
    attacks: ['Rainbow Snail meninggalkan jejak berkilau. Masih lama sampai ke tempatmu.', 'Rainbow Snail masuk ke cangkangnya, lalu keluar lagi. Ciluk ba!', 'Rainbow Snail menjilat sendok, lalu berkata: logam.'],
    hits: ['Aduh! Cangkangku kehilangan satu warna!', 'Aduh! Yang tadi sekeras berlian!', 'Astaga! Aku meleleh sedikit!'],
    defeat: 'Kamu paham benda-benda. Aku mau masuk ke cangkang dulu untuk memikirkannya.',
    rematch: 'Tidak usah buru-buru. Aku bos paling lambat di sini.',
  },
  ticktoad: {
    epithet: 'Si kodok yang selalu terlambat',
    personality: 'Memakai jam di perutnya, tetapi tetap datang terlambat lima menit.',
    weakness: 'Membaca jam',
    intro: 'Kwok! Maaf aku terlambat. Sekarang jam berapa? Jangan lihat perutku.',
    attacks: ['Tick-Tock Toad menyebut jam sambil berkuak. Jamnya keliru.', 'Tick-Tock Toad melompat di tempat, tik, tok, tik, tok.', 'Tick-Tock Toad memutar perutnya, lalu bersendawa.'],
    hits: ['Kwok! Jarum jamku berputar!', 'Uf! Kamu membuatku mundur satu jam!', 'Ting! Yang tadi membunyikan lonceng di perutku.'],
    defeat: 'Waktunya habis, dan aku juga. Hebat. Kwok.',
    rematch: 'Datang saja kapan kamu mau. Aku toh tetap terlambat.',
  },
  inkyblot: {
    epithet: 'Si cumi pelempar koma',
    personality: 'Cumi kecil yang rapi. Ia melempar koma dan titik ke setiap kalimat yang dilihatnya.',
    weakness: 'Tata bahasa dan tanda baca',
    intro: 'Berhenti. Di. Situ. Koma. Aku, punya, terlalu, banyak, koma.',
    attacks: ['Inky Blot melempar koma. Jatuhnya di tempat yang keliru.', 'Inky Blot menyemprotkan titik tepat di. Tengah kalimat.', 'Inky Blot menggoyangkan delapan lengannya dan berteriak: tanda tanya?'],
    hits: ['Splat! Tintaku habis!', 'Oh! Kamu menaruhnya tepat di tempatnya!', 'Blub! Kalimatnya sempurna!'],
    defeat: 'Kamu menang. Titik.',
    rematch: 'Ini belum selesai, koma, hanya jeda sebentar. Sampai nanti!',
  },
  voltafin: {
    epithet: 'Si belut percikan yang lincah',
    personality: 'Tidak bisa diam, dan menyala setiap kali punya ide.',
    weakness: 'Gaya dan listrik',
    intro: 'Zzzip! Dorong aku, tarik aku, colokkan aku. Energiku banyak sekali!',
    attacks: ['Voltafin melesat mengelilingimu. Zzzip!', 'Voltafin menyala seperti lampu kecil, lalu tertawa.', 'Voltafin menempel di magnet dan harus menarik dirinya lepas.'],
    hits: ['Zzzt! Rangkaianku putus!', 'Wah! Aku sampai terdorong jatuh!', 'Percikanku! Padam, fzzz!'],
    defeat: 'Fzzz. Bateraiku habis. Tadi seru sekali!',
    rematch: 'Zzzip! Aku isi daya dulu. Kamu juga. Nanti kita main lagi.',
  },
  hexapuff: {
    epithet: 'Si ikan buntal bersisi enam',
    personality: 'Ikan buntal yang menggembung menjadi segi enam sempurna saat sedang senang.',
    weakness: 'Bangun dan posisi',
    intro: 'Puff! Hitung sisiku. Ayo. Aku tunggu. Puff, puff.',
    attacks: ['Hexapuff menggembung jadi segi enam besar dan menabrakmu pelan.', 'Hexapuff berputar seperempat putaran dan tampak senang sekali.', 'Hexapuff berenang membentuk persegi sempurna.'],
    hits: ['Pfff! Satu sisiku hilang!', 'Oh! Sekarang aku cuma segi lima!', 'Pop! Yang tadi tajam sekali!'],
    defeat: 'Pfffft. Aku bulat lagi. Kamu jago sekali.',
    rematch: 'Puff! Aku mau berlatih membuat sudut dulu. Datang lagi kapan saja.',
  },
  bookworm: {
    epithet: 'Si pembaca agung',
    personality: 'Sudah memakan habis seluruh perpustakaan dan ingat setiap katanya.',
    weakness: 'Membaca dan memahami',
    intro: 'Ah. Seorang pembaca. Aku sudah membaca semuanya. Sebagian besar juga sudah kumakan.',
    attacks: ['Baron Bookworm membetulkan topinya dan membacakan satu kata yang sangat panjang.', 'Baron Bookworm berkata: hmm, bagaimana kalau kita baca sekali lagi?', 'Baron Bookworm menggigit sudut halaman.'],
    hits: ['Astaga! Kamu paham!', 'Topiku! Sampai terlepas!', 'Oh! Aku tidak menyangka akhirnya begitu.'],
    defeat: 'Luar biasa. Pembaca sejati. Aku angkat topi, lalu kumakan topinya.',
    rematch: 'Pembaca yang baik selalu kembali. Akan kusimpan satu halaman untukmu.',
  },
  comet: {
    epithet: 'Si bajak langit yang dingin',
    personality: 'Berlayar mengelilingi Matahari dengan ekor debu dan topi yang sangat besar.',
    weakness: 'Bumi dan antariksa',
    intro: 'Ahoi! Aku sudah melewati semua planet, dan aku baru meleleh sedikit.',
    attacks: ['Captain Comet melesat lewat dan mengibaskan debu ke arahmu.', 'Captain Comet berteriak: ahoi, bulanmu ada berapa?', 'Captain Comet pergi jauh mengelilingi Matahari, lalu kembali lagi.'],
    hits: ['Arrr! Ekorku jadi pendek!', 'Waduh! Tepat kena sasaran!', 'Oh tidak, aku mulai meleleh!'],
    defeat: 'Arrr. Kamu bintang di antara bintang. Sampai jumpa sekitar tujuh puluh tahun lagi.',
    rematch: 'Ahoi! Komet selalu kembali. Kamu juga bisa.',
  },
  aurora: {
    epithet: 'Si penari di langit',
    personality: 'Pita cahaya warna-warni yang bernyanyi sangat pelan di atas salju.',
    weakness: 'Cahaya dan bunyi',
    intro: 'Sst. Lihat ke atas. Dengarkan. Bisakah kamu membedakan mana cahaya dan mana lagunya?',
    attacks: ['Aurora Sprite berputar hijau dan ungu di sekelilingmu. Cantik sekali!', 'Aurora Sprite menyanyikan satu nada yang sangat tinggi. Ting!', 'Aurora Sprite membuat bayangan panjang yang bergoyang.'],
    hits: ['Oh! Warnaku jadi redup!', 'Bunyinya terasa sampai ke dalam!', 'Ah! Kamu memantulkannya langsung ke aku!'],
    defeat: 'Penglihatanmu jernih, pendengaranmu juga. Selamat malam, anak yang cemerlang.',
    rematch: 'Langit selalu ada di sini. Datanglah dan menari lagi.',
  },
}

export const bosses = { en, id }

/** Teks bos dalam bahasa tampilan, dengan teks sumber dari @kira/core bila kuncinya belum ada. */
export function bossText<T extends Partial<BossText>>(map: Record<string, BossText | undefined>, bossId: string, source: T): T & Partial<BossText> {
  return { ...source, ...map[bossId] }
}
