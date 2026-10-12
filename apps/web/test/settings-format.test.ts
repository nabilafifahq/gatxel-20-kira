import { describe, expect, it } from 'vitest'
import { apkPath, backupFolderLabel, formatBytes, parseBackupStatus } from '@/server/dal/console-settings'

describe('formatBytes', () => {
  it('KB, MB, dan GB dengan koma desimal', () => {
    expect(formatBytes(870_400)).toBe('850 KB')
    expect(formatBytes(1536 * 1024)).toBe('1,5 MB')
    expect(formatBytes(48 * 1024 * 1024)).toBe('48 MB')
    expect(formatBytes(12.4 * 1024 * 1024)).toBe('12 MB')
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB')
    expect(formatBytes(-1)).toBe('0 KB')
  })
})

describe('parseBackupStatus', () => {
  it('membaca lastAt dan lastSize (byte atau teks)', () => {
    expect(parseBackupStatus({ lastAt: '2026-10-12T19:00:00Z', lastSize: 50_331_648 })).toEqual({ lastAt: '2026-10-12T19:00:00.000Z', lastSize: '48 MB' })
    expect(parseBackupStatus({ lastAt: '2026-10-12T19:00:00+07:00', lastSize: '48 MB' })).toEqual({ lastAt: '2026-10-12T12:00:00.000Z', lastSize: '48 MB' })
  })
  it('isi rusak dianggap belum ada cadangan', () => {
    expect(parseBackupStatus(null)).toEqual({ lastAt: null, lastSize: null })
    expect(parseBackupStatus({ lastAt: 'kemarin', lastSize: 10 })).toEqual({ lastAt: null, lastSize: null })
    expect(parseBackupStatus({ lastAt: '2026-10-12T19:00:00Z', lastSize: 'x'.repeat(80) })).toEqual({ lastAt: '2026-10-12T19:00:00.000Z', lastSize: null })
  })
})

describe('backupFolderLabel dan apkPath', () => {
  it('label dari KIRA_BACKUP_LABEL, lalu KIRA_BACKUP_DIR, lalu teks belum diatur', () => {
    expect(backupFolderLabel({ KIRA_BACKUP_LABEL: 'D:\\Kira\\cadangan', KIRA_BACKUP_DIR: '/backups' })).toBe('D:\\Kira\\cadangan')
    expect(backupFolderLabel({ KIRA_BACKUP_DIR: '/backups' })).toBe('/backups')
    expect(backupFolderLabel({})).toMatch(/belum diatur/)
  })
  it('APK ada di <data>/apk/kira.apk', () => {
    expect(apkPath('/data')).toBe('/data/apk/kira.apk')
  })
})
