import './LandingTips.css'

export function LandingTips() {
    return (
        <section className="landing-tips-section animate-entrance" aria-labelledby="tips-title">
            <h2 className="landing-section-title" id="tips-title">How to Get Started</h2>
            <div className="landing-tips-grid">
                <div className="landing-tip-card">
                    <div className="landing-tip-number" aria-hidden="true">1</div>
                    <h3>Create Your Hero</h3>
                    <p>Design a character with unique stats, skills, and backstory that will shape your adventures</p>
                </div>
                <div className="landing-tip-card">
                    <div className="landing-tip-number" aria-hidden="true">2</div>
                    <h3>Build Your World</h3>
                    <p>Craft the setting where your adventures will unfold, complete with lore and atmosphere</p>
                </div>
                <div className="landing-tip-card">
                    <div className="landing-tip-number" aria-hidden="true">3</div>
                    <h3>Start an Adventure</h3>
                    <p>Launch into an AI-powered story with your character and watch the magic unfold</p>
                </div>
            </div>
        </section>
    )
} 