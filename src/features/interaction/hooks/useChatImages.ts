import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatImageGeneration, ImageProvider, TurnEntry } from '../../../shared'
import { ApiError, ChatImagesUnsupportedError, type ApiService, type ChatImageBasePath } from '../../../infrastructure/api'
import { isPageVisible, usePageVisible } from '@/app/hooks/usePageFocus'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { generateUUID } from '@/utils/uuid'
import {
  applyFrame as applyFrameToMap,
  applyJobResult,
  clearStartFailure,
  EMPTY_CHAT_IMAGES,
  hydratedGenerationsFromTurns,
  LOCAL_JOB_PREFIX,
  markScheduled as markScheduledInMap,
  markStartFailure,
  mergeHydrated,
  nonTerminalJobIds,
  parseGenerations,
  putGeneration,
  removeGeneration,
  scheduledWithoutJob,
  type ChatImageFrame,
  type ChatImageMap,
  type ChatImageStartFailure,
  type ChatMessageImages,
} from '../utils/chatImageStore'

/** Poll delays per job: 2 s, then 4 s, then every 10 s. */
export const IMAGE_POLL_BACKOFF_MS = [2_000, 4_000, 10_000] as const
/** A scheduled image with no frame yet is looked up after this long. */
export const IMAGE_START_CHECK_MS = 10_000
/** After this long without a job, the turn offers Retry. */
export const IMAGE_START_STALL_MS = 30_000

/** What one turn renders: its generations, the one on screen, and whether one is starting. */
export interface ChatTurnImagesView {
  messageId: number
  generations: readonly ChatImageGeneration[]
  /** The generation on screen: the player's pick, or the newest one. */
  selectedJobId: string | null
  scheduled: boolean
  /** Scheduled long ago and still no job: the image did not start. */
  stalled: boolean
  startFailure?: ChatImageStartFailure
}

export interface ChatImageRegenerateOptions {
  /** An edited scene prompt; omitted, the server uses the turn's own. */
  prompt?: string
  imageProfileId?: string
  /** A personal (BYOK) profile's provider: its held key is attached to this one request. */
  provider?: ImageProvider | null
}

export type ChatImageRegenerateOutcome = 'started' | 'failed' | 'unsupported' | 'skipped'

export interface UseChatImagesOptions {
  api: Pick<ApiService, 'getImageJob' | 'generateChatMessageImage' | 'listChatMessageImages'>
  basePath: string
  sessionId: number
  /** The session's workspace is the committed one; polls pause otherwise. */
  active: boolean
  /** Scene images are shown for this chat. */
  enabled?: boolean
}

export interface ChatImagesApi {
  /** Per assistant message; an unchanged message keeps its view object. */
  views: ReadonlyMap<number, ChatTurnImagesView>
  /** False once the server proved it has no chat image endpoints. */
  supported: boolean
  applyFrame: (frame: ChatImageFrame) => void
  markScheduled: (assistantMessageId: number, scheduled: boolean) => void
  /** Adopts the `imageGenerations` each server projection put on its turns. */
  adoptHydrated: (turns: readonly TurnEntry[]) => void
  regenerate: (assistantMessageId: number, options?: ChatImageRegenerateOptions) => Promise<ChatImageRegenerateOutcome>
  select: (assistantMessageId: number, jobId: string) => void
}

interface ImagesState {
  map: ChatImageMap
  /** Explicit picks only; a message without one shows its newest generation. */
  selection: ReadonlyMap<number, string>
  stalled: ReadonlySet<number>
  views: ReadonlyMap<number, ChatTurnImagesView>
}

interface PollState {
  attempts: number
  nextAt: number
  inFlight: boolean
}

const INITIAL_STATE: ImagesState = { map: EMPTY_CHAT_IMAGES, selection: new Map(), stalled: new Set(), views: new Map() }

/**
 * Owns the chat's scene images: the per-message map, which image each turn
 * shows, polling of every unfinished job, and the "starting" watchdog.
 *
 * Polling runs while the page is visible, focused or not, at 2 s, 4 s, then
 * 10 s per job. A turn told an image is coming (`done.image_scheduled`) that
 * sees no job asks the server after 10 s and offers Retry after 30 s.
 */
