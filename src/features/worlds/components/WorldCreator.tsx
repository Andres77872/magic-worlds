/**
 * World creator component
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { World } from '../../../shared/types';
import { useNavigation, useData } from '../../../app/providers';
import { storage } from '../../../infrastructure/storage';
import './WorldCreator.css';

export function WorldCreator() {
    const { setPage } = useNavigation();
    const { worlds, setWorlds, editingWorld, setEditingWorld } = useData();
    
    const [id] = useState(editingWorld?.id ?? crypto.randomUUID())
    const [name, setName] = useState(editingWorld?.name ?? '')
    const [type, setType] = useState(editingWorld?.type ?? '')
    const [details, setDetails] = useState<{ key: string; value: string }[]>(
        editingWorld ? Object.entries(editingWorld.details).map(([key, value]) => ({key, value})) : [],
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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const detailsRecord = details.reduce<Record<string, string>>((acc, cur) => {
            if (cur.key) acc[cur.key] = cur.value
            return acc
        }, {})
        
        const world: World = {
            id, 
            name, 
            type, 
            details: detailsRecord,
            createdAt: editingWorld?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        
        const updatedWorlds = editingWorld 
            ? worlds.map(w => w.id === id ? world : w)
            : [...worlds, world]
            
        try {
            // First save to localStorage
            await storage.saveWorlds(updatedWorlds);
            // Then update React state
            setWorlds(updatedWorlds);
            setEditingWorld(null);
            setPage('landing');
        } catch (error) {
            console.error('Failed to save world:', error);
            alert('Failed to save world. Please try again.');
        }
    }

    const handleBack = () => {
        setEditingWorld(null)
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
        <div className="world-creator" onKeyDown={handleKeyDown}>
            <div className="world-creator-header">
                <h2>{editingWorld ? 'Edit World' : 'Create World'}</h2>
                <button className="btn btn-secondary" onClick={handleBack}>
                    Back
                </button>
            </div>

            <form onSubmit={handleSubmit} className="world-form">
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
                        Type:
                        <input
                            className="field-input"
                            type="text"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            placeholder="e.g., Fantasy, Sci-Fi, Modern"
                            required
                        />
                    </label>
                </div>

                <div className="details-section">
                    <div className="details-header">
                        <h3>World Details</h3>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={addDetail}
                        >
                            Add Detail
                        </button>
                    </div>

                    <div className="details-list">
                        {details.map((detail, index) => (
                            <div key={index} className="detail-row">
                                <input
                                    className="field-input detail-key"
                                    type="text"
                                    placeholder="Detail name (e.g., Climate, Government)"
                                    value={detail.key}
                                    onChange={(e) => updateDetail(index, 'key', e.target.value)}
                                />
                                <textarea
                                    className="field-input detail-value"
                                    placeholder="Description"
                                    value={detail.value}
                                    onChange={(e) => updateDetail(index, 'value', e.target.value)}
                                    rows={2}
                                />
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => setDetails(prev => prev.filter((_, i) => i !== index))}
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
                        {editingWorld ? 'Update World' : 'Create World'}
                    </button>
                </div>
            </form>
        </div>
    )
}
