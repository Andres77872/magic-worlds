/**
 * Landing page component - Enhanced with magical UI/UX
 * Refactored into modular components for better maintainability
 */

import { useNavigation, useData } from '../../../app/hooks'
import { 
    LandingLoading, 
    LandingHero, 
    LandingQuickActions, 
    LandingContentSections, 
    LandingTips, 
    LandingFooter 
} from './'
import './LandingPage.css'
import type { Character, World, Adventure } from '../../../shared'

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

    // Event handlers
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

    // Calculate stats for the hero section
    const totalAdventures = templateAdventures.length + inProgressAdventures.length
    const hasContent = characters.length > 0 || worlds.length > 0 || totalAdventures > 0

    if (isLoading) {
        return <LandingLoading />
    }

    return (
        <div className="landing-page">
            <LandingHero
                charactersCount={characters.length}
                worldsCount={worlds.length}
                totalAdventures={totalAdventures}
                hasContent={hasContent}
                onStartJourney={() => setPage('character')}
            />

            <LandingQuickActions
                onCreateCharacter={() => setPage('character')}
                onBuildWorld={() => setPage('world')}
                onCreateAdventure={() => setPage('adventure')}
            />

            {hasContent && (
                <LandingContentSections
                    characters={characters}
                    worlds={worlds}
                    templateAdventures={templateAdventures}
                    inProgressAdventures={inProgressAdventures}
                    onCharacterEdit={handleCharacterEdit}
                    onCharacterDelete={deleteCharacter}
                    onWorldEdit={handleWorldEdit}
                    onWorldDelete={deleteWorld}
                    onTemplateEdit={handleTemplateEdit}
                    onTemplateStart={handleTemplateStart}
                    onTemplateDelete={deleteTemplate}
                    onInProgressEdit={handleInProgressEdit}
                    onInProgressDelete={deleteInProgress}
                />
            )}

            {!hasContent && <LandingTips />}

            <LandingFooter
                hasContent={hasContent}
                onClearAll={clearAllData}
            />
        </div>
    )
}
