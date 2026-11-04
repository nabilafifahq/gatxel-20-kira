import { vi } from 'vitest'

/** KIRA_TEST_NOW=2026-11-01T05:00:00Z menjalankan tes DB seolah hari itu, supaya tes tidak bergantung pada hari pelaksanaan. */
if (process.env.KIRA_TEST_NOW) vi.useFakeTimers({ toFake: ['Date'], now: new Date(process.env.KIRA_TEST_NOW) })
