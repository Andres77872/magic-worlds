import type { Adventure, TurnEntry } from '../../../shared'
import { FaCog, FaDice, FaHistory } from 'react-icons/fa'
import './InteractionRightPanel.css'

interface InteractionRightPanelProps {
    adventure: Adventure
    turns?: TurnEntry[]
}

export function InteractionRightPanel({turns = [] }: InteractionRightPanelProps) {
    const handleDiceRoll = () => {
        const roll = Math.floor(Math.random() * 20) + 1
        const message = roll === 20 ? '🎉 Critical Success!' : roll === 1 ? '💀 Critical Failure!' : `You rolled a ${roll}!`
        alert(`🎲 ${message}`)
    }

    const handleSaveAdventure = () => {
        // In a real implementation, this would save the current adventure state
        alert('✨ Adventure progress saved!')
    }

    // Helper function to truncate text to 50 characters
    const truncateText = (text: string, maxLength: number = 50): string => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    // Format timestamp
    const formatTime = (timestamp: string): string => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    }

    return (
        <div className="right-panel interaction-panel interaction-panel--secondary">
            <div className="interaction-panel__section">
                <div className="interaction-panel__section-header">
                    <FaDice className="interaction-panel__section-icon"/>
                    <h4>Quick Actions</h4>
                </div>
                <div className="right-panel__action-buttons">
                    <button 
                        className="right-panel__action-button right-panel__action-button--dice interaction-btn interaction-btn--secondary interaction-focusable" 
                        onClick={handleDiceRoll}
                    >
                        <span className="right-panel__button-icon">🎲</span>
                        Roll D20
                    </button>
                    <button 
                        className="right-panel__action-button right-panel__action-button--save interaction-btn interaction-btn--primary interaction-focusable" 
                        onClick={handleSaveAdventure}
                    >
                        <span className="right-panel__button-icon">💾</span>
                        Save Progress
                    </button>
                </div>
            </div>

            <div className="interaction-panel__section">
                <div className="interaction-panel__section-header">
                    <FaHistory className="interaction-panel__section-icon"/>
                    <h4>Adventure Log</h4>
                </div>
                <div className="right-panel__log-area interaction-scrollbar">
                    {turns.length === 0 ? (
                        <div className="right-panel__log-empty">
                            <div className="right-panel__log-empty-icon">📜</div>
                            <p className="interaction-text--secondary">
                                No adventure logs yet.<br/>
                                Start your adventure to see the story unfold!
                            </p>
                        </div>
                    ) : (
                        turns.map((turn, index) => (
                            <div key={turn.id || index} className="right-panel__log-entry interaction-fade-in">
                                <div className="right-panel__log-time">
                                    <span>{formatTime(turn.timestamp)}</span>
                                    <span className={`right-panel__log-type right-panel__log-type--${turn.type}`}>
                                        {turn.type === 'user' ? 'You' : 'GM'}
                                    </span>
                                </div>
                                <div className="right-panel__log-text">
                                    {truncateText(turn.content)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="interaction-panel__section">
                <div className="interaction-panel__section-header">
                    <FaCog className="interaction-panel__section-icon"/>
                    <h4>Settings</h4>
                </div>
                <div className="right-panel__settings-area">
                    <div className="right-panel__setting-item">
                        <label className="right-panel__setting-label">
                            <input 
                                type="checkbox" 
                                className="right-panel__setting-checkbox"
                                defaultChecked 
                            />
                            <span className="right-panel__setting-text">Auto-save progress</span>
                        </label>
                    </div>
                    <div className="right-panel__setting-item">
                        <label className="right-panel__setting-label">
                            <input 
                                type="checkbox" 
                                className="right-panel__setting-checkbox"
                            />
                            <span className="right-panel__setting-text">Show dice rolls in chat</span>
                        </label>
                    </div>
                    <div className="right-panel__setting-item">
                        <label className="right-panel__setting-label">
                            <input 
                                type="checkbox" 
                                className="right-panel__setting-checkbox"
                                defaultChecked 
                            />
                            <span className="right-panel__setting-text">Enable sound effects</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
