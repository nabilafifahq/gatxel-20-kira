import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { appDb } from '@/server/db'

export const dynamic = 'force-dynamic'

/** Dipakai healthcheck Docker. Tidak membuka data apa pun. */
export async function GET() {
  try {
    await appDb().execute(sql`select 1`)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
