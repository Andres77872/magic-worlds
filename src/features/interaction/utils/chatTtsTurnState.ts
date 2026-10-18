import type { ChatTtsAsset, ChatTtsError, ChatTtsSegmentClip, ChatTtsSegmentStatus, ChatSocketServerMessage, TtsLifecycleStatus, TurnEntry } from '../../../shared'
import { clipGainDb } from '@/shared/voice/clipVolume'
import { isSafeAssetUrl } from './chatImageStore'

/**
 * Per-turn TTS narration state, the audio counterpart of the chat image store (`chatImageStore`).
 * Kept as a separate track (own finder keyed on `ttsJobId`, own terminal-status
 * sets) so a turn that has both an image job and a TTS job can't cross-match.
 */
export type ChatTtsFrame = Extract<ChatSocketServerMessage, { type: 'tts_job' | 'tts_complete' | 'tts_failed' }>

export interface TtsJobHydration extends Pick<ChatTtsSegmentClip, 'tier' | 'gain_db' | 'substitution_reason' | 'voice_name' | 'original_voice_name'> {
  job_id: string
  status: TtsLifecycleStatus
  status_url?: string | null
  result_url?: string | null
  url?: string | null
  assets?: ChatTtsAsset[]
  error?: ChatTtsError | null
}

const TERMINAL_STATUSES = new Set<TtsLifecycleStatus>([
  'completed',
  'failed',
  'invalid',
  'unavailable',
  'quota_exceeded',
  'rate_limited',
  'timeout',
  'content_blocked',
])

const NON_TERMINAL_STATUSES = new Set<ChatTtsSegmentStatus>(['pending', 'in_progress', 'synthesizing', 'mirroring'])

/**
 * Display-only segment states (03 §5.4.2): a cap kept the segment from being
 * enqueued. They are not job statuses, so `TERMINAL_STATUSES` stays closed, but
 * they settle the clip: it is never "generating" and never polled.
 */
const DISPLAY_STATES = new Set<ChatTtsSegmentStatus>(['daily_limit_reached', 'not_narrated'])

/** True for a clip status that will not change without a new request. */
export function isSettledClipStatus(status: ChatTtsSegmentStatus | undefined): boolean {
  if (!status) return false
  return TERMINAL_STATUSES.has(status as TtsLifecycleStatus) || DISPLAY_STATES.has(status)
}

/** True while a clip's job is still running (display states are settled, never generating). */
export function isGeneratingClipStatus(status: ChatTtsSegmentStatus | undefined): boolean {
  return status != null && NON_TERMINAL_STATUSES.has(status)
}

export function hasNonTerminalTtsJob(turn: TurnEntry): boolean {
  if (turn.ttsJobId && turn.ttsStatus && NON_TERMINAL_STATUSES.has(turn.ttsStatus)) return true
  return (turn.ttsSegments ?? []).some((clip) => clip.status != null && NON_TERMINAL_STATUSES.has(clip.status))
}

/** All non-terminal job ids for a turn (legacy single clip + per-segment clips), for polling. */
export function nonTerminalTtsJobIds(turn: TurnEntry): string[] {
  const ids: string[] = []
  if (turn.ttsJobId && turn.ttsStatus && NON_TERMINAL_STATUSES.has(turn.ttsStatus)) ids.push(turn.ttsJobId)
  for (const clip of turn.ttsSegments ?? []) {
    if (clip.job_id && clip.status && NON_TERMINAL_STATUSES.has(clip.status)) ids.push(clip.job_id)
  }
  return ids
}

export function upsertChatTtsFrame(turns: TurnEntry[], frame: ChatTtsFrame): TurnEntry[] {
  const index = findTurnIndex(turns, {
    jobId: frame.job_id ?? undefined,
    assistantMessageId: frame.assistant_message_id,
    turnId: frame.turn_id,
  })
  if (index < 0) return turns
  const segmentIndex = (frame as { segment_index?: number }).segment_index
  if (typeof segmentIndex === 'number') {
    return turns.map((turn, idx) => (idx === index ? mergeSegmentFrame(turn, frame, segmentIndex) : turn))
  }
  return turns.map((turn, idx) => (idx === index ? mergeTtsState(turn, stateFromFrame(frame)) : turn))
}

