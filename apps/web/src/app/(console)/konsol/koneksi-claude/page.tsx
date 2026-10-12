import type { Metadata } from 'next'
import { ClaudeConnectionScreen } from '@/screens/console/ClaudeConnectionScreen'
import { pageActor } from '@/server/auth/actor'
import { createMcpTokenAction, revokeMcpTokenAction, testConnectionAction } from '@/server/actions/console-claude'
import { claudeConnectionDTO } from '@/server/dal/console-claude'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Koneksi Claude' }

/** T14 Koneksi Claude: status AI di worker, tes koneksi, server MCP, dan token akses. */
export default async function ClaudeConnectionPage() {
  const actor = await pageActor(['tutor'], '/konsol/koneksi-claude')
  const data = await load(() => claudeConnectionDTO(actor))
  return <ClaudeConnectionScreen data={data} actions={{ testConnection: testConnectionAction, createMcpToken: createMcpTokenAction, revokeMcpToken: revokeMcpTokenAction }} />
}
