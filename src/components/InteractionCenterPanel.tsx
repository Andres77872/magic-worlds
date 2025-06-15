import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import '../App.css'

const API_URL = 'https://magic.arz.ai/chat/openai/v1/completion'
const API_KEY = 'DUMMY_API_KEY'
const MODEL_ID = 'agt-29122b8b-b1af-4536-84b9-cf1abe02efa5'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function InteractionCenterPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle user form submit and stream AI response
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const userText = inputValue.trim()
    if (!userText) return
    // Add user message
    setMessages((msgs) => [...msgs, { role: 'user', content: userText }])
    setInputValue('')
    // Placeholder for AI response
    setMessages((msgs) => [...msgs, { role: 'assistant', content: '' }])
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL_ID, stream: true, messages: [{ role: 'user', content: userText }] }),
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
    } catch (err) {
      console.error('Streaming error', err)
    }
  }

  return (
    <div className="center-panel">
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-input-container">
        <input
          type="text"
          className="field-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit" className="submit-button">
          Send
        </button>
      </form>
    </div>
  )
}