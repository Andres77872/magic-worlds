import type {Adventure} from '../../../shared'
import './InteractionLeftPanel.css'
import {FaGlobe, FaInfoCircle, FaUsers} from 'react-icons/fa'

interface InteractionLeftPanelProps {
    adventure: Adventure
    onBack: () => void
}

export function InteractionLeftPanel({adventure, onBack}: InteractionLeftPanelProps) {
    return (
        <div className="left-panel">
            <div className="left-panel__section-header">
                <button 
                    className="left-panel__back-button btn btn-secondary"
                    onClick={onBack}
                >
                    ← Back to Adventures
                </button>
            </div>
            
            <div className="left-panel__section">
                <div className="left-panel__section-header">
                    <FaInfoCircle />
                    <h4>Adventure Scenario</h4>
                </div>
                <div className="left-panel__card">
                    <p className="left-panel__scenario-text">{adventure.scenario}</p>
                </div>
            </div>

            <div className="left-panel__section">
                <div className="left-panel__section-header">
                    <FaGlobe />
                    <h4>World Setting</h4>
                </div>
                {adventure.world ? (
                    <div className="left-panel__card">
                        <h5 className="left-panel__world-name">{adventure.world.name}</h5>
                        <span className="left-panel__world-type">{adventure.world.type}</span>
                        {adventure.world.details && Object.keys(adventure.world.details).length > 0 && (
                            <div className="left-panel__world-details">
                                {Object.entries(adventure.world.details).map(([key, value]) => (
                                    <div key={key} className="left-panel__detail-item">
                                        <span className="left-panel__detail-key">{key}:</span>
                                        <span className="left-panel__detail-value">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="left-panel__card">
                        <p className="left-panel__no-data">No world selected</p>
                    </div>
                )}
            </div>

            <div className="left-panel__section">
                <div className="left-panel__section-header">
                    <FaUsers />
                    <h4>Characters</h4>
                </div>
                {adventure.characters && adventure.characters.length > 0 ? (
                    adventure.characters.map(character => (
                        <div key={character.id} className="left-panel__card">
                            <h5 className="left-panel__character-name">{character.name}</h5>
                            <span className="left-panel__character-race">{character.race}</span>
                            {character.stats && Object.keys(character.stats).length > 0 && (
                                <div className="left-panel__character-stats">
                                    {Object.entries(character.stats).map(([key, value]) => (
                                        <div key={key} className="left-panel__stat-item">
                                            <span className="left-panel__stat-key">{key}:</span>
                                            <span className="left-panel__stat-value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="left-panel__card">
                        <p className="left-panel__no-data">No characters selected</p>
                    </div>
                )}
            </div>
        </div>
    )
}
