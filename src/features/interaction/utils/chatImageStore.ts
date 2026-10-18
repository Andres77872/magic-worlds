import type {
  ChatImageAsset,
  ChatImageCredentialMode,
  ChatImageError,
  ChatImageGeneration,
  ChatImageGenerationSummary,
  ChatImageTrigger,
  ChatSocketServerMessage,
  ImageLifecycleStatus,
  ImageProvider,
  TurnEntry,
} from '../../../shared'

/**
 * Chat scene images, keyed by assistant message id and then by job id.
 *
 * Pure and immutable: every function returns the same map when nothing
 * changed, and an unchanged message keeps its entry object, so memoized turns
 * only re-render when their own images move. A frame or job result is matched
 * by its ids alone; one for a message the transcript does not show yet waits
 * here until that message appears.
 */
export type ChatImageFrame = Extract<ChatSocketServerMessage, { type: 'image_job' | 'image_complete' | 'image_failed' }>

/** A failure with no job behind it: the image never started (quota, missing key, a refused regenerate). */
export interface ChatImageStartFailure {
  status: ImageLifecycleStatus
  error: ChatImageError
  /** The profile the refused request named, so "Add key & generate" can retry it. */
  image_profile_id?: string | null
  provider?: ImageProvider | null
}

export interface ChatMessageImages {
  /** Ordered oldest first; the newest job is the last one. */
  generations: readonly ChatImageGeneration[]
  /** `done.image_scheduled`: an image is on its way and no job has been seen yet. */
  scheduled?: boolean
  scheduledAt?: number
  startFailure?: ChatImageStartFailure
}

export type ChatImageMap = ReadonlyMap<number, ChatMessageImages>

/** A job read from `GET /images/jobs/{id}`. */
export interface ImageJobHydration {
  job_id: string
  status: ImageLifecycleStatus
  status_url?: string | null
  result_url?: string | null
  assets?: ChatImageAsset[]
  error?: ChatImageError | null
}

export const EMPTY_CHAT_IMAGES: ChatImageMap = new Map()

const TERMINAL_STATUSES = new Set<ImageLifecycleStatus>([
  'completed',
  'failed',
  'canceled',
  'unavailable',
  'invalid',
  'quota_exceeded',
])

const KNOWN_STATUSES = new Set<ImageLifecycleStatus>([...TERMINAL_STATUSES, 'pending', 'in_progress', 'mirroring'])
const TRIGGERS = new Set<ChatImageTrigger>(['auto', 'regenerate'])
const PROVIDERS = new Set<ImageProvider>(['fal', 'openrouter'])
const CREDENTIAL_MODES = new Set<ChatImageCredentialMode>(['platform', 'user_byok'])

export function isTerminalImageStatus(status: ImageLifecycleStatus | undefined | null): boolean {
  return Boolean(status && TERMINAL_STATUSES.has(status))
}

// --- transitions ------------------------------------------------------------

export function applyFrame(map: ChatImageMap, frame: ChatImageFrame): ChatImageMap {
  const messageId = frame.assistant_message_id
  if (!isMessageId(messageId)) return map
  const current = map.get(messageId)
  if (frame.type === 'image_failed' && !frame.job_id) {
    // A job-less failure: nothing will follow for it, so it ends "starting".
    const startFailure: ChatImageStartFailure = {
      status: knownStatus(frame.status, 'failed'),
      error: safeError(frame.error),
      ...(frame.generation?.image_profile_id ? { image_profile_id: frame.generation.image_profile_id } : {}),
      ...(frame.generation?.provider && PROVIDERS.has(frame.generation.provider) ? { provider: frame.generation.provider } : {}),
    }
    return withEntry(map, messageId, { generations: current?.generations ?? [], startFailure })
  }
  if (!frame.job_id) return map
  const incoming = sanitizeGeneration({
    ...summaryFields(frame.generation),
    job_id: frame.job_id,
    status: frame.status,
    assistant_message_id: messageId,
    turn_id: frame.turn_id,
    status_url: frame.status_url ?? null,
    result_url: frame.result_url ?? null,
    assets: frame.type === 'image_complete' ? frame.assets : [],
    error: frame.type === 'image_failed' ? frame.error : null,
  })
  if (!incoming) return map
  return upsertGenerations(map, messageId, [incoming], { clearStart: true, takesPlaceholder: true })
}

