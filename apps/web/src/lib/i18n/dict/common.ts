/** Kata umum yang dipakai banyak layar. Cara menambah teks ada di dict/index.ts. */
const en = {
  back: 'Back',
  next: 'Next',
  continue: 'Continue',
  done: 'Done',
  start: 'Start',
  close: 'Close',
  cancel: 'Cancel',
  save: 'Save',
  skip: 'Skip',
  check: 'Check',
  tryAgain: 'Try again',
  grade: (n: number) => `Grade ${n}`,
  subject: { math: 'Math', english: 'English', science: 'Science' },
}

const id: typeof en = {
  back: 'Kembali',
  next: 'Lanjut',
  continue: 'Lanjut',
  done: 'Selesai',
  start: 'Mulai',
  close: 'Tutup',
  cancel: 'Batal',
  save: 'Simpan',
  skip: 'Lewati',
  check: 'Periksa',
  tryAgain: 'Coba lagi',
  grade: (n) => `Kelas ${n}`,
  subject: { math: 'Matematika', english: 'Bahasa Inggris', science: 'Sains' },
}

export const common = { en, id }