export function upsertTtsJobResult(turns: TurnEntry[], result: TtsJobHydration): TurnEntry[] {
  const index = findTurnIndex(turns, { jobId: result.job_id })
  if (index < 0) return turns
  return turns.map((turn, idx) => {
    if (idx !== index) return turn
    // A polled job_id that belongs to a narration clip updates that clip, not the
    // legacy single-clip fields.
    if ((turn.ttsSegments ?? []).some((clip) => clip.job_id === result.job_id)) {
      const segments = (turn.ttsSegments ?? []).map((clip) =>
        clip.job_id === result.job_id ? mergeClip(clip, clipFromJobResult(result, clip.segment_index)) : clip,
      )
      return { ...turn, ttsSegments: segments }
    }
    return mergeTtsState(turn, stateFromJobResult(result))
  })
}

/**
 * Fold hydrated (server projection) TTS state into the current turns. Applied
 * after `mergeHydratedImageTurns` so it operates on the same turn objects; the
 * terminal-precedence merge keeps live socket state from being clobbered by a
 * staler hydration snapshot.
 */
export function mergeHydratedTtsTurns(current: TurnEntry[], hydrated: TurnEntry[]): TurnEntry[] {
  if (hydrated.length === 0) return current
  return current.map((turn) => {
    const hydratedMatch = findTurnIndex(hydrated, {
      jobId: turn.ttsJobId,
      assistantMessageId: turn.assistantMessageId,
      turnId: turn.turnId,
    })
    if (hydratedMatch < 0) return turn
    // current is the live state; hydrated is the incoming patch. Terminal
    // precedence in mergeTtsState protects a live completed/failed turn.
    const merged = mergeTtsState(turn, sanitizeTurnTtsState(hydrated[hydratedMatch]))
    const segments = mergeSegmentLists(turn.ttsSegments, hydrated[hydratedMatch].ttsSegments)
    return segments ? { ...merged, ttsSegments: segments } : merged
  })
}

// -- per-segment multi-voice narration ------------------------------------

function clipFromSegmentFrame(frame: ChatTtsFrame, index: number): ChatTtsSegmentClip {
  const base: ChatTtsSegmentClip = {
    segment_index: index,
    segment_count: frame.segment_count,
    kind: frame.kind,
    speaker_id: frame.speaker_id ?? null,
    speaker_name: frame.speaker_name ?? null,
    job_id: frame.job_id ?? undefined,
    status: frame.status,
    status_url: frame.status_url ?? undefined,
    result_url: frame.result_url ?? undefined,
    ...clipVoiceFields(frame),
  }
  if (frame.type === 'tts_complete') {
    const assets = safeAssets(frame.assets)
    return { ...base, status: 'completed', assets, url: assets[0]?.url ?? safeAssetUrl(frame.url) ?? null, error: null }
  }
  if (frame.type === 'tts_failed') {
    return { ...base, error: safeError(frame.error) }
  }
  return base
}

function clipFromJobResult(result: TtsJobHydration, index: number): ChatTtsSegmentClip {
  const assets = safeAssets(result.assets ?? [])
  return {
    segment_index: index,
    job_id: result.job_id,
    status: result.status,
    status_url: result.status_url ?? undefined,
    result_url: result.result_url ?? undefined,
    assets: assets.length > 0 ? assets : undefined,
    url: assets[0]?.url ?? safeAssetUrl(result.url) ?? null,
    error: result.error ? safeError(result.error) : undefined,
    ...clipVoiceFields(result),
  }
}

type ClipVoiceFields = Pick<ChatTtsSegmentClip, 'tier' | 'gain_db' | 'substitution_reason' | 'voice_name' | 'original_voice_name'>

/**
 * The optional voice fields of a clip (D05, D16, D36), copied only when present
 * so an older frame never erases them. `gain_db` is clamped to [-24, 0].
 */
