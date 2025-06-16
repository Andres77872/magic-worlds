/**
 * Character creator component
 * An agnostic component for creating characters with customizable attributes
 */

import type {FormEvent, KeyboardEvent} from 'react';
import {useEffect, useRef, useState} from 'react';
import type {Character} from '../../../shared';
import {useData, useNavigation} from '../../../app/hooks';
import {storage} from '../../../infrastructure/storage';
import {FaPlus, FaQuestionCircle} from 'react-icons/fa';
import {type AttributeCategory, AttributeList} from './AttributeList';
import './CharacterCreator.css';

// Predefined attribute categories
const DEFAULT_ATTRIBUTE_CATEGORIES: AttributeCategory[] = [
    {
        id: 'stats',
        name: 'Stats',
        type: 'stat',
        description: 'Core attributes that define the character\'s basic capabilities'
    },
    {
        id: 'skills',
        name: 'Skills',
        type: 'skill',
        description: 'Learned abilities that represent specialized training or knowledge'
    },
    {
        id: 'traits',
        name: 'Traits',
        type: 'trait',
        description: 'Unique characteristics that define personality or special abilities'
    },
    {
        id: 'equipment',
        name: 'Equipment',
        type: 'equipment',
        description: 'Items, gear, or possessions the character carries'
    }
];

