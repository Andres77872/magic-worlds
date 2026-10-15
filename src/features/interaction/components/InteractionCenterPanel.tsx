import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { frameBatch } from '@/utils/frameBatch'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {ChatNarratorIdentity, ChatResponseSegment, ChatSpeakerRosterEntry, ForwardOption, TurnEntry} from '../../../shared'
import type {ImageJobPublicResponse, TtsJobPublicResponse} from '../../../infrastructure/api'
import {useAuth, useData} from '../../../app/hooks'
import {useWorkspace} from '@/app/hooks/useWorkspace'
import {isPageFocused, usePageFocus} from '@/app/hooks/usePageFocus'
import {Archive, ArrowDown, Eraser, Loader2, PauseCircle, RotateCcw, Sparkles, VolumeX, X} from 'lucide-react'
import {Button, Callout, Icon, IconButton} from '../../../ui/primitives'
import {ConfirmDialog} from '@/ui/components'
import {ChatComposer} from './ChatComposer'
import {ChatTurn} from './ChatTurn'
import type {VoiceRefreshTarget} from './NarrationVoiceNotes'
import {UnsavedReplyNotice} from './UnsavedReplyNotice'
import {useSessionLorebookEntries} from '@/features/lorebook'
import {generateUUID} from '../../../utils/uuid'
import type {ChatSessionConfig} from '../chatSessionConfig'
import {useAdventureChatSocket, type AdventureChatSocketErrorDetail} from '../hooks/useAdventureChatSocket'
import { authSession } from '@/infrastructure/api/authSession'
import {hasNonTerminalImageJob, mergeHydratedImageTurns, upsertChatImageFrame, upsertImageJobResult} from '../utils/chatImageTurnState'
import {hasNonTerminalTtsJob, mergeHydratedTtsTurns, nonTerminalTtsJobIds, upsertChatTtsFrame, upsertTtsJobResult} from '../utils/chatTtsTurnState'
import {mergeHydratedChatTurns} from '../utils/chatTurnMerge'
import {isUnsavedReply, lastUserIndex, latestExchangeReply, transcriptItems, unsavedReplyReason} from '../utils/chatTurnVisibility'
import {finalizeResponseSegments, resolveSegmentIdentity, segmentsToPlainText, streamingXmlToPlainText, streamingXmlToSegments} from '@/utils/chatSegments'
import { scrollBehavior } from '@/utils/motion'
import type { LlmFeature } from '@/shared/types/llm.types'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { llmRecoveryMessage } from '@/features/llmProfiles/llmRecovery'
import { isLlmRequestSpent } from '@/infrastructure/api/llmIntent'
import { chatWorkspaceErrorMessage } from '../utils/chatWorkspaceErrors'
import { narrationErrorKey } from '../utils/narrationQueue'
import { useAttestation } from '@/features/legal/attestation/attestationContext'
import { useNarrationAllowance } from '../hooks/useNarrationAllowance'
import { useAutoNarrationPause } from '../hooks/useAutoNarrationPause'
import { useVoiceAvailability } from '../hooks/useVoiceAvailability'
import { useVoiceCapabilitiesSnapshot } from '../hooks/useVoiceCapabilitiesSnapshot'
import { NarrationAllowanceNote } from './NarrationAllowanceNote'
import { BreakNudge, SafetyPauseNotice, useSafetyPause } from '@/features/safety'
import { readSafeguards } from '@/shared/voice/voiceCapabilities'

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
    /** Resolve a local draft only after a non-empty message is submitted. */
    ensureSession?: () => Promise<number>
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
    /** Mode-specific wiring (stored history endpoints, copy, forward options, basePath). */
    config: ChatSessionConfig
    llmFeature?: LlmFeature
    /**
     * Known AI cast for the session (speaker_id = card id). Persisted segments only
     * carry speaker_id/speaker_name — portraits live in the transient `speakers`
     * frame — so without this seed, group-turn avatars vanish on hydration/reload.
     */
    speakerRoster?: ChatSpeakerRosterEntry[]
    /**
     * Opens the narrator voice picker (adventures only). The "Voice replaced"
     * note on a narrator clip calls it, because the narrator is edited through
     * the template snapshot rather than refreshed (R1-FE-04, ER-G1).
     */
    onEditNarratorVoice?: () => void
    /**
     * A group character chat: the chat voice refresh (EP-2) serves 1:1 chats
     * only, so "Voice replaced" offers no refresh here.
     */
    isGroupChat?: boolean
}

