import { useRef, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import type { Message } from '../types'
import '../App.css'

/**
 * Chat panel showing the conversation and text input.
 */
export function ChatPanel({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  onReset,
}: {
  messages: Message[]
  inputValue: string
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: FormEvent) => void
  onReset: () => void
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="center-panel">
      <button type="button" className="reset-button" onClick={onReset}>
        Reset Adventure
      </button>
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="chat-input-container">
        <input
          type="text"
          className="field-input"
          value={inputValue}
          onChange={onInputChange}
          placeholder="Type your message..."
        />
        <button type="submit" className="submit-button">
          Send
        </button>
      </form>
    </div>
  )
}