import { z } from 'zod'

export const worksheetSchema = z
  .object({
    learnerId: z.string().uuid(),
    skillId: z.string().regex(/^[mes][1-6]\.[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    length: z.enum(['short', 'medium', 'long']),
  })
  .strict()
