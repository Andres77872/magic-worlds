import { FiBookOpen, FiGlobe, FiUserPlus, FiZap, FiPenTool, FiPlay } from 'react-icons/fi'
import './LandingHero.css'
import type { Adventure } from '../../../shared'
import { useUserData, useAdventureSessions } from '../../../app/hooks'

interface LandingHeroProps {
    activeAdventures: number
    onStartJourney: () => void
    lastActiveAdventure?: Adventure
    onContinueAdventure?: (adventure: Adventure) => void
}

export function LandingHero({ 
    activeAdventures, 
    onStartJourney,
    lastActiveAdventure,
    onContinueAdventure
}: LandingHeroProps) {
    const { userData, isLoading: userDataLoading, error: userDataError } = useUserData()
    const { count: apiActiveAdventures, isLoading: sessionsLoading } = useAdventureSessions()
    
    // Extract counts from API response
    const charactersCount = userData?.card_counts?.character ?? 0
    const worldsCount = userData?.card_counts?.world ?? 0
    const templatesCount = userData?.card_counts?.adventure_template ?? 0
    
    // Use API active adventures count if available, otherwise use prop (for backward compatibility)
    const activeAdventuresCount = sessionsLoading ? activeAdventures : apiActiveAdventures
    
    const hasContent = charactersCount > 0 || worldsCount > 0 || templatesCount > 0 || activeAdventuresCount > 0
    
    // Show loading state while fetching user data
    if (userDataLoading) {
        return (
            <section className="landing-hero-section" aria-labelledby="hero-title">
                <div className="landing-hero-background" aria-hidden="true" />
                <div className="landing-hero-content">
                    <h1 className="landing-hero-title" id="hero-title">
                        <span className="landing-title-line">🌟 Magic Worlds</span>
                        <span className="landing-title-subtitle">Loading your realm...</span>
                    </h1>
                </div>
            </section>
        )
    }
    
    // Show error state if user data failed to load
    if (userDataError) {
        return (
            <section className="landing-hero-section" aria-labelledby="hero-title">
                <div className="landing-hero-background" aria-hidden="true" />
                <div className="landing-hero-content">
                    <h1 className="landing-hero-title" id="hero-title">
                        <span className="landing-title-line">🌟 Magic Worlds</span>
                        <span className="landing-title-subtitle">Forge Your Legend</span>
                    </h1>
                    <p className="landing-hero-description">
                        Create epic characters, build mystical worlds, and embark on AI-powered adventures that bring your imagination to life
                    </p>
                    <div className="landing-hero-cta">
                        <button 
                            className="landing-btn-hero btn btn-primary"
                            onClick={onStartJourney}
                            aria-describedby="cta-description"
                        >
                            <FiZap aria-hidden="true" />
                            Start Your First Adventure
                        </button>
                        <p id="cta-description" className="sr-only">
                            Begin your journey by creating your first character
                        </p>
                    </div>
                </div>
            </section>
        )
    }
    return (
        <section className="landing-hero-section" aria-labelledby="hero-title">
            <div className="landing-hero-background" aria-hidden="true" />
            
            <div className="landing-hero-content">
                <h1 className="landing-hero-title" id="hero-title">
                    <span className="landing-title-line">🌟 Magic Worlds</span>
                    <span className="landing-title-subtitle">Forge Your Legend</span>
                </h1>
                <p className="landing-hero-description">
                    Create epic characters, build mystical worlds, and embark on AI-powered adventures that bring your imagination to life
                </p>
                
                {!hasContent ? (
                    <div className="landing-hero-cta">
                        <button 
                            className="landing-btn-hero btn btn-primary"
                            onClick={onStartJourney}
                            aria-describedby="cta-description"
                        >
                            <FiZap aria-hidden="true" />
                            Start Your First Adventure
                        </button>
                        <p id="cta-description" className="sr-only">
                            Begin your journey by creating your first character
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="landing-hero-stats" role="region" aria-label="Your magical world statistics">
                            <div className="landing-stat-card">
                                <FiUserPlus className="landing-stat-icon" aria-hidden="true" />
                                <span className="landing-stat-number">{charactersCount}</span>
                                <span className="landing-stat-label">Heroes</span>
                            </div>
                            <div className="landing-stat-card">
                                <FiGlobe className="landing-stat-icon" aria-hidden="true" />
                                <span className="landing-stat-number">{worldsCount}</span>
                                <span className="landing-stat-label">Worlds</span>
                            </div>
                            <div className="landing-stat-card">
                                <FiBookOpen className="landing-stat-icon" aria-hidden="true" />
                                <span className="landing-stat-number">{templatesCount}</span>
                                <span className="landing-stat-label">Templates</span>
                            </div>
                            <div className="landing-stat-card">
                                <FiPenTool className="landing-stat-icon" aria-hidden="true" />
                                <span className="landing-stat-number">{activeAdventuresCount}</span>
                                <span className="landing-stat-label">Active Adventures</span>
                            </div>
                        </div>
                        
                        {lastActiveAdventure && onContinueAdventure && (
                            <div className="landing-adventure-card-container" role="region" aria-label="Your last active adventure">
                                <div className="landing-adventure-card">
                                    <div className="landing-adventure-content">
                                        <h3 className="landing-adventure-title">Your Active Adventure</h3>
                                        <p className="landing-adventure-description">
                                            {lastActiveAdventure.scenario || 'Continue your magical journey...'}
                                        </p>
                                    </div>
                                    <button 
                                        className="landing-adventure-btn btn btn-primary"
                                        onClick={() => onContinueAdventure(lastActiveAdventure)}
                                        aria-label="Continue your active adventure"
                                    >
                                        <FiPlay aria-hidden="true" />
                                        Continue Adventure
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    )
} 