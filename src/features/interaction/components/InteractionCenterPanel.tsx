import {useEffect, useRef, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared'
import {storage} from '../../../infrastructure/storage'
import {FaSpinner} from 'react-icons/fa'
import {parseForwardOptions, extractForwardOptions} from '../utils/jsonFixer'
import {ChatTurn} from './ChatTurn'
import {generateUUID} from '../../../utils/uuid'
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
    imageUrl?: string  // Add image URL field
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

    // Check if we can generate an AI response (last message is from user)
    const canGenerateResponse = turns.length > 0 && turns[turns.length - 1].type === 'user' && !isLoading

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

    const handleRegenerateResponse = async (turnId: string) => {
        // Find the turn to regenerate
        const turnIndex = turns.findIndex(turn => turn.id === turnId)
        if (turnIndex === -1) return

        // Find the last user message before this AI response
        let userMessageIndex = turnIndex - 1
        while (userMessageIndex >= 0 && turns[userMessageIndex].type !== 'user') {
            userMessageIndex--
        }
        
        if (userMessageIndex < 0) return // No user message found

        const userMessage = turns[userMessageIndex].content
        const existingAiTurn = turns[turnIndex] as ExtendedTurnEntry
        
        // Remove any subsequent turns but keep the AI turn we're regenerating
        const truncatedTurns = turns.slice(0, turnIndex + 1)
        
        // Reset the AI turn content and set it to streaming
        const resetAiTurn: ExtendedTurnEntry = {
            ...existingAiTurn,
            content: '',
            isStreaming: true,
            forwardOptions: undefined,
            isStreamingForwardOptions: false,
            imageUrl: undefined  // Clear the image URL for regeneration
        }
        
        const updatedTurns = [...truncatedTurns.slice(0, -1), resetAiTurn]
        setTurns(updatedTurns)
        setIsLoading(true)
        setError(null)

        try {
            // Save updated turns
            await storage.saveTurns(adventure.id, updatedTurns)

            // Regenerate the response using the existing turn
            await processUserMessage(userMessage, updatedTurns.slice(0, -1), resetAiTurn)
        } catch (error) {
            console.error('Failed to regenerate response:', error)
            setError('Failed to regenerate response. Please try again.')
            setIsLoading(false)
            
            // Reset streaming states on the AI turn when regeneration fails
            const failedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                t.id === resetAiTurn.id
                    ? {
                        ...t,
                        isStreaming: false,
                        isStreamingForwardOptions: false,
                        content: '' // Keep content empty so regeneration button stays visible
                    }
                    : t
            )
            setTurns(failedTurns)
            
            // Save the failed state to storage
            storage.saveTurns(adventure.id, failedTurns).catch(err =>
                console.error('Failed to save failed turns:', err)
            )
        }
    }

    const handleDeleteTurn = async (turnId: string) => {
        if (!window.confirm('Are you sure you want to delete this message?')) {
            return
        }

        try {
            const updatedTurns = turns.filter(turn => turn.id !== turnId)
            setTurns(updatedTurns)
            
            // Save the updated turns to storage
            await storage.saveTurns(adventure.id, updatedTurns)
        } catch (error) {
            console.error('Failed to delete turn:', error)
            setError('Failed to delete message. Please try again.')
        }
    }

    const handleEditTurn = async (turnId: string, newContent: string) => {
        try {
            const updatedTurns = turns.map(turn => 
                turn.id === turnId 
                    ? { ...turn, content: newContent, timestamp: new Date().toISOString() }
                    : turn
            )
            setTurns(updatedTurns)
            
            // Save the updated turns to storage
            await storage.saveTurns(adventure.id, updatedTurns)
        } catch (error) {
            console.error('Failed to edit turn:', error)
            setError('Failed to edit message. Please try again.')
        }
    }

    const handleGenerateResponse = async () => {
        if (!canGenerateResponse) return

        const lastUserTurn = turns[turns.length - 1]
        const userMessage = lastUserTurn.content

        // Create new AI turn
        const aiTurn: ExtendedTurnEntry = {
            id: generateUUID(),
            type: 'ai',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: false,
            forwardOptions: undefined,
            isStreamingForwardOptions: false
        }

        const newTurns = [...turns, aiTurn]
        setTurns(newTurns)
        setIsLoading(true)
        setError(null)

        try {
            // Save turns with empty AI turn
            await storage.saveTurns(adventure.id, newTurns)

            // Process the message with LLM API using the last user message
            await processUserMessage(userMessage, newTurns.slice(0, -1), aiTurn)
        } catch (error) {
            console.error('Failed to generate response:', error)
            setError('Failed to generate response. Please try again.')
            setIsLoading(false)
            
            // Reset streaming states on the AI turn when processing fails
            const failedTurns = newTurns.map((t: ExtendedTurnEntry) =>
                t.id === aiTurn.id
                    ? {
                        ...t,
                        isStreaming: false,
                        isStreamingForwardOptions: false,
                        content: '' // Keep content empty so regeneration button stays visible
                    }
                    : t
            )
            setTurns(failedTurns)
            
            // Save the failed state to storage
            storage.saveTurns(adventure.id, failedTurns).catch(err =>
                console.error('Failed to save failed turns:', err)
            )
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userInput = input.trim()

        const userTurn: TurnEntry = {
            id: generateUUID(),
            type: 'user',
            content: userInput,
            timestamp: new Date().toISOString()
        }

        // Check if the last turn is an empty AI turn from a previous error
        const lastTurn = turns[turns.length - 1] as ExtendedTurnEntry
        const hasEmptyAiTurn = lastTurn && lastTurn.type === 'ai' && lastTurn.content === ''

        let newTurns: TurnEntry[]
        let existingAiTurn: ExtendedTurnEntry | undefined

        if (hasEmptyAiTurn) {
            // Reuse the existing empty AI turn
            newTurns = [...turns.slice(0, -1), userTurn, lastTurn]
            existingAiTurn = lastTurn
        } else {
            // Create new AI turn
            const aiTurn: ExtendedTurnEntry = {
                id: generateUUID(),
                type: 'ai',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: false,
                forwardOptions: undefined,
                isStreamingForwardOptions: false
            }
            newTurns = [...turns, userTurn, aiTurn]
            existingAiTurn = aiTurn
        }

        setTurns(newTurns)
        setInput('')
        setIsLoading(true)
        setError(null)

        try {
            // Save turns with empty AI turn
            await storage.saveTurns(adventure.id, newTurns)

            // Process the message with LLM API
            await processUserMessage(userInput, newTurns.slice(0, -1), existingAiTurn)
        } catch (error) {
            console.error('Failed to process message:', error)
            setError('Failed to process your message. Please try again.')
            setIsLoading(false)
            
            // Reset streaming states on the AI turn when processing fails
            const failedTurns = newTurns.map((t: ExtendedTurnEntry) =>
                t.id === existingAiTurn.id
                    ? {
                        ...t,
                        isStreaming: false,
                        isStreamingForwardOptions: false,
                        content: '' // Keep content empty so regeneration button stays visible
                    }
                    : t
            )
            setTurns(failedTurns)
            
            // Save the failed state to storage
            storage.saveTurns(adventure.id, failedTurns).catch(err =>
                console.error('Failed to save failed turns:', err)
            )
        }
    }

    // Process user message and get AI response
    const processUserMessage = async (_userText: string, currentTurns: TurnEntry[], existingTurn?: ExtendedTurnEntry) => {
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
            const history = currentTurns
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
                    ],
                }),
            })

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            // Use the existing AI turn that was passed in
            if (!existingTurn) {
                throw new Error('No AI turn provided for processing')
            }

            const aiTurn = existingTurn

            // Set the AI turn to streaming state and add it to the turns
            const streamingAiTurn: ExtendedTurnEntry = {
                ...aiTurn,
                isStreaming: true,
                content: '',
                forwardOptions: undefined,
                isStreamingForwardOptions: false
            }

            let updatedTurns = [...currentTurns, streamingAiTurn]
            setTurns(updatedTurns)

            let assistantResponse = ''
            let forwardOptionsBuffer = ''
            let isInsideForwardOptions = false
            let hasClosedForwardOptions = false
            let thinkBuffer = ''
            let isInsideThink = false
            let imageUrl: string | undefined = undefined  // Add variable to store image URL

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
                            
                            // Extract image URL from extras if present
                            if (parsed.extras && Array.isArray(parsed.extras) && parsed.extras.length > 0) {
                                const imageData = parsed.extras[0]
                                if (imageData.png) {
                                    imageUrl = imageData.png  // Use PNG version
                                    // You could also use webp or 512 versions:
                                    // imageUrl = imageData.webp || imageData['512'] || imageData.png
                                    
                                    // Update the AI turn with the image URL immediately
                                    updatedTurns = updatedTurns.map((t: ExtendedTurnEntry) =>
                                        t.id === aiTurn.id
                                            ? {...t, imageUrl}
                                            : t
                                    )
                                    setTurns(updatedTurns)
                                }
                            }
                            
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
                    ? {...t, content: assistantResponse, isStreaming: false, isStreamingForwardOptions: false, imageUrl}
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
            setIsLoading(false)
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
                                <div className="generate-response-suggestion">
                                    <div className="suggestion-content">
                                        <span className="suggestion-icon">🎭</span>
                                        <div className="suggestion-text">
                                            <span className="suggestion-title">Waiting for Game Master response</span>
                                            <span className="suggestion-subtitle">Click to generate an AI response (optional)</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-generate-response-inline"
                                            onClick={handleGenerateResponse}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <FaSpinner className="spinner"/>
                                                    Generating...
                                                </>
                                            ) : 'Generate Response'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
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