export function useChatImages({ api, basePath, sessionId, active, enabled = true }: UseChatImagesOptions): ChatImagesApi {
  const [state, setState] = useState<ImagesState>(INITIAL_STATE)
  const [supported, setSupported] = useState(true)
  const stateRef = useRef(state)
  const supportedRef = useRef(true)
  const activeRef = useRef(active)
  const mountedRef = useRef(true)
  const adoptedRef = useRef(new WeakSet<object>())
  const latest = useRef({ api, basePath, sessionId })
  useEffect(() => {
    activeRef.current = active
    latest.current = { api, basePath, sessionId }
  })
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const commit = useCallback((patch: Partial<Omit<ImagesState, 'views'>>) => {
    const previous = stateRef.current
    const next = { ...previous, ...patch }
    if (next.map === previous.map && next.selection === previous.selection && next.stalled === previous.stalled) return
    next.views = deriveViews(previous.views, next)
    stateRef.current = next
    setState(next)
  }, [])

  const markUnsupported = useCallback(() => {
    supportedRef.current = false
    setSupported(false)
  }, [])

  const applyFrame = useCallback((frame: ChatImageFrame) => {
    const current = stateRef.current
    const messageId = frame.assistant_message_id
    const entry = current.map.get(messageId)
    const startsJob = Boolean(frame.job_id) && !entry?.generations.some((generation) => generation.job_id === frame.job_id)
    // A regenerate's first frame can beat its POST answer: the store swaps the placeholder for it.
    const map = applyFrameToMap(current.map, frame)
    if (map === current.map) return
    // A new job (or a job-less failure) ends any wait and shows itself.
    const settles = startsJob || !frame.job_id
    commit({
      map,
      ...(startsJob ? { selection: without(current.selection, messageId) } : {}),
      ...(settles ? { stalled: without(current.stalled, messageId) } : {}),
    })
  }, [commit])

  const markScheduled = useCallback((assistantMessageId: number, scheduled: boolean) => {
    commit({ map: markScheduledInMap(stateRef.current.map, assistantMessageId, scheduled, Date.now()) })
  }, [commit])

  const adoptHydrated = useCallback((turns: readonly TurnEntry[]) => {
    const fresh = new Map<number, readonly ChatImageGeneration[]>()
    for (const [messageId, list] of hydratedGenerationsFromTurns(turns)) {
      if (adoptedRef.current.has(list)) continue
      adoptedRef.current.add(list)
      fresh.set(messageId, list)
    }
    if (fresh.size === 0) return
    const current = stateRef.current
    const map = mergeHydrated(current.map, fresh)
    let stalled = current.stalled
    for (const messageId of fresh.keys()) stalled = without(stalled, messageId)
    commit({ map, stalled })
  }, [commit])

  const select = useCallback((assistantMessageId: number, jobId: string) => {
    const current = stateRef.current
    if (!current.map.get(assistantMessageId)?.generations.some((generation) => generation.job_id === jobId)) return
    const selection = new Map(current.selection)
    selection.set(assistantMessageId, jobId)
    commit({ selection })
  }, [commit])

  /** Reads one message's images from the server listing and merges them in. */
  const lookUpImages = useCallback(async (assistantMessageId: number) => {
    const { api: client, basePath: path, sessionId: session } = latest.current
    if (!supportedRef.current || !activeRef.current || !isChatImageBasePath(path)) return
    try {
      const generations = parseGenerations(await client.listChatMessageImages(path, session, assistantMessageId), assistantMessageId) ?? []
      if (!mountedRef.current || !activeRef.current || generations.length === 0) return
      commit({ map: mergeHydrated(stateRef.current.map, new Map([[assistantMessageId, generations]])) })
    } catch (error) {
      if (error instanceof ChatImagesUnsupportedError) markUnsupported()
      else console.warn('Failed to look up chat images:', error)
    }
  }, [commit, markUnsupported])

  const regenerate = useCallback(async (assistantMessageId: number, options: ChatImageRegenerateOptions = {}): Promise<ChatImageRegenerateOutcome> => {
    const { api: client, basePath: path, sessionId: session } = latest.current
    if (!enabled || !supportedRef.current || !isChatImageBasePath(path) || !Number.isSafeInteger(session) || session < 1 || !Number.isSafeInteger(assistantMessageId) || assistantMessageId < 1) return 'skipped'
    const placeholderId = `${LOCAL_JOB_PREFIX}${generateUUID()}`
    const prompt = options.prompt?.trim()
    const placeholder: ChatImageGeneration = {
      job_id: placeholderId,
      status: 'pending',
      assistant_message_id: assistantMessageId,
      assets: [],
      trigger: 'regenerate',
      ...(prompt ? { prompt, prompt_edited: true } : {}),
      ...(options.imageProfileId ? { image_profile_id: options.imageProfileId } : {}),
      ...(options.provider ? { provider: options.provider } : {}),
    }
    const current = stateRef.current
    commit({
      map: putGeneration(clearStartFailure(current.map, assistantMessageId), assistantMessageId, placeholder),
      selection: without(current.selection, assistantMessageId),
      stalled: without(current.stalled, assistantMessageId),
    })
    // A personal profile's key rides only this request; it is read now and never kept.
    const credentials = options.provider ? imageCredentialSession.credentials(options.provider) : undefined
    const body = {
      ...(prompt ? { prompt } : {}),
      ...(options.imageProfileId ? { image_profile_id: options.imageProfileId } : {}),
      ...(credentials ? { credentials } : {}),
    }
    try {
      const generation = await client.generateChatMessageImage(path, session, assistantMessageId, body)
      if (!mountedRef.current) return 'started'
      if (generation) {
        commit({ map: putGeneration(stateRef.current.map, assistantMessageId, { ...generation, assistant_message_id: assistantMessageId }, placeholderId) })
      } else {
        // The job was slow to create; frames and the listing deliver it and take the placeholder's place.
        void lookUpImages(assistantMessageId)
      }
      return 'started'
    } catch (error) {
      if (!mountedRef.current) return 'failed'
      const withoutPlaceholder = removeGeneration(stateRef.current.map, assistantMessageId, placeholderId)
      if (error instanceof ChatImagesUnsupportedError) {
        markUnsupported()
        commit({ map: withoutPlaceholder })
        return 'unsupported'
      }
      commit({ map: markStartFailure(withoutPlaceholder, assistantMessageId, startFailureFromError(error, options)) })
      return 'failed'
    } finally {
      delete (body as { credentials?: unknown }).credentials
    }
  }, [commit, enabled, lookUpImages, markUnsupported])

  // --- polling -------------------------------------------------------------
  const visible = usePageVisible()
  const pendingKey = enabled ? nonTerminalJobIds(state.map).sort().join(',') : ''
  const pollsRef = useRef(new Map<string, PollState>())
  const pollTimerRef = useRef<number | null>(null)
  const wakeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!pendingKey || !active || !visible) return
    let running = true
    const polls = pollsRef.current
    const clearTimer = () => {
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    const tick = async () => {
      pollTimerRef.current = null
      const now = Date.now()
      for (const [jobId, poll] of polls) {
        if (!running || !isPageVisible() || !activeRef.current) break
        if (poll.inFlight || poll.nextAt > now) continue
        poll.inFlight = true
        try {
          const result = await latest.current.api.getImageJob(jobId)
          if (mountedRef.current && activeRef.current) commit({ map: applyJobResult(stateRef.current.map, result) })
        } catch (error) {
          console.warn('Failed to poll image job:', error)
        } finally {
          poll.inFlight = false
          poll.attempts += 1
          poll.nextAt = Date.now() + IMAGE_POLL_BACKOFF_MS[Math.min(poll.attempts, IMAGE_POLL_BACKOFF_MS.length - 1)]
        }
      }
      wakeRef.current?.()
    }
    const schedule = () => {
      if (!running) return
      clearTimer()
      const now = Date.now()
      const ids = new Set(nonTerminalJobIds(stateRef.current.map))
      for (const jobId of polls.keys()) if (!ids.has(jobId)) polls.delete(jobId)
      let earliest = Number.POSITIVE_INFINITY
      for (const jobId of ids) {
        let poll = polls.get(jobId)
        if (!poll) {
          poll = { attempts: 0, nextAt: now + IMAGE_POLL_BACKOFF_MS[0], inFlight: false }
          polls.set(jobId, poll)
        }
        if (!poll.inFlight) earliest = Math.min(earliest, poll.nextAt)
      }
      if (earliest === Number.POSITIVE_INFINITY) return
      pollTimerRef.current = window.setTimeout(() => { void tick() }, Math.max(0, earliest - now))
    }
    wakeRef.current = schedule
    schedule()
    return () => {
      running = false
      if (wakeRef.current === schedule) wakeRef.current = null
      clearTimer()
    }
  }, [active, commit, pendingKey, visible])

  // --- "starting" watchdog -------------------------------------------------
  const waiting = enabled ? scheduledWithoutJob(state.map) : []
  const waitingKey = waiting.map(({ messageId, scheduledAt }) => `${messageId}:${scheduledAt}`).join(',')
  const checkedRef = useRef(new Set<number>())

  useEffect(() => {
    if (!waitingKey) return
    const timers: number[] = []
    for (const { messageId, scheduledAt } of scheduledWithoutJob(stateRef.current.map)) {
      if (!checkedRef.current.has(messageId)) {
        timers.push(window.setTimeout(() => {
          checkedRef.current.add(messageId)
          void lookUpImages(messageId)
        }, Math.max(0, scheduledAt + IMAGE_START_CHECK_MS - Date.now())))
      }
      if (!stateRef.current.stalled.has(messageId)) {
        timers.push(window.setTimeout(() => {
          const current = stateRef.current
          if (!scheduledWithoutJob(current.map).some((entry) => entry.messageId === messageId)) return
          const stalled = new Set(current.stalled)
          stalled.add(messageId)
          commit({ stalled })
        }, Math.max(0, scheduledAt + IMAGE_START_STALL_MS - Date.now())))
      }
    }
    return () => { for (const timer of timers) window.clearTimeout(timer) }
  }, [commit, lookUpImages, waitingKey])

  return { views: state.views, supported, applyFrame, markScheduled, adoptHydrated, regenerate, select }
}

