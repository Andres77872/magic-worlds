/**
 * Landing page component - moved to features/landing
 */

import { useState } from 'react'
import { useNavigation, useData } from '../../../app/hooks'
import { ConfirmDialog } from '../../../ui/components'
import { CharacterList, InProgressList, TemplateList, WorldList } from '../../../ui/components/lists'
import { FiBookOpen, FiGlobe, FiLoader, FiTrash2, FiUserPlus } from 'react-icons/fi'
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

    if (isLoading) {
        return (
            <div className="loading-container">
                <FiLoader className="loading-spinner" />
                <p>Loading your magical worlds...</p>
            </div>
        )
    }

    return (
        <div className="landing-page">
            <div className="landing-header">
                <h1>🌟 Magic Worlds</h1>
                <p>Create characters, build worlds, and embark on epic adventures!</p>
            </div>

            <div className="action-buttons">
                <button 
                    className="btn btn-primary action-btn"
                    onClick={() => setPage('character')}
                >
                    <FiUserPlus />
                    Create Character
                </button>
                <button 
                    className="btn btn-primary action-btn"
                    onClick={() => setPage('world')}
                >
                    <FiGlobe />
                    Build World
                </button>
                <button 
                    className="btn btn-primary action-btn"
                    onClick={() => setPage('adventure')}
                >
                    <FiBookOpen />
                    Create Adventure
                </button>
            </div>

            <div className="content-grid">
                <div className="content-section">
                    <div className="section-header">
                        <h2>Characters</h2>
                        <span className="count">{characters.length}</span>
                    </div>
                    <CharacterList
                        characters={characters}
                        onEdit={handleCharacterEdit}
                        onDelete={deleteCharacter}
                    />
                </div>

                <div className="content-section">
                    <div className="section-header">
                        <h2>Worlds</h2>
                        <span className="count">{worlds.length}</span>
                    </div>
                    <WorldList
                        worlds={worlds}
                        onEdit={handleWorldEdit}
                        onDelete={deleteWorld}
                    />
                </div>

                <div className="content-section">
                    <div className="section-header">
                        <h2>Adventure Templates</h2>
                        <span className="count">{templateAdventures.length}</span>
                    </div>
                    <TemplateList
                        templates={templateAdventures}
                        onEdit={handleTemplateEdit}
                        onStart={handleTemplateStart}
                        onDelete={deleteTemplate}
                    />
                </div>

                <div className="content-section">
                    <div className="section-header">
                        <h2>Adventures in Progress</h2>
                        <span className="count">{inProgressAdventures.length}</span>
                    </div>
                    <InProgressList
                        adventures={inProgressAdventures}
                        onEdit={handleInProgressEdit}
                        onPlay={handleInProgressEdit}
                        onDelete={deleteInProgress}
                    />
                </div>
            </div>

            <div className="danger-zone">
                <button 
                    className="btn btn-danger"
                    onClick={() => setConfirmClear(true)}
                >
                    <FiTrash2 />
                    Clear All Data
                </button>
            </div>

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
