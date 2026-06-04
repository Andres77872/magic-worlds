/**
 * Landing page component - Enhanced with magical UI/UX
 * Refactored into modular components for better maintainability
 */

import { useNavigation, useData, useAuth } from '../../../app/hooks'
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
    const { isAuthenticated, openLoginModal } = useAuth()
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

    // Event handlers — all gated behind authentication
    const handleCharacterEdit = (character: Character) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        editCharacter(character)
        setPage('character')
    }

    const handleWorldEdit = (world: World) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        editWorld(world)
        setPage('world')
    }

    const handleTemplateEdit = (template: Adventure) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        editTemplate(template)
        setPage('adventure')
    }

    const handleTemplateStart = (template: Adventure) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        startTemplate(template)
        setPage('interaction')
    }

    const handleInProgressEdit = (adventure: Adventure) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        editInProgress(adventure)
        setPage('interaction')
    }

    // Calculate stats for content sections (still needed for local storage data)
    const hasContent = characters.length > 0 || worlds.length > 0 || 
        templateAdventures.length > 0 || inProgressAdventures.length > 0

    if (isLoading) {
        return <LandingLoading />
    }

    return (
        <div className="landing-page">
            <LandingHero
                activeAdventures={inProgressAdventures.length}
                onStartJourney={() => {
                    if (!isAuthenticated) {
                        openLoginModal()
                        return
                    }
                    setPage('character')
                }}
                lastActiveAdventure={inProgressAdventures.length > 0 ? inProgressAdventures[0] : undefined}
                onContinueAdventure={handleInProgressEdit}
            />

            <LandingQuickActions
                onCreateCharacter={() => {
                    if (!isAuthenticated) {
                        openLoginModal()
                        return
                    }
                    setPage('character')
                }}
                onBuildWorld={() => {
                    if (!isAuthenticated) {
                        openLoginModal()
                        return
                    }
                    setPage('world')
                }}
                onCreateAdventure={() => {
                    if (!isAuthenticated) {
                        openLoginModal()
                        return
                    }
                    setPage('adventure')
                }}
            />

            <LandingContentSections
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

            {!hasContent && <LandingTips />}

            <LandingFooter
                hasContent={hasContent}
                onClearAll={clearAllData}
            />
        </div>
    )
}
