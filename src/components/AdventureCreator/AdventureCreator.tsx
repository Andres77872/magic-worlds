import type {ChangeEvent, FormEvent} from 'react';
import {useEffect, useRef, useState} from 'react';
import type {Adventure, Character, World} from '../../types';
import './AdventureCreator.css';

export function AdventureCreator({
                                     characters,
                                     worlds,
                                     onSubmit,
                                     onBack,
                                     initial,
                                 }: {
    characters: Character[]
    worlds: World[]
    onSubmit: (a: Adventure) => void
    onBack: () => void
    initial?: Adventure
}) {
    const [id] = useState(initial?.id ?? crypto.randomUUID())
    const [scenario, setScenario] = useState(initial?.scenario ?? '')
    const [selectedChars, setSelectedChars] = useState<string[]>(
        initial ? initial.characters.map((c) => c.name) : [],
    )
    const [selectedWorlds, setSelectedWorlds] = useState<string[]>(
        initial ? initial.worlds.map((w) => w.name) : [],
    )


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
        onSubmit({id, scenario, characters: chosenChars, worlds: chosenWorlds})
    }

    const scenarioRef = useRef<HTMLTextAreaElement>(null);

    // Focus the scenario input on mount
    useEffect(() => {
        if (scenarioRef.current) {
            scenarioRef.current.focus();
        }
    }, []);

    const toggleCharacter = (characterName: string) => {
        setSelectedChars(prev =>
            prev.includes(characterName)
                ? prev.filter(name => name !== characterName)
                : [...prev, characterName]
        );
    };

    const removeCharacter = (characterName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedChars(prev => prev.filter(name => name !== characterName));
    };

    const removeWorld = (worldName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedWorlds(prev => prev.filter(name => name !== worldName));
    };

    // Filter out selected characters and worlds from available options
    const availableCharacters = characters.filter(c => !selectedChars.includes(c.name));
    const availableWorlds = worlds.filter(w => !selectedWorlds.includes(w.name));

    return (
        <div className="adventure-creator">
            <form onSubmit={handleSubmit}>
                <h2>{initial ? 'Edit Adventure' : 'Create New Adventure'}</h2>

                <div className="form-field">
                    <label htmlFor="adventure-scenario" className="field-label">
                        Adventure Scenario *
                    </label>
                    <textarea
                        id="adventure-scenario"
                        ref={scenarioRef}
                        className="field-textarea"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        placeholder="Describe the adventure scenario, including any key plot points or objectives..."
                        required
                        aria-required="true"
                        aria-label="Adventure scenario"
                    />
                </div>

                <div className="form-field">
                    <label className="field-label">
                        Characters
                        {selectedChars.length > 0 && ` (${selectedChars.length} selected)`}
                    </label>

                    {selectedChars.length > 0 && (
                        <div className="selected-items">
                            {selectedChars.map(charName => (
                                <div key={charName} className="selected-item">
                                    {charName}
                                    <button
                                        type="button"
                                        onClick={(e) => removeCharacter(charName, e)}
                                        aria-label={`Remove ${charName}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="checkbox-group">
                        {availableCharacters.length > 0 ? (
                            availableCharacters.map((character) => (
                                <label
                                    key={character.id}
                                    className="checkbox-label"
                                    onClick={() => toggleCharacter(character.name)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedChars.includes(character.name)}
                                        onChange={() => {
                                        }}
                                        className="field-checkbox"
                                        aria-label={`Select ${character.name}`}
                                    />
                                    {character.name}
                                </label>
                            ))
                        ) : (
                            <div className="empty-state">
                                {characters.length === 0
                                    ? 'No characters available. Create some characters first.'
                                    : 'All available characters have been selected.'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-field">
                    <label className="field-label">
                        Worlds
                        {selectedWorlds.length > 0 && ` (${selectedWorlds.length} selected)`}
                    </label>

                    {selectedWorlds.length > 0 && (
                        <div className="selected-items">
                            {selectedWorlds.map(worldName => (
                                <div key={worldName} className="selected-item">
                                    {worldName}
                                    <button
                                        type="button"
                                        onClick={(e) => removeWorld(worldName, e)}
                                        aria-label={`Remove ${worldName}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <select
                        className="field-select"
                        multiple
                        value={[]}
                        onChange={handleWorldChange}
                        aria-label="Select worlds for the adventure"
                    >
                        {availableWorlds.length > 0 ? (
                            availableWorlds.map((world) => (
                                <option
                                    key={world.id}
                                    value={world.name}
                                    onClick={() => {
                                        if (!selectedWorlds.includes(world.name)) {
                                            setSelectedWorlds(prev => [...prev, world.name]);
                                        }
                                    }}
                                >
                                    {world.name} ({world.type})
                                </option>
                            ))
                        ) : (
                            <option disabled>
                                {worlds.length === 0 ? 'No worlds available. Create some worlds first.' : 'All available worlds have been selected.'}
                            </option>
                        )}
                    </select>
                    <p className="field-hint">
                        {availableWorlds.length > 0
                            ? 'Click to select worlds for this adventure. Hold Ctrl/Cmd to select multiple.'
                            : ''}
                    </p>
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
                        disabled={!scenario.trim() || (selectedWorlds.length === 0 && worlds.length > 0)}
                        aria-label={initial ? 'Update adventure' : 'Create adventure'}
                    >
                        {initial ? 'Update' : 'Create'} Adventure
                    </button>
                </div>
            </form>
        </div>
    )
}