import {useEffect, useRef, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared'
import {storage} from '../../../infrastructure/storage'
import {FaSpinner} from 'react-icons/fa'
import './InteractionCenterPanel.css'

// API Configuration
const API_URL = 'https://magic.arz.ai/chat/openai/v1/completion'
const API_KEY = 'DUMMY_API_KEY'
const MODEL_ID = 'agt-29122b8b-b1af-4536-84b9-cf1abe02efa5'

interface InteractionCenterPanelProps {
    adventure: Adventure
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
}

export function InteractionCenterPanel({adventure, turns, setTurns}: InteractionCenterPanelProps) {
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
    }

    useEffect(() => {
        scrollToBottom()
    }, [turns])

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset this adventure? This will clear all conversation history.')) {
            setTurns([])
            setError(null)
            storage.saveTurns(adventure.id, [])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userInput = input.trim()

        const userTurn: TurnEntry = {
            id: crypto.randomUUID(),
            type: 'user',
            content: userInput,
            timestamp: new Date().toISOString()
        }

        const newTurns = [...turns, userTurn]
        setTurns(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)

        try {
            // Save user turn
            await storage.saveTurns(adventure.id, newTurns)

            // Process the message with LLM API
            await processUserMessage(userInput, newTurns)
        } catch (error) {
            console.error('Failed to process message:', error)
            setError('Failed to process your message. Please try again.')
            setIsLoading(false)
        }
    }

    // Process user message and get AI response
    const processUserMessage = async (userText: string, currentTurns: TurnEntry[]) => {
        try {
            // Build system prompt with full adventure context (scenario, characters, world)
            const charTags = adventure.characters?.map((c) => {
                const statsStr = Object.entries(c.stats || {})
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ')
                return `<character id="${c.id}" name="${c.name}" race="${c.race}" stats="${statsStr}" />`
            }).join('\n') || 'No characters';

            const world = adventure.world
            const worldDetails = world ? Object.entries(world.details || {})
                .map(([k, v]) => `${k}:${v}`)
                .join(', ') : 'No world details'

            const worldTag = world
                ? `<world id="${world.id}" name="${world.name}" type="${world.type}" details="${worldDetails}" />`
                : '<world>No world defined</world>'

            const systemPrompt = `You are the game master for an adventure.
Scenario: ${adventure.scenario}
Characters:
${charTags}
World:
${worldTag}
Respond to the user inputs as the assistant.`

            // Format history for API
            const history = turns
                .filter(t => t.type === 'user' || t.type === 'ai')
                .map(t => ({
                    role: t.type === 'user' ? 'user' as const : 'assistant' as const,
                    content: t.content
                }));

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({
                    model: MODEL_ID,
                    stream: true,
                    messages: [
                        {role: 'system', content: systemPrompt},
                        ...history,
                        {role: 'user', content: userText},
                    ],
                }),
            })

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            // Create a placeholder for the AI response turn
            const aiTurn: TurnEntry = {
                id: crypto.randomUUID(),
                type: 'ai',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: true // Add flag for streaming state
            }

            // Add the initial empty AI turn
            const updatedTurns = [...currentTurns, aiTurn]
            setTurns(updatedTurns)

            let assistantResponse = ''

            // Process the streamed response
            while (true) {
                const {done, value} = await reader.read()
                if (done) break

                const chunk = new TextDecoder().decode(value)
                const lines = chunk.split('\n').filter(line => line.trim() !== '')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content || ''
                            if (content) {
                                assistantResponse += content

                                // Update the AI turn with the new content
                                setTurns((prevTurns) => {
                                    const updated = prevTurns.map(t =>
                                        t.id === aiTurn.id
                                            ? {...t, content: assistantResponse}
                                            : t
                                    )
                                    return updated
                                })
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e)
                        }
                    }
                }
            }

            // After streaming completes, update the AI turn to final state
            setTurns((prevTurns) => {
                const finalTurns = prevTurns.map(t =>
                    t.id === aiTurn.id
                        ? {...t, content: assistantResponse, isStreaming: false}
                        : t
                )

                // Save the final turns to storage
                storage.saveTurns(adventure.id, finalTurns).catch(err =>
                    console.error('Failed to save turns:', err)
                )

                return finalTurns
            })

            setIsLoading(false)
        } catch (err) {
            console.error('Error processing message:', err)
            throw err
        }
    }

    return (
        <div className="center-panel">
            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)} className="close-error">×</button>
                </div>
            )}

            <div className="chat-container">
                <div className="messages-area">
                    {turns.length === 0 ? (
                        <div className="welcome-message">
                            <h3>Welcome to your adventure!</h3>
                            <p>Type your first action below to begin the story.</p>
                        </div>
                    ) : (
                        turns.map(turn => (
                            <div key={turn.id} className={`message ${turn.type}`}>
                                <div className="message-content">
                                    {turn.content}
                                    {turn.isStreaming && (
                                        <div className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    )}
                                </div>
                                <div className="message-timestamp">
                                    {new Date(turn.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef}/>
                </div>

                <form onSubmit={handleSubmit} className="input-area">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="What do you do next?"
                        className="message-input"
                        disabled={isLoading}
                    />
                    <div className="input-buttons">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!input.trim() || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <FaSpinner className="spinner"/>
                                    Sending...
                                </>
                            ) : 'Send'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleReset}
                            disabled={isLoading || turns.length === 0}
                        >
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {isLoading && (
                <div className="loading-indicator">
                    <FaSpinner className="spinner"/>
                    <span>AI is thinking...</span>
                </div>
            )}
        </div>
    )
}
