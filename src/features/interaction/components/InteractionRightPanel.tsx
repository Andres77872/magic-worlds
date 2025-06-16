import type { Adventure } from '../../../shared/types'
import { FaCog, FaDice, FaHistory } from 'react-icons/fa'
import './InteractionRightPanel.css'

interface InteractionRightPanelProps {
    adventure: Adventure
}

export function InteractionRightPanel({ adventure }: InteractionRightPanelProps) {
    const handleDiceRoll = () => {
        const roll = Math.floor(Math.random() * 20) + 1
        alert(`🎲 You rolled a ${roll}!`)
    }

    const handleSaveAdventure = () => {
        // In a real implementation, this would save the current adventure state
        alert('Adventure progress saved!')
    }

    return (
        <div className="right-panel">
            <div className="panel-section">
                <div className="section-header">
                    <FaDice className="section-icon"/>
                    <h4>Actions</h4>
                </div>
                <div className="action-buttons">
                    <button className="btn btn-secondary btn-block" onClick={handleDiceRoll}>
                        🎲 Roll D20
                    </button>
                    <button className="btn btn-primary btn-block" onClick={handleSaveAdventure}>
                        💾 Save Progress
                    </button>
                </div>
            </div>

            <div className="panel-section">
                <div className="section-header">
                    <FaHistory className="section-icon"/>
                    <h4>Adventure Log</h4>
                </div>
                <div className="log-area">
                    <div className="log-entry">
                        <span className="log-time">Started</span>
                        <span className="log-text">Adventure began</span>
                    </div>
                    {/* Additional log entries would be added here */}
                </div>
            </div>

            <div className="panel-section">
                <div className="section-header">
                    <FaCog className="section-icon"/>
                    <h4>Settings</h4>
                </div>
                <div className="settings-area">
                    <div className="setting-item">
                        <label className="setting-label">
                            <input type="checkbox" defaultChecked />
                            Auto-save progress
                        </label>
                    </div>
                    <div className="setting-item">
                        <label className="setting-label">
                            <input type="checkbox" />
                            Show dice rolls
                        </label>
                    </div>
                    <div className="setting-item">
                        <label className="setting-label">
                            <input type="checkbox" defaultChecked />
                            Sound effects
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
