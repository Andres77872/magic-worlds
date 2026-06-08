import type { ChatImageAsset, ChatImageError, ChatSocketServerMessage, ImageLifecycleStatus, TurnEntry } from '../../../shared'

export type ChatImageFrame = Extract<ChatSocketServerMessage, { type: 'image_job' | 'image_complete' | 'image_failed' }>

export interface ImageJobHydration {
  job_id: string
  status: ImageLifecycleStatus
  status_url?: string | null
  result_url?: string | null
  assets?: ChatImageAsset[]
  error?: ChatImageError | null
}

const TERMINAL_STATUSES = new Set<ImageLifecycleStatus>([
  'completed',
  'failed',
  'canceled',
  'unavailable',
  'invalid',
  'quota_exceeded',
])

const NON_TERMINAL_STATUSES = new Set<ImageLifecycleStatus>(['pending', 'in_progress', 'mirroring'])

export function hasNonTerminalImageJob(turn: TurnEntry): boolean {
  return Boolean(turn.imageJobId && turn.imageStatus && NON_TERMINAL_STATUSES.has(turn.imageStatus))
}

export function upsertChatImageFrame(turns: TurnEntry[], frame: ChatImageFrame): TurnEntry[] {
  const index = findTurnIndex(turns, {
    jobId: frame.job_id ?? undefined,
    assistantMessageId: frame.assistant_message_id,
    turnId: frame.turn_id,
  })
  if (index < 0) return turns
  return turns.map((turn, idx) => (idx === index ? mergeImageState(turn, stateFromFrame(frame)) : turn))
}

export function upsertImageJobResult(turns: TurnEntry[], result: ImageJobHydration): TurnEntry[] {
  const index = findTurnIndex(turns, { jobId: result.job_id })
  if (index < 0) return turns
  return turns.map((turn, idx) => (idx === index ? mergeImageState(turn, stateFromJobResult(result)) : turn))
}

export function mergeHydratedImageTurns(current: TurnEntry[], hydrated: TurnEntry[]): TurnEntry[] {
  if (hydrated.length === 0) return current
  return hydrated.map((turn) => {
    const existingIndex = findTurnIndex(current, {
      jobId: turn.imageJobId,
      assistantMessageId: turn.assistantMessageId,
      turnId: turn.turnId,
    })
    if (existingIndex < 0) return sanitizeTurnImageState(turn)
    return mergeImageState(sanitizeTurnImageState(turn), current[existingIndex])
  })
}

function stateFromFrame(frame: ChatImageFrame): Partial<TurnEntry> {
  const common = {
    assistantMessageId: frame.assistant_message_id,
    turnId: frame.turn_id,
    imageJobId: frame.job_id ?? undefined,
    imageStatus: frame.status,
    imageStatusUrl: frame.status_url ?? undefined,
    imageResultUrl: frame.result_url ?? undefined,
  }
  if (frame.type === 'image_complete') {
    const assets = safeAssets(frame.assets)
    return { ...common, imageStatus: 'completed', imageAssets: assets, imageUrl: assets[0]?.url, imageError: undefined }
  }
  if (frame.type === 'image_failed') {
    return { ...common, imageError: safeError(frame.error) }
  }
  return common
}

function stateFromJobResult(result: ImageJobHydration): Partial<TurnEntry> {
  const assets = safeAssets(result.assets ?? [])
  return {
    imageJobId: result.job_id,
    imageStatus: result.status,
    imageStatusUrl: result.status_url ?? undefined,
    imageResultUrl: result.result_url ?? undefined,
    imageAssets: assets.length > 0 ? assets : undefined,
    imageUrl: assets[0]?.url,
    imageError: result.error ? safeError(result.error) : undefined,
  }
}

