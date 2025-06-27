import { useState } from 'react'
import { FiBookOpen, FiGlobe, FiPlay, FiUserPlus, FiUsers, FiMapPin, FiFileText, FiZap } from 'react-icons/fi'
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

// Enhanced empty state component with better UX
interface EmptyStateProps {
    icon: React.ReactNode
    title: string
    message: string
    actionText?: string
    onAction?: () => void
}

function EmptyState({ icon, title, message, actionText, onAction }: EmptyStateProps) {
    return (
        <div className="landing-content-panel-empty animate-entrance">
            <div className="landing-empty-icon" aria-hidden="true">
                {icon}
            </div>
            <h3 className="landing-empty-title">{title}</h3>
            <p className="landing-empty-message">{message}</p>
            {actionText && onAction && (
                <button 
                    className="btn btn-primary hover-magical click-sparkle" 
                    onClick={onAction}
                    style={{ marginTop: 'var(--spacing-lg)' }}
                >
                    {actionText}
                </button>
            )}
        </div>
    )
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

    // Enhanced tab configuration with better accessibility and theming
    const tabs = [
        {
            id: 'inprogress' as const,
            label: 'Active Adventures',
            icon: <FiPlay aria-hidden="true" />,
            count: inProgressAdventures.length,
            emptyState: {
                icon: <FiZap />,
                title: 'No Active Adventures',
                message: 'Start your first adventure by creating a template or jumping into an existing story. Your epic journey awaits!'
            }
        },
        {
            id: 'characters' as const,
            label: 'Characters',
            icon: <FiUserPlus aria-hidden="true" />,
            count: characters.length,
            emptyState: {
                icon: <FiUsers />,
                title: 'No Characters Created',
                message: 'Create your first hero! Design a character with unique traits, abilities, and backstory to start your adventures.'
            }
        },
        {
            id: 'worlds' as const,
            label: 'Worlds',
            icon: <FiGlobe aria-hidden="true" />,
            count: worlds.length,
            emptyState: {
                icon: <FiMapPin />,
                title: 'No Worlds Built',
                message: 'Build mystical realms filled with wonder and danger. Create the perfect setting for your adventures to unfold.'
            }
        },
        {
            id: 'templates' as const,
            label: 'Templates',
            icon: <FiBookOpen aria-hidden="true" />,
            count: templateAdventures.length,
            emptyState: {
                icon: <FiFileText />,
                title: 'No Adventure Templates',
                message: 'Create adventure templates to quickly start new stories. Design quests, encounters, and storylines for reuse.'
            }
        }
    ]

    const renderTabContent = () => {
        switch (activeSection) {
            case 'characters':
                return characters.length > 0 ? (
                    <div className="animate-entrance">
                        <CharacterList
                            characters={characters}
                            onEdit={onCharacterEdit}
                            onDelete={onCharacterDelete}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'characters')!.emptyState} />
                )

            case 'worlds':
                return worlds.length > 0 ? (
                    <div className="animate-entrance">
                        <WorldList
                            worlds={worlds}
                            onEdit={onWorldEdit}
                            onDelete={onWorldDelete}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'worlds')!.emptyState} />
                )

            case 'templates':
                return templateAdventures.length > 0 ? (
                    <div className="animate-entrance">
                        <TemplateList
                            templates={templateAdventures}
                            onEdit={onTemplateEdit}
                            onStart={onTemplateStart}
                            onDelete={onTemplateDelete}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'templates')!.emptyState} />
                )

            case 'inprogress':
                return inProgressAdventures.length > 0 ? (
                    <div className="animate-entrance">
                        <InProgressList
                            adventures={inProgressAdventures}
                            onEdit={onInProgressEdit}
                            onPlay={onInProgressEdit}
                            onDelete={onInProgressDelete}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'inprogress')!.emptyState} />
                )

            default:
                return null
        }
    }

    return (
        <section className="landing-content-sections animate-entrance" aria-labelledby="content-sections-title">
            <h2 className="sr-only" id="content-sections-title">Your Content</h2>
            
            {/* Enhanced Section Tabs */}
            <div className="landing-section-tabs" role="tablist" aria-label="Content sections">
                {tabs.map((tab) => (
                    <button 
                        key={tab.id}
                        className={`landing-tab-button hover-magical ${activeSection === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(tab.id)}
                        role="tab"
                        aria-selected={activeSection === tab.id}
                        aria-controls={`${tab.id}-panel`}
                        id={`${tab.id}-tab`}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className="landing-tab-count" aria-label={`${tab.count} items`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Enhanced Tab Content */}
            <div className="landing-tab-content">
                <div 
                    className="landing-content-panel"
                    role="tabpanel"
                    aria-labelledby={`${activeSection}-tab`}
                    id={`${activeSection}-panel`}
                    key={activeSection} // Force re-render for animation
                >
                    {renderTabContent()}
                </div>
            </div>
        </section>
    )
} 