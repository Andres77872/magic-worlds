import { useState, useRef, useEffect, useCallback } from 'react'
import type { FormEvent, KeyboardEvent, ChangeEvent } from 'react'
import './Interaction.css'
import { FaPaperPlane, FaRedo, FaSpinner } from 'react-icons/fa'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  isLoading?: boolean
}

interface ChatPanelProps {
  messages: Message[]
  inputValue: string
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent) => void
  onReset: () => void
  isLoading: boolean
}

export function ChatPanel({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  onReset,
  isLoading,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    adjustTextareaHeight()
  }, [messages, inputValue])

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim() && !isLoading) {
        const form = e.currentTarget.form
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as unknown as FormEvent
          form.dispatchEvent(submitEvent as unknown as Event)
        }
      }
    }
  }

  const handleReset = () => {
    setIsResetting(true)
    onReset()
    // Reset the state after a short delay for visual feedback
    setTimeout(() => setIsResetting(false), 300)
  }

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e)
    adjustTextareaHeight()
  }

  return (
    <div className="center-panel">
      <div className="chat-header">
        <h3>Adventure Chat</h3>
        <button 
          onClick={handleReset} 
          className={`reset-button ${isResetting ? 'resetting' : ''}`}
          disabled={isResetting}
          aria-label="Reset conversation"
        >
          {isResetting ? (
            <FaSpinner className="reset-icon spin" />
          ) : (
            <FaRedo className="reset-icon" />
          )}
          <span>Reset</span>
        </button>
      </div>

      <div className="chat-window">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h4>Start the Adventure</h4>
            <p>Send a message to begin your journey</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp || index}-${message.role}`}
              className={`chat-message ${message.role}`}
            >
              <div className="message-role">
                {message.role === 'user' ? 'You' : 'Game Master'}
              </div>
              <div className="message-content">
                {message.isLoading ? (
                  <span className="typing-indicator" />
                ) : (
                  message.content
                )}
              </div>
              {message.timestamp && (
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSubmit} className="chat-form">
        <div className={`chat-input-container ${isInputFocused ? 'focused' : ''}`}>
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="field-input"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Type your message..."
              rows={1}
              disabled={isLoading}
              aria-label="Message input"
              style={{ minHeight: '44px', maxHeight: '200px', resize: 'none' }}
            />
            <button
              type="submit"
              className="submit-button"
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
            >
              {isLoading ? (
                <FaSpinner className="send-icon spin" />
              ) : (
                <FaPaperPlane className="send-icon" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}