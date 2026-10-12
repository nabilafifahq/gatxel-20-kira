// __GTX_SEED__
import type { SettingsDTO } from '@/lib/dto'
import { LEARNER_A, LEARNER_B, shell, wib } from './console-shared'

export const settings: SettingsDTO = {
  shell,
  account: {
    name: 'Dina Pratiwi',
    email: 'dina@keluarga-wiratama.test',
    passkeys: [{ id: 'pk-1', name: 'Laptop rumah', createdAt: wib('2026-09-20', '20:14'), lastUsedAt: wib('2026-10-16', '15:30') }],
  },
  devices: [
    { id: 'dev-tab-a', name: 'Tablet Alya', learners: ['Alya'], createdAt: wib('2026-09-21', '18:00'), lastSeenAt: wib('2026-10-16', '15:42'), expiresAt: '2026-12-20' },
    { id: 'dev-tab-b', name: 'Tablet Bima', learners: ['Bima'], createdAt: wib('2026-07-24', '10:00'), lastSeenAt: wib('2026-10-14', '17:05'), expiresAt: '2026-10-22' },
  ],
  learners: [
    { id: LEARNER_A.id, name: 'Alya', screenLimitMin: 60, restWeekdays: [0], reviewEnabled: true },
    { id: LEARNER_B.id, name: 'Bima', screenLimitMin: 75, restWeekdays: [0, 6], reviewEnabled: false },
  ],
  members: [
    { id: 'm-1', name: 'Dina Pratiwi', email: 'dina@keluarga-wiratama.test', role: 'tutor', learners: ['Alya', 'Bima'] },
    { id: 'm-2', name: 'Ratna Wiratama', email: 'ratna@keluarga-wiratama.test', role: 'guardian', learners: ['Alya'] },
  ],
  invites: [{ id: 'inv-1', email: 'budi@keluarga-wiratama.test', role: 'guardian', expiresAt: wib('2026-10-20', '09:00') }],
  email: { configured: true, from: 'Kira <laporan@keluarga-wiratama.test>' },
  backups: { lastAt: wib('2026-10-16', '02:00'), lastSize: '48 MB', folder: 'D:\\Kira\\cadangan' },
}

export const settingsNoEmail: SettingsDTO = { ...settings, email: { configured: false, from: null }, backups: { ...settings.backups, lastAt: null, lastSize: null } }
