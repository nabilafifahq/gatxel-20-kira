import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/server/auth/actor'
import { insertMedia, learnerConsent, openAttemptOfLearner } from '@/server/dal/media-rows'
import { newReference } from '@/server/errors'
import { log } from '@/server/log'
import { allowedFor, limitFor, sniff, storeFile, type MediaKind } from '@/server/media'

export const dynamic = 'force-dynamic'

const fields = z.object({
  kind: z.enum(['audio', 'drawing', 'image', 'pdf', 'page']),
  attemptId: z.string().uuid().optional(),
  position: z.coerce.number().int().min(1).max(200).optional(),
})

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
    if (!(await openAttemptOfLearner(actor, f.data.attemptId))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (kind === 'audio' && !(await learnerConsent(actor.orgId, actor.userId, 'audio')))
      return NextResponse.json({ error: 'consent', message: 'Recording is turned off for your account. Ask a grown-up.' }, { status: 403 })
    if (kind === 'image' && !(await learnerConsent(actor.orgId, actor.userId, 'photo')))
      return NextResponse.json({ error: 'consent', message: 'Photos are turned off for your account. Ask a grown-up.' }, { status: 403 })
  }
  try {
    const stored = await storeFile(actor.orgId, buf, type.ext)
    const expires = kind === 'audio' || kind === 'image' || kind === 'drawing' ? new Date(Date.now() + 90 * 86400000) : null
    const mediaId = await insertMedia(actor, { kind, path: stored.path, mime: type.mime, size: buf.length, sha256: stored.sha256, expiresAt: expires })
    return NextResponse.json({ mediaId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const reference = newReference()
    log.error('unggah media gagal', { reference, error: e })
    return NextResponse.json({ error: 'server', reference }, { status: 500 })
  }
}
