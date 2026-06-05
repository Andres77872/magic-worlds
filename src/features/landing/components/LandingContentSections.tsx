import { useState } from 'react'
import { BookOpen, FileText, Globe, MapPin, Play, Users, UserPlus, Zap } from 'lucide-react'
import { CharacterList, InProgressList, TemplateList, WorldList } from '../../../ui/components'
import type { Character, World, Adventure } from '../../../shared'
import { Badge, Icon } from '../../../ui/primitives'

interface LandingContentSectionsProps {
    characters: Character[]
    worlds: World[]
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

interface EmptyStateProps {
    icon: React.ReactNode
    title: string
    message: string
}

function EmptyState({ icon, title, message }: EmptyStateProps) {
    return (
        <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center text-parchment-200">
            <div className="mb-6 text-parchment-500 [&_svg]:h-16 [&_svg]:w-16" aria-hidden="true">
                {icon}
            </div>
            <h3 className="mb-2 font-display text-h3 font-semibold text-parchment-50">{title}</h3>
            <p className="max-w-[400px] text-body leading-normal text-parchment-200">{message}</p>
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
    onInProgressDelete,
}: LandingContentSectionsProps) {
    const [activeSection, setActiveSection] = useState<'characters' | 'worlds' | 'templates' | 'inprogress'>('inprogress')

    const hasContent =
        characters.length > 0 || worlds.length > 0 || templateAdventures.length > 0 || inProgressAdventures.length > 0

    if (!hasContent) {
        return null
    }

    const tabs = [
        {
            id: 'inprogress' as const,
            label: 'Active Adventures',
            icon: <Icon icon={Play} size={18} />,
            count: inProgressAdventures.length,
            emptyState: {
                icon: <Icon icon={Zap} />,
                title: 'No Active Adventures',
                message: 'Start your first adventure from a template or jump into an existing story. Your epic journey awaits!',
            },
        },
        {
            id: 'characters' as const,
            label: 'Characters',
            icon: <Icon icon={UserPlus} size={18} />,
            count: characters.length,
            emptyState: {
                icon: <Icon icon={Users} />,
                title: 'No Characters Created',
                message: 'Create your first hero — design a character with unique traits, abilities, and backstory.',
            },
        },
        {
            id: 'worlds' as const,
            label: 'Worlds',
            icon: <Icon icon={Globe} size={18} />,
            count: worlds.length,
            emptyState: {
                icon: <Icon icon={MapPin} />,
                title: 'No Worlds Built',
                message: 'Build mystical realms filled with wonder and danger — the perfect setting for your adventures.',
            },
        },
        {
            id: 'templates' as const,
            label: 'Templates',
            icon: <Icon icon={BookOpen} size={18} />,
            count: templateAdventures.length,
            emptyState: {
                icon: <Icon icon={FileText} />,
                title: 'No Adventure Templates',
                message: 'Create adventure templates to quickly start new stories — quests, encounters, and storylines for reuse.',
            },
        },
    ]

    const renderTabContent = () => {
        switch (activeSection) {
            case 'characters':
                return characters.length > 0 ? (
                    <CharacterList
                        characters={characters}
                        onEdit={onCharacterEdit}
                        onDelete={(index) => {
                            const character = characters[index]
                            if (character?.id) onCharacterDelete(character.id)
                        }}
                    />
                ) : (
                    <EmptyState {...tabs[1].emptyState} />
                )

            case 'worlds':
                return worlds.length > 0 ? (
                    <WorldList
                        worlds={worlds}
                        onEdit={onWorldEdit}
                        onDelete={(index) => {
                            const world = worlds[index]
                            if (world?.id) onWorldDelete(world.id)
                        }}
                    />
                ) : (
                    <EmptyState {...tabs[2].emptyState} />
                )

            case 'templates':
                return templateAdventures.length > 0 ? (
                    <TemplateList
                        templates={templateAdventures}
                        onEdit={onTemplateEdit}
                        onStart={onTemplateStart}
                        onDelete={onTemplateDelete}
                    />
                ) : (
                    <EmptyState {...tabs[3].emptyState} />
                )

            case 'inprogress':
                return inProgressAdventures.length > 0 ? (
                    <InProgressList
                        adventures={inProgressAdventures}
                        onEdit={onInProgressEdit}
                        onPlay={onInProgressEdit}
                        onDelete={onInProgressDelete}
                    />
                ) : (
                    <EmptyState {...tabs[0].emptyState} />
                )

            default:
                return null
        }
    }

    return (
        <section className="relative z-[2] px-4 py-8 sm:px-6" aria-labelledby="content-sections-title">
            <h2 className="sr-only" id="content-sections-title">Your Content</h2>

            <div
                className="mb-8 flex gap-2 overflow-x-auto border-b border-parchment-50/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Content sections"
            >
                {tabs.map((tab) => {
                    const isActive = activeSection === tab.id
                    return (
                        <button
                            key={tab.id}
                            className={[
                                'mb-[-1px] flex min-w-[120px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-md border border-b-0 px-4 py-2 text-body font-medium transition-all md:px-6 md:py-4',
                                isActive
                                    ? 'z-[1] border-ember-500/45 bg-ink-800 font-semibold text-ember-500'
                                    : 'border-parchment-50/10 bg-ink-700 text-parchment-200 hover:border-ember-500/45 hover:bg-ink-600 hover:text-parchment-50',
                            ].join(' ')}
                            onClick={() => setActiveSection(tab.id)}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`${tab.id}-panel`}
                            id={`${tab.id}-tab`}
                        >
                            {tab.icon}
                            {tab.label}
                            <Badge tone={isActive ? 'ember' : 'neutral'} className="min-w-6 justify-center" aria-label={`${tab.count} items`}>
                                {tab.count}
                            </Badge>
                        </button>
                    )
                })}
            </div>

            <div
                className="min-h-[400px] rounded-lg border border-parchment-50/10 bg-ink-800 p-4 transition-all hover:border-ember-500/45 md:p-8"
                role="tabpanel"
                aria-labelledby={`${activeSection}-tab`}
                id={`${activeSection}-panel`}
                key={activeSection}
            >
                {renderTabContent()}
            </div>
        </section>
    )
}
