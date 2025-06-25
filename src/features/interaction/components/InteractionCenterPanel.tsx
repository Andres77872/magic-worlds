import {useEffect, useRef, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared'
import {storage} from '../../../infrastructure/storage'
import {FaSpinner} from 'react-icons/fa'
import {parseForwardOptions, extractForwardOptions} from '../utils/jsonFixer'
import {ChatTurn} from './ChatTurn'
import './InteractionCenterPanel.css'

// API Configuration
const API_URL = 'https://magic.arz.ai/chat/openai/v1/completion'
const API_KEY = 'DUMMY_API_KEY'
const MODEL_ID = 'agt-29122b8b-b1af-4536-84b9-cf1abe02efa5'

// Forward option interface
interface ForwardOption {
    forward_question: string
}

// Extend TurnEntry to include forward options
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    isStreaming?: boolean
    isStreamingForwardOptions?: boolean
}

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

    const handleForwardOptionClick = (option: string) => {
        setInput(option)
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
            const aiTurn: ExtendedTurnEntry = {
                id: crypto.randomUUID(),
                type: 'ai',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: true, // Add flag for streaming state
                forwardOptions: undefined,
                isStreamingForwardOptions: false
            }

            // Add the initial empty AI turn
            let updatedTurns = [...currentTurns, aiTurn]
            setTurns(updatedTurns)

            let assistantResponse = ''
            let forwardOptionsBuffer = ''
            let isInsideForwardOptions = false
            let hasClosedForwardOptions = false
            let thinkBuffer = ''
            let isInsideThink = false

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
                                // Check for special tags (think and forward options)
                                for (let i = 0; i < content.length; i++) {
                                    const char = content[i]
                                    
                                    if (isInsideThink) {
                                        thinkBuffer += char
                                        
                                        // Check if we've completed the closing think tag
                                        if (thinkBuffer.includes('</think>')) {
                                            // Skip all thinking content - don't add it to assistantResponse
                                            isInsideThink = false
                                            thinkBuffer = ''
                                        }
                                        // Skip processing while inside think tags
                                        continue
                                    }
                                    
                                    if (isInsideForwardOptions && !hasClosedForwardOptions) {
                                        forwardOptionsBuffer += char
                                        
                                        // Check if we've completed the closing tag
                                        if (forwardOptionsBuffer.includes('</forward_options>')) {
                                            hasClosedForwardOptions = true
                                            
                                            // Extract the JSON content between the tags
                                            const match = forwardOptionsBuffer.match(/<forward_options>\s*(.*?)\s*<\/forward_options>/s)
                                            if (match && match[1]) {
                                                const forwardOptions = parseForwardOptions(match[1])
                                                
                                                if (forwardOptions && forwardOptions.length > 0) {
                                                    // Update the AI turn with forward options and stop streaming indicator
                                                    updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                                        t.id === aiTurn.id
                                                            ? {...t, forwardOptions, isStreamingForwardOptions: false}
                                                            : t
                                                    )
                                                    setTurns(updatedTurns)
                                                } else {
                                                    // No valid options parsed, just stop the streaming indicator
                                                    updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                                        t.id === aiTurn.id
                                                            ? {...t, isStreamingForwardOptions: false}
                                                            : t
                                                    )
                                                    setTurns(updatedTurns)
                                                }
                                            }
                                            
                                            // Continue processing remaining content after the tag
                                            const remainingContent = forwardOptionsBuffer.split('</forward_options>')[1] || ''
                                            assistantResponse += remainingContent
                                            isInsideForwardOptions = false
                                        } else {
                                            // While streaming forward options, try to parse partial JSON
                                            // to show options as they become available
                                            const partialMatch = forwardOptionsBuffer.match(/<forward_options>\s*(.*)/s)
                                            if (partialMatch && partialMatch[1]) {
                                                const partialOptions = extractForwardOptions(partialMatch[1])
                                                if (partialOptions && partialOptions.length > 0) {
                                                    // Update with partial options while still streaming
                                                    updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                                        t.id === aiTurn.id
                                                            ? {...t, forwardOptions: partialOptions, isStreamingForwardOptions: true}
                                                            : t
                                                    )
                                                    setTurns(updatedTurns)
                                                }
                                            }
                                        }
                                    } else if (!isInsideForwardOptions) {
                                        // Add character to response buffer
                                        assistantResponse += char
                                        
                                        // Check if we're starting a think tag
                                        if (assistantResponse.includes('<think>')) {
                                            isInsideThink = true
                                            thinkBuffer = '<think>'
                                            // Remove the think tag from the displayed content
                                            assistantResponse = assistantResponse.replace('<think>', '')
                                        }
                                        
                                        // Check if we have the start of the forward options tag
                                        if (assistantResponse.includes('<forward_options>') && !hasClosedForwardOptions) {
                                            isInsideForwardOptions = true
                                            forwardOptionsBuffer = '<forward_options>'
                                            // Remove the tag from the displayed content
                                            assistantResponse = assistantResponse.replace('<forward_options>', '')
                                            
                                            // Show the forward options streaming indicator immediately
                                            updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                                t.id === aiTurn.id
                                                    ? {...t, isStreamingForwardOptions: true}
                                                    : t
                                            )
                                            setTurns(updatedTurns)
                                        }
                                    } else {
                                        // After closing tag, just append normally
                                        assistantResponse += char
                                    }
                                }

                                // Update the AI turn with the new content (without forward options tags)
                                updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                    t.id === aiTurn.id
                                        ? {...t, content: assistantResponse}
                                        : t
                                )
                                setTurns(updatedTurns)
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e)
                        }
                    }
                }
            }

            // After streaming completes, update the AI turn to final state
            const finalTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                t.id === aiTurn.id
                    ? {...t, content: assistantResponse, isStreaming: false, isStreamingForwardOptions: false}
                    : t
            )
            
            setTurns(finalTurns)

            // Save the final turns to storage
            storage.saveTurns(adventure.id, finalTurns).catch(err =>
                console.error('Failed to save turns:', err)
            )

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
                            <div className="welcome-icon">🎭</div>
                            <h3>Welcome to your adventure!</h3>
                            <p>You are about to embark on an epic journey. What will your first action be?</p>
                            <div className="welcome-hint">
                                <span className="hint-icon">💡</span>
                                <span>Tip: Be descriptive in your actions to create a more immersive experience!</span>
                            </div>
                        </div>
                    ) : (
                        turns.map((turn: ExtendedTurnEntry) => (
                            <ChatTurn 
                                key={turn.id} 
                                turn={turn} 
                                onForwardOptionClick={handleForwardOptionClick}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef}/>
                </div>
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

            {isLoading && (
                <div className="loading-indicator">
                    <FaSpinner className="spinner"/>
                    <span>AI is thinking...</span>
                </div>
            )}
        </div>
    )
}
