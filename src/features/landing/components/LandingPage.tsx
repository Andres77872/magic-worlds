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

    return (
        <div className="landing-page">
            {/* Hero Section */}
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
                                onClick={() => setPage('character')}
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
                                <span className="landing-stat-number">{characters.length}</span>
                                <span className="landing-stat-label">Heroes</span>
                            </div>
                            <div className="landing-stat-card">
                                <FiGlobe className="landing-stat-icon" aria-hidden="true" />
                                <span className="landing-stat-number">{worlds.length}</span>
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

            {/* Quick Actions */}
            <section className="landing-quick-actions" aria-labelledby="quick-actions-title">
                <h2 className="landing-section-title" id="quick-actions-title">Begin Your Journey</h2>
                <div className="landing-action-cards" role="group" aria-label="Quick action buttons">
                    <button 
                        className="landing-action-card character-card hover-magical animate-entrance"
                        onClick={() => setPage('character')}
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
                        onClick={() => setPage('world')}
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
                        onClick={() => setPage('adventure')}
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

            {/* Content Sections */}
            {hasContent && (
                <section className="landing-content-sections" aria-labelledby="content-sections-title">
                    <h2 className="sr-only" id="content-sections-title">Your Content</h2>
                    
                    {/* Section Tabs */}
                    <div className="landing-section-tabs" role="tablist" aria-label="Content sections">
                        <button 
                            className={`landing-tab-button ${activeSection === 'inprogress' ? 'active' : ''}`}
                            onClick={() => setActiveSection('inprogress')}
                            role="tab"
                            aria-selected={activeSection === 'inprogress'}
                            aria-controls="inprogress-panel"
                            id="inprogress-tab"
                        >
                            <FiPlay aria-hidden="true" />
                            Active Adventures
                            <span className="landing-tab-count">{inProgressAdventures.length}</span>
                        </button>
                        <button 
                            className={`landing-tab-button ${activeSection === 'characters' ? 'active' : ''}`}
                            onClick={() => setActiveSection('characters')}
                            role="tab"
                            aria-selected={activeSection === 'characters'}
                            aria-controls="characters-panel"
                            id="characters-tab"
                        >
                            <FiUserPlus aria-hidden="true" />
                            Characters
                            <span className="landing-tab-count">{characters.length}</span>
                        </button>
                        <button 
                            className={`landing-tab-button ${activeSection === 'worlds' ? 'active' : ''}`}
                            onClick={() => setActiveSection('worlds')}
                            role="tab"
                            aria-selected={activeSection === 'worlds'}
                            aria-controls="worlds-panel"
                            id="worlds-tab"
                        >
                            <FiGlobe aria-hidden="true" />
                            Worlds
                            <span className="landing-tab-count">{worlds.length}</span>
                        </button>
                        <button 
                            className={`landing-tab-button ${activeSection === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveSection('templates')}
                            role="tab"
                            aria-selected={activeSection === 'templates'}
                            aria-controls="templates-panel"
                            id="templates-tab"
                        >
                            <FiBookOpen aria-hidden="true" />
                            Templates
                            <span className="landing-tab-count">{templateAdventures.length}</span>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="landing-tab-content animate-entrance">
                        {activeSection === 'characters' && (
                            <div 
                                className="landing-content-panel"
                                role="tabpanel"
                                aria-labelledby="characters-tab"
                                id="characters-panel"
                            >
                                <CharacterList
                                    characters={characters}
                                    onEdit={handleCharacterEdit}
                                    onDelete={deleteCharacter}
                                />
                            </div>
                        )}

                        {activeSection === 'worlds' && (
                            <div 
                                className="landing-content-panel"
                                role="tabpanel"
                                aria-labelledby="worlds-tab"
                                id="worlds-panel"
                            >
                                <WorldList
                                    worlds={worlds}
                                    onEdit={handleWorldEdit}
                                    onDelete={deleteWorld}
                                />
                            </div>
                        )}

                        {activeSection === 'templates' && (
                            <div 
                                className="landing-content-panel"
                                role="tabpanel"
                                aria-labelledby="templates-tab"
                                id="templates-panel"
                            >
                                <TemplateList
                                    templates={templateAdventures}
                                    onEdit={handleTemplateEdit}
                                    onStart={handleTemplateStart}
                                    onDelete={deleteTemplate}
                                />
                            </div>
                        )}

                        {activeSection === 'inprogress' && (
                            <div 
                                className="landing-content-panel"
                                role="tabpanel"
                                aria-labelledby="inprogress-tab"
                                id="inprogress-panel"
                            >
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
            )}

            {/* Footer Actions */}
            <footer className="landing-footer">
                {hasContent && (
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmClear(true)}
                        aria-describedby="clear-warning"
                    >
                        <FiTrash2 aria-hidden="true" />
                        Clear All Data
                    </button>
                )}
                <p id="clear-warning" className="sr-only">
                    This action will permanently delete all your characters, worlds, and adventures
                </p>
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
