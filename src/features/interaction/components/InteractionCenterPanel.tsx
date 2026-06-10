import {useCallback, useEffect, useRef, useState} from 'react'
import type {ChatMessage, ForwardOption, TurnEntry} from '../../../shared'
import {apiService, type ImageJobPublicResponse, type TtsJobPublicResponse} from '../../../infrastructure/api'
import {useAuth} from '../../../app/hooks'
import {Loader2, Send, Sparkles, Square, Volume2} from 'lucide-react'
import {Button, controlClass, cx} from '../../../ui/primitives'
import {ChatTurn} from './ChatTurn'
import {generateUUID} from '../../../utils/uuid'
import type {ChatSessionConfig} from '../chatSessionConfig'
import {useAdventureChatSocket} from '../hooks/useAdventureChatSocket'
import {hasNonTerminalImageJob, mergeHydratedImageTurns, upsertChatImageFrame, upsertImageJobResult} from '../utils/chatImageTurnState'
import {hasNonTerminalTtsJob, mergeHydratedTtsTurns, upsertChatTtsFrame, upsertTtsJobResult} from '../utils/chatTtsTurnState'

// Extend TurnEntry to include forward options and the (out-of-scope) image prompt
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    isStreaming?: boolean
    imagePrompt?: string  // Text prompt for a future image-generation step (not rendered)
}

// Remove completed <think>...</think> reasoning blocks (and an unterminated
// trailing one) from the displayed narrative.
function stripThink(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '')
}

interface InteractionCenterPanelProps {
    /** Numeric session id (adventure_id or character-chat id). */
    sessionId: number
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
    /** Mode-specific wiring (load/save endpoints, copy, forward options, basePath). */
    config: ChatSessionConfig
}

