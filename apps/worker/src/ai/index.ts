import type { Env } from '../env'
import { JobError } from '../errors'
import { ClaudeCodeProvider } from './claude-code'
import { OpenAiCompatibleProvider } from './openai'
import type { AiProvider, AiRunOutput, AiTier } from './types'

export * from './types'

export const AI_NOT_CONFIGURED = 'AI belum diatur. Pilih provider di file .env lalu mulai ulang worker.'

/** Provider `none`: setiap job AI gagal cepat dengan pesan yang sama. */
export class NoneProvider implements AiProvider {
  readonly name = 'none' as const
  readonly label = 'AI'
  readonly model = null
  readonly ready = false
  readonly notReadyReason = AI_NOT_CONFIGURED
  modelFor(_tier: AiTier): null {
    return null
  }
  async describe(): Promise<null> {
    return null
  }
  async run(): Promise<AiRunOutput> {
    throw new JobError(AI_NOT_CONFIGURED, { retryable: false })
  }
}

export function createProvider(env: Env): AiProvider {
  switch (env.AI_PROVIDER) {
    case 'claude-code':
      return new ClaudeCodeProvider({
        bin: env.CLAUDE_BIN,
        token: env.CLAUDE_CODE_OAUTH_TOKEN,
        modelAuthor: env.CLAUDE_MODEL_AUTHOR ?? '',
        modelFast: env.CLAUDE_MODEL_FAST ?? '',
      })
    case 'openai-compatible':
      return new OpenAiCompatibleProvider({ baseUrl: env.AI_BASE_URL ?? '', apiKey: env.AI_API_KEY, model: env.AI_MODEL ?? '' })
    default:
      return new NoneProvider()
  }
}