function clipVoiceFields(source: Partial<ClipVoiceFields>): ClipVoiceFields {
  const fields: ClipVoiceFields = {}
  if (source.tier === 'standard' || source.tier === 'expressive') fields.tier = source.tier
  const gain = clipGainDb(source.gain_db)
  if (gain !== null) fields.gain_db = gain
  if (typeof source.substitution_reason === 'string') fields.substitution_reason = source.substitution_reason
  const voiceName = safeName(source.voice_name)
  if (voiceName) fields.voice_name = voiceName
  const originalVoiceName = safeName(source.original_voice_name)
  if (originalVoiceName) fields.original_voice_name = originalVoiceName
  return fields
}

function safeName(value: unknown): string | undefined {
  return typeof value === 'string' ? safeText(value, '') || undefined : undefined
}

function mergeClip(existing: ChatTtsSegmentClip | undefined, incoming: ChatTtsSegmentClip): ChatTtsSegmentClip {
  if (!existing) return incoming
  const existingTerminal = isSettledClipStatus(existing.status)
  const incomingTerminal = isSettledClipStatus(incoming.status)
  // A new job for the segment (a retry, or a capped segment narrated later)
  // replaces the settled clip; the same job never moves back from terminal.
  const newerJob = Boolean(incoming.job_id) && incoming.job_id !== existing.job_id
  const keepTerminal = existingTerminal && !incomingTerminal && !newerJob
  const assets = dedupeAssets([...(existing.assets ?? []), ...(incoming.assets ?? [])])
  return {
    ...existing,
    ...incoming,
    segment_index: existing.segment_index,
    segment_count: incoming.segment_count ?? existing.segment_count,
    kind: incoming.kind ?? existing.kind,
    speaker_id: incoming.speaker_id ?? existing.speaker_id,
    speaker_name: incoming.speaker_name ?? existing.speaker_name,
    tier: incoming.tier ?? existing.tier,
    gain_db: incoming.gain_db ?? existing.gain_db,
    substitution_reason: incoming.substitution_reason ?? existing.substitution_reason,
    voice_name: incoming.voice_name ?? existing.voice_name,
    original_voice_name: incoming.original_voice_name ?? existing.original_voice_name,
    status: keepTerminal ? existing.status : incoming.status ?? existing.status,
    assets: assets.length > 0 ? assets : undefined,
    url: assets[0]?.url ?? incoming.url ?? existing.url ?? null,
    error: incoming.status === 'completed'
      ? undefined
      : keepTerminal ? existing.error : newerJob && existingTerminal ? incoming.error ?? undefined : incoming.error ?? existing.error,
  }
}

function upsertClip(segments: ChatTtsSegmentClip[] | undefined, incoming: ChatTtsSegmentClip): ChatTtsSegmentClip[] {
  const next = [...(segments ?? [])]
  const at = next.findIndex((clip) => clip.segment_index === incoming.segment_index)
  if (at >= 0) next[at] = mergeClip(next[at], incoming)
  else next.push(incoming)
  next.sort((a, b) => a.segment_index - b.segment_index)
  return next
}

function mergeSegmentFrame(turn: TurnEntry, frame: ChatTtsFrame, index: number): TurnEntry {
  // A segment frame means a newer request was admitted, so a turn-level gate
  // failure (no job: attestation, archived workspace, …) no longer applies.
  const staleGate = !turn.ttsJobId && turn.ttsError != null
  return {
    ...turn,
    ...(staleGate ? { ttsStatus: undefined, ttsError: undefined } : {}),
    assistantMessageId: frame.assistant_message_id ?? turn.assistantMessageId,
    turnId: frame.turn_id ?? turn.turnId,
    ttsSegments: upsertClip(turn.ttsSegments, clipFromSegmentFrame(frame, index)),
  }
}

function sanitizeClip(clip: ChatTtsSegmentClip): ChatTtsSegmentClip {
  const assets = safeAssets(clip.assets ?? [])
  // Hydrated clips are cast from stored metadata: re-validate the voice fields.
  const voice = clipVoiceFields(clip)
  const rawUrl = clip.url ?? (typeof clip.audio_url === 'string' ? clip.audio_url : undefined)
  return {
    ...clip,
    tier: voice.tier,
    gain_db: voice.gain_db,
    substitution_reason: voice.substitution_reason,
    voice_name: voice.voice_name,
    original_voice_name: voice.original_voice_name,
    assets: assets.length > 0 ? assets : undefined,
    url: assets[0]?.url ?? (rawUrl && isSafeTtsAudioUrl(rawUrl) ? rawUrl : undefined),
    error: clip.error ? safeError(clip.error) : undefined,
  }
}

