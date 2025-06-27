import { useState } from 'react'
import { FiBookOpen, FiGlobe, FiPlay, FiUserPlus } from 'react-icons/fi'
import { CharacterList, InProgressList, TemplateList, WorldList } from '../../../ui/components/lists'
import type { Character, World, Adventure } from '../../../shared/types'
import './LandingContentSections.css'

interface LandingContentSectionsProps {
    characters: Character[]
    worlds: World[]
    templateAdventures: Adventure[]
    inProgressAdventures: Adventure[]
    onCharacterEdit: (character: Character) => void
    onCharacterDelete: (index: number) => void | Promise<void>
    onWorldEdit: (world: World) => void
    onWorldDelete: (index: number) => void | Promise<void>
    onTemplateEdit: (template: Adventure) => void
    onTemplateStart: (template: Adventure) => void
    onTemplateDelete: (index: number) => void | Promise<void>
    onInProgressEdit: (adventure: Adventure) => void
    onInProgressDelete: (index: number) => void | Promise<void>
}

export function LandingContentSections({
    characters,
    worlds,
    templateAdventures,
    inProgressAdventures,
    onCharacterEdit,
    onCharacterDelete,
    onWorldEdit,
    onWorldDelete,
    onTemplateEdit,
    onTemplateStart,
    onTemplateDelete,
    onInProgressEdit,
    onInProgressDelete
}: LandingContentSectionsProps) {
    const [activeSection, setActiveSection] = useState<'characters' | 'worlds' | 'templates' | 'inprogress'>('inprogress')

    return (
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
                            onEdit={onCharacterEdit}
                            onDelete={onCharacterDelete}
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
                            onEdit={onWorldEdit}
                            onDelete={onWorldDelete}
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
                            onEdit={onTemplateEdit}
                            onStart={onTemplateStart}
                            onDelete={onTemplateDelete}
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
                            onEdit={onInProgressEdit}
                            onPlay={onInProgressEdit}
                            onDelete={onInProgressDelete}
                        />
                    </div>
                )}
            </div>
        </section>
    )
} 