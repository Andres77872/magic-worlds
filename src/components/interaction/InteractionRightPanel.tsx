import {useState} from 'react'
import type {Adventure, TurnEntry} from '../../types'
import './Interaction.css'
import {FaChevronDown, FaChevronUp} from 'react-icons/fa'

export function InteractionRightPanel({
                                          adventure,
                                          turns = [],
                                      }: {
    adventure?: Adventure
    turns?: TurnEntry[]
}) {
    const [expandedTurn, setExpandedTurn] = useState<number | null>(null)
    const [isScrolling, setIsScrolling] = useState(false)
    const [scrollPosition, setScrollPosition] = useState(0)

    const toggleTurn = (turnNumber: number) => {
        setExpandedTurn(expandedTurn === turnNumber ? null : turnNumber)
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement
        setScrollPosition(target.scrollTop)
    }

    if (!adventure) {
        return (
            <div className="right-panel">
                <div className="empty-state">
                    <div className="empty-state-icon">📖</div>
                    <h4>No Adventure Selected</h4>
                    <p>Select or create an adventure to begin</p>
                </div>
            </div>
        )
    }


    return (
        <div className="right-panel">
            <div className="panel-section">
                <div className="section-header">
                    <h4>Adventure Log</h4>
                    <span className="badge">{turns.length} turns</span>
                </div>

                {!turns || turns.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💬</div>
                        <h4>No Turns Yet</h4>
                        <p>Start the conversation to see the log here</p>
                    </div>
                ) : (
                    <div
                        className={`turn-list-container ${isScrolling ? 'scrolling' : ''}`}
                        onScroll={handleScroll}
                        onMouseEnter={() => setIsScrolling(true)}
                        onMouseLeave={() => setIsScrolling(false)}
                    >
                        <div className="turn-list">
                            {turns.map((turn) => {
                                const userText = turn.userInput || ''
                                const aiText = turn.assistantResponse || ''
                                const isExpanded = expandedTurn === turn.number

                                return (
                                    <div
                                        key={turn.number}
                                        className={`turn-item ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => toggleTurn(turn.number)}
                                    >
                                        <div className="turn-header">
                                            <div className="turn-number">Turn {turn.number}</div>
                                            <div className="turn-actions">
                                                {isExpanded ? <FaChevronUp/> : <FaChevronDown/>}
                                            </div>
                                        </div>

                                        <div className="turn-content">
                                            <div className="message user-message">
                                                <div className="message-sender">You</div>
                                                <div className="message-text">
                                                    {isExpanded ? userText : `${userText.slice(0, 80)}${userText.length > 80 ? '...' : ''}`}
                                                </div>
                                            </div>

                                            <div className="message ai-message">
                                                <div className="message-sender">AI</div>
                                                <div className="message-text">
                                                    {isExpanded
                                                        ? aiText
                                                        : aiText
                                                            ? `${aiText.slice(0, 80)}${aiText.length > 80 ? '...' : ''}`
                                                            : '...'}
                                                </div>
                                            </div>
                                        </div>

                                        {turn.timestamp && (
                                            <div className="turn-timestamp">
                                                {new Date(turn.timestamp).toLocaleTimeString()}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {isScrolling && scrollPosition > 10 && (
                            <div className="scroll-indicator top">
                                <FaChevronUp/>
                            </div>
                        )}

                        {isScrolling && scrollPosition < 100 && (
                            <div className="scroll-indicator bottom">
                                <FaChevronDown/>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}