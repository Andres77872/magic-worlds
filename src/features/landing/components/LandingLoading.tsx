import { GiMagicSwirl } from 'react-icons/gi'
import './LandingLoading.css'

export function LandingLoading() {
    return (
        <div className="landing-loading-container" role="status" aria-live="polite">
            <GiMagicSwirl 
                className="landing-loading-spinner" 
                aria-hidden="true"
            />
            <p className="landing-loading-text">Summoning your magical worlds...</p>
            <div className="landing-loading-particles" aria-hidden="true">
                <span className="landing-particle"></span>
                <span className="landing-particle"></span>
                <span className="landing-particle"></span>
            </div>
        </div>
    )
} 