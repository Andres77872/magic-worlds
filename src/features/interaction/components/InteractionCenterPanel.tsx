import {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {ChatNarratorIdentity, ChatResponseSegment, ChatSpeakerRosterEntry, ForwardOption, TurnEntry} from '../../../shared'
import {apiService, type ImageJobPublicResponse, type TtsJobPublicResponse} from '../../../infrastructure/api'
import {useAuth} from '../../../app/hooks'
import {ArrowDown, Loader2, RotateCcw, Sparkles} from 'lucide-react'
import {Button, Icon} from '../../../ui/primitives'
import {ConfirmDialog} from '@/ui/components'
import {ChatComposer} from './ChatComposer'
import {ChatTurn} from './ChatTurn'
import {useSessionLorebookEntries} from '@/features/lorebook'
import {generateUUID} from '../../../utils/uuid'
import type {ChatSessionConfig} from '../chatSessionConfig'
import {useAdventureChatSocket} from '../hooks/useAdventureChatSocket'
import {hasNonTerminalImageJob, mergeHydratedImageTurns, upsertChatImageFrame, upsertImageJobResult} from '../utils/chatImageTurnState'
import {hasNonTerminalTtsJob, mergeHydratedTtsTurns, nonTerminalTtsJobIds, upsertChatTtsFrame, upsertTtsJobResult} from '../utils/chatTtsTurnState'
import {mergeHydratedChatTurns} from '../utils/chatTurnMerge'
import {finalizeResponseSegments, resolveSegmentIdentity, segmentsToPlainText, streamingXmlToPlainText, streamingXmlToSegments} from '@/utils/chatSegments'

// Extend TurnEntry to include forward options and the (out-of-scope) image prompt
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    segments?: ChatResponseSegment[]
    isStreaming?: boolean
    narratorIdentity?: ChatNarratorIdentity | null
    imagePrompt?: string  // Text prompt for a future image-generation step (not rendered)
}

interface InteractionCenterPanelProps {
    /** Numeric session id (adventure_id or character-chat id). */
    sessionId: number
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
    /** Mode-specific wiring (canonical history endpoints, copy, forward options, basePath). */
    config: ChatSessionConfig
    /**
     * Known AI cast for the session (speaker_id = card id). Persisted segments only
     * carry speaker_id/speaker_name — portraits live in the transient `speakers`
     * frame — so without this seed, group-turn avatars vanish on hydration/reload.
     */
    speakerRoster?: ChatSpeakerRosterEntry[]
}

// Snapshot of an AI turn used to restore it if a regeneration fails.
interface TurnRestore {
    content: string
    forwardOptions?: ForwardOption[]
    segments?: ChatResponseSegment[]
    imagePrompt?: string
    assistantMessageId?: number
    turnId?: string
    imageJobId?: string
    imageStatus?: ExtendedTurnEntry['imageStatus']
    imageStatusUrl?: string
    imageResultUrl?: string
    imageAssets?: ExtendedTurnEntry['imageAssets']
    imageUrl?: string
    imageError?: ExtendedTurnEntry['imageError']
    ttsJobId?: string
    ttsStatus?: ExtendedTurnEntry['ttsStatus']
    ttsStatusUrl?: string
    ttsResultUrl?: string
    ttsAssets?: ExtendedTurnEntry['ttsAssets']
    ttsUrl?: string
    ttsError?: ExtendedTurnEntry['ttsError']
}

// Cleared TTS lifecycle fields, applied whenever an AI turn is (re)generated or
// edited so the new text never keeps the prior text's stale narration audio.
const RESET_TTS_FIELDS = {
    ttsJobId: undefined,
    ttsStatus: undefined,
    ttsStatusUrl: undefined,
    ttsResultUrl: undefined,
    ttsAssets: undefined,
    ttsUrl: undefined,
    ttsError: undefined,
} satisfies Partial<ExtendedTurnEntry>

// Image counterpart of RESET_TTS_FIELDS, for the same (re)generate/edit paths.
const RESET_IMAGE_FIELDS = {
    imageJobId: undefined,
    imageStatus: undefined,
    imageStatusUrl: undefined,
    imageResultUrl: undefined,
    imageAssets: undefined,
    imageUrl: undefined,
    imageError: undefined,
} satisfies Partial<ExtendedTurnEntry>

// Clear an optimistic `pending` that never received its `tts_job` ack (socket
// dropped right after the request, or the server rejected it while we were
// offline). Without this the speaker control spins forever: polling skips turns
// with no job id and hydration won't overwrite a non-terminal local status.
const TTS_PENDING_WATCHDOG_MS = 15_000
// Recover from a generation whose `done`/`error` frame never arrives (server
// stall, half-open or torn-down socket): without this the composer is stuck on
// "Stop" forever. Every streaming frame re-arms the timer, so it only measures
// silence — the window sits above the backend's 120s agent-graph timeout.
const GENERATION_WATCHDOG_MS = 130_000
// Stable request key per (assistantMessageId, turnId), stored server-side for
// tracing. Dedupe itself is content-hash based on the server (an in-flight or
// completed job for the same turn + text + voice is reused).
function ttsRequestId(assistantMessageId: number, turnId: string): string {
    return `tts-${assistantMessageId}-${turnId}`
}

function canonicalMessageId(turn?: TurnEntry | null): number | undefined {
    if (!turn) return undefined
    const direct = Number(turn.id)
    if (Number.isInteger(direct) && direct > 0) return direct
    if (turn.type === 'ai' && Number.isInteger(turn.assistantMessageId) && turn.assistantMessageId! > 0) {
        return turn.assistantMessageId
    }
    return undefined
}