/** Folds a polled job into the message that owns it; a job no message owns is ignored. */
export function applyJobResult(map: ChatImageMap, result: ImageJobHydration): ChatImageMap {
  for (const [messageId, entry] of map) {
    if (!entry.generations.some((generation) => generation.job_id === result.job_id)) continue
    const incoming = sanitizeGeneration({
      job_id: result.job_id,
      status: result.status,
      status_url: result.status_url ?? null,
      result_url: result.result_url ?? null,
      assets: result.assets ?? [],
      error: result.error ?? null,
    })
    return incoming ? upsertGenerations(map, messageId, [incoming], { clearStart: false }) : map
  }
  return map
}

/**
 * Adopts the server's generations per message: a union by job id, so a job
 * only the live socket knows yet is kept, and a finished job never goes back
 * to running.
 */
export function mergeHydrated(map: ChatImageMap, hydrated: ReadonlyMap<number, readonly ChatImageGeneration[]>): ChatImageMap {
  let next = map
  for (const [messageId, generations] of hydrated) {
    if (!isMessageId(messageId) || generations.length === 0) continue
    const safe = generations.map((generation) => sanitizeGeneration(generation)).filter((generation): generation is ChatImageGeneration => generation !== null)
    if (safe.length) next = upsertGenerations(next, messageId, safe, { clearStart: true, takesPlaceholder: true })
  }
  return next
}

/** Collects the server snapshot the projection put on each assistant turn. */
export function hydratedGenerationsFromTurns(turns: readonly TurnEntry[]): Map<number, readonly ChatImageGeneration[]> {
  const result = new Map<number, readonly ChatImageGeneration[]>()
  for (const turn of turns) {
    if (turn.type !== 'ai' || !isMessageId(turn.assistantMessageId) || !turn.imageGenerations?.length) continue
    result.set(turn.assistantMessageId, turn.imageGenerations)
  }
  return result
}

/**
 * `done.image_scheduled`: show "starting" until the first frame. A message
 * whose job already arrived (frames can race `done`) is left as it is.
 */
export function markScheduled(map: ChatImageMap, messageId: number, scheduled: boolean, now: number): ChatImageMap {
  if (!isMessageId(messageId)) return map
  const current = map.get(messageId)
  if (!scheduled) {
    if (!current?.scheduled) return map
    return withEntry(map, messageId, withoutSchedule(current))
  }
  if (current && (current.generations.length > 0 || current.startFailure || current.scheduled)) return map
  return withEntry(map, messageId, { generations: current?.generations ?? [], scheduled: true, scheduledAt: now })
}

/** Records a request that was refused before any job existed. */
export function markStartFailure(map: ChatImageMap, messageId: number, failure: ChatImageStartFailure): ChatImageMap {
  if (!isMessageId(messageId)) return map
  const current = map.get(messageId)
  return withEntry(map, messageId, { generations: current?.generations ?? [], startFailure: { ...failure, error: safeError(failure.error) } })
}

/** Inserts or replaces one generation (an optimistic regenerate and its server answer). */
export function putGeneration(map: ChatImageMap, messageId: number, generation: ChatImageGeneration, replacesJobId?: string): ChatImageMap {
  const safe = sanitizeGeneration(generation)
  if (!isMessageId(messageId) || !safe) return map
  const base = replacesJobId ? removeGeneration(map, messageId, replacesJobId) : map
  return upsertGenerations(base, messageId, [safe], { clearStart: true })
}

export function removeGeneration(map: ChatImageMap, messageId: number, jobId: string): ChatImageMap {
  const current = map.get(messageId)
  if (!current?.generations.some((generation) => generation.job_id === jobId)) return map
  return withEntry(map, messageId, { ...current, generations: current.generations.filter((generation) => generation.job_id !== jobId) })
}

export function clearStartFailure(map: ChatImageMap, messageId: number): ChatImageMap {
  const current = map.get(messageId)
  if (!current?.startFailure) return map
  return withEntry(map, messageId, withoutStartFailure(current))
}

