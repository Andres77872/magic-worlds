
import { useState, useEffect } from 'react'
import type { FormEvent, Dispatch, SetStateAction } from 'react'
import '../../App.css'
import { storage } from '../../services/storage'
import type { Adventure, TurnEntry, Message } from '../../types'
import { ChatPanel } from './ChatPanel'
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
          timestamp: t.timestamp || new Date().toISOString() 
        },
      ])
      setMessages(initial)
    }
  }, [turns, messages.length])

  const handleReset = () => {
    setMessages([])
    setTurns([])
    storage.saveTurns(adventure.id, [])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const userText = inputValue.trim()
    if (!userText) return
    // Add user message locally
    setMessages((msgs) => [...msgs, { role: 'user', content: userText }])
    setInputValue('')
    // Placeholder for AI response
    setMessages((msgs) => [...msgs, { role: 'assistant', content: '' }])
    try {
      // Build system prompt with full adventure context (scenario, characters, world)
      const charTags = adventure.characters.map((c) => {
        const statsStr = Object.entries(c.stats)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')
        return `<character id="${c.id}" name="${c.name}" race="${c.race}" stats="${statsStr}" />`
      }).join('\n')
      
      const world = adventure.world
      const worldDetails = world ? Object.entries(world.details)
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
        { role: 'user' as const, content: t.userInput },
        { role: 'assistant' as const, content: t.assistantResponse },
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
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userText },
          ],
        }),
      })
      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let assistantContent = ''
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        const chunk = decoder.decode(value, { stream: true })
        const parts = chunk.split(/\n\n/)
        for (const part of parts) {
          if (part.trim().startsWith('data:')) {
            const jsonStr = part.replace(/^data:\s*/, '').trim()
            if (jsonStr === '[DONE]') {
              done = true
              break
            }
            try {
              const data = JSON.parse(jsonStr)
              const delta = data.choices?.[0]?.delta?.content
              if (delta) {
                assistantContent += delta
                setMessages((msgs) => {
                  const copy = [...msgs]
                  const last = copy[copy.length - 1]
                  if (last.role === 'assistant') {
                    last.content = assistantContent
                  }
                  return copy
                })
              }
            } catch {
              // skip parse errors
            }
          }
        }
      }
      // After streaming completes, record this turn
      const timestamp = new Date().toISOString()
      setTurns((prev) => {
        const next = [
          ...prev,
          { 
            number: prev.length + 1, 
            userInput: userText, 
            assistantResponse: assistantContent,
            timestamp,
            metadata: {}
          },
        ]
        storage.saveTurns(adventure.id, next)
        return next
      })
    } catch (err) {
      console.error('Streaming error', err)
    }
  }

  return (
    <ChatPanel
      messages={messages}
      inputValue={inputValue}
      onInputChange={(e) => setInputValue(e.target.value)}
      onSubmit={handleSubmit}
      onReset={handleReset}
    />
  )
}