export function isChatImageBasePath(value: string): value is ChatImageBasePath {
  return value === 'adventure-sessions' || value === 'character-chats'
}

/** Reads a refused request into the failure the turn shows; error text is filtered by the store. */
function startFailureFromError(error: unknown, options: ChatImageRegenerateOptions): ChatImageStartFailure {
  const profile = {
    ...(options.imageProfileId ? { image_profile_id: options.imageProfileId } : {}),
    ...(options.provider ? { provider: options.provider } : {}),
  }
  if (error instanceof ApiError) {
    const code = (error.code || '').toLowerCase()
    const status = code.includes('quota') || error.category === 'quota' || error.status === 402
      ? 'quota_exceeded' as const
      : code === 'image_generation_disabled' ? 'unavailable' as const : 'failed' as const
    return { status, error: { category: error.category || 'request', detail: error.message, ...(code ? { code } : {}) }, ...profile }
  }
  if (error instanceof Error && error.message === 'IMAGE_CREDENTIAL_HTTPS_REQUIRED') {
    return { status: 'failed', error: { category: 'request', detail: error.message, code: 'image_credential_https_required' }, ...profile }
  }
  return { status: 'failed', error: { category: 'request', detail: 'Image generation failed.' }, ...profile }
}

function deriveViews(previous: ReadonlyMap<number, ChatTurnImagesView>, state: Omit<ImagesState, 'views'>): ReadonlyMap<number, ChatTurnImagesView> {
  const views = new Map<number, ChatTurnImagesView>()
  for (const [messageId, entry] of state.map) {
    const view = viewFor(messageId, entry, state.selection.get(messageId), state.stalled.has(messageId))
    const prior = previous.get(messageId)
    views.set(messageId, prior && sameView(prior, view) ? prior : view)
  }
  return views
}

function viewFor(messageId: number, entry: ChatMessageImages, picked: string | undefined, stalled: boolean): ChatTurnImagesView {
  const newest = entry.generations[entry.generations.length - 1]
  const selectedJobId = picked && entry.generations.some((generation) => generation.job_id === picked) ? picked : newest?.job_id ?? null
  return {
    messageId,
    generations: entry.generations,
    selectedJobId,
    scheduled: Boolean(entry.scheduled),
    stalled: stalled && Boolean(entry.scheduled),
    ...(entry.startFailure ? { startFailure: entry.startFailure } : {}),
  }
}

function sameView(left: ChatTurnImagesView, right: ChatTurnImagesView): boolean {
  return left.generations === right.generations && left.selectedJobId === right.selectedJobId
    && left.scheduled === right.scheduled && left.stalled === right.stalled && left.startFailure === right.startFailure
}

function without<T extends ReadonlyMap<number, unknown> | ReadonlySet<number>>(collection: T, key: number): T {
  if (!collection.has(key)) return collection
  const next = collection instanceof Map ? new Map(collection) : new Set(collection as ReadonlySet<number>)
  next.delete(key)
  return next as unknown as T
}