// --- reads ------------------------------------------------------------------

/** Every job still running, across all messages. */
export function nonTerminalJobIds(map: ChatImageMap): string[] {
  const ids: string[] = []
  for (const entry of map.values()) {
    for (const generation of entry.generations) {
      if (!isTerminalImageStatus(generation.status) && !isLocalJobId(generation.job_id)) ids.push(generation.job_id)
    }
  }
  return ids
}

/** Messages told an image is coming that have seen no job yet, with when they were told. */
export function scheduledWithoutJob(map: ChatImageMap): Array<{ messageId: number; scheduledAt: number }> {
  const result: Array<{ messageId: number; scheduledAt: number }> = []
  for (const [messageId, entry] of map) {
    if (entry.scheduled && entry.generations.length === 0 && !entry.startFailure) {
      result.push({ messageId, scheduledAt: entry.scheduledAt ?? 0 })
    }
  }
  return result
}

/** The newest generation of a message, or undefined. */
export function newestGeneration(entry: ChatMessageImages | undefined): ChatImageGeneration | undefined {
  return entry?.generations[entry.generations.length - 1]
}

/** Optimistic regenerate placeholders carry a local id until the server answers. */
export const LOCAL_JOB_PREFIX = 'local:'
export function isLocalJobId(jobId: string): boolean {
  return jobId.startsWith(LOCAL_JOB_PREFIX)
}

// --- legacy rows ------------------------------------------------------------

/**
 * Rows from servers that predate `image_generations` keep one image slot in the
 * message metadata (`image_job`, `image_job_status`, `image_assets`,
 * `image_job_error`). Without a job id there is nothing to follow, so nothing
 * is returned.
 */
export function legacyGenerationFromMetadata(metadata: Record<string, unknown>, assistantMessageId?: number): ChatImageGeneration | null {
  const job = record(metadata.image_job)
  const jobId = typeof job.job_id === 'string' ? job.job_id : null
  if (!jobId) return null
  const assets = Array.isArray(metadata.image_assets) ? metadata.image_assets as ChatImageAsset[] : []
  const storedStatus = typeof metadata.image_job_status === 'string' ? metadata.image_job_status : typeof job.status === 'string' ? job.status : null
  const status = knownStatus(storedStatus, assets.length ? 'completed' : 'pending')
  const error = metadata.image_job_error && typeof metadata.image_job_error === 'object' ? metadata.image_job_error as ChatImageError : null
  const prompt = typeof record(metadata.turn_metadata).imagePrompt === 'string' ? record(metadata.turn_metadata).imagePrompt as string : null
  return sanitizeGeneration({
    job_id: jobId,
    status,
    ...(isMessageId(assistantMessageId) ? { assistant_message_id: assistantMessageId } : {}),
    status_url: typeof job.status_url === 'string' ? job.status_url : null,
    result_url: typeof job.result_url === 'string' ? job.result_url : null,
    assets,
    error,
    prompt,
    trigger: 'auto',
  })
}

/**
 * Parses a server list of generations (`image_generations` of a stored row, or
 * the message's image listing), which comes newest first; anything unusable is
 * dropped and the result is ordered oldest first.
 */
export function parseGenerations(value: unknown, assistantMessageId?: number): ChatImageGeneration[] | null {
  if (!Array.isArray(value)) return null
  return orderGenerations([...value].reverse()
    .map((row) => sanitizeGeneration({ ...(isMessageId(assistantMessageId) ? { assistant_message_id: assistantMessageId } : {}), ...(row as ChatImageGeneration) }))
    .filter((generation): generation is ChatImageGeneration => generation !== null))
}

// --- safety -----------------------------------------------------------------

/**
 * Normalizes one generation from any source. Asset URLs and error text are
 * filtered; prompts are shown to the user as they are and never pass the
 * error-text filter, which would reject ordinary words.
 */
