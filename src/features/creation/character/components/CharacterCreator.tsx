/**
 * Character creator component - refactored with common components
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { Character } from '../../../../shared';
import { useNavigation, useData } from '../../../../app/hooks';
import { storage } from '../../../../infrastructure/storage';
import { generateUUID } from '../../../../utils/uuid';
import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { 
    CreatorLayout, 
    CreatorField, 
    CreatorInput,
    CreatorTextarea, 
    AttributeManager,
    FormActions 
} from '../../common/components';
import './CharacterCreator.css';

// Predefined attribute categories for characters
const DEFAULT_CHARACTER_CATEGORIES: AttributeCategory[] = [
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
    const { setPage } = useNavigation();
    const { characters, setCharacters, editingCharacter, setEditingCharacter } = useData();
    
    const [id] = useState(editingCharacter?.id ?? generateUUID());
    const [name, setName] = useState(editingCharacter?.name ?? '');
    const [race, setRace] = useState(editingCharacter?.race ?? '');
    const [description, setDescription] = useState(editingCharacter?.description ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Store custom categories separately
    const [customCategories, setCustomCategories] = useState<AttributeCategory[]>([]);
    
    // Initialize attributeCategories
    const [attributeCategories, setAttributeCategories] = useState<AttributeCategory[]>([
        ...DEFAULT_CHARACTER_CATEGORIES,
        ...customCategories
    ]);
    
    // Initialize attributes from existing character or empty structure
    const initializeAttributes = () => {
        const result: Record<string, { key: string; value: string }[]> = {};
        
        // Initialize all categories with empty arrays
        attributeCategories.forEach(category => {
            result[category.id] = [];
        });
        
        if (editingCharacter) {
            // Map existing character stats (main category)
            result.stats = Object.entries(editingCharacter.stats || {})
                .filter(([key]) => !key.startsWith('_')) // Filter out metadata
                .map(([key, value]) => ({
                    key,
                    value: typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                }));
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

        // Add the new category
        setCustomCategories(prev => [...prev, newCategory]);
        setAttributeCategories(prev => [...prev, newCategory]);

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
        if (!categoryToDelete || categoryToDelete.type !== 'custom') return;
        
        // Update custom categories
        setCustomCategories(prev => prev.filter(cat => cat.id !== categoryId));
        
        // Update all categories
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
        setIsSubmitting(true);
        
        try {
            // Flatten all attributes into stats and additional properties
            const allStats: Record<string, string> = {};
            const additionalProps: Record<string, Record<string, string>> = {};
            
            // Process attributes
            Object.entries(attributes).forEach(([categoryId, items]) => {
                if (categoryId === 'stats') {
                    // Stats go directly into the stats object
                    items.forEach(({key, value}) => {
                        if (key) allStats[key] = value;
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
            
            // Store custom category metadata in stats
            if (customCategories.length > 0) {
                allStats._customCategories = JSON.stringify(customCategories);
            }
            
            const character: Character = {
                id,
                name,
                race,
                description,
                stats: allStats,
                ...additionalProps,
                createdAt: editingCharacter?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const updatedCharacters = editingCharacter 
                ? characters.map(c => c.id === id ? character : c)
                : [...characters, character];
                
            // First save to localStorage
            await storage.saveCharacters(updatedCharacters);
            // Then update React state
            setCharacters(updatedCharacters);
            setEditingCharacter(null);
            setPage('landing');
        } catch (error) {
            console.error('Failed to save character:', error);
            alert('Failed to save character. Please try again.');
        } finally {
            setIsSubmitting(false);
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

    // Load custom categories from editing character
    useEffect(() => {
        if (editingCharacter && editingCharacter.stats && editingCharacter.stats._customCategories) {
            try {
                const savedCustomCategories = JSON.parse(editingCharacter.stats._customCategories as string) as AttributeCategory[];
                setCustomCategories(savedCustomCategories);
                setAttributeCategories([...DEFAULT_CHARACTER_CATEGORIES, ...savedCustomCategories]);
                
                // Load attributes for custom categories
                const newAttributes = { ...attributes };
                savedCustomCategories.forEach(category => {
                    const categoryData = (editingCharacter as any)[category.id];
                    if (categoryData && typeof categoryData === 'object') {
                        newAttributes[category.id] = Object.entries(categoryData)
                            .map(([key, value]) => ({
                                key,
                                value: typeof value === 'string' ? value : String(value)
                            }));
                    }
                });
                setAttributes(newAttributes);
            } catch (error) {
                console.error('Error loading custom categories:', error);
            }
        }
    }, [editingCharacter]);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
            handleBack();
        }
    };

    return (
        <CreatorLayout
            title={editingCharacter ? 'Edit Character' : 'Create Character'}
            icon="🎭"
            theme="fire"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="creator-form" onKeyDown={handleKeyDown}>
                <div className="creator-form-section character-essentials">
                    <CreatorField 
                        label="Name:" 
                        htmlFor="character-name" 
                        required
                        tooltip="The name of your character. This will be used to identify them throughout the game."
                    >
                        <CreatorInput
                            id="character-name"
                            value={name}
                            onChange={setName}
                            required
                            autoFocus
                        />
                    </CreatorField>

                    <CreatorField 
                        label="Race/Species:" 
                        htmlFor="character-race" 
                        required
                        tooltip="The race or species of your character, which may influence traits and abilities."
                    >
                        <CreatorInput
                            id="character-race"
                            value={race}
                            onChange={setRace}
                            required
                        />
                    </CreatorField>

                    <CreatorField 
                        label="Description:" 
                        htmlFor="character-description"
                        tooltip="Add a rich description of your character including their background, appearance, and personality traits."
                    >
                        <CreatorTextarea
                            id="character-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your character's appearance, personality, and background..."
                            rows={4}
                        />
                    </CreatorField>
                </div>
                
                <AttributeManager
                    title="Attributes & Abilities"
                    icon="⚔️"
                    categories={attributeCategories}
                    attributes={attributes}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    onAddAttribute={addAttribute}
                    onUpdateAttribute={updateAttribute}
                    onRemoveAttribute={removeAttribute}
                    theme="fire"
                    categoryConfig={{
                        stats: {
                            keyPlaceholder: 'Stat name',
                            valuePlaceholder: 'Value',
                            addButtonLabel: 'Add Stat'
                        },
                        skills: {
                            keyPlaceholder: 'Skill name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Skill',
                            valueIsTextarea: true
                        },
                        traits: {
                            keyPlaceholder: 'Trait name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Trait',
                            valueIsTextarea: true
                        },
                        equipment: {
                            keyPlaceholder: 'Item name',
                            valuePlaceholder: 'Description',
                            addButtonLabel: 'Add Equipment',
                            valueIsTextarea: true
                        }
                    }}
                />

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingCharacter ? 'Update Character' : 'Create Character'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    );
} 