// __GTX_SEED__
import type { ClaudeConnectionDTO } from '@/lib/dto'
import { shell, wib } from './console-shared'

export const claudeConnected: ClaudeConnectionDTO = {
  shell,
  provider: 'claude-code',
  status: 'connected',
  detail: 'Claude Code 2.4 di worker, masuk dengan token langganan. Tes terakhir menjawab dalam 3,2 detik.',
  lastCheckAt: wib('2026-10-16', '07:30'),
  mcp: {
    enabled: true,
    url: 'https://kira-rumah.tail4f2c1.ts.net/mcp',
    tokens: [
      { id: 'mcp-1', name: 'Laptop Dina', createdAt: wib('2026-10-14', '20:15'), lastUsedAt: wib('2026-10-16', '07:42') },
      { id: 'mcp-2', name: 'HP Dina', createdAt: wib('2026-10-15', '21:00'), lastUsedAt: null },
    ],
  },
}

export const claudeNotConfigured: ClaudeConnectionDTO = {
  ...claudeConnected,
  provider: 'none',
  status: 'not-configured',
  detail: 'Worker belum punya token AI. Studio AI dan saran nilai tetap mati sampai token diisi.',
  lastCheckAt: null,
  mcp: { ...claudeConnected.mcp, tokens: [] },
}

export const claudeError: ClaudeConnectionDTO = {
  ...claudeConnected,
  status: 'error',
  detail: 'Claude Code menolak token (401). Token mungkin sudah dicabut atau kedaluwarsa.',
  lastCheckAt: wib('2026-10-16', '06:00'),
}
