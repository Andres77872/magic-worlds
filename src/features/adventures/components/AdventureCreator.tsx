/**
 * Adventure creator component
 */

import type {ChangeEvent, FormEvent, KeyboardEvent} from 'react';
import {useEffect, useRef, useState} from 'react';
import type {Adventure} from '../../../shared/types';
import { useNavigation, useData } from '../../../app/providers';
import './AdventureCreator.css';

export function AdventureCreator() {
    const { setPage } = useNavigation();
    const { characters, worlds, adventures, setAdventures, editingAdventure, setEditingAdventure } = useData();
    
    const [id] = useState(editingAdventure?.id ?? crypto.randomUUID())
    const [scenario, setScenario] = useState(editingAdventure?.scenario ?? '')
    const [selectedChars, setSelectedChars] = useState<string[]>(
        editingAdventure ? editingAdventure.characters.map((c) => c.name) : [],
    )
    const [selectedWorlds, setSelectedWorlds] = useState<string[]>(
        editingAdventure ? editingAdventure.worlds.map((w) => w.name) : [],
    )

    const handleCharacterChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
        setSelectedChars(opts)
    }

    const handleWorldChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
        setSelectedWorlds(opts)
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const chosenChars = characters.filter((c) =>
            selectedChars.includes(c.name),
        )
        const chosenWorlds = worlds.filter((w) =>
            selectedWorlds.includes(w.name),
        )
        
        const adventure: Adventure = {
            id, 
            scenario, 
            characters: chosenChars, 
            worlds: chosenWorlds,
            status: 'template',
            createdAt: editingAdventure?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        
        const updatedAdventures = editingAdventure 
            ? adventures.map(a => a.id === id ? adventure : a)
            : [...adventures, adventure]
            
        setAdventures(updatedAdventures)
        setEditingAdventure(null)
        setPage('landing')
    }

    const handleBack = () => {
        setEditingAdventure(null)
        setPage('landing')
    }

    const scenarioRef = useRef<HTMLTextAreaElement>(null);

    // Focus the scenario input on mount
    useEffect(() => {
        if (scenarioRef.current) {
            scenarioRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleBack();
        }
    };

    return (
        <div className="adventure-creator" onKeyDown={handleKeyDown}>
            <div className="adventure-creator-header">
                <h2>{editingAdventure ? 'Edit Adventure' : 'Create Adventure'}</h2>
                <button className="btn btn-secondary" onClick={handleBack}>
                    Back
                </button>
            </div>

            <form onSubmit={handleSubmit} className="adventure-form">
                <div className="field">
                    <label className="field-label">
                        Scenario:
                        <textarea
                            ref={scenarioRef}
                            className="field-input scenario-textarea"
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value)}
                            placeholder="Describe the adventure scenario..."
                            rows={6}
                            required
                        />
                    </label>
                </div>

                <div className="selection-section">
                    <div className="field">
                        <label className="field-label">
                            Characters:
                            <select
                                className="field-input selection-list"
                                multiple
                                value={selectedChars}
                                onChange={handleCharacterChange}
                                size={Math.min(characters.length + 1, 6)}
                            >
                                {characters.length === 0 ? (
                                    <option disabled>No characters available</option>
                                ) : (
                                    characters.map((char) => (
                                        <option key={char.id} value={char.name}>
                                            {char.name} ({char.race})
                                        </option>
                                    ))
                                )}
                            </select>
                        </label>
                        {characters.length === 0 && (
                            <p className="help-text">
                                Create some characters first to add them to adventures.
                            </p>
                        )}
                    </div>

                    <div className="field">
                        <label className="field-label">
                            Worlds:
                            <select
                                className="field-input selection-list"
                                multiple
                                value={selectedWorlds}
                                onChange={handleWorldChange}
                                size={Math.min(worlds.length + 1, 6)}
                            >
                                {worlds.length === 0 ? (
                                    <option disabled>No worlds available</option>
                                ) : (
                                    worlds.map((world) => (
                                        <option key={world.id} value={world.name}>
                                            {world.name} ({world.type})
                                        </option>
                                    ))
                                )}
                            </select>
                        </label>
                        {worlds.length === 0 && (
                            <p className="help-text">
                                Create some worlds first to add them to adventures.
                            </p>
                        )}
                    </div>
                </div>

                <div className="selected-items">
                    {selectedChars.length > 0 && (
                        <div className="selected-group">
                            <h4>Selected Characters:</h4>
                            <div className="selected-tags">
                                {selectedChars.map((name) => (
                                    <span key={name} className="selected-tag">
                                        {name}
                                        <button
                                            type="button"
                                            className="remove-tag"
                                            onClick={() => setSelectedChars(prev => prev.filter(n => n !== name))}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedWorlds.length > 0 && (
                        <div className="selected-group">
                            <h4>Selected Worlds:</h4>
                            <div className="selected-tags">
                                {selectedWorlds.map((name) => (
                                    <span key={name} className="selected-tag">
                                        {name}
                                        <button
                                            type="button"
                                            className="remove-tag"
                                            onClick={() => setSelectedWorlds(prev => prev.filter(n => n !== name))}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleBack}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        {editingAdventure ? 'Update Adventure' : 'Create Adventure'}
                    </button>
                </div>
            </form>
        </div>
    )
}
