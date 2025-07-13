/**
 * World creator component - refactored with common components
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { World } from '../../../../shared';
import { useNavigation, useData } from '../../../../app/hooks';
import { storage } from '../../../../infrastructure/storage';
import { generateUUID } from '../../../../utils/uuid';
import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { 
    CreatorLayout, 
    CreatorField, 
    CreatorInput, 
    AttributeManager,
    FormActions 
} from '../../common/components';
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
    
    const [id] = useState(editingWorld?.id ?? generateUUID());
    const [name, setName] = useState(editingWorld?.name ?? '');
    const [type, setType] = useState(editingWorld?.type ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Store custom categories separately since they're not in the World type
    const [customCategories, setCustomCategories] = useState<AttributeCategory[]>([]);
    
    // Initialize attributeCategories
    const [attributeCategories, setAttributeCategories] = useState<AttributeCategory[]>([
        ...DEFAULT_WORLD_CATEGORIES,
        ...customCategories
    ]);
    
    // Initialize attributes from existing world or empty structure
    const initializeAttributes = () => {
        const result: Record<string, { key: string; value: string }[]> = {};
        
        // Initialize all categories with empty arrays
        attributeCategories.forEach(category => {
            result[category.id] = [];
        });
        
        if (editingWorld) {
            // Map existing world details
            result.details = Object.entries(editingWorld.details || {})
                .filter(([key]) => !key.startsWith('_')) // Filter out metadata
                .map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
            
            // Load other default categories (terrain, climate, inhabitants)
            DEFAULT_WORLD_CATEGORIES.forEach(category => {
                const categoryId = category.id;
                if (categoryId !== 'details' && 
                    categoryId in editingWorld && 
                    typeof editingWorld[categoryId as keyof World] === 'object') {
                    
                    // Type-safe access using dynamic key
                    const categoryData = editingWorld[categoryId as keyof World] as Record<string, string>;
                    
                    result[categoryId] = Object.entries(categoryData)
                        .map(([key, value]) => ({
                            key,
                            value: typeof value === 'string' ? value : String(value)
                        }));
                }
            });
        }

        return result;
    };
    
    const [attributes, setAttributes] = useState<Record<string, { key: string; value: string }[]>>(
        initializeAttributes()
    );
    
    // Add a new custom category
    const addCategory = (name: string, description: string) => {
        const id = name.toLowerCase().replace(/\s+/g, '-');

        // Check if category with this id already exists
        if (attributeCategories.some(cat => cat.id === id)) {
            alert('A category with a similar name already exists. Please use a different name.');
            return;
        }

        const newCategory: AttributeCategory = {
            id,
            name,
            type: 'custom',
            description: description || `Custom attributes for ${name}`
        };

        // Add the new category to customCategories state using functional update
        setCustomCategories(prev => [...prev, newCategory]);
        
        // Then update attributeCategories with the functional update pattern
        setAttributeCategories(prev => [
            ...DEFAULT_WORLD_CATEGORIES,
            ...prev.filter(cat => cat.type === 'custom'),
            newCategory
        ]);

        // Initialize empty attributes array for this category
        setAttributes(prev => ({
            ...prev,
            [id]: []
        }));
    };
    
    // Delete a category
    const deleteCategory = (categoryId: string) => {
        // Find the category to ensure it exists and is custom
        const categoryToDelete = attributeCategories.find(cat => cat.id === categoryId);
        if (!categoryToDelete || categoryToDelete.type !== 'custom') {
            console.warn('Cannot delete default categories');
            return;
        }
        
        // Update custom categories first
        const updatedCustomCategories = customCategories.filter(cat => cat.id !== categoryId);
        setCustomCategories(updatedCustomCategories);
        
        // Then update attributeCategories with DEFAULT_WORLD_CATEGORIES and updated custom categories
        setAttributeCategories([...DEFAULT_WORLD_CATEGORIES, ...updatedCustomCategories]);
        
        // Update attributes state by removing that category
        setAttributes(prev => {
            const newAttributes = {...prev};
            delete newAttributes[categoryId];
            return newAttributes;
        });
    };

    // Add a new attribute to a category (works for both default and custom categories)
    const addAttribute = (categoryId: string) => {
        // Add the new attribute to the specified category
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
        setIsSubmitting(true);
        
        try {
            // Create separate objects for each category
            const details: Record<string, string> = {};
            const additionalProps: Record<string, Record<string, string>> = {};
            
            // Process attributes by category
            Object.entries(attributes).forEach(([categoryId, items]) => {
                if (categoryId === 'details') {
                    // Details go directly into the details object
                    items.forEach(({key, value}) => {
                        if (key) details[key] = value;
                    });
                } else {
                    // Other categories become separate properties
                    const categoryData: Record<string, string> = {};
                    items.forEach(({key, value}) => {
                        if (key) categoryData[key] = value;
                    });
                    if (Object.keys(categoryData).length > 0) {
                        additionalProps[categoryId] = categoryData;
                    }
                }
            });
            
            // Store custom category metadata in details
            if (customCategories.length > 0) {
                details._customCategories = JSON.stringify(customCategories);
            }
            
            const world: World = {
                id, 
                name, 
                type, 
                details,
                ...additionalProps,
                createdAt: editingWorld?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const updatedWorlds = editingWorld 
                ? worlds.map(w => w.id === id ? world : w)
                : [...worlds, world];
                
            // First save to localStorage
            await storage.saveWorlds(updatedWorlds);
            // Then update React state
            setWorlds(updatedWorlds);
            setEditingWorld(null);
            setPage('landing');
        } catch (error) {
            console.error('Failed to save world:', error);
            alert('Failed to save world. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        setEditingWorld(null);
        setPage('landing');
    };

    const nameInputRef = useRef<HTMLInputElement>(null);
    
    // Focus the name input on mount
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);

    // Load custom categories from editing world
    useEffect(() => {
        if (editingWorld && editingWorld.details._customCategories) {
            try {
                const savedCustomCategories = JSON.parse(editingWorld.details._customCategories) as AttributeCategory[];
                setCustomCategories(savedCustomCategories);
                setAttributeCategories([...DEFAULT_WORLD_CATEGORIES, ...savedCustomCategories]);
                
                // Load attributes for custom categories
                const newAttributes = { ...attributes };
                savedCustomCategories.forEach(category => {
                    newAttributes[category.id] = Object.entries(editingWorld.details)
                        .filter(([key]) => key.startsWith(`${category.id}_`))
                        .map(([key, value]) => ({
                            key: key.replace(`${category.id}_`, ''),
                            value
                        }));
                });
                setAttributes(newAttributes);
            } catch (error) {
                console.error('Error loading custom categories:', error);
            }
        }
    }, [editingWorld]);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
            handleBack();
        }
    };

    return (
        <CreatorLayout
            title={editingWorld ? 'Edit World' : 'Create World'}
            icon="✨"
            theme="magical"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="creator-form" onKeyDown={handleKeyDown}>
                <div className="creator-form-section creator-form-section--magical">
                    <CreatorField label="Name:" htmlFor="world-name" required>
                        <CreatorInput
                            id="world-name"
                            value={name}
                            onChange={setName}
                            required
                            autoFocus
                        />
                    </CreatorField>

                    <CreatorField label="Type:" htmlFor="world-type" required>
                        <CreatorInput
                            id="world-type"
                            value={type}
                            onChange={setType}
                            placeholder="e.g., Fantasy, Sci-Fi, Modern"
                            required
                        />
                    </CreatorField>
                </div>
                
                <AttributeManager
                    title="World Attributes"
                    icon="🌍"
                    categories={attributeCategories}
                    attributes={attributes}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    onAddAttribute={addAttribute}
                    onUpdateAttribute={updateAttribute}
                    onRemoveAttribute={removeAttribute}
                    theme="magical"
                    categoryConfig={{
                        details: {
                            keyPlaceholder: 'Detail name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Detail',
                            valueIsTextarea: true
                        },
                        terrain: {
                            keyPlaceholder: 'Terrain name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Terrain',
                            valueIsTextarea: true
                        },
                        climate: {
                            keyPlaceholder: 'Climate name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Climate',
                            valueIsTextarea: true
                        },
                        inhabitants: {
                            keyPlaceholder: 'Inhabitant name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Inhabitant',
                            valueIsTextarea: true
                        }
                    }}
                />

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingWorld ? 'Update World' : 'Create World'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    );
} 