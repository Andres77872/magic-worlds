import {useEffect, useState} from 'react';
import type {Adventure, Character, World} from '../types';
import {CharacterList, InProgressList, TemplateList, WorldList} from './lists';
import {ConfirmDialog} from './ConfirmDialog';
import {FiBookOpen, FiGlobe, FiLoader, FiTrash2, FiUserPlus} from 'react-icons/fi';
import './LandingPage.css';

interface LandingPageProps {
    isLoading: boolean
    characters: Character[]
    worlds: World[]
    templateAdventures: Adventure[]
    inProgressAdventures: Adventure[]
    onCharacterEdit: (character: Character) => void
    onCharacterDelete: (index: number) => Promise<void>
    onWorldEdit: (world: World) => void
    onWorldDelete: (index: number) => Promise<void>
    onTemplateEdit: (template: Adventure) => void
    onTemplateStart: (template: Adventure) => void
    onTemplateDelete: (index: number) => Promise<void>
    onInProgressEdit: (adventure: Adventure) => void
    onInProgressDelete: (index: number) => Promise<void>
    onClearAll: () => void
    onGoTo: (page: 'landing' | 'character' | 'world' | 'adventure' | 'interaction') => void
    confirmClear: boolean
    setConfirmClear: (value: boolean) => void
}

export function LandingPage({
                                isLoading,
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
                                onClearAll,
                                onGoTo,
                                confirmClear,
                                setConfirmClear,
                            }: LandingPageProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner">
                    <FiLoader className="spinner"/>
                    <span>Loading your adventure hub...</span>
                </div>
            </div>
        );
    }


    return (
        <div className="landing">
            <header className="landing-header">
                <h1>Magic Worlds</h1>
                <p>Create and manage your tabletop RPG adventures, characters, and worlds in one place.</p>
            </header>

            <div className="landing-buttons">
                <button
                    className="landing-button"
                    onClick={() => onGoTo('character')}
                    aria-label="Create new character"
                >
                    <FiUserPlus size={20}/>
                    <span>New Character</span>
                </button>
                <button
                    className="landing-button"
                    onClick={() => onGoTo('world')}
                    aria-label="Create new world"
                >
                    <FiGlobe size={20}/>
                    <span>New World</span>
                </button>
                <button
                    className="landing-button"
                    onClick={() => onGoTo('adventure')}
                    aria-label="Create new adventure"
                >
                    <FiBookOpen size={20}/>
                    <span>New Adventure</span>
                </button>
            </div>

            <div className="list-section">
                <h3>Characters ({characters.length})</h3>
                {characters.length > 0 ? (
                    <CharacterList
                        characters={characters}
                        onEdit={onCharacterEdit}
                        onDelete={onCharacterDelete}
                    />
                ) : (
                    <div className="empty-state">
                        No characters yet. Create your first character to get started!
                    </div>
                )}
            </div>

            <div className="list-section">
                <h3>Worlds ({worlds.length})</h3>
                {worlds.length > 0 ? (
                    <WorldList
                        worlds={worlds}
                        onEdit={onWorldEdit}
                        onDelete={onWorldDelete}
                    />
                ) : (
                    <div className="empty-state">
                        No worlds created yet. Start by creating a new world!
                    </div>
                )}
            </div>

            <div className="list-section">
                <h3>Adventure Templates ({templateAdventures.length})</h3>
                {templateAdventures.length > 0 ? (
                    <TemplateList
                        templates={templateAdventures}
                        onEdit={onTemplateEdit}
                        onStart={onTemplateStart}
                        onDelete={onTemplateDelete}
                    />
                ) : (
                    <div className="empty-state">
                        No adventure templates. Create a new adventure and save it as a template.
                    </div>
                )}
            </div>

            <div className="list-section">
                <h3>Adventures In Progress ({inProgressAdventures.length})</h3>
                {inProgressAdventures.length > 0 ? (
                    <InProgressList
                        adventures={inProgressAdventures}
                        onEdit={onInProgressEdit}
                        onDelete={onInProgressDelete}
                    />
                ) : (
                    <div className="empty-state">
                        No adventures in progress. Start a new adventure or continue from a template.
                    </div>
                )}
            </div>

            <div className="delete-section">
                <button
                    className="delete-button"
                    onClick={() => setConfirmClear(true)}
                    aria-label="Clear all data"
                >
                    <FiTrash2 size={16}/>
                    <span>Clear All Data</span>
                </button>
                <ConfirmDialog
                    visible={confirmClear}
                    message="Are you sure you want to delete all data? This action cannot be undone."
                    confirmText="Delete Everything"
                    onConfirm={onClearAll}
                    onCancel={() => setConfirmClear(false)}
                />
            </div>
        </div>
    )
}
