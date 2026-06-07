import {useEffect, useRef, useState} from 'react'
import type {Adventure, ChatMessage, ForwardOption, TurnEntry} from '../../../shared'
import {apiService} from '../../../infrastructure/api'
import {useAuth} from '../../../app/hooks'
import {Loader2, Send, Sparkles, Square} from 'lucide-react'
import {Button, controlClass, cx} from '../../../ui/primitives'
import {ChatTurn} from './ChatTurn'
import {generateUUID} from '../../../utils/uuid'
import {useAdventureChatSocket} from '../hooks/useAdventureChatSocket'

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
    adventure: Adventure
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
}

// Snapshot of an AI turn used to restore it if a regeneration fails.
interface TurnRestore {
    content: string
    forwardOptions?: ForwardOption[]
    imagePrompt?: string
}

export function InteractionCenterPanel({adventure, turns, setTurns}: InteractionCenterPanelProps) {
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { isAuthenticated, openLoginModal } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const sessionId = Number(adventure.id)

    // Refs let the long-lived socket callbacks read the latest turns and target
    // the in-flight AI turn without being recreated every render.
    const turnsRef = useRef<TurnEntry[]>(turns)
    const streamingIdRef = useRef<string | null>(null)
    const rawResponseRef = useRef('')
    const restoreRef = useRef<TurnRestore | null>(null)

    // Keep the ref in sync with externally-driven turn changes (parent loads,
    // edits, deletes). Event handlers also set it inline before streaming so the
    // socket callbacks never read a stale list.
    useEffect(() => {
        turnsRef.current = turns
    }, [turns])

    // Helper function to save turns via adventure sessions API
    const saveTurnsToApi = async (adventureId: string, turnsToSave: TurnEntry[]) => {
        try {
            const id = Number(adventureId)
            if (!isNaN(id)) {
                const turnState = JSON.stringify({ turns: turnsToSave })
                await apiService.updateAdventureSession(id, turnState)
            }
        } catch (err) {
            console.error('Failed to save turns to API:', err)
        }
    }

    // Apply a mutation to the AI turn currently being streamed.
    const updateStreamingTurn = (mutate: (turn: ExtendedTurnEntry) => ExtendedTurnEntry) => {
        const id = streamingIdRef.current
        if (!id) return
        const next = turnsRef.current.map((t) => (t.id === id ? mutate(t as ExtendedTurnEntry) : t))
        turnsRef.current = next
        setTurns(next)
    }

    // The conversation + all turn metadata stream over one per-session WebSocket.
    // Gate the connection behind auth (and a valid session id).
    const { sendChat, cancel } = useAdventureChatSocket(
        isAuthenticated && !Number.isNaN(sessionId) ? sessionId : null,
        {
            onDelta: (content) => {
                rawResponseRef.current += content
                const assistant = stripThink(rawResponseRef.current)
                updateStreamingTurn((t) => ({ ...t, content: assistant }))
            },
            onMetadata: ({ forwardOptions, imagePrompt }) => {
                updateStreamingTurn((t) => ({ ...t, forwardOptions, imagePrompt }))
            },
            onDone: () => {
                const id = streamingIdRef.current
                const next = turnsRef.current.map((t) =>
                    t.id === id ? { ...(t as ExtendedTurnEntry), isStreaming: false } : t
                )
                turnsRef.current = next
                setTurns(next)
                streamingIdRef.current = null
                rawResponseRef.current = ''
                restoreRef.current = null
                setIsLoading(false)
                saveTurnsToApi(adventure.id, next).catch((err) =>
                    console.error('Failed to save turns:', err)
                )
            },
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
                        }
                    }
                    return { ...entry, isStreaming: false, content: '' }
                })
                turnsRef.current = next
                setTurns(next)
                streamingIdRef.current = null
                rawResponseRef.current = ''
                restoreRef.current = null
                setIsLoading(false)
                setError(message || 'Failed to generate response. Please try again.')
                saveTurnsToApi(adventure.id, next).catch((err) =>
                    console.error('Failed to save failed turns:', err)
                )
            },
        }
    )

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
    }

    useEffect(() => {
        scrollToBottom()
    }, [turns])

    // Check if we can generate an AI response (last message is from user)
    const canGenerateResponse = turns.length > 0 && turns[turns.length - 1].type === 'user' && !isLoading

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset this adventure? This will clear all conversation history.')) {
            setTurns([])
            turnsRef.current = []
            setError(null)
            saveTurnsToApi(adventure.id, [])
        }
    }

    const handleForwardOptionClick = (message: string) => {
        setInput(message)
    }

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
                }
                : t
        )
        turnsRef.current = streamingTurns
        setTurns(streamingTurns)

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
        }

        // Drop any subsequent turns but keep (and reset) the AI turn we regenerate.
        const truncatedTurns = turns.slice(0, turnIndex + 1)
        const resetAiTurn: ExtendedTurnEntry = {
            ...existingAiTurn,
            content: '',
            isStreaming: true,
            forwardOptions: undefined,
            imagePrompt: undefined,
        }
        const updatedTurns = [...truncatedTurns.slice(0, -1), resetAiTurn]
        turnsRef.current = updatedTurns
        setTurns(updatedTurns)
        setIsLoading(true)
        setError(null)
        saveTurnsToApi(adventure.id, updatedTurns)
        startGeneration(updatedTurns.slice(0, -1), resetAiTurn, restore)
    }

    const handleDeleteTurn = async (turnId: string) => {
        if (!window.confirm('Are you sure you want to delete this message?')) {
            return
        }

        try {
            const updatedTurns = turns.filter((turn) => turn.id !== turnId)
            setTurns(updatedTurns)
            turnsRef.current = updatedTurns
            await saveTurnsToApi(adventure.id, updatedTurns)
        } catch (error) {
            console.error('Failed to delete turn:', error)
            setError('Failed to delete message. Please try again.')
        }
    }

    const handleEditTurn = async (turnId: string, newContent: string) => {
        try {
            const updatedTurns = turns.map((turn) =>
                turn.id === turnId
                    ? { ...turn, content: newContent, timestamp: new Date().toISOString() }
                    : turn
            )
            setTurns(updatedTurns)
            turnsRef.current = updatedTurns
            await saveTurnsToApi(adventure.id, updatedTurns)
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
        turnsRef.current = newTurns
        setTurns(newTurns)
        setIsLoading(true)
        setError(null)
        saveTurnsToApi(adventure.id, newTurns)
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

        turnsRef.current = newTurns
        setTurns(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)
        saveTurnsToApi(adventure.id, newTurns)
        startGeneration(newTurns.slice(0, -1), aiTurn)
    }

    const handleStop = () => {
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
                                Welcome to your adventure
                            </h3>
                            <p className="max-w-md font-narrative text-[17px] leading-relaxed text-parchment-200">
                                You are about to embark on an epic journey. What will your first action be?
                            </p>
                            <div className="mt-2 flex items-center gap-2 rounded-full border border-parchment-50/10 bg-ink-700 px-4 py-2 text-[13px] text-parchment-400">
                                <Sparkles size={15} className="text-arcane-300" />
                                <span>Be descriptive in your actions to create a more immersive experience.</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {turns.map((turn: ExtendedTurnEntry) => (
                                <ChatTurn
                                    key={turn.id}
                                    turn={turn}
                                    onForwardOptionClick={handleForwardOptionClick}
                                    onRegenerateClick={handleRegenerateResponse}
                                    onDeleteClick={handleDeleteTurn}
                                    onEditClick={handleEditTurn}
                                />
                            ))}
                            {canGenerateResponse && (
                                <div className="my-4 flex items-center gap-3 rounded-xl border border-parchment-50/10 bg-ink-700 p-4">
                                    <Sparkles size={18} className="shrink-0 text-arcane-300" />
                                    <div className="flex flex-1 flex-col">
                                        <span className="text-[14px] font-semibold text-parchment-50">
                                            Waiting for Game Master response
                                        </span>
                                        <span className="text-[13px] text-parchment-400">
                                            Click to generate an AI response (optional)
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
                        placeholder="What do you do next?"
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
                        <span>The Game Master is weaving the tale…</span>
                    </div>
                )}
            </div>
        </div>
    )
}
