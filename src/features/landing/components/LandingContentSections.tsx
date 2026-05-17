import { useState, useEffect } from 'react'
import { FiBookOpen, FiGlobe, FiPlay, FiUserPlus, FiUsers, FiMapPin, FiFileText, FiZap } from 'react-icons/fi'
import { CharacterList, InProgressList, TemplateList, WorldList } from '../../../ui/components'
import type { Character, World, Adventure } from '../../../shared'
import { useUserData } from '../../../app/hooks'
import { apiService } from '../../../infrastructure/api'
import { mapApiTemplatesToAdventures } from '../../../utils/apiMappers'
import './LandingContentSections.css'

interface LandingContentSectionsProps {
    templateAdventures: Adventure[]
    inProgressAdventures: Adventure[]
    onCharacterEdit: (character: Character) => void
    onCharacterDelete: (id: string) => void | Promise<void>
    onWorldEdit: (world: World) => void
    onWorldDelete: (id: string) => void | Promise<void>
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
    const [characters, setCharacters] = useState<Character[]>([])
    const [worlds, setWorlds] = useState<World[]>([])
    const [apiTemplates, setApiTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    // Get user data from API to determine if tabs should be shown
    const { userData, isLoading: userDataLoading } = useUserData()
    
    // Fetch characters, worlds, and templates from API
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
                
                // Use the apiService to fetch data from the API
                const [charactersData, worldsData, templatesData] = await Promise.all([
                    apiService.getCharacters(),
                    apiService.getWorlds(),
                    apiService.getAdventureTemplates()
                ])

                setCharacters(charactersData || [])
                setWorlds(worldsData || [])
                setApiTemplates(templatesData || [])
            } catch (err) {
                console.error('Error fetching data:', err)
                setError(err instanceof Error ? err.message : 'Failed to fetch data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    // Check if any content exists based on API data or local data
    const hasApiContent = userData && (
        userData.card_counts.character > 0 ||
        userData.card_counts.world > 0 ||
        userData.card_counts.adventure_template > 0
    )
    
    // Also check local data for fallback
    const hasLocalContent = characters.length > 0 || worlds.length > 0 || 
        templateAdventures.length > 0 || inProgressAdventures.length > 0
    
    // Merge API templates with local templates (prefer API data)
    const mergedTemplates = apiTemplates.length > 0 
        ? mapApiTemplatesToAdventures(apiTemplates) 
        : templateAdventures
    
    // Show tabs if we have API content, local content, or still loading API data
    const shouldShowTabs = userDataLoading || hasApiContent || hasLocalContent
    
    // Don't render if no content at all (safe to return here - after all hooks)
    if (!shouldShowTabs) {
        return null
    }

    // Enhanced tab configuration with better accessibility and theming
    // Use API data counts when available, fallback to local state
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
            count: userData?.card_counts?.character ?? characters.length,
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
            count: userData?.card_counts?.world ?? worlds.length,
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
            count: userData?.card_counts?.adventure_template ?? mergedTemplates.length,
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
                if (loading) {
                    return (
                        <div className="landing-content-panel-loading">
                            <div className="loading-spinner" aria-label="Loading characters"></div>
                            <p>Loading characters...</p>
                        </div>
                    )
                }
                if (error) {
                    return (
                        <div className="landing-content-panel-error">
                            <p>Error loading characters: {error}</p>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </button>
                        </div>
                    )
                }
                return characters.length > 0 ? (
                    <div className="animate-entrance">
                        <CharacterList
                            characters={characters}
                            onEdit={onCharacterEdit}
                            onDelete={(index) => {
                                const character = characters[index]
                                if (character?.id) {
                                    onCharacterDelete(character.id)
                                }
                            }}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'characters')!.emptyState} />
                )

            case 'worlds':
                if (loading) {
                    return (
                        <div className="landing-content-panel-loading">
                            <div className="loading-spinner" aria-label="Loading worlds"></div>
                            <p>Loading worlds...</p>
                        </div>
                    )
                }
                if (error) {
                    return (
                        <div className="landing-content-panel-error">
                            <p>Error loading worlds: {error}</p>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </button>
                        </div>
                    )
                }
                return worlds.length > 0 ? (
                    <div className="animate-entrance">
                        <WorldList
                            worlds={worlds}
                            onEdit={onWorldEdit}
                            onDelete={(index) => {
                                const world = worlds[index]
                                if (world?.id) {
                                    onWorldDelete(world.id)
                                }
                            }}
                        />
                    </div>
                ) : (
                    <EmptyState {...tabs.find(tab => tab.id === 'worlds')!.emptyState} />
                )

            case 'templates':
                return mergedTemplates.length > 0 ? (
                    <div className="animate-entrance">
                        <TemplateList
                            templates={mergedTemplates}
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