import type {Dispatch, FormEvent, SetStateAction} from 'react'
import {useEffect, useState} from 'react'
import './Interaction.css'
import {storage} from '../../services/storage'
import type {Adventure, Message, TurnEntry} from '../../types'
import {ChatPanel} from './ChatPanel'
import {FaSpinner} from 'react-icons/fa'

const API_URL = 'https://magic.arz.ai/chat/openai/v1/completion'
const API_KEY = 'DUMMY_API_KEY'
const MODEL_ID = 'agt-29122b8b-b1af-4536-84b9-cf1abe02efa5'

export function InteractionCenterPanel({
                                           adventure,
                                           turns,
                                           setTurns,
                                       }: {
    adventure: Adventure
    turns: TurnEntry[]
    setTurns: Dispatch<SetStateAction<TurnEntry[]>>
}) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize messages from turns when component mounts or turns change
    useEffect(() => {
        if (turns.length > 0 && messages.length === 0) {
            const initial: Message[] = turns.flatMap((t) => [
                {
                    role: 'user' as const,
                    content: t.userInput || '',
                    timestamp: t.timestamp || new Date().toISOString()
                },
                {
                    role: 'assistant' as const,
                    content: t.assistantResponse || '',
                    timestamp: t.timestamp || new Date().toISOString(),
                    isLoading: false
                },
            ])
            setMessages(initial)
        }
    }, [turns, messages.length])

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset this adventure? This will clear all conversation history.')) {
            setMessages([])
            setTurns([])
            setError(null)
            storage.saveTurns(adventure.id, [])
        }
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const userText = inputValue.trim()
        if (!userText || isLoading) return

        try {
            setError(null)
            setIsLoading(true)

            // Add user message locally
            const userMessage: Message = {
                role: 'user',
                content: userText,
                timestamp: new Date().toISOString()
            }
            setMessages((msgs) => [...msgs, userMessage])
            setInputValue('')

            // Add loading message
            const loadingMessage: Message = {
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                isLoading: true
            }
            setMessages((msgs) => [...msgs, loadingMessage])

            // Process the message and get AI response
            await processUserMessage(userText)
        } catch (err) {
            console.error('Error processing message:', err)
            setError('Failed to process your message. Please try again.')
            // Remove the loading message if there was an error
            setMessages(msgs => msgs.filter(m => !m.isLoading))
        } finally {
            setIsLoading(false)
        }
    }

    // Process user message and get AI response
    const processUserMessage = async (userText: string) => {
        try {
            // Build system prompt with full adventure context (scenario, characters, world)
            const charTags = adventure.characters.map((c) => {
                const statsStr = Object.entries(c.stats || {})
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ')
                return `<character id="${c.id}" name="${c.name}" race="${c.race}" stats="${statsStr}" />`
            }).join('\n')

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

            const history = turns.flatMap((t) => [
                {role: 'user' as const, content: t.userInput},
                {role: 'assistant' as const, content: t.assistantResponse},
            ])

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

            let assistantResponse = ''
            let isFirstChunk = true

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
                                // Update the last message with the new content
                                setMessages(msgs => {
                                    const newMsgs = [...msgs]
                                    const lastMsg = newMsgs[newMsgs.length - 1]
                                    if (lastMsg) {
                                        lastMsg.content = assistantResponse
                                        lastMsg.isLoading = false
                                    }
                                    return newMsgs
                                })
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e)
                        }
                    }
                }

                // After first chunk, we can remove the loading state
                if (isFirstChunk) {
                    isFirstChunk = false
                }
            }

            // After streaming completes, record this turn
            const newTurn: TurnEntry = {
                number: turns.length + 1,
                userInput: userText,
                assistantResponse: assistantResponse,
                timestamp: new Date().toISOString(),
                metadata: {}
            }

            const updatedTurns = [...turns, newTurn]
            setTurns(updatedTurns)
            storage.saveTurns(adventure.id, updatedTurns)

        } catch (err) {
            console.error('Error processing message:', err)
            throw err // Re-throw to be caught by the caller
        }
    }

    return (
        <div className="interaction-center">
            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)} className="close-error">×</button>
                </div>
            )}

            <ChatPanel
                messages={messages}
                inputValue={inputValue}
                onInputChange={(e) => setInputValue(e.target.value)}
                onSubmit={handleSubmit}
                onReset={handleReset}
                isLoading={isLoading}
            />

            {isLoading && (
                <div className="loading-indicator">
                    <FaSpinner className="spinner"/>
                    <span>AI is thinking...</span>
                </div>
            )}
        </div>
    )
}