function mergeSegmentLists(
  current: ChatTtsSegmentClip[] | undefined,
  hydrated: ChatTtsSegmentClip[] | undefined,
): ChatTtsSegmentClip[] | undefined {
  if (!hydrated?.length) return current
  let merged = current
  for (const clip of hydrated) {
    merged = upsertClip(merged, sanitizeClip(clip))
  }
  return merged
}

function stateFromFrame(frame: ChatTtsFrame): Partial<TurnEntry> {
  const common = {
    assistantMessageId: frame.assistant_message_id,
    turnId: frame.turn_id,
    ttsJobId: frame.job_id ?? undefined,
    ttsStatus: frame.status,
    ttsStatusUrl: frame.status_url ?? undefined,
    ttsResultUrl: frame.result_url ?? undefined,
  }
  if (frame.type === 'tts_complete') {
    const assets = safeAssets(frame.assets)
    const fallbackUrl = safeAssetUrl(frame.url)
    return { ...common, ttsStatus: 'completed', ttsAssets: assets, ttsUrl: assets[0]?.url ?? fallbackUrl, ttsError: undefined }
  }
  if (frame.type === 'tts_failed') {
    return { ...common, ttsError: safeError(frame.error) }
  }
  return common
}

function stateFromJobResult(result: TtsJobHydration): Partial<TurnEntry> {
  const assets = safeAssets(result.assets ?? [])
  const fallbackUrl = safeAssetUrl(result.url)
  return {
    ttsJobId: result.job_id,
    ttsStatus: result.status,
    ttsStatusUrl: result.status_url ?? undefined,
    ttsResultUrl: result.result_url ?? undefined,
    ttsAssets: assets.length > 0 ? assets : undefined,
    ttsUrl: assets[0]?.url ?? fallbackUrl,
    ttsError: result.error ? safeError(result.error) : undefined,
  }
}

function mergeTtsState(turn: TurnEntry, incoming: Partial<TurnEntry>): TurnEntry {
  const existingTerminal = turn.ttsStatus ? TERMINAL_STATUSES.has(turn.ttsStatus) : false
  const incomingTerminal = incoming.ttsStatus ? TERMINAL_STATUSES.has(incoming.ttsStatus) : false
  const shouldKeepTerminal = existingTerminal && !incomingTerminal
  const next: TurnEntry = {
    ...turn,
    assistantMessageId: incoming.assistantMessageId ?? turn.assistantMessageId,
    turnId: incoming.turnId ?? turn.turnId,
    ttsJobId: incoming.ttsJobId ?? turn.ttsJobId,
    ttsStatusUrl: incoming.ttsStatusUrl ?? turn.ttsStatusUrl,
    ttsResultUrl: incoming.ttsResultUrl ?? turn.ttsResultUrl,
  }
  if (!shouldKeepTerminal && incoming.ttsStatus) {
    next.ttsStatus = incoming.ttsStatus
  }
  const mergedAssets = dedupeAssets([...(turn.ttsAssets ?? []), ...(incoming.ttsAssets ?? [])])
  if (mergedAssets.length > 0) {
    next.ttsAssets = mergedAssets
    next.ttsUrl = mergedAssets[0].url
  } else if (incoming.ttsUrl && isSafeTtsAudioUrl(incoming.ttsUrl)) {
    next.ttsUrl = incoming.ttsUrl
  }
  if (!shouldKeepTerminal && incoming.ttsError) {
    next.ttsError = incoming.ttsError
  }
  if (incoming.ttsStatus === 'completed') {
    next.ttsError = undefined
  }
  return next
}

