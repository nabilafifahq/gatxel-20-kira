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
  langSwitch: { label: 'Language', id: 'Bahasa Indonesia', en: 'English', notAllowed: 'Ask a grown-up to change the language.' },
  errors: { generic: 'Something went wrong. Try again in a moment.', invalid: 'Something in the answer is not right. Please try again.' },
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
  langSwitch: { label: 'Bahasa', id: 'Bahasa Indonesia', en: 'English', notAllowed: 'Minta tolong orang dewasa untuk mengganti bahasa, ya.' },
  errors: { generic: 'Ada yang tidak beres. Coba lagi sebentar lagi, ya.', invalid: 'Ada isian yang belum pas. Coba lagi, ya.' },
}

export const common = { en, id }
