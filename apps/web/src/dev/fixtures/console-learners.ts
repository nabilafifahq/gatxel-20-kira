// __GTX_SEED__
import type { LearnersDTO } from '@/lib/dto'
import { LEARNER_A, LEARNER_B, shell } from './console-shared'

export const learners: LearnersDTO = {
  shell,
  maxLearners: 4,
  learners: [
    {
      id: LEARNER_A.id,
      name: 'Alya',
      grade: 2,
      avatar: 'fox',
      active: true,
      consent: 'granted',
      guardians: ['Ratna Wiratama'],
      devices: 1,
      since: '2026-09-21',
    },
    {
      id: LEARNER_B.id,
      name: 'Bima',
      grade: 4,
      avatar: 'owl',
      active: true,
      consent: 'granted',
      guardians: ['Ratna Wiratama', 'Budi Wiratama'],
      devices: 2,
      since: '2026-07-24',
    },
    {
      id: 'lrn_seed_nadia',
      name: 'Nadia',
      grade: 1,
      avatar: 'rabbit',
      active: false,
      consent: 'pending',
      guardians: [],
      devices: 0,
      since: '2026-10-15',
    },
  ],
}

export const learnersFull: LearnersDTO = { ...learners, maxLearners: 3 }

export const learnersEmpty: LearnersDTO = { ...learners, learners: [], shell: { ...shell, learners: [], currentLearnerId: null } }
