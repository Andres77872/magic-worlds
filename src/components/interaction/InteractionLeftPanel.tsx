import type { Adventure } from '../../types'
import './styles/InteractionLeftPanel.css'
import { FaGlobe, FaUsers, FaInfoCircle } from 'react-icons/fa'

export function InteractionLeftPanel({ adventure }: { adventure: Adventure }) {
  return (
    <div className="left-panel">
      <div className="panel-section">
        <div className="section-header">
          <FaInfoCircle className="section-icon" />
          <h4>Adventure Info</h4>
        </div>
        <div className="info-card">
          <p className="scenario-text">{adventure.scenario}</p>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-header">
          <FaGlobe className="section-icon" />
          <h4>World</h4>
        </div>
        {adventure.world ? (
          <div className="info-card">
            <h5 className="world-name">{adventure.world.name}</h5>
            <span className="world-type">{adventure.world.type}</span>
            {adventure.world.details && (
              <div className="world-details">
                {Object.entries(adventure.world.details).map(([key, value]) => (
                  <div key={key} className="detail-item">
                    <span className="detail-label">{key}:</span>
                    <span className="detail-value">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">No world selected</div>
        )}
      </div>

      <div className="panel-section">
        <div className="section-header">
          <FaUsers className="section-icon" />
          <h4>Characters ({adventure.characters?.length || 0})</h4>
        </div>
        {adventure.characters && adventure.characters.length > 0 ? (
          <div className="character-grid">
            {adventure.characters.map((character) => (
              <div key={character.id} className="character-card">
                <div className="character-avatar">
                  {character.name.charAt(0).toUpperCase()}
                </div>
                <div className="character-info">
                  <h5 className="character-name">{character.name}</h5>
                  <span className="character-race">{character.race}</span>
                  {character.stats && (
                    <div className="character-stats">
                      {Object.entries(character.stats).map(([stat, value]) => (
                        <div key={stat} className="stat-item">
                          <span className="stat-value">{value}</span>
                          <span className="stat-label">{stat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No characters added</div>
        )}
      </div>
    </div>
  )
}
