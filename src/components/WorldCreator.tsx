import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { World } from '../types';
import './WorldCreator.css';

export function WorldCreator({
                                 onSubmit,
                                 onBack,
                                 initial,
                             }: {
    onSubmit: (w: World) => void
    onBack: () => void
    initial?: World
}) {
    const [id] = useState(initial?.id ?? crypto.randomUUID())
    const [name, setName] = useState(initial?.name ?? '')
    const [type, setType] = useState(initial?.type ?? '')
    const [details, setDetails] = useState<{ key: string; value: string }[]>(
        initial ? Object.entries(initial.details).map(([key, value]) => ({key, value})) : [],
    )

    const addDetail = () => setDetails((prev) => [...prev, {key: '', value: ''}])

    const updateDetail = (
        index: number,
        field: 'key' | 'value',
        value: string,
    ) => {
        setDetails((prev) => {
            const next = [...prev]
            next[index] = {...next[index], [field]: value}
            return next
        })
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const detailsRecord = details.reduce<Record<string, string>>((acc, cur) => {
            if (cur.key) acc[cur.key] = cur.value
            return acc
        }, {})
        onSubmit({id, name, type, details: detailsRecord})
    }

    const nameInputRef = useRef<HTMLInputElement>(null);
    
    // Focus the name input on mount
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent, index: number) => {
        // Remove detail row when pressing backspace on empty key field
        if (e.key === 'Backspace' && !details[index].key && details.length > 1) {
            e.preventDefault();
            setDetails(prev => prev.filter((_, i) => i !== index));
            
            // Focus previous input or next available input
            const prevInput = document.querySelector(`input[data-index="${index - 1}"][data-field="value"]`) as HTMLInputElement;
            if (prevInput) {
                prevInput.focus();
            }
        }
    };

    // Common world types for suggestions
    const worldTypes = [
        'Fantasy', 'Sci-Fi', 'Cyberpunk', 'Steampunk', 'Post-Apocalyptic',
        'Medieval', 'Modern', 'Future', 'Horror', 'Mystery', 'Adventure',
        'Western', 'Space Opera', 'Dystopian', 'Utopian', 'Historical', 'Alternate History'
    ];

    return (
        <div className="world-creator">
            <form onSubmit={handleSubmit}>
                <h2>{initial ? 'Edit World' : 'Create New World'}</h2>
                
                <div className="form-field">
                    <label htmlFor="world-name" className="field-label">
                        World Name *
                    </label>
                    <input
                        id="world-name"
                        ref={nameInputRef}
                        className="field-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter world name"
                        required
                        aria-required="true"
                        aria-label="World name"
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="world-type" className="field-label">
                        World Type
                    </label>
                    <div className="field-input-with-suggestions">
                        <input
                            id="world-type"
                            className="field-input"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            placeholder="e.g., Fantasy, Sci-Fi, Cyberpunk"
                            list="world-types"
                            aria-label="World type"
                        />
                        <datalist id="world-types">
                            {worldTypes.map((worldType) => (
                                <option key={worldType} value={worldType} />
                            ))}
                        </datalist>
                    </div>
                </div>

                <div className="form-field">
                    <label className="field-label">World Details</label>
                    <p className="field-hint">Add key details about your world (e.g., era, magic system, technology level)</p>
                    
                    {details.map((detail, i) => (
                        <div key={i} className="detail-row">
                            <input
                                className="field-input"
                                placeholder="Detail name"
                                value={detail.key}
                                onChange={(e) => updateDetail(i, 'key', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, i)}
                                data-index={i}
                                data-field="key"
                                aria-label={`Detail name ${i + 1}`}
                            />
                            <input
                                className="field-input"
                                placeholder="Value"
                                value={detail.value}
                                onChange={(e) => updateDetail(i, 'value', e.target.value)}
                                data-index={i}
                                data-field="value"
                                aria-label={`Detail value ${i + 1}`}
                            />
                        </div>
                    ))}
                    
                    <button 
                        type="button" 
                        className="add-detail-button" 
                        onClick={addDetail}
                        aria-label="Add new detail"
                    >
                        <span>+</span> Add Detail
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
                        aria-label={initial ? 'Update world' : 'Create world'}
                    >
                        {initial ? 'Update' : 'Create'} World
                    </button>
                </div>
            </form>
        </div>
    )
}