/**
 * The public-source router: each lane has its own provider, timeout and
 * failure state. A slow or blocked provider cannot turn the others into a
 * failed report.
 */

import type { FetchLike } from './archive.js'
import { normaliseTarget } from './core.js'
import { buildMentions, type MentionOptions } from './mentions.js'
import { buildArquivoInfo, type ArquivoOptions } from './arquivo.js'
import type { SourcesReport } from '../shared/sources.js'

export type SourceOptions = MentionOptions & ArquivoOptions & { fetchImpl?: FetchLike }

export async function buildSources(raw: string, options: SourceOptions = {}): Promise<SourcesReport> {
  const target = normaliseTarget(raw)
  const [mentions, archives] = await Promise.all([
    buildMentions(target.href, options),
    buildArquivoInfo(target.href, options),
  ])
  return {
    domain: target.hostname,
    checkedAt: new Date().toISOString(),
    mentions,
    archives,
  }
}
