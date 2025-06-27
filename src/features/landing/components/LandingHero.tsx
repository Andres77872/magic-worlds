import { FiBookOpen, FiGlobe, FiUserPlus, FiZap } from 'react-icons/fi'
import { GiCastle, GiDragonHead, GiScrollQuill } from 'react-icons/gi'
import './LandingHero.css'

interface LandingHeroProps {
    charactersCount: number
    worldsCount: number
    totalAdventures: number
    hasContent: boolean
    onStartJourney: () => void
}

export function LandingHero({ 
    charactersCount, 
    worldsCount, 
    totalAdventures, 
    hasContent, 
    onStartJourney 
}: LandingHeroProps) {
    return (
        <section className="landing-hero-section animate-entrance" aria-labelledby="hero-title">
            <div className="landing-hero-background" aria-hidden="true">
                <div className="landing-hero-gradient"></div>
                <div className="landing-floating-elements">
                    <GiDragonHead className="landing-floating-icon dragon animate-float" />
                    <GiCastle className="landing-floating-icon castle animate-float" style={{animationDelay: '2s'}} />
                    <GiScrollQuill className="landing-floating-icon scroll animate-float" style={{animationDelay: '4s'}} />
                </div>
            </div>
            
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
                            className="landing-btn-hero btn btn-primary hover-magical click-sparkle"
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
                            <span className="landing-stat-number">{totalAdventures}</span>
                            <span className="landing-stat-label">Adventures</span>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
} 