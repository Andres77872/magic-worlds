/**
 * Landing page component - Enhanced with magical UI/UX
 */

import { useState } from 'react'
import { useNavigation, useData } from '../../../app/hooks'
import { ConfirmDialog } from '../../../ui/components'
import { CharacterList, InProgressList, TemplateList, WorldList } from '../../../ui/components/lists'
import { FiBookOpen, FiGlobe, FiTrash2, FiUserPlus, FiPlay, FiZap } from 'react-icons/fi'
import { GiCastle, GiDragonHead, GiMagicSwirl, GiScrollQuill } from 'react-icons/gi'
import './LandingPage.css'
import type { Character, World, Adventure } from '../../../shared/types'

export function LandingPage() {
    const { setPage } = useNavigation()
    const { 
        characters, 
        worlds, 
        templateAdventures, 
        inProgressAdventures,
        isLoading,
        editCharacter,
        deleteCharacter,
        editWorld,
        deleteWorld,
        editTemplate,
        startTemplate,
        deleteTemplate,
        editInProgress,
        deleteInProgress,
        clearAllData
    } = useData()
    
    const [confirmClear, setConfirmClear] = useState(false)
    const [activeSection, setActiveSection] = useState<'characters' | 'worlds' | 'templates' | 'inprogress'>('inprogress')

    const handleCharacterEdit = (character: Character) => {
        editCharacter(character)
        setPage('character')
    }

    const handleWorldEdit = (world: World) => {
        editWorld(world)
        setPage('world')
    }

    const handleTemplateEdit = (template: Adventure) => {
        editTemplate(template)
        setPage('adventure')
    }

    const handleTemplateStart = (template: Adventure) => {
        startTemplate(template)
        setPage('interaction')
    }

    const handleInProgressEdit = (adventure: Adventure) => {
        editInProgress(adventure)
        setPage('interaction')
    }

    const handleClearAll = async () => {
        await clearAllData()
        setConfirmClear(false)
    }

    // Calculate stats for the hero section
    const totalAdventures = templateAdventures.length + inProgressAdventures.length
    const hasContent = characters.length > 0 || worlds.length > 0 || totalAdventures > 0

    if (isLoading) {
        return (
            <div className="loading-container magical-loading">
                <GiMagicSwirl className="loading-spinner magical-spin" />
                <p className="loading-text">Summoning your magical worlds...</p>
                <div className="loading-particles">
                    <span className="particle"></span>
                    <span className="particle"></span>
                    <span className="particle"></span>
                </div>
            </div>
        )
    }

    return (
        <div className="landing-page">
            {/* Hero Section */}
            <section className="hero-section animate-entrance">
                <div className="hero-background">
                    <div className="hero-gradient"></div>
                    <div className="floating-elements">
                        <GiDragonHead className="floating-icon dragon animate-float" />
                        <GiCastle className="floating-icon castle animate-float" style={{animationDelay: '2s'}} />
                        <GiScrollQuill className="floating-icon scroll animate-float" style={{animationDelay: '4s'}} />
                    </div>
                </div>
                
                <div className="hero-content">
                    <h1 className="hero-title">
                        <span className="title-line">🌟 Magic Worlds</span>
                        <span className="title-subtitle">Forge Your Legend</span>
                    </h1>
                    <p className="hero-description">
                        Create epic characters, build mystical worlds, and embark on AI-powered adventures
                    </p>
                    
                    {!hasContent ? (
                        <div className="hero-cta">
                            <button 
                                className="btn btn-hero btn-primary hover-magical click-sparkle"
                                onClick={() => setPage('character')}
                            >
                                <FiZap />
                                Start Your First Adventure
                            </button>
                        </div>
                    ) : (
                        <div className="hero-stats">
                            <div className="stat-card">
                                <FiUserPlus className="stat-icon" />
                                <span className="stat-number">{characters.length}</span>
                                <span className="stat-label">Heroes</span>
                            </div>
                            <div className="stat-card">
                                <FiGlobe className="stat-icon" />
                                <span className="stat-number">{worlds.length}</span>
                                <span className="stat-label">Worlds</span>
                            </div>
                            <div className="stat-card">
                                <FiBookOpen className="stat-icon" />
                                <span className="stat-number">{totalAdventures}</span>
                                <span className="stat-label">Adventures</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Quick Actions */}
            <section className="quick-actions">
                <h2 className="section-title">Begin Your Journey</h2>
                <div className="action-cards">
                    <button 
                        className="action-card character-card hover-magical animate-entrance"
                        onClick={() => setPage('character')}
                        style={{animationDelay: '0.1s'}}
                    >
                        <div className="card-icon">
                            <FiUserPlus />
                        </div>
                        <h3>Create Character</h3>
                        <p>Forge a legendary hero with unique traits and abilities</p>
                        <div className="card-decoration"></div>
                    </button>
                    
                    <button 
                        className="action-card world-card hover-magical animate-entrance"
                        onClick={() => setPage('world')}
                        style={{animationDelay: '0.2s'}}
                    >
                        <div className="card-icon">
                            <FiGlobe />
                        </div>
                        <h3>Build World</h3>
                        <p>Design mystical realms filled with wonder and danger</p>
                        <div className="card-decoration"></div>
                    </button>
                    
                    <button 
                        className="action-card adventure-card hover-magical animate-entrance"
                        onClick={() => setPage('adventure')}
                        style={{animationDelay: '0.3s'}}
                    >
                        <div className="card-icon">
                            <FiBookOpen />
                        </div>
                        <h3>Create Adventure</h3>
                        <p>Craft epic quests and thrilling storylines</p>
                        <div className="card-decoration"></div>
                    </button>
                </div>
            </section>

            {/* Content Sections */}
            {hasContent && (
                <section className="content-sections">
                    {/* Section Tabs */}
                    <div className="section-tabs">
                        <button 
                            className={`tab-button ${activeSection === 'inprogress' ? 'active' : ''}`}
                            onClick={() => setActiveSection('inprogress')}
                        >
                            <FiPlay />
                            Active Adventures
                            <span className="tab-count">{inProgressAdventures.length}</span>
                        </button>
                        <button 
                            className={`tab-button ${activeSection === 'characters' ? 'active' : ''}`}
                            onClick={() => setActiveSection('characters')}
                        >
                            <FiUserPlus />
                            Characters
                            <span className="tab-count">{characters.length}</span>
                        </button>
                        <button 
                            className={`tab-button ${activeSection === 'worlds' ? 'active' : ''}`}
                            onClick={() => setActiveSection('worlds')}
                        >
                            <FiGlobe />
                            Worlds
                            <span className="tab-count">{worlds.length}</span>
                        </button>
                        <button 
                            className={`tab-button ${activeSection === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveSection('templates')}
                        >
                            <FiBookOpen />
                            Templates
                            <span className="tab-count">{templateAdventures.length}</span>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="tab-content animate-entrance">
                        {activeSection === 'characters' && (
                            <div className="content-panel">
                                <CharacterList
                                    characters={characters}
                                    onEdit={handleCharacterEdit}
                                    onDelete={deleteCharacter}
                                />
                            </div>
                        )}

                        {activeSection === 'worlds' && (
                            <div className="content-panel">
                                <WorldList
                                    worlds={worlds}
                                    onEdit={handleWorldEdit}
                                    onDelete={deleteWorld}
                                />
                            </div>
                        )}

                        {activeSection === 'templates' && (
                            <div className="content-panel">
                                <TemplateList
                                    templates={templateAdventures}
                                    onEdit={handleTemplateEdit}
                                    onStart={handleTemplateStart}
                                    onDelete={deleteTemplate}
                                />
                            </div>
                        )}

                        {activeSection === 'inprogress' && (
                            <div className="content-panel">
                                <InProgressList
                                    adventures={inProgressAdventures}
                                    onEdit={handleInProgressEdit}
                                    onPlay={handleInProgressEdit}
                                    onDelete={deleteInProgress}
                                />
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Tips Section for New Users */}
            {!hasContent && (
                <section className="tips-section animate-entrance">
                    <h2 className="section-title">How to Get Started</h2>
                    <div className="tips-grid">
                        <div className="tip-card">
                            <div className="tip-number">1</div>
                            <h3>Create Your Hero</h3>
                            <p>Design a character with unique stats, skills, and backstory</p>
                        </div>
                        <div className="tip-card">
                            <div className="tip-number">2</div>
                            <h3>Build Your World</h3>
                            <p>Craft the setting where your adventures will unfold</p>
                        </div>
                        <div className="tip-card">
                            <div className="tip-number">3</div>
                            <h3>Start an Adventure</h3>
                            <p>Launch into an AI-powered story with your character</p>
                        </div>
                    </div>
                </section>
            )}

            {/* Footer Actions */}
            <footer className="landing-footer">
                {hasContent && (
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmClear(true)}
                    >
                        <FiTrash2 />
                        Clear All Data
                    </button>
                )}
            </footer>

            {confirmClear && (
                <ConfirmDialog
                    visible={confirmClear}
                    title="Clear All Data"
                    message="Are you sure you want to delete all characters, worlds, and adventures? This action cannot be undone."
                    onConfirm={handleClearAll}
                    onCancel={() => setConfirmClear(false)}
                />
            )}
        </div>
    )
}