export function InteractionCenterPanel({sessionId, turns, setTurns, config, speakerRoster}: InteractionCenterPanelProps) {
    const { t } = useTranslation()
    // Session-attached lorebook triggers: underline matching words in the composer and
    // transcript, Ctrl/Cmd-click to open the entry's floating card.
    const loreTargetKind = config.kind === 'adventure' ? 'adventure_session' : 'character_chat'
    const { matcher: loreMatcher } = useSessionLorebookEntries(
        loreTargetKind,
        Number.isNaN(sessionId) ? '' : String(sessionId),
    )
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { isAuthenticated, openLoginModal, token } = useAuth()
    // `retryable` marks errors from a failed generation, where the banner can
    // offer a one-tap retry (regenerate / answer the trailing user turn).
    const [errorState, setErrorState] = useState<{ message: string; retryable: boolean } | null>(null)
    const error = errorState?.message ?? null
    const errorRetryable = errorState?.retryable ?? false
    const setError = useCallback((message: string | null, retryable = false) => {
        setErrorState(message === null ? null : { message, retryable })
    }, [])
    const [pendingDeleteTurn, setPendingDeleteTurn] = useState<TurnEntry | null>(null)
    const [isDeletingTurn, setIsDeletingTurn] = useState(false)
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
    const [isClearingTurns, setIsClearingTurns] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    // Screen-reader announcement of the just-finished AI turn. Streaming mutates a
    // turn in place token-by-token, so the visual log can't be `aria-live` (it would
    // read every partial token); instead we announce the completed text once, here.
    const [liveAnnouncement, setLiveAnnouncement] = useState('')

    // Per-session "auto-narrate" toggle: when on, each finished AI turn auto-requests
    // TTS narration. Persisted so it survives remounts/reloads. Key prefix is namespaced
    // per kind so adventure id 7 and character-chat id 7 don't share a preference.
    const autoNarrateKey = `${config.autoNarrateKeyPrefix}${sessionId}`
    const [autoNarrate, setAutoNarrate] = useState<boolean>(() => {
        try {
            return localStorage.getItem(autoNarrateKey) === '1'
        } catch {
            return false
        }
    })
    // Refs let the long-lived socket callbacks read the latest turns and target
    // the in-flight AI turn without being recreated every render.
    const turnsRef = useRef<TurnEntry[]>(turns)
    const streamingIdRef = useRef<string | null>(null)
    const rawResponseRef = useRef('')
    // Speaker roster + narrator identity (seeded from the session cast, refreshed by
    // the `speakers` frame). Read inside the long-lived socket callbacks to resolve
    // speaker_id → name/portrait for live attribution, and on hydration to restore
    // portraits the persisted projection strips. Reset to the seed each generation.
    const speakerRosterRef = useRef(speakerRoster)
    useEffect(() => {
        speakerRosterRef.current = speakerRoster
    }, [speakerRoster])
    const seededRosterMap = useCallback(
        () => new Map((speakerRosterRef.current ?? []).map((entry) => [entry.speaker_id, entry] as const)),
        [],
    )
    const rosterRef = useRef<{ map: Map<string, ChatSpeakerRosterEntry>; narrator: ChatNarratorIdentity | null }>({
        map: seededRosterMap(),
        narrator: null,
    })
    const restoreRef = useRef<TurnRestore | null>(null)
    // Read by the long-lived socket `onDone` callback (which fires from a WS event,
    // not a render) so it always sees the latest toggle value.
    const autoNarrateRef = useRef(autoNarrate)
    useEffect(() => {
        autoNarrateRef.current = autoNarrate
        try {
            localStorage.setItem(autoNarrateKey, autoNarrate ? '1' : '0')
        } catch {
            // ignore storage failures (private mode / quota)
        }
    }, [autoNarrate, autoNarrateKey])
    // Stable composer-toolbar callbacks (memoized ChatComposer props).
    const handleToggleAutoNarrate = useCallback(() => setAutoNarrate((on) => !on), [])
    // "Stop" is only armed a frame after loading begins. React 19 commits the Send
    // click's setIsLoading synchronously, swapping Send → Stop under the cursor, so
    // without this the same click would land on Stop and cancel the turn it just
    // started (same class of phantom-click bug as the card-drawer footer).
    const stopArmedRef = useRef(false)
    // Pending-narration watchdog timers, keyed by assistantMessageId; cleared when
    // any TTS frame for that message arrives (see TTS_PENDING_WATCHDOG_MS).
    const ttsWatchdogsRef = useRef<Map<number, number>>(new Map())
    useEffect(() => {
        const watchdogs = ttsWatchdogsRef.current
        return () => {
            for (const timer of watchdogs.values()) window.clearTimeout(timer)
            watchdogs.clear()
        }
    }, [])

    // Keep the ref in sync with externally-driven turn changes (parent loads,
    // edits, deletes). Event handlers also set it inline before streaming so the
    // socket callbacks never read a stale list.
    useEffect(() => {
        turnsRef.current = turns
    }, [turns])

    useEffect(() => {
        if (!isLoading) {
            stopArmedRef.current = false
            return
        }
        const id = requestAnimationFrame(() => {
            stopArmedRef.current = true
        })
        return () => cancelAnimationFrame(id)
    }, [isLoading])

    const setTurnState = useCallback((next: TurnEntry[]) => {
        turnsRef.current = next
        setTurns(next)
    }, [setTurns])

    // Apply a mutation to the AI turn currently being streamed.
    const updateStreamingTurn = useCallback((mutate: (turn: ExtendedTurnEntry) => ExtendedTurnEntry) => {
        const id = streamingIdRef.current
        if (!id) return
        const next = turnsRef.current.map((t) => (t.id === id ? mutate(t as ExtendedTurnEntry) : t))
        setTurnState(next)
    }, [setTurnState])

    const generationWatchdogRef = useRef<number | null>(null)
    const clearGenerationWatchdog = useCallback(() => {
        if (generationWatchdogRef.current !== null) {
            window.clearTimeout(generationWatchdogRef.current)
            generationWatchdogRef.current = null
        }
    }, [])

    // Finalize the in-flight AI turn after a failure (server `error` frame or the
    // generation watchdog): restore the previous answer on a failed regeneration,
    // otherwise leave the turn empty so the regenerate affordance stays visible.
    const failStreamingTurn = useCallback((message: string) => {
        clearGenerationWatchdog()
        const id = streamingIdRef.current
        const restore = restoreRef.current
        const next = id
            ? turnsRef.current.map((t) => {
                if (t.id !== id) return t
                const entry = t as ExtendedTurnEntry
                if (restore && restore.content) {
                    return {
                        ...entry,
                        isStreaming: false,
                        content: restore.content,
                        forwardOptions: restore.forwardOptions,
                        segments: restore.segments,
                        imagePrompt: restore.imagePrompt,
                        assistantMessageId: restore.assistantMessageId,
                        turnId: restore.turnId,
                        imageJobId: restore.imageJobId,
                        imageStatus: restore.imageStatus,
                        imageStatusUrl: restore.imageStatusUrl,
                        imageResultUrl: restore.imageResultUrl,
                        imageAssets: restore.imageAssets,
                        imageUrl: restore.imageUrl,
                        imageError: restore.imageError,
                        ttsJobId: restore.ttsJobId,
                        ttsStatus: restore.ttsStatus,
                        ttsStatusUrl: restore.ttsStatusUrl,
                        ttsResultUrl: restore.ttsResultUrl,
                        ttsAssets: restore.ttsAssets,
                        ttsUrl: restore.ttsUrl,
                        ttsError: restore.ttsError,
                    }
                }
                return { ...entry, isStreaming: false, content: '' }
            })
            : turnsRef.current
        if (id) {
            setTurnState(next)
        }
        streamingIdRef.current = null
        rawResponseRef.current = ''
        restoreRef.current = null
        setIsLoading(false)
        setError(message, true)
    }, [clearGenerationWatchdog, setError, setTurnState])

    const armGenerationWatchdog = useCallback(() => {
        clearGenerationWatchdog()
        if (!streamingIdRef.current) return
        generationWatchdogRef.current = window.setTimeout(() => {
            generationWatchdogRef.current = null
            if (!streamingIdRef.current) return
            failStreamingTurn(t('interaction.center.generationTimeout'))
        }, GENERATION_WATCHDOG_MS)
    }, [clearGenerationWatchdog, failStreamingTurn, t])

    useEffect(() => clearGenerationWatchdog, [clearGenerationWatchdog])

    // Persisted segments only carry speaker_id/speaker_name (portraits are stripped
    // server-side), so hydrated AI turns re-resolve identity against the roster.
    const resolveTurnIdentities = useCallback((list: TurnEntry[]): TurnEntry[] => {
        const roster = rosterRef.current.map
        if (roster.size === 0) return list
        return list.map((turn) => {
            const entry = turn as ExtendedTurnEntry
            if (turn.type !== 'ai' || !entry.segments?.length) return turn
            return { ...entry, segments: resolveSegmentIdentity(entry.segments, roster) }
        })
    }, [])

    const hydrateTurnsFromApi = useCallback(async () => {
        if (!isAuthenticated || Number.isNaN(sessionId)) return
        // Never hydrate over an in-flight stream: the server projection can't
        // contain the streaming turn yet, so applying it would orphan
        // streamingIdRef and silently drop the rest of the generation.
        if (streamingIdRef.current) return
        try {
            const hydrated = await config.loadTurns(sessionId)
            // A generation may have started while the projection was loading
            // (rapid follow-up send) — that projection is stale; drop it.
            if (streamingIdRef.current) return
            // Hydration owns ordering/deletions, while the live stream may
            // temporarily be the only source with parsed response segments.
            const textMerged = mergeHydratedChatTurns(turnsRef.current, hydrated)
            // Fold image then TTS state in; both apply terminal-precedence merges
            // so a staler response can't clobber live socket state.
            const imageMerged = mergeHydratedImageTurns(turnsRef.current, textMerged)
            const next = resolveTurnIdentities(mergeHydratedTtsTurns(imageMerged, textMerged))
            setTurnState(next)
        } catch (err) {
            console.warn('Failed to hydrate chat media state:', err)
        }
    }, [config, isAuthenticated, resolveTurnIdentities, sessionId, setTurnState])

    const pollNonTerminalImageJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        const jobs = snapshot.filter(hasNonTerminalImageJob)
        for (const turn of jobs) {
            if (!turn.imageJobId) continue
            try {
                const result: ImageJobPublicResponse = await apiService.getImageJob(turn.imageJobId)
                const next = upsertImageJobResult(turnsRef.current, result)
                if (next !== turnsRef.current) {
                    setTurnState(next)
                }
            } catch (err) {
                console.warn('Failed to poll image job:', err)
            }
        }
    }, [setTurnState])

    const applyImageFrame = useCallback((frame: Parameters<typeof upsertChatImageFrame>[1]) => {
        const next = upsertChatImageFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            void pollNonTerminalImageJobs(next)
        }
    }, [pollNonTerminalImageJobs, setTurnState])

    const pollNonTerminalTtsJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        const jobs = snapshot.filter(hasNonTerminalTtsJob)
        for (const turn of jobs) {
            // A multi-voice turn has one job per clip; poll each non-terminal one.
            for (const jobId of nonTerminalTtsJobIds(turn)) {
                try {
                    const result: TtsJobPublicResponse = await apiService.getTtsJob(jobId)
                    const next = upsertTtsJobResult(turnsRef.current, result)
                    if (next !== turnsRef.current) {
                        setTurnState(next)
                    }
                } catch (err) {
                    console.warn('Failed to poll tts job:', err)
                }
            }
        }
    }, [setTurnState])

    const applyTtsFrame = useCallback((frame: Parameters<typeof upsertChatTtsFrame>[1]) => {
        if (frame.assistant_message_id) {
            const timer = ttsWatchdogsRef.current.get(frame.assistant_message_id)
            if (timer !== undefined) {
                window.clearTimeout(timer)
                ttsWatchdogsRef.current.delete(frame.assistant_message_id)
            }
        }
        // Failures are otherwise only visible in the speaker button's hover
        // tooltip — too quiet for auto-narrate, where nobody is watching it.
        if (frame.type === 'tts_failed') {
            setError(t('interaction.center.narrationFailed', { detail: frame.error?.detail || t('interaction.center.unknownError') }))
        }
        const next = upsertChatTtsFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            void pollNonTerminalTtsJobs(next)
        }
    }, [pollNonTerminalTtsJobs, setTurnState, t])

    // The conversation + all turn metadata stream over one per-session WebSocket.
    // Gate the connection behind auth (and a valid session id).
    const { status: socketStatus, sendChat, sendTts, cancel } = useAdventureChatSocket(
        isAuthenticated && token && !Number.isNaN(sessionId) ? sessionId : null,
        {
            onSpeakers: ({ roster, narrator }) => {
                // Live entries win over the seeded cast (fresher name/portrait),
                // but seeded speakers absent from the frame stay resolvable.
                const map = seededRosterMap()
                for (const entry of roster) map.set(entry.speaker_id, entry)
                rosterRef.current = { map, narrator: narrator ?? null }
                // Stamp narrator identity so ChatTurn's eyebrow + the live status line
                // can name the narrator (Game Master / scene-setting).
                updateStreamingTurn((t) => ({ ...t, narratorIdentity: narrator ?? null }))
            },
            onDelta: (content) => {
                armGenerationWatchdog()
                rawResponseRef.current += content
                const raw = rawResponseRef.current
                // Paint live per-speaker segments when the XML voice markup is present;
                // otherwise fall back to flattened prose (no regression). The
                // authoritative `segments` frame replaces these once the turn finishes.
                const { segments } = streamingXmlToSegments(raw)
                const plain = streamingXmlToPlainText(raw)
                if (segments.length) {
                    const resolved = resolveSegmentIdentity(segments, rosterRef.current.map)
                    updateStreamingTurn((t) => ({ ...t, segments: resolved, content: plain }))
                } else {
                    updateStreamingTurn((t) => ({ ...t, segments: undefined, content: plain }))
                }
            },
            onMetadata: ({ forwardOptions, imagePrompt }) => {
                updateStreamingTurn((t) => ({
                    ...t,
                    ...(forwardOptions !== undefined ? { forwardOptions } : {}),
                    ...(imagePrompt !== undefined ? { imagePrompt } : {}),
                }))
            },
            onSegments: ({ segments, displayText }) => {
                armGenerationWatchdog()
                const resolved = resolveSegmentIdentity(segments, rosterRef.current.map)
                const content = displayText?.trim() || segmentsToPlainText(resolved)
                updateStreamingTurn((t) => ({ ...t, segments: resolved, content: content || t.content }))
            },
            onDone: ({ userMessageId, assistantMessageId, turnId }) => {
                clearGenerationWatchdog()
                const id = streamingIdRef.current
                const streamingIndex = turnsRef.current.findIndex((turn) => turn.id === id)
                let userIndex = streamingIndex - 1
                while (userIndex >= 0 && turnsRef.current[userIndex].type !== 'user') {
                    userIndex--
                }
                const next = turnsRef.current.map((t, index) => {
                    if (t.id === id) {
                        const entry = t as ExtendedTurnEntry
                        return {
                            ...entry,
                            id: assistantMessageId ? String(assistantMessageId) : t.id,
                            isStreaming: false,
                            segments: finalizeResponseSegments(entry.segments),
                            assistantMessageId,
                            turnId,
                        }
                    }
                    if (userMessageId && index === userIndex && !canonicalMessageId(t)) {
                        return { ...t, id: String(userMessageId), turnId }
                    }
                    return t
                })
                setTurnState(next)
                // Announce the finished AI turn to assistive tech (once, on done).
                // The streaming turn's id is reassigned to the assistant message id
                // in `next`, so look it up by that — not the old streaming id.
                const finishedId = assistantMessageId ? String(assistantMessageId) : id
                const finished = next.find((turn) => turn.id === finishedId) as ExtendedTurnEntry | undefined
                const announceText = finished
                    ? finished.segments?.length
                        ? segmentsToPlainText(finished.segments)
                        : finished.content ?? ''
                    : ''
                if (announceText.trim()) setLiveAnnouncement(announceText.trim())
                streamingIdRef.current = null
                rawResponseRef.current = ''
                restoreRef.current = null
                setIsLoading(false)
                void hydrateTurnsFromApi()
                void pollNonTerminalImageJobs(next)
                // Auto-narrate: request TTS for the just-finished GM turn. The audio
                // streams back over the same socket; playback still needs a tap (see
                // TurnNarration) because WS callbacks have no user-gesture context.
                if (autoNarrateRef.current && assistantMessageId && turnId) {
                    sendTts(assistantMessageId, turnId, ttsRequestId(assistantMessageId, turnId))
                }
            },
            onImageJob: applyImageFrame,
            onImageComplete: applyImageFrame,
            onImageFailed: applyImageFrame,
            onTtsJob: applyTtsFrame,
            onTtsComplete: applyTtsFrame,
            onTtsFailed: applyTtsFrame,
            onError: (message) => {
                failStreamingTurn(message || t('interaction.center.generateFailed'))
            },
        },
        token,
        config.basePath
    )

    // Surface the connection state once a real connection has existed — the
    // socket also reports closed→connecting transiently on first mount, which
    // must not flash a "reconnecting" notice.
    const [hasEverConnected, setHasEverConnected] = useState(false)
    useEffect(() => {
        if (socketStatus === 'open') setHasEverConnected(true)
    }, [socketStatus])
    const isReconnecting = hasEverConnected && socketStatus !== 'open'

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
    }

    // Auto-scroll policy: follow the stream only while the reader is already at
    // (or near) the bottom, or right after they send/request something. A reader
    // who scrolled up to re-read must not be yanked down by every delta — they
    // get a floating "new messages" pill instead.
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const nearBottomRef = useRef(true)
    const forceScrollRef = useRef(false)
    const [hasNewBelow, setHasNewBelow] = useState(false)

    const handleMessagesScroll = () => {
        const el = scrollContainerRef.current
        if (!el) return
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        nearBottomRef.current = nearBottom
        if (nearBottom) setHasNewBelow(false)
    }

    const jumpToLatest = () => {
        nearBottomRef.current = true
        setHasNewBelow(false)
        scrollToBottom()
    }

    useEffect(() => {
        if (turns.length === 0) return
        if (forceScrollRef.current || nearBottomRef.current) {
            forceScrollRef.current = false
            scrollToBottom()
            return
        }
        setHasNewBelow(true)
    }, [turns])

    useEffect(() => {
        if (socketStatus === 'open') {
            void hydrateTurnsFromApi()
        }
    }, [hydrateTurnsFromApi, socketStatus])

    // The parent-seeded turns render before the first hydration, so attach
    // roster portraits to them once at mount (both callbacks are stable).
    useEffect(() => {
        if (!speakerRosterRef.current?.length) return
        setTurnState(resolveTurnIdentities(turnsRef.current))
    }, [resolveTurnIdentities, setTurnState])

    useEffect(() => {
        const hasImage = turns.some(hasNonTerminalImageJob)
        const hasTts = turns.some(hasNonTerminalTtsJob)
        if (!hasImage && !hasTts) return
        const timer = window.setInterval(() => {
            if (hasImage) void pollNonTerminalImageJobs()
            if (hasTts) void pollNonTerminalTtsJobs()
        }, 3_000)
        return () => window.clearInterval(timer)
    }, [pollNonTerminalImageJobs, pollNonTerminalTtsJobs, turns])

    useEffect(() => {
        const recover = () => {
            if (document.visibilityState === 'visible') {
                void hydrateTurnsFromApi()
            }
        }
        document.addEventListener('visibilitychange', recover)
        window.addEventListener('online', recover)
        return () => {
            document.removeEventListener('visibilitychange', recover)
            window.removeEventListener('online', recover)
        }
    }, [hydrateTurnsFromApi])

    // Check if we can generate an AI response (last message is from user)
    const isMutatingTurns = isDeletingTurn || isClearingTurns
    const canGenerateResponse = turns.length > 0 && turns[turns.length - 1].type === 'user' && !isLoading && !isMutatingTurns

    const handleReset = () => {
        if (isLoading || turnsRef.current.length === 0 || isMutatingTurns) return
        setResetConfirmOpen(true)
    }

    const confirmReset = async () => {
        if (isClearingTurns) return
        const previousTurns = turnsRef.current
        setIsClearingTurns(true)
        setTurnState([])
        setError(null)
        try {
            const canonicalTurns = await config.clearMessages(sessionId)
            setTurnState(canonicalTurns)
        } catch (error) {
            console.error('Failed to clear turns:', error)
            setTurnState(previousTurns)
            setError(t('interaction.center.clearFailed'))
        } finally {
            setIsClearingTurns(false)
            setResetConfirmOpen(false)
        }
    }

    const handleForwardOptionClick = useCallback((message: string) => {
        setInput(message)
    }, [])

    // Request (or retry) TTS narration for a finished GM turn. Optimistically marks
    // the turn pending so the speaker control shows a spinner before the first
    // `tts_job` frame arrives; the WS frames then drive the real lifecycle.
    const handleRequestNarration = useCallback((assistantMessageId?: number, turnId?: string) => {
        if (!assistantMessageId || !turnId) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        if (socketStatus !== 'open') {
            setError(t('interaction.center.narrationUnavailable'))
            return
        }
        sendTts(assistantMessageId, turnId, ttsRequestId(assistantMessageId, turnId))
        let changed = false
        const next = turnsRef.current.map((t) => {
            const entry = t as ExtendedTurnEntry
            const matches = entry.assistantMessageId === assistantMessageId || entry.turnId === turnId
            if (!matches || entry.ttsUrl || hasNonTerminalTtsJob(entry)) return t
            changed = true
            return { ...entry, ttsStatus: 'pending' as const, ttsError: undefined }
        })
        if (changed) setTurnState(next)
        // Arm the ack watchdog: if no tts_job/tts_failed frame names this message
        // within the window, roll the optimistic `pending` back to idle.
        const watchdogs = ttsWatchdogsRef.current
        const existing = watchdogs.get(assistantMessageId)
        if (existing !== undefined) window.clearTimeout(existing)
        watchdogs.set(assistantMessageId, window.setTimeout(() => {
            watchdogs.delete(assistantMessageId)
            let rolledBack = false
            const recovered = turnsRef.current.map((t) => {
                const entry = t as ExtendedTurnEntry
                if (entry.assistantMessageId !== assistantMessageId) return t
                if (entry.ttsJobId || entry.ttsStatus !== 'pending') return t
                rolledBack = true
                return { ...entry, ttsStatus: undefined }
            })
            if (rolledBack) setTurnState(recovered)
        }, TTS_PENDING_WATCHDOG_MS))
    }, [isAuthenticated, openLoginModal, sendTts, setTurnState, socketStatus, t])

    // Put the targeted AI turn into a clean streaming state and request a
    // generation over the socket. `history` is everything before that AI turn.
    const startGeneration = (history: TurnEntry[], aiTurn: ExtendedTurnEntry, restore?: TurnRestore) => {
        if (Number.isNaN(sessionId)) {
            setError(t('interaction.center.invalidSession'))
            setIsLoading(false)
            return
        }

        streamingIdRef.current = aiTurn.id
        rawResponseRef.current = ''
        rosterRef.current = { map: seededRosterMap(), narrator: null }
        restoreRef.current = restore ?? null

        const streamingTurns = turnsRef.current.map((t) =>
            t.id === aiTurn.id
                ? {
                    ...(t as ExtendedTurnEntry),
                    isStreaming: true,
                    content: '',
                    forwardOptions: undefined,
                    segments: undefined,
                    narratorIdentity: undefined,
                    imagePrompt: undefined,
                    assistantMessageId: undefined,
                    turnId: undefined,
                    ...RESET_IMAGE_FIELDS,
                    ...RESET_TTS_FIELDS,
                }
                : t
        )
        setTurnState(streamingTurns)

        // The server owns the durable history and prompt construction. A chat
        // request therefore carries only the latest user input.
        const content = [...history].reverse().find((turn) => turn.type === 'user')?.content.trim()
        if (!content) {
            failStreamingTurn(t('interaction.center.generateFailed'))
            return
        }
        sendChat(content)
        armGenerationWatchdog()
    }

    // Ref mirror so stable callbacks (regenerate) always invoke the latest
    // closure without depending on its (render-scoped) identity.
    const startGenerationRef = useRef(startGeneration)
    useEffect(() => {
        startGenerationRef.current = startGeneration
    })

    const handleRegenerateResponse = useCallback(async (turnId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }

        // Snapshot via ref: this callback stays stable across renders (memoized
        // ChatTurn prop) yet always operates on the latest turn list.
        const currentTurns = turnsRef.current
        const turnIndex = currentTurns.findIndex((turn) => turn.id === turnId)
        if (turnIndex === -1) return

        // Find the last user message before this AI response
        let userMessageIndex = turnIndex - 1
        while (userMessageIndex >= 0 && currentTurns[userMessageIndex].type !== 'user') {
            userMessageIndex--
        }
        if (userMessageIndex < 0) return // No user message found

        const existingAiTurn = currentTurns[turnIndex] as ExtendedTurnEntry
        const restore: TurnRestore = {
            content: existingAiTurn.content,
            forwardOptions: existingAiTurn.forwardOptions,
            segments: existingAiTurn.segments,
            imagePrompt: existingAiTurn.imagePrompt,
            assistantMessageId: existingAiTurn.assistantMessageId,
            turnId: existingAiTurn.turnId,
            imageJobId: existingAiTurn.imageJobId,
            imageStatus: existingAiTurn.imageStatus,
            imageStatusUrl: existingAiTurn.imageStatusUrl,
            imageResultUrl: existingAiTurn.imageResultUrl,
            imageAssets: existingAiTurn.imageAssets,
            imageUrl: existingAiTurn.imageUrl,
            imageError: existingAiTurn.imageError,
            ttsJobId: existingAiTurn.ttsJobId,
            ttsStatus: existingAiTurn.ttsStatus,
            ttsStatusUrl: existingAiTurn.ttsStatusUrl,
            ttsResultUrl: existingAiTurn.ttsResultUrl,
            ttsAssets: existingAiTurn.ttsAssets,
            ttsUrl: existingAiTurn.ttsUrl,
            ttsError: existingAiTurn.ttsError,
        }

        // Drop any subsequent turns but keep (and reset) the AI turn we regenerate.
        const truncatedTurns = currentTurns.slice(0, turnIndex + 1)
        const resetAiTurn: ExtendedTurnEntry = {
            ...existingAiTurn,
            content: '',
            isStreaming: true,
            forwardOptions: undefined,
            segments: undefined,
            imagePrompt: undefined,
            assistantMessageId: undefined,
            turnId: undefined,
            ...RESET_IMAGE_FIELDS,
            ...RESET_TTS_FIELDS,
        }
        const updatedTurns = [...truncatedTurns.slice(0, -1), resetAiTurn]
        setTurnState(updatedTurns)
        setIsLoading(true)
        setError(null)
        // Every generation appends a fresh canonical assistant row, so the
        // replaced reply (and any canonical turns after it) must be deleted
        // first — otherwise post-done hydration resurrects the old answer
        // next to a duplicated user bubble.
        const replacedIds = [existingAiTurn, ...currentTurns.slice(turnIndex + 1)]
            .map((turn) => canonicalMessageId(turn))
            .filter((id): id is number => id !== undefined)
        try {
            for (const id of replacedIds) {
                await config.deleteMessage(sessionId, id)
            }
        } catch (err) {
            console.error('Failed to delete replaced turns before regenerating:', err)
            setTurnState(currentTurns)
            setIsLoading(false)
            setError(t('interaction.center.generateFailed'), true)
            return
        }
        startGenerationRef.current(updatedTurns.slice(0, -1), resetAiTurn, restore)
    }, [config, isAuthenticated, openLoginModal, sessionId, setError, setTurnState, t])

    const handleDeleteTurn = useCallback((turnId: string) => {
        if (isMutatingTurns) return
        const target = turnsRef.current.find((turn) => turn.id === turnId)
        if (target) setPendingDeleteTurn(target)
    }, [isMutatingTurns])

    const confirmDeleteTurn = async () => {
        if (!pendingDeleteTurn || isDeletingTurn) return
        const previousTurns = turnsRef.current
        const target = previousTurns.find((turn) => turn.id === pendingDeleteTurn.id)
        if (!target) {
            setPendingDeleteTurn(null)
            return
        }

        setIsDeletingTurn(true)
        try {
            const updatedTurns = previousTurns.filter((turn) => turn.id !== pendingDeleteTurn.id)
            setTurnState(updatedTurns)
            setError(null)

            const messageId = canonicalMessageId(target)
            if (messageId) {
                const canonicalTurns = await config.deleteMessage(sessionId, messageId)
                setTurnState(canonicalTurns)
            }
        } catch (error) {
            console.error('Failed to delete turn:', error)
            setTurnState(previousTurns)
            setError(t('interaction.center.deleteFailed'))
        } finally {
            setIsDeletingTurn(false)
            setPendingDeleteTurn(null)
        }
    }

    // Stable per-turn delete-confirmation callbacks (memoized ChatTurn props).
    const confirmDeleteTurnRef = useRef(confirmDeleteTurn)
    useEffect(() => {
        confirmDeleteTurnRef.current = confirmDeleteTurn
    })
    const handleConfirmDeleteTurn = useCallback(() => {
        void confirmDeleteTurnRef.current()
    }, [])
    const handleCancelDeleteTurn = useCallback(() => setPendingDeleteTurn(null), [])

    const handleEditTurn = useCallback(async (turnId: string, newContent: string) => {
        const previousTurns = turnsRef.current
        const updatedTurns = turnsRef.current.map((turn) => {
            if (turn.id !== turnId) return turn
            const edited = { ...turn, content: newContent, timestamp: new Date().toISOString() }
            // Drop media generated from the prior assistant text so stale assets
            // are never replayed while the canonical edit is in flight.
            return turn.type === 'ai' ? { ...edited, segments: undefined, ...RESET_IMAGE_FIELDS, ...RESET_TTS_FIELDS } : edited
        })
        setTurnState(updatedTurns)
        const target = previousTurns.find((turn) => turn.id === turnId)
        const messageId = canonicalMessageId(target)
        if (!messageId) return
        try {
            const canonicalTurns = await config.updateMessage(sessionId, messageId, newContent)
            setTurnState(canonicalTurns)
        } catch (error) {
            console.error('Failed to edit turn:', error)
            setTurnState(previousTurns)
            setError(t('interaction.center.editFailed'))
        }
    }, [config, sessionId, setError, setTurnState, t])

    const handleGenerateResponse = () => {
        if (!canGenerateResponse) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }

        const aiTurn: ExtendedTurnEntry = {
            id: generateUUID(),
            type: 'ai',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: false,
            forwardOptions: undefined,
            segments: undefined,
        }
        const newTurns = [...turns, aiTurn]
        forceScrollRef.current = true
        setTurnState(newTurns)
        setIsLoading(true)
        setError(null)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    // Retry from the error banner: regenerate the trailing (empty or restored)
    // AI turn, or answer a trailing user turn.
    const handleRetryGeneration = () => {
        if (isLoading || isMutatingTurns) return
        const last = turnsRef.current[turnsRef.current.length - 1]
        if (!last) return
        setError(null)
        if (last.type === 'user') {
            handleGenerateResponse()
        } else if (last.type === 'ai') {
            handleRegenerateResponse(last.id)
        }
    }

    const handleSubmit = () => {
        if (!input.trim() || isLoading || isMutatingTurns) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }

        const userInput = input.trim()
        const userTurn: TurnEntry = {
            id: generateUUID(),
            type: 'user',
            content: userInput,
            timestamp: new Date().toISOString(),
        }

        // Reuse a trailing empty AI turn left over from a previous error.
        const lastTurn = turns[turns.length - 1] as ExtendedTurnEntry
        const hasEmptyAiTurn = lastTurn && lastTurn.type === 'ai' && lastTurn.content === ''

        let newTurns: TurnEntry[]
        let aiTurn: ExtendedTurnEntry
        if (hasEmptyAiTurn) {
            newTurns = [...turns.slice(0, -1), userTurn, lastTurn]
            aiTurn = lastTurn
        } else {
            aiTurn = {
                id: generateUUID(),
                type: 'ai',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: false,
                forwardOptions: undefined,
                segments: undefined,
            }
            newTurns = [...turns, userTurn, aiTurn]
        }

        forceScrollRef.current = true
        setTurnState(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    const handleStop = () => {
        if (!stopArmedRef.current) return
        cancel()
        // With no open socket the cancel can't reach the server and no `done`
        // will ever arrive for this stream — recover the composer right away
        // instead of leaving the user to wait out the generation watchdog.
        if (socketStatus !== 'open' && streamingIdRef.current) {
            failStreamingTurn(t('interaction.center.generateFailed'))
        }
    }

    return (
        <div className="flex h-full flex-col bg-ink-800">
            {/* Polite live region: announces each completed AI turn once to screen readers. */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveAnnouncement}
            </div>
            {error && (
                <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-2 text-[14px] text-blood-500">
                    <span>{error}</span>
                    <div className="flex shrink-0 items-center gap-2">
                        {errorRetryable && !isLoading && !isMutatingTurns && turns.length > 0 && (
                            <Button
                                size="sm"
                                variant="primary"
                                iconLeft={<RotateCcw size={13} />}
                                onClick={handleRetryGeneration}
                            >
                                {t('interaction.center.retry')}
                            </Button>
                        )}
                        <button
                            onClick={() => setError(null)}
                            className="text-lg leading-none text-blood-500/80 hover:text-blood-500"
                            aria-label={t('interaction.center.closeError')}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[760px] px-4 py-6 md:px-6">
                    {turns.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 py-16 text-center">
                            <h3 className="font-display text-[28px] font-semibold text-parchment-50">
                                {config.copy.emptyTitle}
                            </h3>
                            <p className="max-w-md font-narrative text-[17px] leading-relaxed text-parchment-200">
                                {config.copy.emptyBody}
                            </p>
                            <div className="mt-2 flex items-center gap-2 rounded-full border border-parchment-50/10 bg-ink-700 px-4 py-2 text-[13px] text-parchment-400">
                                <Sparkles size={15} className="text-arcane-300" />
                                <span>{config.copy.emptyHint}</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {turns.map((turn: ExtendedTurnEntry) => {
                                const isDeleteTarget = pendingDeleteTurn?.id === turn.id
                                return (
                                    <ChatTurn
                                        key={turn.id}
                                        turn={turn}
                                        aiLabel={config.aiLabel}
                                        showForwardOptions={config.showForwardOptions}
                                        showImage={config.showImages}
                                        onForwardOptionClick={handleForwardOptionClick}
                                        onRegenerateClick={handleRegenerateResponse}
                                        onDeleteClick={handleDeleteTurn}
                                        onConfirmDeleteClick={handleConfirmDeleteTurn}
                                        onCancelDeleteClick={handleCancelDeleteTurn}
                                        onEditClick={handleEditTurn}
                                        onRequestNarration={handleRequestNarration}
                                        confirmingDelete={isDeleteTarget}
                                        deleting={isDeleteTarget && isDeletingTurn}
                                        actionsDisabled={isLoading || isClearingTurns || (isDeletingTurn && !isDeleteTarget)}
                                        loreMatcher={loreMatcher}
                                    />
                                )
                            })}
                            {canGenerateResponse && (
                                <div className="my-4 flex items-center gap-3 rounded-xl border border-parchment-50/10 bg-ink-700 p-4">
                                    <Sparkles size={18} className="shrink-0 text-arcane-300" />
                                    <div className="flex flex-1 flex-col">
                                        <span className="text-[14px] font-semibold text-parchment-50">
                                            {config.copy.waitingTitle}
                                        </span>
                                        <span className="text-[13px] text-parchment-400">
                                            {config.copy.waitingHint}
                                        </span>
                                    </div>
                                    <Button
                                        onClick={handleGenerateResponse}
                                        disabled={isLoading}
                                        iconLeft={isLoading ? <Loader2 size={16} className="animate-spin" /> : undefined}
                                    >
                                        {isLoading ? t('interaction.center.generating') : t('interaction.center.generateResponse')}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            {hasNewBelow && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="pointer-events-auto bg-ink-700/95 shadow-md backdrop-blur-sm"
                        iconLeft={<ArrowDown size={14} />}
                        onClick={jumpToLatest}
                    >
                        {t('interaction.center.newMessages')}
                    </Button>
                </div>
            )}
            </div>

            <div className="border-t border-parchment-50/10 bg-ink-900/40 backdrop-blur-md">
                <ChatComposer
                    value={input}
                    onValueChange={setInput}
                    onSubmit={handleSubmit}
                    onStop={handleStop}
                    isLoading={isLoading}
                    isMutating={isMutatingTurns}
                    autoNarrate={autoNarrate}
                    onToggleAutoNarrate={handleToggleAutoNarrate}
                    onReset={handleReset}
                    canReset={turns.length > 0}
                    placeholder={config.copy.placeholder}
                    loreMatcher={loreMatcher}
                />
                {isLoading && (
                    <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 pb-3 text-[13px] text-arcane-300 md:px-6">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{config.copy.loadingHint}</span>
                    </div>
                )}
                {isReconnecting && (
                    <div
                        role="status"
                        className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 pb-3 text-[13px] text-parchment-400 md:px-6"
                    >
                        <Loader2 size={14} className="animate-spin" />
                        <span>{t('interaction.center.reconnecting')}</span>
                    </div>
                )}
            </div>

            <ConfirmDialog
                visible={resetConfirmOpen}
                title={t('interaction.center.resetTitle')}
                icon={<Icon icon={RotateCcw} size={21} className="text-blood-500" />}
                message={
                    <div className="flex flex-col gap-3">
                        <p>{config.copy.resetConfirm}</p>
                        <p className="text-parchment-400">{t('interaction.center.resetBody')}</p>
                    </div>
                }
                confirmLabel={t('interaction.center.resetTitle')}
                cancelLabel={t('interaction.center.resetCancel')}
                variant="danger"
                isProcessing={isClearingTurns}
                processingLabel={t('interaction.center.clearing')}
                onConfirm={() => void confirmReset()}
                onCancel={() => setResetConfirmOpen(false)}
            />
        </div>
    )
}
