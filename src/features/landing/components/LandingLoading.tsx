import './LandingLoading.css'

export function LandingLoading() {
    return (
        <div className="landing-loading-container" role="status" aria-live="polite">
            <div className="landing-loading-spinner" aria-hidden="true" />
            <p className="landing-loading-text">Summoning your magical worlds...</p>
        </div>
    )
} 