import { useState, useRef, useEffect } from 'react'
import type { Adventure, TurnEntry } from '../../../shared/types'
import { storage } from '../../../infrastructure/storage'
import './InteractionCenterPanel.css'

interface InteractionCenterPanelProps {
    adventure: Adventure
    turns: TurnEntry[]
    setTurns: (turns: TurnEntry[]) => void
}

export function InteractionCenterPanel({ adventure, turns, setTurns }: InteractionCenterPanelProps) {
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [turns])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userTurn: TurnEntry = {
            id: crypto.randomUUID(),
            type: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        }

        const newTurns = [...turns, userTurn]
        setTurns(newTurns)
        setInput('')
        setIsLoading(true)

        try {
            // Save user turn
            await storage.saveTurns(adventure.id, newTurns)

            // Simulate AI response (in real app, this would call an AI service)
            setTimeout(async () => {
                const aiTurn: TurnEntry = {
                    id: crypto.randomUUID(),
                    type: 'ai',
                    content: `The adventure continues... (This is a placeholder AI response to: "${userTurn.content}")`,
                    timestamp: new Date().toISOString()
                }

                const updatedTurns = [...newTurns, aiTurn]
                setTurns(updatedTurns)
                await storage.saveTurns(adventure.id, updatedTurns)
                setIsLoading(false)
            }, 1000)
        } catch (error) {
            console.error('Failed to save turn:', error)
            setIsLoading(false)
        }
    }

    return (
        <div className="center-panel">
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
                                </div>
                                <div className="message-timestamp">
                                    {new Date(turn.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="message ai">
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
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
                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={!input.trim() || isLoading}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    )
}