export function CharacterCreator() {
    const {setPage} = useNavigation();
    const {characters, setCharacters, editingCharacter, setEditingCharacter} = useData();

    const [id] = useState(editingCharacter?.id ?? crypto.randomUUID());
    const [name, setName] = useState(editingCharacter?.name ?? '');
    const [race, setRace] = useState(editingCharacter?.race ?? '');
    const [description, setDescription] = useState(editingCharacter?.description ?? '');

    // Custom category management
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');

    // Initialize attributeCategories from default or existing character data
    const initializeCategories = () => {
        if (!editingCharacter || !editingCharacter.customCategories) {
            return [...DEFAULT_ATTRIBUTE_CATEGORIES];
        }

        // If editing a character with custom categories, add them
        return [
            ...DEFAULT_ATTRIBUTE_CATEGORIES,
            ...(editingCharacter.customCategories || [])
        ];
    };

    // Initialize attributes from existing character or empty structure
    const initializeAttributes = (categories: AttributeCategory[]) => {
        if (!editingCharacter) {
            return categories.reduce((acc, category) => {
                acc[category.id] = [];
                return acc;
            }, {} as Record<string, { key: string; value: string }[]>);
        }

        // Map existing character attributes to the new structure
        const result: Record<string, { key: string; value: string }[]> = {};

        // First handle stats which existed in the previous version
        result.stats = Object.entries(editingCharacter.stats || {}).map(([key, value]) => ({
            key,
            value: String(value)
        }));

        // Handle predefined attribute categories if they exist in the edited character
        categories.forEach(category => {
            if (category.id !== 'stats') {
                result[category.id] = Object.entries(editingCharacter[category.id] || {}).map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
            }
        });

        return result;
    };

    const [attributeCategories, setAttributeCategories] = useState<AttributeCategory[]>(initializeCategories);
    const [attributes, setAttributes] = useState<Record<string, { key: string; value: string }[]>>(() =>
        initializeAttributes(initializeCategories())
    );

    // Add a new custom category
    const addCategory = () => {
        if (!newCategoryName.trim()) return;

        const id = newCategoryName.toLowerCase().replace(/\s+/g, '-');

        // Check if category with this id already exists
        if (attributeCategories.some(cat => cat.id === id)) {
            alert('A category with a similar name already exists. Please use a different name.');
            return;
        }

        const newCategory: AttributeCategory = {
            id,
            name: newCategoryName.trim(),
            type: 'custom',
            description: newCategoryDescription.trim() || `Custom attributes for ${newCategoryName}`
        };

        // Add the new category
        setAttributeCategories(prev => [...prev, newCategory]);

        // Initialize empty attributes array for this category
        setAttributes(prev => ({
            ...prev,
            [id]: []
        }));

        // Reset form
        setNewCategoryName('');
        setNewCategoryDescription('');
        setShowAddCategory(false);
    };
    
    // Delete a category
    const deleteCategory = (categoryId: string) => {
        // Find the category to ensure it exists and is custom
        const categoryToDelete = attributeCategories.find(cat => cat.id === categoryId);
        if (!categoryToDelete || categoryToDelete.type !== 'custom') return;
        
        // Update categories state by filtering out the deleted one
        setAttributeCategories(prev => 
            prev.filter(cat => cat.id !== categoryId)
        );
        
        // Update attributes state by removing that category
        setAttributes(prev => {
            const newAttributes = {...prev};
            delete newAttributes[categoryId];
            return newAttributes;
        });
    };

    // Add a new attribute to a category
    const addAttribute = (categoryId: string) => {
        setAttributes(prev => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), {key: '', value: ''}]
        }));
    };

    // Update an attribute
    const updateAttribute = (
        categoryId: string,
        index: number,
        field: 'key' | 'value',
        value: string,
    ) => {
        setAttributes(prev => {
            const category = [...prev[categoryId]];
            category[index] = {...category[index], [field]: value};
            return {...prev, [categoryId]: category};
        });
    };

    // Remove an attribute
    const removeAttribute = (categoryId: string, index: number) => {
        setAttributes(prev => {
            const category = prev[categoryId].filter((_, i) => i !== index);
            return {...prev, [categoryId]: category};
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Extract custom categories to save with character
        const customCategories = attributeCategories.filter(
            category => category.type === 'custom'
        );

        // Convert attributes structure to the format expected by the Character type
        const attributesRecord: Record<string, Record<string, string>> = {};

        Object.entries(attributes).forEach(([categoryId, items]) => {
            attributesRecord[categoryId] = items.reduce((acc, {key, value}) => {
                if (key) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);
        });

        const character: Character = {
            id,
            name,
            race,
            description,
            // Keep stats at the top level for backward compatibility
            stats: attributesRecord.stats || {},
            // Add custom categories metadata
            customCategories,
            // Add other attribute categories
            ...Object.fromEntries(
                Object.entries(attributesRecord).filter(([key]) => key !== 'stats')
            ),
            createdAt: editingCharacter?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updatedCharacters = editingCharacter
            ? characters.map(c => c.id === id ? character : c)
            : [...characters, character];

        try {
            // First save to localStorage
            await storage.saveCharacters(updatedCharacters);
            // Then update React state
            setCharacters(updatedCharacters);
            setEditingCharacter(null);
            setPage('landing');
        } catch (error) {
            console.error('Failed to save character:', error);
            alert('Failed to save character. Please try again.');
        }
    };

    const handleBack = () => {
        setEditingCharacter(null);
        setPage('landing');
    };

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
                <div className="character-essentials">
                    <div className="field">
                        <label className="field-label">
                            Name:
                            <div className="input-with-tooltip">
                                <input
                                    ref={nameInputRef}
                                    className="field-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                                <span className="tooltip-trigger">
                                    <FaQuestionCircle/>
                                    <div className="tooltip">
                                        The name of your character. This will be used to identify them throughout the game.
                                    </div>
                                </span>
                            </div>
                        </label>
                    </div>

                    <div className="field">
                        <label className="field-label">
                            Race/Species:
                            <div className="input-with-tooltip">
                                <input
                                    className="field-input"
                                    type="text"
                                    value={race}
                                    onChange={(e) => setRace(e.target.value)}
                                    required
                                />
                                <span className="tooltip-trigger">
                                    <FaQuestionCircle/>
                                    <div className="tooltip">
                                        The race or species of your character, which may influence traits and abilities.
                                    </div>
                                </span>
                            </div>
                        </label>
                    </div>

                    <div className="field">
                        <label className="field-label">
                            Description:
                            <div className="input-with-tooltip">
                                <textarea
                                    className="field-input description-textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe your character's appearance, personality, and background..."
                                    rows={4}
                                />
                                <span className="tooltip-trigger tooltip-trigger-textarea">
                                    <FaQuestionCircle/>
                                    <div className="tooltip">
                                        Add a rich description of your character including their background, appearance, and personality traits.
                                    </div>
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Attributes sections */}
                <div className="attributes-container">
                    <div className="attributes-header">
                        <h3>Attributes & Abilities</h3>
                        <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => setShowAddCategory(prev => !prev)}
                        >
                            <FaPlus/> Add Category
                        </button>
                    </div>

                    {/* Add new category form */}
                    {showAddCategory && (
                        <div className="add-category-form">
                            <h4>New Attribute Category</h4>
                            <div className="category-form-fields">
                                <div className="field">
                                    <label className="field-label">
                                        Category Name:
                                        <input
                                            className="field-input"
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g., Magic Abilities, Backgrounds"
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
                                            placeholder="What kind of attributes belong in this category?"
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
                            isDeletable={category.type === 'custom'}
                        />
                    ))}
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
    );
}