function findTurnIndex(turns: TurnEntry[], keys: { jobId?: string | null; assistantMessageId?: number; turnId?: string }): number {
  if (keys.jobId) {
    const byJob = turns.findIndex(
      (turn) => turn.ttsJobId === keys.jobId || (turn.ttsSegments ?? []).some((clip) => clip.job_id === keys.jobId),
    )
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
  // The last-AI fallback is only for lookups that carried at least one id (a
  // live frame racing the turn's ids). A key-less lookup — user turns and
  // still-streaming turns during hydration merges — must never adopt another
  // turn's TTS state.
  if (!keys.jobId && !keys.assistantMessageId && !keys.turnId) return -1
  for (let idx = turns.length - 1; idx >= 0; idx -= 1) {
    if (turns[idx].type === 'ai') return idx
  }
  return -1
}

function sanitizeTurnTtsState(turn: TurnEntry): TurnEntry {
  const assets = safeAssets(turn.ttsAssets ?? [])
  return {
    ...turn,
    ttsAssets: assets.length > 0 ? assets : undefined,
    ttsUrl: assets[0]?.url ?? (turn.ttsUrl && isSafeTtsAudioUrl(turn.ttsUrl) ? turn.ttsUrl : undefined),
    ttsError: turn.ttsError ? safeError(turn.ttsError) : undefined,
  }
}

/**
 * Narration audio is only playable through the backend's ownership-checked
 * download route (`/tts/assets/{asset_id}.mp3`, optionally absolute when the
 * API sets a public base URL). Anything else — including stale
 * `/generated-tts/` static URLs from before that route existed — is dropped so
 * the speaker control falls back to "request narration" and re-resolves
 * through job reuse.
 */
export function isSafeTtsAudioUrl(value: string): boolean {
  if (!isSafeAssetUrl(value)) return false
  const path = value.replace(/^https?:\/\/[^/]+/i, '')
  const normalized = path.split('?')[0].split('#')[0].toLowerCase()
  return normalized.startsWith('/tts/assets/') && normalized.endsWith('.mp3')
}

function safeAssets(assets: ChatTtsAsset[]): ChatTtsAsset[] {
  return dedupeAssets(assets.filter((asset) => asset.content_type === 'audio/mpeg' && isSafeTtsAudioUrl(asset.url)))
}

function dedupeAssets(assets: ChatTtsAsset[]): ChatTtsAsset[] {
  const seen = new Set<string>()
  const result: ChatTtsAsset[] = []
  for (const asset of assets) {
    const key = asset.asset_id || asset.url
    if (!key || seen.has(key) || asset.content_type !== 'audio/mpeg' || !isSafeTtsAudioUrl(asset.url)) continue
    seen.add(key)
    result.push(asset)
  }
  return result
}

function safeAssetUrl(value: unknown): string | undefined {
  return typeof value === 'string' && isSafeTtsAudioUrl(value) ? value : undefined
}

function safeError(error: ChatTtsError): ChatTtsError {
  const retry = typeof error.retry_after_seconds === 'number' && Number.isFinite(error.retry_after_seconds) && error.retry_after_seconds >= 0
    ? error.retry_after_seconds
    : undefined
  const action = safeErrorAction(error.action)
  return {
    category: safeText(error.category, 'failed'),
    detail: safeText(error.detail, 'Narration failed.'),
    code: safeErrorCode(error.code),
    retry_after_seconds: retry,
    ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    ...(action ? { action } : {}),
  }
}

/**
 * The public actions a narration error may carry: `attest` (D26) and
 * `crisis_resources` (PC-1, a `voice_safety_pause` refusal). Anything else is dropped.
 */
function safeErrorAction(action: unknown): ChatTtsError['action'] | undefined {
  return action === 'attest' || action === 'crisis_resources' ? action : undefined
}

/** Public error codes are short identifiers (`voice_unavailable`, `WORKSPACE_ARCHIVED`); anything else is dropped. */
const SAFE_ERROR_CODE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/

function safeErrorCode(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined
  const trimmed = code.trim()
  return SAFE_ERROR_CODE.test(trimmed) ? trimmed : undefined
}

function safeText(value: string, fallback: string): string {
  const text = String(value || '').trim()
  const lowered = text.toLowerCase()
  if (!text || lowered.includes('http://') || lowered.includes('https://') || lowered.includes('/var/') || lowered.includes('/tmp/') || lowered.includes('secret') || lowered.includes('bearer ') || lowered.includes('authorization')) {
    return fallback
  }
  return text
}
