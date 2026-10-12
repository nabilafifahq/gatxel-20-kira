import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { tables } from '@kira/db'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { systemCtx } from '@/server/audit'
import { newReference } from '@/server/errors'
import { log } from '@/server/log'
import { allowedFor, limitFor, sniff, storeFile, type MediaKind } from '@/server/media'

export const dynamic = 'force-dynamic'

const fields = z.object({
  kind: z.enum(['audio', 'drawing', 'image', 'pdf', 'page']),
  attemptId: z.string().uuid().optional(),
  position: z.coerce.number().int().min(1).max(200).optional(),
})

async function consentGranted(orgId: string, learnerId: string, purpose: 'audio' | 'photo'): Promise<boolean> {
  const rows = await inOrg(systemCtx(orgId), (tx) =>
    tx
      .select({ granted: tables.consentEvent.granted })
      .from(tables.consentEvent)
      .where(and(eq(tables.consentEvent.learnerId, learnerId), eq(tables.consentEvent.purpose, purpose)))
      .orderBy(desc(tables.consentEvent.createdAt))
      .limit(1),
  )
  return rows[0]?.granted === true
}

/** Unggah rekaman, gambar, atau PDF. Learner hanya untuk attempt miliknya; PDF hanya tutor. */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'origin' }, { status: 403 })
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > 62 * 1024 * 1024) return NextResponse.json({ error: 'too-large' }, { status: 413 })
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const f = fields.safeParse({ kind: form.get('kind'), attemptId: form.get('attemptId') ?? undefined, position: form.get('position') ?? undefined })
  const file = form.get('file')
  if (!f.success || !(file instanceof Blob)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const kind = f.data.kind as MediaKind
  if (actor.role === 'learner' && !['audio', 'drawing', 'image'].includes(kind)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (actor.role === 'guardian') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (file.size > limitFor(kind)) return NextResponse.json({ error: 'too-large', message: 'Berkas terlalu besar.' }, { status: 413 })
  const buf = Buffer.from(await file.arrayBuffer())
  const type = sniff(buf)
  if (!type || !allowedFor(kind, type.mime)) return NextResponse.json({ error: 'type', message: 'Jenis berkas tidak didukung.' }, { status: 415 })
  if (actor.role === 'learner') {
    if (!f.data.attemptId) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    const own = await inOrg(orgCtx(actor), (tx) =>
      tx.select({ id: tables.attempt.id }).from(tables.attempt).where(and(eq(tables.attempt.id, f.data.attemptId!), eq(tables.attempt.learnerId, actor.userId), eq(tables.attempt.status, 'in_progress'))).limit(1),
    )
    if (!own[0]) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (kind === 'audio' && !(await consentGranted(actor.orgId, actor.userId, 'audio')))
      return NextResponse.json({ error: 'consent', message: 'Recording is turned off for your account. Ask a grown-up.' }, { status: 403 })
    if (kind === 'image' && !(await consentGranted(actor.orgId, actor.userId, 'photo')))
      return NextResponse.json({ error: 'consent', message: 'Photos are turned off for your account. Ask a grown-up.' }, { status: 403 })
  }
  try {
    const stored = await storeFile(actor.orgId, buf, type.ext)
    const expires = kind === 'audio' || kind === 'image' || kind === 'drawing' ? new Date(Date.now() + 90 * 86400000) : null
    const [row] = await inOrg(orgCtx(actor), (tx) =>
      tx
        .insert(tables.media)
        .values({
          orgId: actor.orgId,
          learnerId: actor.role === 'learner' ? actor.userId : null,
          kind: kind === 'drawing' ? 'drawing' : kind,
          path: stored.path,
          mime: type.mime,
          size: buf.length,
          sha256: stored.sha256,
          createdBy: actor.userId,
          expiresAt: expires,
        })
        .returning({ id: tables.media.id }),
    )
    return NextResponse.json({ mediaId: row!.id }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const reference = newReference()
    log.error('unggah media gagal', { reference, error: e })
    return NextResponse.json({ error: 'server', reference }, { status: 500 })
  }
}
