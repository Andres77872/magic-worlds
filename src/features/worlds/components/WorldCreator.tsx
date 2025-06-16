/**
 * World creator component
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { World } from '../../../shared';
import { useNavigation, useData } from '../../../app/hooks';
import { storage } from '../../../infrastructure/storage';
import {type AttributeCategory, AttributeList } from '../../../ui/components/common/AttributeList';
import { FaPlus } from 'react-icons/fa';
import './WorldCreator.css';

// Predefined attribute categories for worlds
const DEFAULT_WORLD_CATEGORIES: AttributeCategory[] = [
    {
        id: 'details',
        name: 'World Details',
        type: 'detail',
        description: 'Key information about your world'
    },
    {
        id: 'terrain',
        name: 'Terrain',
        type: 'detail',
        description: 'Geographic features and landscapes of your world'
    },
    {
        id: 'climate',
        name: 'Climate',
        type: 'detail',
        description: 'Weather patterns and environmental conditions'
    },
    {
        id: 'inhabitants',
        name: 'Inhabitants',
        type: 'detail',
        description: 'Races, species, and civilizations that populate your world'
    }
];

export function WorldCreator() {
    const { setPage } = useNavigation();
    const { worlds, setWorlds, editingWorld, setEditingWorld } = useData();
    
    const [id] = useState(editingWorld?.id ?? crypto.randomUUID());
    const [name, setName] = useState(editingWorld?.name ?? '');
    const [type, setType] = useState(editingWorld?.type ?? '');
    
    // Custom category management
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    
    // Initialize attributeCategories from default or existing world data
    const initializeCategories = () => {
        if (!editingWorld || !editingWorld.customCategories) {
            return [...DEFAULT_WORLD_CATEGORIES];
        }

        // If editing a world with custom categories, add them
        return [
            ...DEFAULT_WORLD_CATEGORIES,
            ...(editingWorld.customCategories || [])
        ];
    };
    
    // Initialize attributes from existing world or empty structure
    const initializeAttributes = (categories: AttributeCategory[]) => {
        if (!editingWorld) {
            return categories.reduce((acc, category) => {
                acc[category.id] = [];
                return acc;
            }, {} as Record<string, { key: string; value: string }[]>);
        }

        // Map existing world attributes to the new structure
        const result: Record<string, { key: string; value: string }[]> = {};

        // First handle details which existed in the previous version
        result.details = Object.entries(editingWorld.details || {}).map(([key, value]) => ({
            key,
            value: String(value)
        }));

        // Handle predefined attribute categories if they exist in the edited world
        categories.forEach(category => {
            if (category.id !== 'details' && editingWorld[category.id]) {
                result[category.id] = Object.entries(editingWorld[category.id] || {}).map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
            } else if (category.id !== 'details') {
                result[category.id] = [];
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
        
        // Extract custom categories to save with world
        const customCategories = attributeCategories.filter(
            category => category.type === 'custom'
        );

        // Convert attributes structure to the format expected by the World type
        const attributesRecord: Record<string, Record<string, string>> = {};

        Object.entries(attributes).forEach(([categoryId, items]) => {
            attributesRecord[categoryId] = items.reduce((acc, {key, value}) => {
                if (key) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);
        });
        
        const world: World = {
            id, 
            name, 
            type, 
            // Keep details at the top level for backward compatibility
            details: attributesRecord.details || {},
            // Add custom categories metadata
            customCategories,
            // Add other attribute categories
            ...Object.fromEntries(
                Object.entries(attributesRecord).filter(([key]) => key !== 'details')
            ),
            createdAt: editingWorld?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const updatedWorlds = editingWorld 
            ? worlds.map(w => w.id === id ? world : w)
            : [...worlds, world];
            
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
                
                {/* Attributes sections */}
                <div className="attributes-container">
                    <div className="attributes-header">
                        <h3>World Attributes</h3>
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
                                            placeholder="e.g., Magic Systems, Factions"
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
                            valueIsTextarea={true}
                            keyPlaceholder={`${category.name.slice(0, -1)} name`}
                            valuePlaceholder="Description"
                            addButtonLabel={`Add ${category.name.slice(0, -1)}`}
                        />
                    ))}
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
