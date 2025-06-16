import type {Adventure} from '../../../shared/types'
import './InteractionLeftPanel.css'
import {FaGlobe, FaInfoCircle, FaUsers} from 'react-icons/fa'

interface InteractionLeftPanelProps {
    adventure: Adventure
    onBack: () => void
}

export function InteractionLeftPanel({adventure, onBack}: InteractionLeftPanelProps) {
    return (
        <div className="left-panel">
            <div className="panel-header">
                <button className="btn btn-secondary btn-sm" onClick={onBack}>
                    ← Back
                </button>
            </div>
            
            <div className="panel-section">
                <div className="section-header">
                    <FaInfoCircle className="section-icon"/>
                    <h4>Adventure Info</h4>
                </div>
                <div className="info-card">
                    <p className="scenario-text">{adventure.scenario}</p>
                </div>
            </div>

            <div className="panel-section">
                <div className="section-header">
                    <FaGlobe className="section-icon"/>
                    <h4>Worlds</h4>
                </div>
                {adventure.world ? (
                    <div className="info-card">
                        <h5 className="world-name">{adventure.world.name}</h5>
                        <span className="world-type">{adventure.world.type}</span>
                        {adventure.world.details && Object.keys(adventure.world.details).length > 0 && (
                            <div className="world-details">
                                {Object.entries(adventure.world.details).map(([key, value]) => (
                                    <div key={key} className="detail-item">
                                        <span className="detail-key">{key}:</span>
                                        <span className="detail-value">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="info-card">
                        <p className="no-data">No worlds selected</p>
                    </div>
                )}
            </div>

            <div className="panel-section">
                <div className="section-header">
                    <FaUsers className="section-icon"/>
                    <h4>Characters</h4>
                </div>
                {adventure.characters && adventure.characters.length > 0 ? (
                    adventure.characters.map(character => (
                        <div key={character.id} className="info-card character-card">
                            <h5 className="character-name">{character.name}</h5>
                            <span className="character-race">{character.race}</span>
                            {character.stats && Object.keys(character.stats).length > 0 && (
                                <div className="character-stats">
                                    {Object.entries(character.stats).map(([key, value]) => (
                                        <div key={key} className="stat-item">
                                            <span className="stat-key">{key}:</span>
                                            <span className="stat-value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="info-card">
                        <p className="no-data">No characters selected</p>
                    </div>
                )}
            </div>
        </div>
    )
}
