import { FiBookOpen, FiGlobe, FiUserPlus } from 'react-icons/fi'
import './LandingQuickActions.css'

interface LandingQuickActionsProps {
    onCreateCharacter: () => void
    onBuildWorld: () => void
    onCreateAdventure: () => void
}

export function LandingQuickActions({ 
    onCreateCharacter, 
    onBuildWorld, 
    onCreateAdventure 
}: LandingQuickActionsProps) {
    return (
        <section className="landing-quick-actions" aria-labelledby="quick-actions-title">
            <h2 className="landing-section-title" id="quick-actions-title">Begin Your Journey</h2>
            <div className="landing-action-cards" role="group" aria-label="Quick action buttons">
                <button 
                    className="landing-action-card character-card hover-magical animate-entrance"
                    onClick={onCreateCharacter}
                    style={{animationDelay: '0.1s'}}
                    aria-describedby="character-description"
                >
                    <div className="landing-card-icon" aria-hidden="true">
                        <FiUserPlus />
                    </div>
                    <h3>Create Character</h3>
                    <p id="character-description">Forge a legendary hero with unique traits, abilities, and a compelling backstory</p>
                </button>
                
                <button 
                    className="landing-action-card world-card hover-magical animate-entrance"
                    onClick={onBuildWorld}
                    style={{animationDelay: '0.2s'}}
                    aria-describedby="world-description"
                >
                    <div className="landing-card-icon" aria-hidden="true">
                        <FiGlobe />
                    </div>
                    <h3>Build World</h3>
                    <p id="world-description">Design mystical realms filled with wonder, danger, and endless possibilities</p>
                </button>
                
                <button 
                    className="landing-action-card adventure-card hover-magical animate-entrance"
                    onClick={onCreateAdventure}
                    style={{animationDelay: '0.3s'}}
                    aria-describedby="adventure-description"
                >
                    <div className="landing-card-icon" aria-hidden="true">
                        <FiBookOpen />
                    </div>
                    <h3>Create Adventure</h3>
                    <p id="adventure-description">Craft epic quests, thrilling storylines, and memorable encounters</p>
                </button>
            </div>
        </section>
    )
} 