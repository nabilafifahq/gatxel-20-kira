/**
 * Teks walkthrough pertama anak (en-GB). Satu tempat supaya mudah dipindah ke kamus bahasa anak (pilot/bahasa).
 * Paling banyak tiga tip, kalimat pendek, dan tidak ada yang menahan anak dari mulai belajar.
 */
export const FIRST_RUN_COPY = {
  region: 'Quick tips',
  tips: [
    { icon: 'play', title: 'Start with the big stop', body: "The biggest stop on your path is today's first session. Tap it to begin." },
    { icon: 'star', title: 'Earn stars as you go', body: 'Finish a session to earn stars and XP. A wrong answer is fine. Have another go.' },
    { icon: 'speaker', title: 'Listen and look around', body: 'Tap the speaker to hear a question. Map, Review, and Me are in the menu.' },
  ],
  next: 'Next',
  done: "Let's start",
  skip: 'Skip tips',
  stepOf: (n: number, total: number) => `Tip ${n} of ${total}`,
} as const