// Snapshot of an AI turn used to restore it if a regeneration fails.
interface TurnRestore {
    content: string
    forwardOptions?: ForwardOption[]
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

// Stable request key per (assistantMessageId, turnId), stored server-side for
// tracing. Dedupe itself is content-hash based on the server (an in-flight or
// completed job for the same turn + text + voice is reused).
function ttsRequestId(assistantMessageId: number, turnId: string): string {
    return `tts-${assistantMessageId}-${turnId}`
}

export function InteractionCenterPanel({sessionId, turns, setTurns, config}: InteractionCenterPanelProps) {
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { isAuthenticated, openLoginModal, token } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

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

    // Persist the client turn mirror via the mode-specific endpoint.
    const saveTurnsToApi = useCallback(async (turnsToSave: TurnEntry[]) => {
        try {
            if (!Number.isNaN(sessionId)) {
                await config.saveTurns(sessionId, turnsToSave)
            }
        } catch (err) {
            console.error('Failed to save turns to API:', err)
        }
    }, [config, sessionId])

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

    const hydrateTurnsFromApi = useCallback(async () => {
        if (!isAuthenticated || Number.isNaN(sessionId)) return
        try {
            const hydrated = await config.loadTurns(sessionId)
            if (hydrated.length > 0) {
                // Fold image then TTS state in; both apply terminal-precedence merges
                // so a staler projection can't clobber live socket state.
                const next = mergeHydratedTtsTurns(mergeHydratedImageTurns(turnsRef.current, hydrated), hydrated)
                setTurnState(next)
                void saveTurnsToApi(next)
            }
        } catch (err) {
            console.warn('Failed to hydrate chat media state:', err)
        }
    }, [config, isAuthenticated, saveTurnsToApi, sessionId, setTurnState])

    const pollNonTerminalImageJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        const jobs = snapshot.filter(hasNonTerminalImageJob)
        for (const turn of jobs) {
            if (!turn.imageJobId) continue
            try {
                const result: ImageJobPublicResponse = await apiService.getImageJob(turn.imageJobId)
                const next = upsertImageJobResult(turnsRef.current, result)
                if (next !== turnsRef.current) {
                    setTurnState(next)
                    void saveTurnsToApi(next)
                }
            } catch (err) {
                console.warn('Failed to poll image job:', err)
            }
        }
    }, [saveTurnsToApi, setTurnState])

    const applyImageFrame = useCallback((frame: Parameters<typeof upsertChatImageFrame>[1]) => {
        const next = upsertChatImageFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            void saveTurnsToApi(next)
            void pollNonTerminalImageJobs(next)
        }
    }, [pollNonTerminalImageJobs, saveTurnsToApi, setTurnState])

    const pollNonTerminalTtsJobs = useCallback(async (snapshot: TurnEntry[] = turnsRef.current) => {
        const jobs = snapshot.filter(hasNonTerminalTtsJob)
        for (const turn of jobs) {
            if (!turn.ttsJobId) continue
            try {
                const result: TtsJobPublicResponse = await apiService.getTtsJob(turn.ttsJobId)
                const next = upsertTtsJobResult(turnsRef.current, result)
                if (next !== turnsRef.current) {
                    setTurnState(next)
                    void saveTurnsToApi(next)
                }
            } catch (err) {
                console.warn('Failed to poll tts job:', err)
            }
        }
    }, [saveTurnsToApi, setTurnState])

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
            setError(`Narration failed: ${frame.error?.detail || 'unknown error'}`)
        }
        const next = upsertChatTtsFrame(turnsRef.current, frame)
        if (next !== turnsRef.current) {
            setTurnState(next)
            void saveTurnsToApi(next)
            void pollNonTerminalTtsJobs(next)
        }
    }, [pollNonTerminalTtsJobs, saveTurnsToApi, setTurnState])

    // The conversation + all turn metadata stream over one per-session WebSocket.
    // Gate the connection behind auth (and a valid session id).
    const { status: socketStatus, sendChat, sendTts, cancel } = useAdventureChatSocket(
        isAuthenticated && token && !Number.isNaN(sessionId) ? sessionId : null,
        {
            onDelta: (content) => {
                rawResponseRef.current += content
                const assistant = stripThink(rawResponseRef.current)
                updateStreamingTurn((t) => ({ ...t, content: assistant }))
            },
            onMetadata: ({ forwardOptions, imagePrompt }) => {
                updateStreamingTurn((t) => ({ ...t, forwardOptions, imagePrompt }))
            },
            onDone: ({ assistantMessageId, turnId }) => {
                const id = streamingIdRef.current
                const next = turnsRef.current.map((t) =>
                    t.id === id ? { ...(t as ExtendedTurnEntry), isStreaming: false, assistantMessageId, turnId } : t
                )
                setTurnState(next)
                streamingIdRef.current = null
                rawResponseRef.current = ''
                restoreRef.current = null
                setIsLoading(false)
                saveTurnsToApi(next).catch((err) =>
                    console.error('Failed to save turns:', err)
                )
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
                const id = streamingIdRef.current
                const restore = restoreRef.current
                const next = turnsRef.current.map((t) => {
                    if (t.id !== id) return t
                    const entry = t as ExtendedTurnEntry
                    // Restore the previous answer on a failed regeneration; otherwise
                    // leave the AI turn empty so the regenerate affordance stays visible.
                    if (restore && restore.content) {
                        return {
                            ...entry,
                            isStreaming: false,
                            content: restore.content,
                            forwardOptions: restore.forwardOptions,
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
                setTurnState(next)
                streamingIdRef.current = null
                rawResponseRef.current = ''
                restoreRef.current = null
                setIsLoading(false)
                setError(message || 'Failed to generate response. Please try again.')
                saveTurnsToApi(next).catch((err) =>
                    console.error('Failed to save failed turns:', err)
                )
            },
        },
        token,
        config.basePath
    )

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
    }

    useEffect(() => {
        scrollToBottom()
    }, [turns])

    useEffect(() => {
        if (socketStatus === 'open') {
            void hydrateTurnsFromApi()
        }
    }, [hydrateTurnsFromApi, socketStatus])

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
    const canGenerateResponse = turns.length > 0 && turns[turns.length - 1].type === 'user' && !isLoading

    const handleReset = () => {
        if (window.confirm(config.copy.resetConfirm)) {
            setTurnState([])
            setError(null)
            saveTurnsToApi([])
        }
    }

    const handleForwardOptionClick = (message: string) => {
        setInput(message)
    }

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
            setError('Narration is unavailable while reconnecting — try again in a moment.')
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
    }, [isAuthenticated, openLoginModal, sendTts, setTurnState, socketStatus])

    // Put the targeted AI turn into a clean streaming state and request a
    // generation over the socket. `history` is everything before that AI turn.
    const startGeneration = (history: TurnEntry[], aiTurn: ExtendedTurnEntry, restore?: TurnRestore) => {
        if (Number.isNaN(sessionId)) {
            setError('Invalid adventure session ID')
            setIsLoading(false)
            return
        }

        streamingIdRef.current = aiTurn.id
        rawResponseRef.current = ''
        restoreRef.current = restore ?? null

        const streamingTurns = turnsRef.current.map((t) =>
            t.id === aiTurn.id
                ? {
                    ...(t as ExtendedTurnEntry),
                    isStreaming: true,
                    content: '',
                    forwardOptions: undefined,
                    imagePrompt: undefined,
                    assistantMessageId: undefined,
                    turnId: undefined,
                    ...RESET_IMAGE_FIELDS,
                    ...RESET_TTS_FIELDS,
                }
                : t
        )
        setTurnState(streamingTurns)

        // Send only user/assistant history. Private GM/system prompt construction
        // and provider config are owned server-side by magic-worlds-api.
        const messages: ChatMessage[] = history
            .filter((t) => t.type === 'user' || t.type === 'ai')
            .map((t) => ({
                role: t.type === 'user' ? ('user' as const) : ('assistant' as const),
                content: t.content,
            }))
        sendChat(messages)
    }

    const handleRegenerateResponse = (turnId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }

        const turnIndex = turns.findIndex((turn) => turn.id === turnId)
        if (turnIndex === -1) return

        // Find the last user message before this AI response
        let userMessageIndex = turnIndex - 1
        while (userMessageIndex >= 0 && turns[userMessageIndex].type !== 'user') {
            userMessageIndex--
        }
        if (userMessageIndex < 0) return // No user message found

        const existingAiTurn = turns[turnIndex] as ExtendedTurnEntry
        const restore: TurnRestore = {
            content: existingAiTurn.content,
            forwardOptions: existingAiTurn.forwardOptions,
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
        const truncatedTurns = turns.slice(0, turnIndex + 1)
        const resetAiTurn: ExtendedTurnEntry = {
            ...existingAiTurn,
            content: '',
            isStreaming: true,
            forwardOptions: undefined,
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
        saveTurnsToApi(updatedTurns)
        startGeneration(updatedTurns.slice(0, -1), resetAiTurn, restore)
    }

    const handleDeleteTurn = async (turnId: string) => {
        if (!window.confirm('Are you sure you want to delete this message?')) {
            return
        }

        try {
            const updatedTurns = turns.filter((turn) => turn.id !== turnId)
            setTurnState(updatedTurns)
            await saveTurnsToApi(updatedTurns)
        } catch (error) {
            console.error('Failed to delete turn:', error)
            setError('Failed to delete message. Please try again.')
        }
    }

    const handleEditTurn = async (turnId: string, newContent: string) => {
        try {
            const updatedTurns = turns.map((turn) => {
                if (turn.id !== turnId) return turn
                const edited = { ...turn, content: newContent, timestamp: new Date().toISOString() }
                // An edited AI turn keeps neither narration nor scene image — both
                // were generated from the previous text. (Note: edits only update
                // the client mirror, so re-requesting narration still reads the
                // server-persisted original text; at minimum stale audio must not
                // replay against the new text.)
                return turn.type === 'ai' ? { ...edited, ...RESET_IMAGE_FIELDS, ...RESET_TTS_FIELDS } : edited
            })
            setTurnState(updatedTurns)
            await saveTurnsToApi(updatedTurns)
        } catch (error) {
            console.error('Failed to edit turn:', error)
            setError('Failed to edit message. Please try again.')
        }
    }

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
        }
        const newTurns = [...turns, aiTurn]
        setTurnState(newTurns)
        setIsLoading(true)
        setError(null)
        saveTurnsToApi(newTurns)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return
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
            }
            newTurns = [...turns, userTurn, aiTurn]
        }

        setTurnState(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)
        saveTurnsToApi(newTurns)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    const handleStop = () => {
        if (!stopArmedRef.current) return
        cancel()
    }

    return (
        <div className="flex h-full flex-col bg-ink-800">
            {error && (
                <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-2 text-[14px] text-blood-500">
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="text-lg leading-none text-blood-500/80 hover:text-blood-500"
                        aria-label="Close error message"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
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
                            {turns.map((turn: ExtendedTurnEntry) => (
                                <ChatTurn
                                    key={turn.id}
                                    turn={turn}
                                    aiLabel={config.aiLabel}
                                    showForwardOptions={config.showForwardOptions}
                                    showImage={config.showImages}
                                    onForwardOptionClick={handleForwardOptionClick}
                                    onRegenerateClick={handleRegenerateResponse}
                                    onDeleteClick={handleDeleteTurn}
                                    onEditClick={handleEditTurn}
                                    onRequestNarration={handleRequestNarration}
                                />
                            ))}
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
                                        {isLoading ? 'Generating…' : 'Generate Response'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="border-t border-parchment-50/10 bg-ink-900/40 backdrop-blur-md">
                <form
                    onSubmit={handleSubmit}
                    className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 py-3 md:px-6"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={config.copy.placeholder}
                        className={cx(controlClass, 'flex-1')}
                        disabled={isLoading}
                    />
                    {isLoading ? (
                        <Button
                            type="button"
                            kind="secondary"
                            onClick={handleStop}
                            iconLeft={<Square size={14} />}
                        >
                            Stop
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={!input.trim()}
                            iconLeft={<Send size={16} />}
                        >
                            Send
                        </Button>
                    )}
                    <Button
                        type="button"
                        kind={autoNarrate ? 'primary' : 'secondary'}
                        onClick={() => setAutoNarrate((on) => !on)}
                        iconLeft={<Volume2 size={15} />}
                        aria-pressed={autoNarrate}
                        title={autoNarrate ? 'Auto-narrate is on — new GM turns are read aloud' : 'Auto-narrate new GM turns'}
                    >
                        Narrate
                    </Button>
                    <Button
                        type="button"
                        kind="secondary"
                        onClick={handleReset}
                        disabled={isLoading || turns.length === 0}
                    >
                        Reset
                    </Button>
                </form>
                {isLoading && (
                    <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 pb-3 text-[13px] text-arcane-300 md:px-6">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{config.copy.loadingHint}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
