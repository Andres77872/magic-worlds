/**
 * Adventure creator component
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useState, useRef, useEffect } from 'react'
import { FaPlus } from 'react-icons/fa'
import type { Adventure, Character, World } from '../../../shared'
import { useNavigation, useData } from '../../../app/hooks'
import { storage } from '../../../infrastructure/storage'
import type { AttributeCategory } from '../../../ui/components/common/AttributeList'
import { AttributeList } from '../../../ui/components/common/AttributeList'
import './AdventureCreator.css'

// Predefined adventure attribute categories
const DEFAULT_ADVENTURE_CATEGORIES: AttributeCategory[] = [
    {
        id: 'objectives',
        name: 'Objectives',
        type: 'custom',
        description: 'Goals and missions to complete in the adventure'
    },
    {
        id: 'notes',
        name: 'Notes',
        type: 'custom',
        description: 'Additional information and reminders'
    },
    {
        id: 'npcs',
        name: 'NPCs',
        type: 'custom',
        description: 'Non-player characters that appear in the adventure'
    },
    {
        id: 'locations',
        name: 'Locations',
        type: 'custom',
        description: 'Important places in this adventure'
    }
];

export function AdventureCreator() {
    const { setPage } = useNavigation()
    const { adventures, setAdventures, editingTemplate, setEditingTemplate, characters, worlds } = useData()
    
    const [id] = useState(editingTemplate?.id ?? crypto.randomUUID())
    const [scenario, setScenario] = useState(editingTemplate?.scenario ?? '')
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
        editingTemplate?.characters?.map(c => c.id) ?? []
    )
    const [selectedWorld, setSelectedWorld] = useState<string | undefined>(
        editingTemplate?.world?.id
    )
    
    // Custom category management
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')
    
    // Initialize attributeCategories from default or existing adventure data
    const initializeCategories = () => {
        if (!editingTemplate || !editingTemplate.customCategories) {
            return [...DEFAULT_ADVENTURE_CATEGORIES]
        }

        // If editing an adventure with custom categories, add them
        return [
            ...DEFAULT_ADVENTURE_CATEGORIES,
            ...(editingTemplate.customCategories || [])
        ]
    }
    
    // Initialize attributes from existing adventure or empty structure
    const initializeAttributes = (categories: AttributeCategory[]) => {
        if (!editingTemplate) {
            return categories.reduce((acc, category) => {
                acc[category.id] = []
                return acc
            }, {} as Record<string, { key: string; value: string }[]>)
        }

        // Map existing adventure attributes to the new structure
        const result: Record<string, { key: string; value: string }[]> = {}

        // Handle predefined attribute categories if they exist in the edited adventure
        categories.forEach(category => {
            if (editingTemplate[category.id]) {
                result[category.id] = Object.entries(editingTemplate[category.id] || {}).map(([key, value]) => ({
                    key,
                    value: String(value)
                }))
            } else {
                result[category.id] = []
            }
        })

        return result
    }
    
    const [attributeCategories, setAttributeCategories] = useState<AttributeCategory[]>(initializeCategories)
    const [attributes, setAttributes] = useState<Record<string, { key: string; value: string }[]>>(() =>
        initializeAttributes(initializeCategories())
    )
    
    // Add a new custom category
    const addCategory = () => {
        if (!newCategoryName.trim()) return

        const id = newCategoryName.toLowerCase().replace(/\s+/g, '-')

        // Check if category with this id already exists
        if (attributeCategories.some(cat => cat.id === id)) {
            alert('A category with a similar name already exists. Please use a different name.')
            return
        }

        const newCategory: AttributeCategory = {
            id,
            name: newCategoryName.trim(),
            type: 'custom',
            description: newCategoryDescription.trim() || `Custom attributes for ${newCategoryName}`
        }

        // Add the new category
        setAttributeCategories(prev => [...prev, newCategory])

        // Initialize empty attributes array for this category
        setAttributes(prev => ({
            ...prev,
            [id]: []
        }))

        // Reset form
        setNewCategoryName('')
        setNewCategoryDescription('')
        setShowAddCategory(false)
    }
    
    // Delete a category
    const deleteCategory = (categoryId: string) => {
        // Find the category to ensure it exists and is custom
        const categoryToDelete = attributeCategories.find(cat => cat.id === categoryId)
        if (!categoryToDelete || DEFAULT_ADVENTURE_CATEGORIES.some(c => c.id === categoryId)) return
        
        // Update categories state by filtering out the deleted one
        setAttributeCategories(prev => 
            prev.filter(cat => cat.id !== categoryId)
        )
        
        // Update attributes state by removing that category
        setAttributes(prev => {
            const newAttributes = {...prev}
            delete newAttributes[categoryId]
            return newAttributes
        })
    }

    // Add a new attribute to a category
    const addAttribute = (categoryId: string) => {
        setAttributes(prev => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), {key: '', value: ''}]
        }))
    }

    // Update an attribute
    const updateAttribute = (
        categoryId: string,
        index: number,
        field: 'key' | 'value',
        value: string,
    ) => {
        setAttributes(prev => {
            const category = [...prev[categoryId]]
            category[index] = {...category[index], [field]: value}
            return {...prev, [categoryId]: category}
        })
    }

    // Remove an attribute
    const removeAttribute = (categoryId: string, index: number) => {
        setAttributes(prev => {
            const category = prev[categoryId].filter((_, i) => i !== index)
            return {...prev, [categoryId]: category}
        })
    }
    
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        
        // Extract custom categories to save with adventure
        const customCategories = attributeCategories.filter(
            category => !DEFAULT_ADVENTURE_CATEGORIES.some(c => c.id === category.id)
        )

        // Convert attributes structure to the format expected by the Adventure type
        const attributesRecord: Record<string, Record<string, string>> = {}

        Object.entries(attributes).forEach(([categoryId, items]) => {
            attributesRecord[categoryId] = items.reduce((acc, {key, value}) => {
                if (key) acc[key] = value
                return acc
            }, {} as Record<string, string>)
        })
        
        const adventure: Adventure = {
            id,
            scenario,
            characters: characters.filter(c => selectedCharacters.includes(c.id)),
            world: worlds.find(w => w.id === selectedWorld),
            customCategories,
            createdAt: editingTemplate?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Add all attribute categories to the adventure
            ...attributesRecord
        }
        
        const updatedAdventures = editingTemplate
            ? adventures.map(a => a.id === id ? adventure : a)
            : [...adventures, adventure]
            
        try {
            await storage.saveAdventures(updatedAdventures)
            setAdventures(updatedAdventures)
            setEditingTemplate(null)
            setPage('landing')
        } catch (error) {
            console.error('Failed to save adventure:', error)
            alert('Failed to save adventure. Please try again.')
        }
    }

    const handleBack = () => {
        setEditingTemplate(null)
        setPage('landing')
    }

    const scenarioInputRef = useRef<HTMLTextAreaElement>(null)
    
    useEffect(() => {
        if (scenarioInputRef.current) {
            scenarioInputRef.current.focus()
        }
    }, [])

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleBack()
        }
    }

    return (
        <div className="adventure-creator" onKeyDown={handleKeyDown}>
            <div className="adventure-creator-header">
                <h2>{editingTemplate ? 'Edit Adventure' : 'Create Adventure'}</h2>
                <button className="btn btn-secondary" onClick={handleBack}>
                    Back
                </button>
            </div>

            <form onSubmit={handleSubmit} className="adventure-form">
                <div className="field">
                    <label className="field-label">
                        Scenario:
                        <textarea
                            ref={scenarioInputRef}
                            className="field-input"
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value)}
                            rows={4}
                            required
                        />
                    </label>
                </div>

                <div className="field">
                    <label className="field-label">Characters:</label>
                    <div className="character-selection">
                        {characters.length === 0 ? (
                            <div className="empty-state">
                                No characters available. 
                                <button 
                                    type="button" 
                                    className="btn btn-link" 
                                    onClick={() => setPage('character-creator')}
                                >
                                    Create one
                                </button>
                            </div>
                        ) : (
                            characters.map(character => (
                                <div key={character.id} className="character-option">
                                    <label>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedCharacters.includes(character.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCharacters(prev => [...prev, character.id])
                                                } else {
                                                    setSelectedCharacters(prev => 
                                                        prev.filter(id => id !== character.id)
                                                    )
                                                }
                                            }}
                                        />
                                        {character.name}
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="field">
                    <label className="field-label">World (optional):</label>
                    <div className="world-selection">
                        <div className="world-option">
                            <label>
                                <input 
                                    type="radio" 
                                    name="world" 
                                    checked={!selectedWorld}
                                    onChange={() => setSelectedWorld(undefined)}
                                />
                                None
                            </label>
                        </div>
                        
                        {worlds.length === 0 ? (
                            <div className="empty-state">
                                No worlds available. 
                                <button 
                                    type="button" 
                                    className="btn btn-link" 
                                    onClick={() => setPage('world-creator')}
                                >
                                    Create one
                                </button>
                            </div>
                        ) : (
                            worlds.map(world => (
                                <div key={world.id} className="world-option">
                                    <label>
                                        <input 
                                            type="radio" 
                                            name="world" 
                                            checked={selectedWorld === world.id}
                                            onChange={() => setSelectedWorld(world.id)}
                                        />
                                        {world.name}
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                {/* Attributes sections */}
                <div className="attributes-container">
                    <div className="attributes-header">
                        <h3>Adventure Components</h3>
                        <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => setShowAddCategory(prev => !prev)}
                        >
                            <FaPlus /> Add Category
                        </button>
                    </div>

                    {/* Add new category form */}
                    {showAddCategory && (
                        <div className="add-category-form">
                            <h4>New Adventure Component</h4>
                            <div className="category-form-fields">
                                <div className="field">
                                    <label className="field-label">
                                        Category Name:
                                        <input
                                            className="field-input"
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g., Encounters, Treasures, Events"
                                            required
                                        />
                                    </label>
                                </div>
                                <div className="field">
                                    <label className="field-label">
                                        Description (optional):
                                        <textarea
                                            className="field-input"
                                            value={newCategoryDescription}
                                            onChange={(e) => setNewCategoryDescription(e.target.value)}
                                            placeholder="What kind of information belongs in this category?"
                                            rows={2}
                                        />
                                    </label>
                                </div>
                                <div className="category-form-actions">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowAddCategory(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={addCategory}
                                    >
                                        Create Category
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                
                    {/* Attribute categories */}
                    {attributeCategories.map(category => (
                        <AttributeList
                            key={category.id}
                            category={category}
                            attributes={attributes[category.id] || []}
                            onAddAttribute={() => addAttribute(category.id)}
                            onUpdateAttribute={(index, field, value) =>
                                updateAttribute(category.id, index, field, value)
                            }
                            onRemoveAttribute={(index) => removeAttribute(category.id, index)}
                            onDeleteCategory={() => deleteCategory(category.id)}
                            isDeletable={!DEFAULT_ADVENTURE_CATEGORIES.some(c => c.id === category.id)}
                            valueIsTextarea={category.id === 'notes' || category.id === 'npcs'}
                            keyPlaceholder={getKeyPlaceholder(category.id)}
                            valuePlaceholder={getValuePlaceholder(category.id)}
                            addButtonLabel={getAddButtonLabel(category.id)}
                        />
                    ))}
                </div>
                
                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleBack}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        {editingTemplate ? 'Update Adventure' : 'Create Adventure'}
                    </button>
                </div>
            </form>
        </div>
    )
}

// Helper functions to get appropriate placeholders based on category
function getKeyPlaceholder(categoryId: string): string {
    switch (categoryId) {
        case 'objectives': return 'Objective title';
        case 'notes': return 'Note title';
        case 'npcs': return 'Character name';
        case 'locations': return 'Location name';
        default: return 'Name';
    }
}

function getValuePlaceholder(categoryId: string): string {
    switch (categoryId) {
        case 'objectives': return 'Objective description';
        case 'notes': return 'Note content';
        case 'npcs': return 'Character description';
        case 'locations': return 'Location description';
        default: return 'Description';
    }
}

function getAddButtonLabel(categoryId: string): string {
    switch (categoryId) {
        case 'objectives': return 'Add Objective';
        case 'notes': return 'Add Note';
        case 'npcs': return 'Add NPC';
        case 'locations': return 'Add Location';
        default: return `Add ${categoryId.charAt(0).toUpperCase() + categoryId.slice(1, -1)}`;
    }
}