export function sanitizeGeneration(value: Partial<ChatImageGeneration> & { job_id?: unknown; status?: unknown }): ChatImageGeneration | null {
  if (!value || typeof value.job_id !== 'string' || !value.job_id) return null
  const status = knownStatus(value.status, 'pending')
  const result: ChatImageGeneration = {
    job_id: value.job_id,
    status,
    assets: safeAssets(Array.isArray(value.assets) ? value.assets : []),
  }
  if (isMessageId(value.assistant_message_id)) result.assistant_message_id = value.assistant_message_id
  if (typeof value.turn_id === 'string') result.turn_id = value.turn_id
  if (typeof value.status_url === 'string') result.status_url = value.status_url
  if (typeof value.result_url === 'string') result.result_url = value.result_url
  if (value.error && typeof value.error === 'object') result.error = safeError(value.error)
  if (typeof value.prompt === 'string' && value.prompt.trim()) result.prompt = value.prompt
  if (typeof value.prompt_edited === 'boolean') result.prompt_edited = value.prompt_edited
  if (typeof value.model_prompt === 'string' && value.model_prompt.trim()) result.model_prompt = value.model_prompt
  Object.assign(result, summaryFields(value))
  return result
}

function summaryFields(value: ChatImageGenerationSummary | null | undefined): ChatImageGenerationSummary {
  if (!value || typeof value !== 'object') return {}
  const result: ChatImageGenerationSummary = {}
  if (typeof value.image_profile_id === 'string' && value.image_profile_id) result.image_profile_id = value.image_profile_id
  if (typeof value.profile_name === 'string' && value.profile_name.trim()) result.profile_name = value.profile_name
  if (typeof value.model === 'string' && value.model.trim()) result.model = value.model
  if (typeof value.model_display_name === 'string' && value.model_display_name.trim()) result.model_display_name = value.model_display_name
  if (typeof value.provider === 'string' && PROVIDERS.has(value.provider)) result.provider = value.provider
  if (typeof value.credential_mode === 'string' && CREDENTIAL_MODES.has(value.credential_mode)) result.credential_mode = value.credential_mode
  if (typeof value.credit_cost === 'number' && Number.isFinite(value.credit_cost) && value.credit_cost >= 0) result.credit_cost = value.credit_cost
  if (typeof value.aspect_ratio === 'string' && /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(value.aspect_ratio)) result.aspect_ratio = value.aspect_ratio
  if (typeof value.trigger === 'string' && TRIGGERS.has(value.trigger)) result.trigger = value.trigger
  if (typeof value.created_at === 'string' && value.created_at) result.created_at = value.created_at
  if (typeof value.updated_at === 'string' && value.updated_at) result.updated_at = value.updated_at
  return result
}

export function safeAssets(assets: ChatImageAsset[]): ChatImageAsset[] {
  const seen = new Set<string>()
  const result: ChatImageAsset[] = []
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object' || !isSafeAssetUrl(asset.url)) continue
    const key = asset.asset_id || asset.url
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(asset)
  }
  return result
}

export function safeError(error: ChatImageError): ChatImageError {
  return {
    category: safeText(error?.category, 'failed'),
    detail: safeText(error?.detail, 'Image generation failed.'),
    code: error?.code ? safeText(error.code, '') || undefined : undefined,
  }
}

