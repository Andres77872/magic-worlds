/**
 * Character creator component
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { Character } from '../../../shared/types';
import { useNavigation, useData } from '../../../app/providers';
import './CharacterCreator.css';

export function CharacterCreator() {
    const { setPage } = useNavigation();
    const { characters, setCharacters, editingCharacter, setEditingCharacter } = useData();
    
    const [id] = useState(editingCharacter?.id ?? crypto.randomUUID())
    const [name, setName] = useState(editingCharacter?.name ?? '')
    const [race, setRace] = useState(editingCharacter?.race ?? '')
    const [stats, setStats] = useState<{ key: string; value: string }[]>(
        !editingCharacter ? [] : Object.entries(editingCharacter.stats).map(([key, value]) => ({key, value: String(value)})),
    )

    const addStat = () => setStats((prev) => [...prev, {key: '', value: ''}])

    const updateStat = (
        index: number,
        field: 'key' | 'value',
        value: string,
    ) => {
        setStats((prev) => {
            const next = [...prev]
            next[index] = {...next[index], [field]: value}
            return next
        })
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const statsRecord = stats.reduce<Record<string, string>>((acc, cur) => {
            if (cur.key) acc[cur.key] = cur.value
            return acc
        }, {})
        
        const character: Character = {
            id, 
            name, 
            race, 
            stats: statsRecord,
            createdAt: editingCharacter?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        
        const updatedCharacters = editingCharacter 
            ? characters.map(c => c.id === id ? character : c)
            : [...characters, character]
            
        setCharacters(updatedCharacters)
        setEditingCharacter(null)
        setPage('landing')
    }

    const handleBack = () => {
        setEditingCharacter(null)
        setPage('landing')
    }

    const nameInputRef = useRef<HTMLInputElement>(null);
    
    // Focus the name input on mount
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleBack();
        }
    };

    return (
        <div className="character-creator" onKeyDown={handleKeyDown}>
            <div className="character-creator-header">
                <h2>{editingCharacter ? 'Edit Character' : 'Create Character'}</h2>
                <button className="btn btn-secondary" onClick={handleBack}>
                    Back
                </button>
            </div>

            <form onSubmit={handleSubmit} className="character-form">
                <div className="field">
                    <label className="field-label">
                        Name:
                        <input
                            ref={nameInputRef}
                            className="field-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </label>
                </div>

                <div className="field">
                    <label className="field-label">
                        Race:
                        <input
                            className="field-input"
                            type="text"
                            value={race}
                            onChange={(e) => setRace(e.target.value)}
                            required
                        />
                    </label>
                </div>

                <div className="stats-section">
                    <div className="stats-header">
                        <h3>Stats</h3>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={addStat}
                        >
                            Add Stat
                        </button>
                    </div>

                    <div className="stats-list">
                        {stats.map((stat, index) => (
                            <div key={index} className="stat-row">
                                <input
                                    className="field-input stat-key"
                                    type="text"
                                    placeholder="Stat name"
                                    value={stat.key}
                                    onChange={(e) => updateStat(index, 'key', e.target.value)}
                                />
                                <input
                                    className="field-input stat-value"
                                    type="text"
                                    placeholder="Value"
                                    value={stat.value}
                                    onChange={(e) => updateStat(index, 'value', e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => setStats(prev => prev.filter((_, i) => i !== index))}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleBack}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        {editingCharacter ? 'Update Character' : 'Create Character'}
                    </button>
                </div>
            </form>
        </div>
    )
}
