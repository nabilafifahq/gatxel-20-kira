import 'server-only'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { QM_OPS, factLabelId, jakartaDate, summariseQm, trackLevels, type QmOp } from '@kira/core'
import { TOPICS, topicProgress } from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { ArenaTutorDTO } from '@/lib/dto-arena'
import type { Tx } from '../db'
import { loadQmState, loadQuizState, trackTotals } from './arena-state'
import { qmStatRows } from './arena-hitung'

const { arenaSession } = tables

const OP_ID: Record<QmOp, string> = { add: 'Tambah', sub: 'Kurang', mul: 'Kali', div: 'Bagi' }

const HARI_ID: Record<string, string> = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' }

const TOPIK_ID: Record<string, string> = {
  flags: 'Bendera dunia',
  capitals: 'Ibu kota negara',
  provinces: 'Provinsi Indonesia',
  continents: 'Benua dan samudra',
  animals: 'Hewan',
  body: 'Tubuh manusia',
  space: 'Tata surya',
  inventors: 'Penemu dan tokoh sains',
  landmarks: 'Bangunan terkenal dunia',
  instruments: 'Alat musik',
  dinosaurs: 'Dinosaurus',
  words: 'Kata bahasa Inggris sehari-hari',
}

/** Ringkasan arena untuk tutor (Indonesia): jalur XP, statistik Quick Maths, dan kemajuan Quiz Arena. */
export async function arenaTutorDTO(tx: Tx, learnerId: string, grade: number): Promise<ArenaTutorDTO> {
  const today = jakartaDate()
  const totals = await trackTotals(tx, learnerId)
  const levels = trackLevels(totals)
  const qmState = await loadQmState(tx, learnerId, grade)
  const quizState = await loadQuizState(tx, learnerId)
  const stats = summariseQm(await qmStatRows(tx, learnerId), today)
  const quizRounds = (
    await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(arenaSession)
      .where(and(eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, 'pengetahuan'), isNotNull(arenaSession.finishedAt), sql`${arenaSession.mode} in ('quiz', 'speed')`))
  )[0]?.n
  return {
    tracks: [
      { track: 'belajar', nama: 'Belajar', xp: totals.belajar, level: levels.belajar },
      { track: 'hitung', nama: 'Quick Maths', xp: totals.hitung, level: levels.hitung },
      { track: 'pengetahuan', nama: 'Quiz Arena', xp: totals.pengetahuan, level: levels.pengetahuan },
    ],
    hitung: {
      ronde: stats.rounds,
      akurasi: stats.accuracy,
      soalPerMenit: stats.ppm,
      rekorSprint: stats.bestSprintPpm,
      rekorTarget: stats.bestTargetSec,
      minggu: stats.week.map((d) => ({ tanggal: d.date, label: HARI_ID[d.label] ?? d.label, ronde: d.rounds, benar: d.correct, soalPerMenit: d.ppm })),
      palingLambat: stats.slowest.map((f) => ({ jenis: factLabelId(f.fact), rataDetik: Math.round(f.avgMs / 100) / 10, akurasi: f.accuracy, jumlah: f.n })),
      level: QM_OPS.map((op) => ({ operasi: OP_ID[op], level: qmState.levels[op] })),
      flashLevel: qmState.flashLevel,
      strategi: qmState.strategies.length,
      misiHari: qmState.missionDates.length,
    },
    pengetahuan: {
      ronde: quizRounds ?? 0,
      topik: TOPICS.map((t) => {
        const p = topicProgress(t.id, quizState.know)
        return { judul: TOPIK_ID[t.id] ?? t.title, dikenal: p.known, total: p.total }
      }),
      rekorSpeed: quizState.speedBest,
    },
  }
}