function safeText(value: unknown, fallback: string): string {
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

// --- internals --------------------------------------------------------------

/**
 * `takesPlaceholder`: a job new to the message that is not its automatic image
 * takes the place of the oldest optimistic regenerate, since the socket and
 * the listing can deliver a regenerate before (or instead of) its POST answer.
 */
function upsertGenerations(map: ChatImageMap, messageId: number, incoming: readonly ChatImageGeneration[], options: { clearStart: boolean; takesPlaceholder?: boolean }): ChatImageMap {
  const current = map.get(messageId)
  const list = [...(current?.generations ?? [])]
  let changed = false
  for (const generation of incoming) {
    const index = list.findIndex((existing) => existing.job_id === generation.job_id)
    if (index < 0) {
      if (options.takesPlaceholder && !isLocalJobId(generation.job_id) && generation.trigger !== 'auto') {
        const placeholder = list.findIndex((existing) => isLocalJobId(existing.job_id))
        if (placeholder >= 0) list.splice(placeholder, 1)
      }
      list.splice(insertionIndex(list, generation), 0, generation)
      changed = true
      continue
    }
    const merged = mergeGeneration(list[index], generation)
    if (merged !== list[index]) {
      list[index] = merged
      changed = true
    }
  }
  const dropsSchedule = Boolean(current?.scheduled) && list.length > 0
  const dropsStart = options.clearStart && Boolean(current?.startFailure) && changed
  if (!changed && !dropsSchedule && !dropsStart) return map
  let entry: ChatMessageImages = { ...(current ?? {}), generations: changed ? orderGenerations(list) : current!.generations }
  if (dropsSchedule) entry = withoutSchedule(entry)
  if (dropsStart) entry = withoutStartFailure(entry)
  return withEntry(map, messageId, entry)
}

/** Terminal wins per job; known fields are kept when the newer source leaves them out. */
function mergeGeneration(existing: ChatImageGeneration, incoming: ChatImageGeneration): ChatImageGeneration {
  const keepStatus = isTerminalImageStatus(existing.status) && !isTerminalImageStatus(incoming.status)
  const next: ChatImageGeneration = { ...existing }
  for (const [key, value] of Object.entries(incoming) as Array<[keyof ChatImageGeneration, unknown]>) {
    if (key === 'status' || key === 'assets' || key === 'error') continue
    if (value !== undefined && value !== null) (next as unknown as Record<string, unknown>)[key] = value
  }
  if (!keepStatus) {
    next.status = incoming.status
    // A source that leaves assets out (a job poll, a frame) never wipes ones already known.
    if (incoming.assets.length > 0) next.assets = incoming.assets
    if (incoming.error) next.error = incoming.error
    if (incoming.status === 'completed') delete next.error
  }
  return sameGeneration(existing, next) ? existing : next
}

function sameGeneration(left: ChatImageGeneration, right: ChatImageGeneration): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]) as Set<keyof ChatImageGeneration>
  for (const key of keys) {
    const a = left[key]
    const b = right[key]
    if (a === b) continue
    if (key === 'assets' || key === 'error') {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) return false
      continue
    }
    return false
  }
  return true
}

/**
 * Oldest first. Frames carry no `created_at`, so a list is kept in arrival
 * order (a job first seen live is the newest) and sorted by date only once
 * every job has one; ties keep their order.
 */
function orderGenerations(list: ChatImageGeneration[]): ChatImageGeneration[] {
  const times = list.map(createdAt)
  if (times.some((time) => time === null)) return list
  return list
    .map((generation, index) => ({ generation, index, time: times[index]! }))
    .sort((left, right) => (left.time === right.time ? left.index - right.index : left.time - right.time))
    .map(({ generation }) => generation)
}

/** A dated job goes before the first known job dated after it; any other new job is the newest. */
function insertionIndex(list: readonly ChatImageGeneration[], generation: ChatImageGeneration): number {
  const time = createdAt(generation)
  if (time === null) return list.length
  const later = list.findIndex((existing) => {
    const existingTime = createdAt(existing)
    return existingTime !== null && existingTime > time
  })
  return later < 0 ? list.length : later
}

function createdAt(generation: ChatImageGeneration): number | null {
  const time = generation.created_at ? Date.parse(generation.created_at) : Number.NaN
  return Number.isFinite(time) ? time : null
}

function withoutSchedule(entry: ChatMessageImages): ChatMessageImages {
  const next = { ...entry }
  delete next.scheduled
  delete next.scheduledAt
  return next
}

function withoutStartFailure(entry: ChatMessageImages): ChatMessageImages {
  const next = { ...entry }
  delete next.startFailure
  return next
}

function withEntry(map: ChatImageMap, messageId: number, entry: ChatMessageImages): ChatImageMap {
  const next = new Map(map)
  next.set(messageId, entry)
  return next
}

function knownStatus(value: unknown, fallback: ImageLifecycleStatus): ImageLifecycleStatus {
  return typeof value === 'string' && KNOWN_STATUSES.has(value as ImageLifecycleStatus) ? value as ImageLifecycleStatus : fallback
}

function isMessageId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