function mergeImageState(turn: TurnEntry, incoming: Partial<TurnEntry>): TurnEntry {
  const existingTerminal = turn.imageStatus ? TERMINAL_STATUSES.has(turn.imageStatus) : false
  const incomingTerminal = incoming.imageStatus ? TERMINAL_STATUSES.has(incoming.imageStatus) : false
  const shouldKeepTerminal = existingTerminal && !incomingTerminal
  const next: TurnEntry = {
    ...turn,
    assistantMessageId: incoming.assistantMessageId ?? turn.assistantMessageId,
    turnId: incoming.turnId ?? turn.turnId,
    imageJobId: incoming.imageJobId ?? turn.imageJobId,
    imageStatusUrl: incoming.imageStatusUrl ?? turn.imageStatusUrl,
    imageResultUrl: incoming.imageResultUrl ?? turn.imageResultUrl,
  }
  if (!shouldKeepTerminal && incoming.imageStatus) {
    next.imageStatus = incoming.imageStatus
  }
  const mergedAssets = dedupeAssets([...(turn.imageAssets ?? []), ...(incoming.imageAssets ?? [])])
  if (mergedAssets.length > 0) {
    next.imageAssets = mergedAssets
    next.imageUrl = mergedAssets[0].url
  } else if (incoming.imageUrl && isSafeAssetUrl(incoming.imageUrl)) {
    next.imageUrl = incoming.imageUrl
  }
  if (!shouldKeepTerminal && incoming.imageError) {
    next.imageError = incoming.imageError
  }
  if (incoming.imageStatus === 'completed') {
    next.imageError = undefined
  }
  return next
}

function findTurnIndex(turns: TurnEntry[], keys: { jobId?: string | null; assistantMessageId?: number; turnId?: string }): number {
  if (keys.jobId) {
    const byJob = turns.findIndex((turn) => turn.imageJobId === keys.jobId)
    if (byJob >= 0) return byJob
  }
  if (keys.assistantMessageId) {
    const byMessage = turns.findIndex((turn) => turn.assistantMessageId === keys.assistantMessageId || turn.id === String(keys.assistantMessageId))
    if (byMessage >= 0) return byMessage
  }
  if (keys.turnId) {
    const byTurn = turns.findIndex((turn) => turn.turnId === keys.turnId)
    if (byTurn >= 0) return byTurn
  }
  for (let idx = turns.length - 1; idx >= 0; idx -= 1) {
    if (turns[idx].type === 'ai') return idx
  }
  return -1
}

function sanitizeTurnImageState(turn: TurnEntry): TurnEntry {
  const assets = safeAssets(turn.imageAssets ?? [])
  return {
    ...turn,
    imageAssets: assets.length > 0 ? assets : undefined,
    imageUrl: assets[0]?.url ?? (turn.imageUrl && isSafeAssetUrl(turn.imageUrl) ? turn.imageUrl : undefined),
    imageError: turn.imageError ? safeError(turn.imageError) : undefined,
  }
}

function safeAssets(assets: ChatImageAsset[]): ChatImageAsset[] {
  return dedupeAssets(assets.filter((asset) => isSafeAssetUrl(asset.url)))
}

function dedupeAssets(assets: ChatImageAsset[]): ChatImageAsset[] {
  const seen = new Set<string>()
  const result: ChatImageAsset[] = []
  for (const asset of assets) {
    const key = asset.asset_id || asset.url
    if (!key || seen.has(key) || !isSafeAssetUrl(asset.url)) continue
    seen.add(key)
    result.push(asset)
  }
  return result
}

function safeError(error: ChatImageError): ChatImageError {
  return {
    category: safeText(error.category, 'failed'),
    detail: safeText(error.detail, 'Image generation failed.'),
    code: error.code ? safeText(error.code, '') || undefined : undefined,
  }
}

function safeText(value: string, fallback: string): string {
  const text = String(value || '').trim()
  const lowered = text.toLowerCase()
  if (!text || lowered.includes('http://') || lowered.includes('https://') || lowered.includes('/var/') || lowered.includes('/tmp/') || lowered.includes('secret') || lowered.includes('bearer ') || lowered.includes('authorization')) {
    return fallback
  }
  return text
}

export function isSafeAssetUrl(value: string): boolean {
  const text = String(value || '').trim()
  const lowered = text.toLowerCase()
  if (!text || lowered.startsWith('data:') || lowered.includes('fal.media') || lowered.includes('signature=') || lowered.includes('x-amz-signature') || lowered.includes('/var/') || lowered.includes('/tmp/')) {
    return false
  }
  if (text.startsWith('/')) return !text.startsWith('//')
  return lowered.startsWith('http://') || lowered.startsWith('https://')
}
