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
import { CategoryService } from '../../common/services';
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
            
            // Load other categories (skills, traits, equipment, etc)
            DEFAULT_CHARACTER_CATEGORIES.forEach(category => {
                if (category.id !== 'stats' && editingCharacter[category.id]) {
                    result[category.id] = Object.entries(editingCharacter[category.id] || {})
                        .map(([key, value]) => ({
                            key,
                            value: typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                        }));
                }
            });
            
            // Load custom categories if they exist
            if (editingCharacter.stats?._customCategories) {
                try {
                    const customCats = JSON.parse(editingCharacter.stats._customCategories);
                    customCats.forEach((category: AttributeCategory) => {
                        if (editingCharacter[category.id]) {
                            result[category.id] = Object.entries(editingCharacter[category.id] || {})
                                .map(([key, value]) => ({
                                    key,
                                    value: typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                                }));
                        }
                    });
                } catch (err) {
                    console.error('Failed to parse custom categories:', err);
                }
            }
        }

        return result;
    };
    
    const [attributes, setAttributes] = useState<Record<string, { key: string; value: string }[]>>(
        initializeAttributes()
    );
    
    // Load custom categories from editing character using CategoryService
    useEffect(() => {
        if (editingCharacter) {
            const savedCustomCategories = CategoryService.loadCategories(editingCharacter, 'stats');
            
            if (savedCustomCategories.length > 0) {
                setCustomCategories(savedCustomCategories);
                
                // Update all categories
                setAttributeCategories([
                    ...DEFAULT_CHARACTER_CATEGORIES,
                    ...savedCustomCategories
                ]);
                
                // Initialize attributes for all categories using CategoryService
                const allCategories = [...DEFAULT_CHARACTER_CATEGORIES, ...savedCustomCategories];
                const initializedAttributes = CategoryService.initializeAttributes(
                    editingCharacter,
                    allCategories,
                    'stats'
                );
                
                setAttributes(initializedAttributes);
            }
        }
    }, [editingCharacter]);

    // Add a new custom category using CategoryService
    const addCategory = (name: string, description: string) => {
        const newCategory = CategoryService.createCategory(name, description);
        
        // Add the new category to customCategories state
        setCustomCategories(prev => [...prev, newCategory]);
        
        // Update attributeCategories
        setAttributeCategories(prev => [...prev, newCategory]);
        
        // Initialize empty attributes array for this category
        setAttributes(prev => ({
            ...prev,
            [newCategory.id]: []
        }));
        
        return newCategory.id;
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
        
        // Then update attributeCategories with DEFAULT_CHARACTER_CATEGORIES and updated custom categories
        setAttributeCategories([...DEFAULT_CHARACTER_CATEGORIES, ...updatedCustomCategories]);
        
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
        if (!name || !race) return;
        
        setIsSubmitting(true);
        
        try {
            // Prepare character data structure
            let characterData: Character = {
                id, 
                name, 
                race, 
                description,
                stats: {},
                skills: {},
                traits: {},
                equipment: {},
                createdAt: editingCharacter?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Save custom categories metadata using CategoryService
            if (customCategories.length > 0) {
                characterData = CategoryService.saveCategories(characterData, customCategories, 'stats') as Character;
            }
            
            // Save attributes for all categories using CategoryService
            Object.keys(attributes).forEach(categoryId => {
                characterData = CategoryService.saveAttributes(
                    characterData,
                    categoryId,
                    attributes[categoryId]?.filter(attr => attr.key && attr.value) || [],
                    'stats'
                ) as Character;
            });
            
            // Save to storage and update app state
            const updatedCharacters = editingCharacter 
                ? characters.map(c => c.id === id ? characterData : c)
                : [...characters, characterData];
                
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
        // Load custom categories from existing character using CategoryService
        if (editingCharacter) {
            const savedCustomCategories = CategoryService.loadCategories(editingCharacter, 'stats');
            
            if (savedCustomCategories.length > 0) {
                setCustomCategories(savedCustomCategories);
                
                // Update all categories
                setAttributeCategories([
                    ...DEFAULT_CHARACTER_CATEGORIES,
                    ...savedCustomCategories
                ]);
                
                // Initialize attributes for all categories using CategoryService
                const allCategories = [...DEFAULT_CHARACTER_CATEGORIES, ...savedCustomCategories];
                const initializedAttributes = CategoryService.initializeAttributes(
                    editingCharacter,
                    allCategories,
                    'stats'
                );
                
                setAttributes(initializedAttributes);
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
                <div className="creator-form-section creator-form-section--fire character-essentials">
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