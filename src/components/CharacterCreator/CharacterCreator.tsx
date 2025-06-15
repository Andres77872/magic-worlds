import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { Character } from '../types';
import './CharacterCreator.css';

export function CharacterCreator({
                                     onSubmit,
                                     onBack,
                                     initial,
                                 }: {
    onSubmit: (c: Character) => void
    onBack: () => void
    initial?: Character
}) {
    const [id] = useState(initial?.id ?? crypto.randomUUID())
    const [name, setName] = useState(initial?.name ?? '')
    const [race, setRace] = useState(initial?.race ?? '')
    const [stats, setStats] = useState<{ key: string; value: string }[]>(
        !initial ? [] : Object.entries(initial.stats).map(([key, value]) => ({key, value})),
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
        onSubmit({id, name, race, stats: statsRecord})
    }

    const nameInputRef = useRef<HTMLInputElement>(null);
    
    // Focus the name input on mount
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent, index: number) => {
        // Remove stat row when pressing backspace on empty key field
        if (e.key === 'Backspace' && !stats[index].key && stats.length > 1) {
            e.preventDefault();
            setStats(prev => prev.filter((_, i) => i !== index));
            
            // Focus previous input or next available input
            const prevInput = document.querySelector(`input[data-index="${index - 1}"][data-field="value"]`) as HTMLInputElement;
            if (prevInput) {
                prevInput.focus();
            }
        }
    };

    return (
        <div className="character-creator">
            <form onSubmit={handleSubmit}>
                <h2>{initial ? 'Edit Character' : 'Create Character'}</h2>
                
                <div className="form-field">
                    <label htmlFor="character-name" className="field-label">
                        Character Name *
                    </label>
                    <input
                        id="character-name"
                        ref={nameInputRef}
                        className="field-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter character name"
                        required
                        aria-required="true"
                        aria-label="Character name"
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="character-race" className="field-label">
                        Race
                    </label>
                    <input
                        id="character-race"
                        className="field-input"
                        value={race}
                        onChange={(e) => setRace(e.target.value)}
                        placeholder="e.g., Human, Elf, Dwarf"
                        aria-label="Character race"
                    />
                </div>

                <div className="form-field">
                    <label className="field-label">Additional Stats</label>
                    {stats.map((stat, i) => (
                        <div key={i} className="stat-row">
                            <input
                                className="field-input"
                                placeholder="Stat name"
                                value={stat.key}
                                onChange={(e) => updateStat(i, 'key', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, i)}
                                data-index={i}
                                data-field="key"
                                aria-label={`Stat name ${i + 1}`}
                            />
                            <input
                                className="field-input"
                                placeholder="Value"
                                value={stat.value}
                                onChange={(e) => updateStat(i, 'value', e.target.value)}
                                data-index={i}
                                data-field="value"
                                aria-label={`Stat value ${i + 1}`}
                            />
                        </div>
                    ))}
                    <button 
                        type="button" 
                        className="add-stat-button" 
                        onClick={addStat}
                        aria-label="Add new stat"
                    >
                        + Add Stat
                    </button>
                </div>

                <div className="button-group">
                    <button 
                        type="button" 
                        className="button back-button" 
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        Back
                    </button>
                    <button 
                        type="submit" 
                        className="button submit-button"
                        disabled={!name.trim()}
                        aria-label="Save character"
                    >
                        {initial ? 'Update' : 'Create'} Character
                    </button>
                </div>
            </form>
        </div>
    )
}