interface ChatAttempt {
    requestId: string
    content: string
    existingUserMessageId?: number
    aiTurnId: string
    accountKey: string
    sessionKey: string
    target?: AdventureChatSocketErrorDetail['llmRetry']
    /** Set once the hook confirmed the request is spent: a retry starts a fresh reply. */
    llmRetry?: AdventureChatSocketErrorDetail['llmRetry']
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

// A reply that never became part of the conversation: the server stores failed
// and stopped replies empty and keeps them out of the model's context, so the
// streamed text is dropped and the turn renders as a notice, not a message.
function unsavedReply(turn: ExtendedTurnEntry, category?: 'cancelled'): ExtendedTurnEntry {
    return {
        ...turn,
        isStreaming: false,
        content: '',
        segments: undefined,
        forwardOptions: undefined,
        imagePrompt: undefined,
        narratorIdentity: undefined,
        metadata: { ...turn.metadata, interrupted: true, ...(category ? { error_category: category } : {}) },
    }
}

// Mirror the server's version bookkeeping: one stored reply per player message
// is active, the rest are kept as inactive versions.
function withVersionState(turn: TurnEntry, inactive: boolean): TurnEntry {
    const metadata = { ...turn.metadata }
    delete metadata.inactive_variant
    if (inactive) metadata.inactive_variant = true
    return { ...turn, metadata }
}

function storedMessageId(turn?: TurnEntry | null): number | undefined {
    if (!turn) return undefined
    const direct = Number(turn.id)
    if (Number.isInteger(direct) && direct > 0) return direct
    if (turn.type === 'ai' && Number.isInteger(turn.assistantMessageId) && turn.assistantMessageId! > 0) {
        return turn.assistantMessageId
    }
    return undefined
}

export function InteractionCenterPanel({sessionId: initialSessionId, ensureSession, turns, setTurns, config, speakerRoster, llmFeature, onEditNarratorVoice, isGroupChat = false}: InteractionCenterPanelProps) {
    const { t } = useTranslation()
    const voicesEnabled = isVoicesFeatureEnabled()
    const [createdSessionId, setCreatedSessionId] = useState<number | null>(null)
    const sessionId = createdSessionId ?? initialSessionId
    const firstMessageRef = useRef<string | null>(null)
    const creatingSessionRef = useRef<{ stopped: boolean } | null>(null)
    // Session-attached lorebook triggers: underline matching words in the composer and
    // transcript, Ctrl/Cmd-click to open the entry's floating card.
    const loreTargetKind = config.kind === 'adventure' ? 'adventure_session' : 'character_chat'
    const { matcher: loreMatcher } = useSessionLorebookEntries(
        loreTargetKind,
        Number.isNaN(sessionId) ? '' : String(sessionId),
        config.workspaceId,
    )
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { isAuthenticated, openLoginModal, token } = useAuth()
    const pageFocused = usePageFocus()
    // Workspace R1: every request of this session rides `config.api` (the session's
    // own workspace). Live refreshes (hydration, media polls) only run while that
    // workspace is the committed one; after a switch their results are dropped.
    const { selectedWorkspaceId, workspaces } = useWorkspace()
    const sessionActive = config.workspaceId === selectedWorkspaceId
    // Workspace R1: an archived workspace (or a session the server no longer
    // finds there) leaves the conversation readable but not writable. The notice
    // belongs to this session in this workspace, so another one never inherits it.
    const workspaceNoticeKey = `${config.workspaceId}:${sessionId}`
    const [reportedNotice, setReportedNotice] = useState<{ key: string; message: string } | null>(null)
    const sessionWorkspaceArchived = Boolean(workspaces.find((workspace) => workspace.id === config.workspaceId)?.archived_at)
    const workspaceNotice = reportedNotice?.key === workspaceNoticeKey
        ? reportedNotice.message
        : sessionWorkspaceArchived ? t('workspaceActivity.chat.workspaceArchived') : null
    const readOnly = workspaceNotice !== null
    const sessionActiveRef = useRef(sessionActive)
    useEffect(() => {
        sessionActiveRef.current = sessionActive
    }, [sessionActive])
    // Read by the socket `onDone` callback: a read-only session never auto-narrates.
    const readOnlyRef = useRef(readOnly)
    useEffect(() => {
        readOnlyRef.current = readOnly
    }, [readOnly])
    // `generation` errors belong to the reply at the tail and render inline in its
    // notice; `retryable` ones offer a one-tap retry there. Everything else
    // (edit, delete, clear, narration) uses the banner.
    const [errorState, setErrorState] = useState<{ message: string; retryable: boolean; generation: boolean } | null>(null)
    const setError = useCallback((message: string | null, retryable = false, generation = retryable) => {
        setErrorState(message === null ? null : { message, retryable, generation })
    }, [])
    const [pendingDeleteTurn, setPendingDeleteTurn] = useState<TurnEntry | null>(null)
    const [isDeletingTurn, setIsDeletingTurn] = useState(false)
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
    const [isClearingTurns, setIsClearingTurns] = useState(false)
    const [isSwitchingVersion, setIsSwitchingVersion] = useState(false)
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
            return voicesEnabled && localStorage.getItem(autoNarrateKey) === '1'
        } catch {
            return false
        }
    })
    // Refs let the long-lived socket callbacks read the latest turns and target
    // the in-flight AI turn without being recreated every render.
    const turnsRef = useRef<TurnEntry[]>(turns)
    const streamingIdRef = useRef<string | null>(null)
    const rawResponseRef = useRef('')
    const recoveryRef = useRef<{ assistantMessageId?: number; turnId?: string; requestId?: string; until: number } | null>(null)
    // The last request this panel sent, kept until it settles so Retry can resume
    // it by the same request ID (and frame) instead of running the turn twice.
    const attemptRef = useRef<ChatAttempt | null>(null)
    const retryLookupRef = useRef<AbortController | null>(null)
    const mountedRef = useRef(true)
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; retryLookupRef.current?.abort() } }, [])
    const deltaBatchRef = useRef<ReturnType<typeof frameBatch<string>> | null>(null)
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
    // A regeneration between its server sync and its socket request. Stop flags
    // it; hydration waits for it so the optimistic reply slot isn't dropped.
    const regeneratingRef = useRef<{ stopped: boolean } | null>(null)
    // Read by the long-lived socket `onDone` callback (which fires from a WS event,
    // not a render) so it always sees the latest toggle value.
    const autoNarrateRef = useRef(autoNarrate)
    useEffect(() => {
        autoNarrateRef.current = voicesEnabled && autoNarrate
        if (!voicesEnabled) return
        try {
            localStorage.setItem(autoNarrateKey, autoNarrate ? '1' : '0')
        } catch {
            // ignore storage failures (private mode / quota)
        }
    }, [autoNarrate, autoNarrateKey, voicesEnabled])
    // Stable composer-toolbar callbacks (memoized ChatComposer props).
    const handleToggleAutoNarrate = useCallback(() => {
        if (isVoicesFeatureEnabled()) setAutoNarrate((on) => !on)
    }, [])
    // Today's narration allowance (D24), read only once narration is in use here.
    const [narrationRequested, setNarrationRequested] = useState(false)
    const narrationAllowance = useNarrationAllowance(config.api, turns, voicesEnabled && isAuthenticated && (autoNarrate || narrationRequested))
    // D37: the server can pause auto-narration (budget circuit, operator). Auto sends stop and a
    // notice shows; manual play is untouched (09 §4.5).
    const autoNarrationPause = useAutoNarrationPause(config.api, voicesEnabled && isAuthenticated && autoNarrate && !readOnly, turns.length)
    // Companion safeguards (EP-11): always sent; all off when the read fails or is pending.
    const voiceCapabilities = useVoiceCapabilitiesSnapshot(config.api, voicesEnabled && isAuthenticated && !readOnly, turns.length)
    // R2-BE-01 (ER-H1): the chat socket's `voice_safety_notice` pauses voice. While
    // paused, narration controls are disabled and nothing new is requested; the
    // notice modal shows until dismissed. A pause the server already reports (`safeguards.paused_until`) seeds it without
    // reopening the notice; readSafeguards(null) is SAFEGUARDS_OFF, so no seed.
    const safetyPause = useSafetyPause(readSafeguards(voiceCapabilities).paused_until)
    // 09 §7 (I-12, D37): narration switched off for this account (`capabilities.status`,
    // fail open). Narrate buttons are disabled with copy and nothing new is requested,
    // auto or manual; stored clips still play. The server reports an active safety pause
    // as switched off too, so the reading is refreshed when the pause starts or ends.
    const narrationUnavailable = !useVoiceAvailability(
        config.api,
        voicesEnabled && isAuthenticated && !readOnly,
        `${turns.length}:${safetyPause.isPaused}`,
    ).narration_available
    const narrationBlocked = !voicesEnabled || narrationUnavailable || safetyPause.isPaused
    // R1-FE-04: "Voice replaced" actions on narrated turns. Refreshes ride the session's
    // client and store the returned DTO through DataProvider; they are offered disabled
    // while read-only, while a reply streams, and until the capabilities read succeeds.
    const { refreshAdventureVoices, refreshCharacterChatVoice } = useData()
    const refreshVoiceDisabled = readOnly || isLoading || !voiceCapabilities
    const handleRefreshVoice = useMemo(() => {
        if (!voicesEnabled || Number.isNaN(sessionId)) return undefined
        if (config.kind === 'adventure' && typeof refreshAdventureVoices === 'function') {
            // A targeted refresh sends the clip's speaker card (R-30).
            return (target: VoiceRefreshTarget) => refreshAdventureVoices(String(sessionId), target.cardId ? [target.cardId] : null, config.api)
        }
        if (config.kind === 'character' && !isGroupChat && typeof refreshCharacterChatVoice === 'function') {
            return () => refreshCharacterChatVoice(String(sessionId), config.api)
        }
        return undefined
    }, [config.api, config.kind, isGroupChat, refreshAdventureVoices, refreshCharacterChatVoice, sessionId, voicesEnabled])
    // The break nudge counts time while narration plays here (13 §2.7): the turns
    // report each playing stretch.
    const playingTurnsRef = useRef(new Set<string>())
    const [narrationPlaying, setNarrationPlaying] = useState(false)
    const handleNarrationPlayingChange = useCallback((turnId: string, playing: boolean) => {
        if (playing) playingTurnsRef.current.add(turnId)
        else playingTurnsRef.current.delete(turnId)
        setNarrationPlaying(playingTurnsRef.current.size > 0)
    }, [])
    const autoPausedRef = useRef(autoNarrationPause.paused || narrationBlocked)
    useEffect(() => {
        autoPausedRef.current = autoNarrationPause.paused || narrationBlocked
    }, [autoNarrationPause.paused, narrationBlocked])
    const reportAutoNarrationPaused = autoNarrationPause.reportPaused
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

    // Finalize the in-flight AI turn after a failure (server `error` frame, lost
    // connection, or the generation watchdog). The server keeps nothing of a
    // failed reply, so neither does the transcript: the turn becomes a notice.
    const failStreamingTurn = useCallback((message: string, retryable = true) => {
        clearGenerationWatchdog()
        const id = streamingIdRef.current
        if (id) {
            setTurnState(turnsRef.current.map((t) => (t.id === id ? unsavedReply(t as ExtendedTurnEntry) : t)))
        }
        streamingIdRef.current = null
        rawResponseRef.current = ''
        setIsLoading(false)
        setError(retryable ? message : null, retryable)
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

    useEffect(() => () => { clearGenerationWatchdog(); deltaBatchRef.current?.cancel() }, [clearGenerationWatchdog])

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

    // Adopt a server projection. Hydration owns ordering/deletions, while the live
    // stream may temporarily be the only source with parsed response segments;
    // image then TTS state fold in with terminal-precedence merges so a staler
    // response can't clobber live socket state.
    const adoptServerTurns = useCallback((hydrated: TurnEntry[]): TurnEntry[] => {
        const textMerged = mergeHydratedChatTurns(turnsRef.current, hydrated)
        const imageMerged = mergeHydratedImageTurns(turnsRef.current, textMerged)
        const next = resolveTurnIdentities(mergeHydratedTtsTurns(imageMerged, textMerged))
        setTurnState(next)
        return next
    }, [resolveTurnIdentities, setTurnState])

    const hydrateTurnsFromApi = useCallback(async () => {
        if (!isAuthenticated || Number.isNaN(sessionId) || !isPageFocused() || !sessionActiveRef.current) return
        // Never hydrate over an in-flight stream: the server projection can't
        // contain the streaming turn yet, so applying it would orphan
        // streamingIdRef and silently drop the rest of the generation. A
        // regeneration still syncing is in the same position.
        if (streamingIdRef.current || regeneratingRef.current) return
        try {
            const hydrated = await config.loadTurns(sessionId)
            // A generation may have started while the projection was loading
            // (rapid follow-up send) — that projection is stale; drop it. So is
            // one that lands after a workspace switch.
            if (!mountedRef.current || !sessionActiveRef.current || streamingIdRef.current || regeneratingRef.current) return
            const recovery = recoveryRef.current
            if (recovery && hydrated.some((turn) => turn.type === 'ai' && !turn.isStreaming &&
                ((recovery.assistantMessageId && turn.assistantMessageId === recovery.assistantMessageId) || (recovery.turnId && turn.turnId === recovery.turnId) || (recovery.requestId && turn.metadata?.request_id === recovery.requestId)))) {
                recoveryRef.current = null
                setError(null)
            }
            adoptServerTurns(hydrated)
        } catch (err) {
            console.warn('Failed to hydrate chat media state:', err)
        }
    }, [adoptServerTurns, config, isAuthenticated, sessionId, setError])

    const imagePollInFlightRef = useRef(false)
    const pollNonTerminalImageJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        if (!isPageFocused() || imagePollInFlightRef.current || !sessionActiveRef.current) return
        imagePollInFlightRef.current = true
        try {
            const jobs = snapshot.filter(hasNonTerminalImageJob)
            for (const turn of jobs) {
                if (!isPageFocused()) return
                if (!turn.imageJobId) continue
                try {
                    const result: ImageJobPublicResponse = await config.api.getImageJob(turn.imageJobId)
                    if (!mountedRef.current || !sessionActiveRef.current) return
                    const next = upsertImageJobResult(turnsRef.current, result)
                    if (next !== turnsRef.current) setTurnState(next)
                } catch (err) {
                    console.warn('Failed to poll image job:', err)
                }
            }
        } finally {
            imagePollInFlightRef.current = false
        }
    }, [config.api, setTurnState])

    const applyImageFrame = useCallback((frame: Parameters<typeof upsertChatImageFrame>[1]) => {
        const next = upsertChatImageFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            if (isPageFocused()) void pollNonTerminalImageJobs(next)
        }
    }, [pollNonTerminalImageJobs, setTurnState])

    const ttsPollInFlightRef = useRef(false)
    const pollNonTerminalTtsJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        if (!isVoicesFeatureEnabled() || !isPageFocused() || ttsPollInFlightRef.current || !sessionActiveRef.current) return
        ttsPollInFlightRef.current = true
        try {
            const jobs = snapshot.filter(hasNonTerminalTtsJob)
            for (const turn of jobs) {
                // A multi-voice turn has one job per clip; poll each non-terminal one.
                for (const jobId of nonTerminalTtsJobIds(turn)) {
                    if (!isPageFocused()) return
                    try {
                        const result: TtsJobPublicResponse = await config.api.getTtsJob(jobId)
                        if (!mountedRef.current || !sessionActiveRef.current) return
                        const next = upsertTtsJobResult(turnsRef.current, result)
                        if (next !== turnsRef.current) setTurnState(next)
                    } catch (err) {
                        console.warn('Failed to poll tts job:', err)
                    }
                }
            }
        } finally {
            ttsPollInFlightRef.current = false
        }
    }, [config.api, setTurnState])

    const applyTtsFrame = useCallback((frame: Parameters<typeof upsertChatTtsFrame>[1]) => {
        if (!isVoicesFeatureEnabled()) return
        if (frame.assistant_message_id) {
            const timer = ttsWatchdogsRef.current.get(frame.assistant_message_id)
            if (timer !== undefined) {
                window.clearTimeout(timer)
                ttsWatchdogsRef.current.delete(frame.assistant_message_id)
            }
        }
        // Failures are otherwise only visible in the speaker button's hover
        // tooltip — too quiet for auto-narrate, where nobody is watching it.
        if (frame.type === 'tts_failed' && frame.error?.code === 'auto_narration_paused') {
            // Only a tap sets the optimistic `pending`; auto sends from onDone never do.
            const assistantMessageId = frame.assistant_message_id
            let rolledBack = false
            const idle = turnsRef.current.map((turn) => {
                const entry = turn as ExtendedTurnEntry
                if (entry.assistantMessageId !== assistantMessageId || entry.ttsJobId || entry.ttsStatus !== 'pending') return turn
                rolledBack = true
                return { ...entry, ttsStatus: undefined }
            })
            if (!rolledBack) {
                // An auto request refused while auto-narration is paused (D37): not a failure.
                reportAutoNarrationPaused()
                return
            }
            // A tapped request refused with the auto code (no `trigger` is sent, so the BFF
            // should read it as manual). Say so, with the generic copy: "You can still play
            // turns" would be wrong here. The turn goes back to idle so it can be tried again.
            setTurnState(idle)
            setError(t('interaction.center.narrationFailed', { detail: frame.error.detail || t('interaction.center.unknownError') }))
            return
        }
        if (frame.type === 'tts_failed') {
            if (frame.error?.code === 'workspace_archived') {
                // Workspace R1: the session's workspace was archived. Same read-only
                // state and copy as an archived chat turn, not a narration failure.
                setReportedNotice({ key: workspaceNoticeKey, message: t('workspaceActivity.chat.workspaceArchived') })
            } else {
                const knownKey = narrationErrorKey(frame.error)
                setError(knownKey ? t(knownKey) : t('interaction.center.narrationFailed', { detail: frame.error?.detail || t('interaction.center.unknownError') }))
            }
        }
        const next = upsertChatTtsFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            if (isPageFocused()) void pollNonTerminalTtsJobs(next)
        }
    }, [pollNonTerminalTtsJobs, reportAutoNarrationPaused, setError, setTurnState, t, workspaceNoticeKey])

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
            onTurnStarted: (frame) => {
                const index = turnsRef.current.findIndex((turn) => turn.id === streamingIdRef.current)
                if (!frame.execution_attempt && index > 0 && turnsRef.current[index - 1].type === 'user') {
                    setTurnState(turnsRef.current.map((turn, i) => i === index - 1
                        ? { ...turn, id: String(frame.user_message_id), turnId: frame.turn_id } : turn))
                }
                updateStreamingTurn((turn) => ({ ...turn, assistantMessageId: frame.assistant_message_id, turnId: frame.turn_id,
                    ...(frame.execution_attempt ? { metadata: { ...turn.metadata, execution_attempt: { ...frame.execution_attempt } } } : {}) }))
            },
            onConnectionLost: () => {
                const active = turnsRef.current.find((turn) => turn.id === streamingIdRef.current)
                if (active) recoveryRef.current = { assistantMessageId: active.assistantMessageId, turnId: active.turnId, requestId: typeof active.metadata?.request_id === 'string' ? active.metadata.request_id : undefined, until: Date.now() + 30_000 }
                deltaBatchRef.current?.flush()
                failStreamingTurn(t('streaming.reconnecting'))
                if (isPageFocused()) void hydrateTurnsFromApi()
            },
            onDelta: (content) => {
                if (!streamingIdRef.current) return
                armGenerationWatchdog()
                if (!deltaBatchRef.current) deltaBatchRef.current = frameBatch<string>((chunks) => {
                    if (!streamingIdRef.current) return
                    const content = chunks.join('')
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
                })
                deltaBatchRef.current.push(content)
            },
            onMetadata: ({ forwardOptions, imagePrompt }) => {
                updateStreamingTurn((t) => ({
                    ...t,
                    ...(forwardOptions !== undefined ? { forwardOptions } : {}),
                    ...(imagePrompt !== undefined ? { imagePrompt } : {}),
                }))
            },
            onSegments: ({ segments, displayText }) => {
                deltaBatchRef.current?.flush()
                armGenerationWatchdog()
                const resolved = resolveSegmentIdentity(segments, rosterRef.current.map)
                const content = displayText?.trim() || segmentsToPlainText(resolved)
                updateStreamingTurn((t) => ({ ...t, segments: resolved, content: content || t.content }))
            },
            onDone: ({ interrupted, userMessageId, assistantMessageId, turnId }) => {
                deltaBatchRef.current?.flush()
                if (!streamingIdRef.current) return
                clearGenerationWatchdog()
                if (!interrupted) attemptRef.current = null
                const id = streamingIdRef.current
                const streamingIndex = turnsRef.current.findIndex((turn) => turn.id === id)
                let userIndex = streamingIndex - 1
                while (userIndex >= 0 && turnsRef.current[userIndex].type !== 'user') {
                    userIndex--
                }
                const next = turnsRef.current.map((t, index) => {
                    if (t.id === id) {
                        const entry = t as ExtendedTurnEntry
                        const ids = { id: assistantMessageId ? String(assistantMessageId) : t.id, assistantMessageId, turnId }
                        // A stopped reply is stored empty and never reaches the model.
                        if (interrupted) return { ...unsavedReply(entry, 'cancelled'), ...ids }
                        return {
                            ...entry,
                            ...ids,
                            isStreaming: false,
                            metadata: { ...entry.metadata, interrupted },
                            segments: finalizeResponseSegments(entry.segments),
                        }
                    }
                    if (userMessageId && index === userIndex && !storedMessageId(t)) {
                        return { ...t, id: String(userMessageId), turnId }
                    }
                    // A finished reply becomes the active version; the earlier
                    // replies to the same message stay stored, out of context.
                    if (!interrupted && index > userIndex && t.type === 'ai' && !t.isStreaming && !isUnsavedReply(t)) {
                        return withVersionState(t, true)
                    }
                    return t
                })
                setTurnState(next)
                // Announce the finished AI turn to assistive tech (once, on done).
                // The streaming turn's id is reassigned to the assistant message id
                // in `next`, so look it up by that — not the old streaming id.
                const finishedId = assistantMessageId ? String(assistantMessageId) : id
                const finished = next.find((turn) => turn.id === finishedId) as ExtendedTurnEntry | undefined
                const announceText = finished && !interrupted
                    ? finished.segments?.length
                        ? segmentsToPlainText(finished.segments)
                        : finished.content ?? ''
                    : ''
                if (announceText.trim()) setLiveAnnouncement(announceText.trim())
                streamingIdRef.current = null
                rawResponseRef.current = ''
                setIsLoading(false)
                if (isPageFocused()) {
                    void hydrateTurnsFromApi()
                    void pollNonTerminalImageJobs(next)
                }
                // Auto-narrate: request TTS for the just-finished GM turn. The audio
                // streams back over the same socket; playback still needs a tap (see
                // TurnNarration) because WS callbacks have no user-gesture context.
                if (isVoicesFeatureEnabled() && !interrupted && autoNarrateRef.current && !autoPausedRef.current && !readOnlyRef.current && assistantMessageId && turnId) {
                    sendTts(assistantMessageId, turnId, ttsRequestId(assistantMessageId, turnId))
                }
            },
            onImageJob: applyImageFrame,
            onImageComplete: applyImageFrame,
            onImageFailed: applyImageFrame,
            onTtsJob: applyTtsFrame,
            onTtsComplete: applyTtsFrame,
            onTtsFailed: applyTtsFrame,
            onVoiceSafetyNotice: (notice) => { if (isVoicesFeatureEnabled()) safetyPause.onNotice(notice) },
            onError: (message, detail) => {
                // The UI copy is deliberately generic; the category + request id
                // are what correlate this failure with the backend log line.
                console.warn('chat_stream_error', {
                    surface: config.basePath,
                    sessionId,
                    category: detail.category,
                    requestId: detail.requestId,
                    turnId: detail.turnId,
                })
                deltaBatchRef.current?.flush()
                // Workspace R1: a missing/foreign session or an archived/removed workspace
                // cannot be retried from here; explain it without offering Try again.
                // The socket closes for good on those (no reconnect); the panel turns read-only.
                const workspaceMessage = chatWorkspaceErrorMessage(detail.code, t)
                if (workspaceMessage) {
                    attemptRef.current = null
                    failStreamingTurn(workspaceMessage, false)
                    setReportedNotice({ key: workspaceNoticeKey, message: workspaceMessage })
                    return
                }
                if (isLlmRequestSpent(detail) && !['LLM_EXECUTION_UPSTREAM_FAILED', 'LLM_EXECUTION_FINISHED'].includes(detail.code || '')) attemptRef.current = null
                if (attemptRef.current && (!detail.requestId || detail.requestId === attemptRef.current.requestId)) attemptRef.current.llmRetry = detail.llmRetry
                failStreamingTurn(llmRecoveryMessage(detail, t) ?? (message || t('interaction.center.generateFailed')))
                // While the hook confirms the request is spent, the notice explains
                // without offering a retry that could race the confirmation.
                if (detail.retryPending) setError(llmRecoveryMessage(detail, t) ?? message, false, true)
            },
        },
        token,
        config.basePath,
        llmFeature,
        config.workspaceId,
    )

    // Surface the connection state once a real connection has existed — the
    // socket also reports closed→connecting transiently on first mount, which
    // must not flash a "reconnecting" notice.
    const [hasEverConnected, setHasEverConnected] = useState(false)
    useEffect(() => {
        if (socketStatus === 'open') setHasEverConnected(true)
    }, [socketStatus])
    // A workspace close is terminal (no reconnect), so it never reads as reconnecting.
    const isReconnecting = hasEverConnected && socketStatus !== 'open' && !readOnly

    // `turns` gets a new identity on every streamed chunk, so the follow-the-stream
    // effect below must scroll instantly: a 'smooth' scroll restarted many times a
    // second never settles and the log lurches for the whole generation. Smooth is
    // reserved for the one deliberate jump, and even that yields to reduced motion
    // (the global CSS rule in theme.css cannot reach a JS ScrollBehavior).
    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
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
        scrollToBottom(scrollBehavior())
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

    // Reconcile after a connection opens or the reader returns to this tab.
    const hasPendingImageJob = turns.some(hasNonTerminalImageJob)
    const hasPendingTtsJob = voicesEnabled && turns.some(hasNonTerminalTtsJob)
    const lastPresenceRef = useRef({ socketStatus: 'closed' as typeof socketStatus, pageFocused })
    useEffect(() => {
        const previous = lastPresenceRef.current
        lastPresenceRef.current = { socketStatus, pageFocused }
        const resumed = pageFocused && !previous.pageFocused
        const connected = pageFocused && socketStatus === 'open' && previous.socketStatus !== 'open'
        if (resumed && recoveryRef.current) recoveryRef.current.until = Date.now() + 30_000
        if (resumed || connected) void hydrateTurnsFromApi()
        if (resumed) {
            if (hasPendingImageJob) void pollNonTerminalImageJobs()
            if (hasPendingTtsJob) void pollNonTerminalTtsJobs()
        }
    }, [hasPendingImageJob, hasPendingTtsJob, hydrateTurnsFromApi, pageFocused, pollNonTerminalImageJobs, pollNonTerminalTtsJobs, socketStatus])

    // Reconnect may race the server's interrupted-turn commit. Re-read briefly,
    // without replaying the chat or replacing visible partial text with a spinner.
    useEffect(() => {
        if (!pageFocused) return
        const timer = window.setInterval(() => {
            if (!isPageFocused() || !recoveryRef.current) return
            if (Date.now() > recoveryRef.current.until) {
                console.warn('text_stream_recovery_failed', { requestId: recoveryRef.current.requestId, surface: 'chat' })
                recoveryRef.current = null
                return
            }
            void hydrateTurnsFromApi()
        }, 2_000)
        return () => window.clearInterval(timer)
    }, [hydrateTurnsFromApi, pageFocused])

    // The parent-seeded turns render before the first hydration, so attach
    // roster portraits to them once at mount (both callbacks are stable).
    useEffect(() => {
        if (!speakerRosterRef.current?.length) return
        setTurnState(resolveTurnIdentities(turnsRef.current))
    }, [resolveTurnIdentities, setTurnState])

    // Depend on the derived booleans, not on `turns`: the array is replaced on every
    // streamed chunk, so an interval keyed on it was cleared and recreated many times
    // a second and never reached its 3s tick — precisely during the stream the poller
    // exists to recover from. Both callbacks read the latest turns through a ref.
    useEffect(() => {
        if (!pageFocused || (!hasPendingImageJob && !hasPendingTtsJob)) return
        const timer = window.setInterval(() => {
            if (!isPageFocused()) return
            if (hasPendingImageJob) void pollNonTerminalImageJobs()
            if (hasPendingTtsJob) void pollNonTerminalTtsJobs()
        }, 3_000)
        return () => window.clearInterval(timer)
    }, [hasPendingImageJob, hasPendingTtsJob, pageFocused, pollNonTerminalImageJobs, pollNonTerminalTtsJobs])

    useEffect(() => {
        const recover = () => {
            if (isPageFocused()) void hydrateTurnsFromApi()
        }
        window.addEventListener('online', recover)
        return () => {
            window.removeEventListener('online', recover)
        }
    }, [hydrateTurnsFromApi])

    // Check if we can generate an AI response (last message is from user)
    const isMutatingTurns = isDeletingTurn || isClearingTurns || isSwitchingVersion
    const canGenerateResponse = turns.length > 0 && turns[turns.length - 1].type === 'user' && !isLoading && !isMutatingTurns

    // The transcript shows what the model sees: inactive versions and unsaved
    // replies collapse. Only the latest reply can be regenerated or switched —
    // every later turn was written against the reply an older message kept.
    const transcript = useMemo(() => transcriptItems(turns), [turns])
    const tail = turns[turns.length - 1] as ExtendedTurnEntry | undefined
    const tailIsUnsaved = isUnsavedReply(tail)
    // A greeting answers no player message (no latest exchange), so there is
    // nothing to regenerate it from. A failed tail offers its own retry.
    const latestShown = latestExchangeReply(turns).shown
    const latestReplyId = latestShown && !latestShown.isStreaming && !tailIsUnsaved ? latestShown.id : undefined
    // A failed request is explained where its reply would be; the banner keeps the rest.
    const inlineError = errorState?.generation && (tailIsUnsaved || tail?.type === 'user') ? errorState : null
    const bannerError = inlineError ? null : errorState
    // A 1:1 chat's single character speaks every reply: its portrait replaces the
    // GM glyph and its speech skips the repeated per-segment name.
    const aiSpeaker = useMemo(() => {
        const solo = config.kind === 'character' && speakerRoster?.length === 1 ? speakerRoster[0] : undefined
        return solo ? { id: solo.speaker_id, name: solo.name, imageUrl: solo.image_url } : undefined
    }, [config.kind, speakerRoster])

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
            const storedTurns = await config.clearMessages(sessionId)
            setTurnState(storedTurns)
        } catch (error) {
            console.error('Failed to clear turns:', error)
            setTurnState(previousTurns)
            setError(t('interaction.center.clearFailed'))
        } finally {
            setIsClearingTurns(false)
            setResetConfirmOpen(false)
        }
    }

    const composerRef = useRef<HTMLTextAreaElement | null>(null)
    const handleForwardOptionClick = useCallback((message: string) => {
        setInput(message)
        composerRef.current?.focus()
    }, [])

    // Request (or retry) TTS narration for a finished GM turn. Optimistically marks
    // the turn pending so the speaker control shows a spinner before the first
    // `tts_job` frame arrives; the WS frames then drive the real lifecycle.
    const handleRequestNarration = useCallback((assistantMessageId?: number, turnId?: string) => {
        if (!isVoicesFeatureEnabled() || !assistantMessageId || !turnId || narrationBlocked) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        if (socketStatus !== 'open') {
            setError(t('interaction.center.narrationUnavailable'))
            return
        }
        setNarrationRequested(true)
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
    }, [isAuthenticated, narrationBlocked, openLoginModal, sendTts, setTurnState, socketStatus, t])

    // A clip refused with `attestation_required` (D26): open the prompt, then
    // request that clip once more if the user attested.
    const attestation = useAttestation()
    const requestNarrationRef = useRef(handleRequestNarration)
    useEffect(() => {
        requestNarrationRef.current = handleRequestNarration
    }, [handleRequestNarration])
    const handleAttestNarration = useCallback((assistantMessageId?: number, turnId?: string) => {
        if (!isVoicesFeatureEnabled() || !attestation) return
        void attestation.requestAttestation().then((attested) => {
            if (attested && mountedRef.current) requestNarrationRef.current(assistantMessageId, turnId)
        })
    }, [attestation])

    // Put the targeted AI turn into a clean streaming state and request a
    // generation over the socket. `history` is everything before that AI turn.
    // `resume` resends an unsettled request under its own ID and frame.
    const startGeneration = (history: TurnEntry[], aiTurn: ExtendedTurnEntry,
        resume?: ChatAttempt, target?: AdventureChatSocketErrorDetail['llmRetry']) => {
        if (Number.isNaN(sessionId)) {
            setError(t('interaction.center.invalidSession'))
            setIsLoading(false)
            return
        }

        deltaBatchRef.current?.cancel()
        recoveryRef.current = null
        streamingIdRef.current = aiTurn.id
        rawResponseRef.current = ''
        rosterRef.current = { map: seededRosterMap(), narrator: null }

        const requestId = resume?.requestId ?? generateUUID()
        const precedingUser = [...history].reverse().find((turn) => turn.type === 'user')
        const streamingTurns = turnsRef.current.map((t) =>
            t.id === aiTurn.id
                ? {
                    ...(t as ExtendedTurnEntry),
                    isStreaming: true,
                    metadata: { ...t.metadata, request_id: requestId, interrupted: false, error_category: undefined },
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
                : !resume && t.id === precedingUser?.id ? { ...t, metadata: { ...t.metadata, request_id: requestId } } : t
        )
        setTurnState(streamingTurns)

        // The server owns the durable history and prompt construction. A chat
        // request carries the latest input and, for a retry, its durable id.
        // Sending stored text as new input would append a duplicate user row.
        // A resumed request resends its original frame so the server recognizes it.
        const content = resume ? resume.content : precedingUser?.content.trim()
        if (!content) {
            failStreamingTurn(t('interaction.center.generateFailed'))
            return
        }
        const existingUserMessageId = resume ? resume.existingUserMessageId : storedMessageId(precedingUser)
        attemptRef.current = { requestId, content, existingUserMessageId, aiTurnId: aiTurn.id,
            accountKey: authSession.getSnapshot().accountKey, sessionKey: JSON.stringify([config.basePath, sessionId]),
            ...(target ? { target } : {}) }
        if (resume && target) sendChat(content, requestId, existingUserMessageId, target, true)
        else if (existingUserMessageId !== undefined) sendChat(content, requestId, existingUserMessageId)
        else sendChat(content, requestId)
        armGenerationWatchdog()
    }

    // Ref mirror so stable callbacks (regenerate) always invoke the latest
    // closure without depending on its (render-scoped) identity.
    const startGenerationRef = useRef(startGeneration)
    useEffect(() => {
        startGenerationRef.current = startGeneration
    })

    // Answer the latest player message again as a new version. Nothing is
    // deleted: the server keeps every earlier reply, builds the model's history
    // up to the player message, and makes the new reply the active version only
    // once it completes — a failed or stopped one leaves the current reply in
    // place. The list comes from a fresh projection so a request still running
    // elsewhere is seen before another starts.
    const regenerateLatestReply = async () => {
        if (streamingIdRef.current || regeneratingRef.current) return
        const fence = { stopped: false }
        regeneratingRef.current = fence
        setIsLoading(true)
        setError(null)
        try {
            let list: TurnEntry[]
            try {
                list = adoptServerTurns(await config.loadTurns(sessionId))
            } catch (err) {
                console.error('Failed to read the conversation before regenerating:', err)
                setIsLoading(false)
                setError(t('interaction.center.regenerateFailed'))
                return
            }
            const userIndex = lastUserIndex(list)
            if (fence.stopped || userIndex < 0) {
                setIsLoading(false)
                return
            }
            if (list.slice(userIndex + 1).some((turn) => turn.isStreaming)) {
                setIsLoading(false)
                setError(t('llmProfiles.recovery.LLM_EXECUTION_IN_PROGRESS'), true)
                return
            }
            const aiTurn: ExtendedTurnEntry = { id: generateUUID(), type: 'ai', content: '', timestamp: new Date().toISOString(), isStreaming: true }
            const next = [...list, aiTurn]
            forceScrollRef.current = true
            setTurnState(next)
            startGenerationRef.current(list, aiTurn)
        } finally {
            if (regeneratingRef.current === fence) regeneratingRef.current = null
        }
    }

    // Show (and send to the model) another stored version of the latest reply.
    // The switch is optimistic; the server's projection then confirms it.
    const switchingVersionRef = useRef(false)
    const selectReplyVersion = async (turnId: string) => {
        if (streamingIdRef.current || regeneratingRef.current || switchingVersionRef.current || isDeletingTurn || isClearingTurns) return
        const previousTurns = turnsRef.current
        const start = lastUserIndex(previousTurns)
        const target = previousTurns.find((turn) => turn.id === turnId)
        const messageId = storedMessageId(target)
        if (!target || messageId === undefined || start < 0 || previousTurns.indexOf(target) < start) return
        setTurnState(previousTurns.map((turn, index) => index > start && turn.type === 'ai' && !turn.isStreaming && !isUnsavedReply(turn)
            ? withVersionState(turn, turn.id !== turnId) : turn))
        switchingVersionRef.current = true
        setIsSwitchingVersion(true)
        setError(null)
        try {
            adoptServerTurns(await config.selectReply(sessionId, messageId))
        } catch (error) {
            console.error('Failed to switch reply version:', error)
            setTurnState(previousTurns)
            setError(t('interaction.center.versionFailed'))
        } finally {
            switchingVersionRef.current = false
            setIsSwitchingVersion(false)
        }
    }
    const selectReplyVersionRef = useRef(selectReplyVersion)
    useEffect(() => {
        selectReplyVersionRef.current = selectReplyVersion
    })
    const handleSelectVersion = useCallback((turnId: string) => {
        void selectReplyVersionRef.current(turnId)
    }, [])

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

            const messageId = storedMessageId(target)
            if (messageId) {
                const storedTurns = await config.deleteMessage(sessionId, messageId)
                setTurnState(storedTurns)
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
            // are never replayed while the stored edit is in flight.
            return turn.type === 'ai' ? { ...edited, segments: undefined, ...RESET_IMAGE_FIELDS, ...RESET_TTS_FIELDS } : edited
        })
        setTurnState(updatedTurns)
        const target = previousTurns.find((turn) => turn.id === turnId)
        const messageId = storedMessageId(target)
        if (!messageId) return
        try {
            const storedTurns = await config.updateMessage(sessionId, messageId, newContent)
            setTurnState(storedTurns)
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

    // Before anything new runs, read what the server committed for the tail's
    // request, including after a reload. Returns true when that settled the
    // retry: the result was recovered or adopted, the request is still running,
    // or the retry has to stop. False means the request is spent (failed or
    // stopped) or unknown, and the caller starts a fresh reply in its place.
    const resumeUnsettledAttempt = async (last: ExtendedTurnEntry): Promise<boolean> => {
        const active = attemptRef.current
        const attempt = active && (last.id === active.aiTurnId || last.metadata?.request_id === active.requestId) ? active : null
        const basePath = config.basePath
        const requestId = attempt?.requestId ?? last.metadata?.request_id
        if (basePath !== 'adventure-sessions' && basePath !== 'character-chats') return false
        if (typeof requestId !== 'string') return false
        const owner = authSession.getSnapshot()
        const sessionKey = JSON.stringify([basePath, sessionId])
        if (attempt && (attempt.accountKey !== owner.accountKey || attempt.sessionKey !== sessionKey)) {
            setError(t('llmProfiles.recovery.LLM_EXECUTION_INTENT_CHANGED'))
            return true
        }
        if (turnsRef.current[turnsRef.current.length - 1]?.id !== last.id) {
            setError(t('llmProfiles.recovery.LLM_EXECUTION_INTENT_CHANGED'))
            return true
        }
        // The hook already confirmed this request ended without a result.
        if (attempt?.llmRetry) return false
        // Resend the same request in the same slot; the server recovers it
        // instead of running it again.
        const begin = (original: ChatAttempt, target?: AdventureChatSocketErrorDetail['llmRetry']) => {
            const index = turnsRef.current.findIndex(turn => turn.id === last.id)
            if (index !== turnsRef.current.length - 1 || index < 0) { setIsLoading(false); return }
            const response: ExtendedTurnEntry = { ...last, isStreaming: true }
            const updated = [...turnsRef.current.slice(0, index), response]
            setTurnState(updated)
            setIsLoading(true)
            setError(null)
            forceScrollRef.current = true
            startGenerationRef.current(updated.slice(0, -1), response, original, target)
        }
        retryLookupRef.current?.abort()
        const controller = new AbortController()
        retryLookupRef.current = controller
        setIsLoading(true)
        try {
            const state = await config.api.reconcileChatTurn(basePath, sessionId, requestId, controller.signal)
            if (controller.signal.aborted || !mountedRef.current || !authSession.isCurrent(owner) || !sessionActiveRef.current) return true
            setIsLoading(false)
            if (state.status === 'completed') {
                attemptRef.current = null
                void hydrateTurnsFromApi()
                return true
            }
            if (state.status === 'failed' || state.status === 'cancelled') return false
            if (!state.recovery_required && state.status !== 'awaiting_credential') {
                recoveryRef.current = { requestId, until: Date.now() + 30_000 }
                setError(t('llmProfiles.recovery.LLM_EXECUTION_IN_PROGRESS'), true)
                void hydrateTurnsFromApi()
                return true
            }
            const command = state.dispatch
            if (!command || attempt && (command.content !== attempt.content || (command.existing_user_message_id ?? undefined) !== attempt.existingUserMessageId)) {
                setError(t('llmProfiles.recovery.LLM_EXECUTION_INTENT_CHANGED'))
                return true
            }
            begin({ requestId, content: command.content, existingUserMessageId: command.existing_user_message_id ?? undefined,
                aiTurnId: last.id, accountKey: owner.accountKey, sessionKey, target: command.llm }, command.llm)
            return true
        } catch (error) {
            if (controller.signal.aborted || !mountedRef.current || !authSession.isCurrent(owner) || !sessionActiveRef.current) return true
            setIsLoading(false)
            if ((error as { code?: unknown })?.code === 'LLM_EXECUTION_NOT_FOUND' && attempt) {
                // No admitted command exists. Resend only the exact unsatisfied frame.
                begin(attempt, attempt.target)
                return true
            }
            // The record can't be proven (edited, deleted, or unreadable). A fresh
            // reply re-reads the conversation and refuses while a row is in flight.
            return false
        } finally {
            if (retryLookupRef.current === controller) retryLookupRef.current = null
        }
    }

    // Regenerate the latest reply, or Try again on the attempt at the tail. An
    // unsettled request (dropped mid-stream, still running) is recovered by its
    // own ID so it never runs twice; otherwise a new version is written.
    const replaceLatestReply = async (turnId: string) => {
        if (streamingIdRef.current || regeneratingRef.current || retryLookupRef.current) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        const list = turnsRef.current
        const tail = list[list.length - 1] as ExtendedTurnEntry | undefined
        if (tail?.id === turnId && tail.type === 'ai') {
            const attempt = attemptRef.current
            const unsettled = isUnsavedReply(tail) || tail.isStreaming
                || (attempt !== null && attempt.requestId === tail.metadata?.request_id)
            if (unsettled && await resumeUnsettledAttempt(tail)) return
        } else if (latestExchangeReply(list).shown?.id !== turnId) return
        await regenerateLatestReply()
    }
    const replaceLatestReplyRef = useRef(replaceLatestReply)
    useEffect(() => {
        replaceLatestReplyRef.current = replaceLatestReply
    })
    const handleRegenerateResponse = useCallback((turnId: string) => {
        void replaceLatestReplyRef.current(turnId)
    }, [])

    // Try again from the tail: answer a trailing player message, or replace the
    // trailing reply (unsaved notice, or the banner after a failed request).
    const handleRetryGeneration = () => {
        if (isLoading || isMutatingTurns) return
        const last = turnsRef.current[turnsRef.current.length - 1]
        if (!last) return
        setError(null)
        if (last.type === 'user') handleGenerateResponse()
        else if (last.type === 'ai') void replaceLatestReply(last.id)
    }

    const submitMessage = (userInput: string) => {
        const userTurn: TurnEntry = {
            id: generateUUID(),
            type: 'user',
            content: userInput,
            timestamp: new Date().toISOString(),
        }

        const aiTurn: ExtendedTurnEntry = {
            id: generateUUID(), type: 'ai', content: '', timestamp: new Date().toISOString(),
            isStreaming: false, forwardOptions: undefined, segments: undefined,
        }
        const newTurns = [...turns, userTurn, aiTurn]

        forceScrollRef.current = true
        setTurnState(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    // The socket hook's effect runs first, so the first message can queue on the
    // newly created socket without waiting for a second click or an open event.
    const submitMessageRef = useRef(submitMessage)
    useEffect(() => { submitMessageRef.current = submitMessage })
    useEffect(() => {
        const content = firstMessageRef.current
        if (content === null || Number.isNaN(sessionId)) return
        firstMessageRef.current = null
        submitMessageRef.current(content)
    }, [createdSessionId, sessionId])

    const handleSubmit = () => {
        if (!input.trim() || isLoading || isMutatingTurns || creatingSessionRef.current) return
        if (!isAuthenticated) { openLoginModal(); return }
        const content = input.trim()
        if (!Number.isNaN(sessionId)) { submitMessage(content); return }
        if (!ensureSession) { setError(t('interaction.center.invalidSession')); return }
        const fence = { stopped: false }
        creatingSessionRef.current = fence
        setIsLoading(true)
        setError(null)
        void ensureSession().then((id) => {
            if (!mountedRef.current || fence.stopped) return
            if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid session id')
            firstMessageRef.current = content
            setCreatedSessionId(id)
        }).catch(() => {
            if (mountedRef.current && !fence.stopped) {
                setIsLoading(false)
                setError(t('interaction.center.generateFailed'))
            }
        }).finally(() => {
            if (creatingSessionRef.current === fence) creatingSessionRef.current = null
        })
    }

    const handleStop = () => {
        if (!stopArmedRef.current) return
        if (creatingSessionRef.current) {
            creatingSessionRef.current.stopped = true
            setIsLoading(false)
            return
        }
        if (retryLookupRef.current) {
            retryLookupRef.current.abort(); retryLookupRef.current = null; setIsLoading(false)
            return
        }
        // A regeneration still syncing/deleting has sent nothing yet: it checks
        // this flag before its request goes out.
        if (regeneratingRef.current) {
            regeneratingRef.current.stopped = true
            return
        }
        deltaBatchRef.current?.flush()
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
            {bannerError && (
                <div role="alert" className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-2 text-[14px] text-blood-500">
                    <span>{bannerError.message}</span>
                    <div className="flex shrink-0 items-center gap-2">
                        {bannerError.retryable && !isLoading && !isMutatingTurns && turns.length > 0 && (
                            <Button
                                size="sm"
                                variant="primary"
                                iconLeft={<RotateCcw size={13} />}
                                onClick={handleRetryGeneration}
                            >
                                {t('interaction.center.retry')}
                            </Button>
                        )}
                        <IconButton
                            label={t('interaction.center.closeError')}
                            size="sm"
                            tone="danger"
                            onClick={() => setError(null)}
                        >
                            <X size={16} strokeWidth={1.75} />
                        </IconButton>
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
                            <div className="mt-2 flex items-center gap-2 text-label text-parchment-300">
                                <Sparkles size={15} strokeWidth={1.75} className="shrink-0 text-arcane-300" aria-hidden />
                                <span>{config.copy.emptyHint}</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {transcript.map((item) => {
                                const { turn } = item
                                if (item.kind === 'unsaved') {
                                    return (
                                        <UnsavedReplyNotice
                                            key={turn.id}
                                            reason={unsavedReplyReason(turn)}
                                            aiLabel={config.aiLabel}
                                            detail={readOnly ? workspaceNotice : inlineError?.message}
                                            onRetry={readOnly ? undefined : handleRetryGeneration}
                                            retrying={isLoading || isMutatingTurns || Boolean(inlineError && !inlineError.retryable)}
                                        />
                                    )
                                }
                                const isDeleteTarget = pendingDeleteTurn?.id === turn.id
                                return (
                                    <ChatTurn
                                        // Switching versions swaps the turn in one slot; a
                                        // stable key keeps focus on the switcher.
                                        key={item.versions ? 'latest-reply-versions' : turn.id}
                                        turn={turn}
                                        versions={item.versions}
                                        onSelectVersion={item.versions ? handleSelectVersion : undefined}
                                        versionsDisabled={readOnly || isLoading || isClearingTurns || isDeletingTurn}
                                        aiLabel={config.aiLabel}
                                        aiSpeaker={aiSpeaker}
                                        showForwardOptions={config.showForwardOptions}
                                        showImage={config.showImages}
                                        onForwardOptionClick={handleForwardOptionClick}
                                        onRegenerateClick={turn.id === latestReplyId && !readOnly ? handleRegenerateResponse : undefined}
                                        onDeleteClick={handleDeleteTurn}
                                        onConfirmDeleteClick={handleConfirmDeleteTurn}
                                        onCancelDeleteClick={handleCancelDeleteTurn}
                                        onEditClick={handleEditTurn}
                                        // Read-only (archived workspace): stored clips still play, nothing new is requested.
                                        onRequestNarration={!voicesEnabled || readOnly ? undefined : handleRequestNarration}
                                        onAttestNarration={!voicesEnabled || readOnly ? undefined : handleAttestNarration}
                                        narrationUnavailable={narrationBlocked}
                                        onRefreshVoice={handleRefreshVoice}
                                        onEditNarratorVoice={config.kind === 'adventure' ? onEditNarratorVoice : undefined}
                                        refreshDisabled={refreshVoiceDisabled}
                                        onNarrationPlayingChange={handleNarrationPlayingChange}
                                        confirmingDelete={isDeleteTarget}
                                        deleting={isDeleteTarget && isDeletingTurn}
                                        actionsDisabled={readOnly || isLoading || isClearingTurns || isSwitchingVersion || (isDeletingTurn && !isDeleteTarget)}
                                        loreMatcher={loreMatcher}
                                    />
                                )
                            })}
                            {canGenerateResponse && !readOnly && (
                                <div className="my-4 flex flex-wrap items-center gap-3 border-t border-parchment-50/10 py-4">
                                    <Sparkles size={18} strokeWidth={1.75} className="shrink-0 text-arcane-300" aria-hidden />
                                    <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                                        <span className="text-body font-semibold text-parchment-50">
                                            {config.copy.waitingTitle}
                                        </span>
                                        <span className="text-label text-parchment-300">
                                            {config.copy.waitingHint}
                                        </span>
                                        {inlineError && (
                                            <span role="alert" className="text-label text-blood-500">
                                                {inlineError.message}
                                            </span>
                                        )}
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

            <div className="bg-ink-800">
                {readOnly ? (
                    <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2 md:px-6">
                        <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} data-testid="chat-read-only">
                            {workspaceNotice}
                        </Callout>
                    </div>
                ) : (
                <ChatComposer
                    inputRef={composerRef}
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
                    accessory={<LlmFeatureControl feature={llmFeature ?? (config.kind === 'adventure' ? 'chat_adventure' : 'chat_character')}
                        disabled={isLoading || isMutatingTurns} />}
                    placeholder={config.copy.placeholder}
                    loreMatcher={loreMatcher}
                />
                )}
                {/* Narration switched off server-side (09 §7): buttons are disabled, this says why. The
                    live region stays mounted so a switch-off that lands mid-session is announced. */}
                {voicesEnabled && !readOnly && (
                    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[760px] px-4 md:px-6" data-testid="narration-availability-status">
                        {/* A safety pause says so rather than the generic switch-off (09 §4.7). */}
                        {safetyPause.isPaused ? (
                            <Callout tone="info" icon={<Icon icon={VolumeX} size={16} />} className="mb-3" data-testid="narration-safety-paused">
                                {t('voiceSafety.narrationPaused')}
                            </Callout>
                        ) : narrationUnavailable && (
                            <Callout tone="info" icon={<Icon icon={VolumeX} size={16} />} className="mb-3" data-testid="narration-unavailable">
                                {t('interaction.narration.unavailableNotice')}
                            </Callout>
                        )}
                    </div>
                )}
                {/* The live region stays mounted while auto-narrate is on, so a pause that starts mid-session is announced. */}
                {voicesEnabled && !readOnly && autoNarrate && (
                    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[760px] px-4 md:px-6" data-testid="auto-narration-status">
                        {autoNarrationPause.paused && !narrationUnavailable && (
                            <Callout tone="info" icon={<Icon icon={PauseCircle} size={16} />} className="mb-3" data-testid="auto-narration-paused">
                                {t('interaction.narration.autoPaused')}
                            </Callout>
                        )}
                    </div>
                )}
                {voicesEnabled && !readOnly && <NarrationAllowanceNote {...narrationAllowance} />}
                {voicesEnabled && !readOnly && (
                    <BreakNudge
                        minutes={readSafeguards(voiceCapabilities).break_nudge_minutes}
                        active={narrationPlaying}
                        className="mx-auto mb-3 w-full max-w-[760px] px-4 md:px-6"
                    />
                )}
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
                icon={<Icon icon={Eraser} size={21} className="text-blood-500" />}
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
            <SafetyPauseNotice
                open={voicesEnabled && safetyPause.noticeOpen}
                retryAfterSeconds={safetyPause.retryAfterSeconds}
                onClose={safetyPause.dismiss}
            />
        </div>
    )
}
