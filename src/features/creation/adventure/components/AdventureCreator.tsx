/**
 * Adventure creator component - refactored with common components
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { Adventure, Character } from '../../../../shared';
import { useNavigation, useData } from '../../../../app/hooks';
import { generateUUID } from '../../../../utils/uuid';
import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { 
    CreatorLayout, 
    CreatorField, 
    CreatorTextarea, 
    AttributeManager,
    FormActions 
} from '../../common/components';
import { CategoryService } from '../../common/services';
import './AdventureCreator.css';

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

export function AdventureCreator() {
    const { setPage } = useNavigation();
    const { templateAdventures, setTemplateAdventures, editingTemplate, setEditingTemplate, characters, worlds } = useData();
    
    const [id] = useState(editingTemplate?.id ?? generateUUID());
    const [scenario, setScenario] = useState(editingTemplate?.scenario ?? '');
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
        editingTemplate?.characters?.map(c => c.id) ?? []
    );
    const [selectedWorld, setSelectedWorld] = useState<string | undefined>(
        editingTemplate?.world?.id
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Store custom categories separately
    const [customCategories, setCustomCategories] = useState<AttributeCategory[]>([]);
    
    // Initialize attributeCategories
    const [attributeCategories, setAttributeCategories] = useState<AttributeCategory[]>([
        ...DEFAULT_ADVENTURE_CATEGORIES,
        ...customCategories
    ]);
    
    // Initialize attributes from existing adventure or empty structure
    const initializeAttributes = () => {
        const result: Record<string, { key: string; value: string }[]> = {};
        
        // Initialize all categories with empty arrays
        attributeCategories.forEach(category => {
            result[category.id] = [];
        });
        
        if (editingTemplate) {
            // Load existing adventure attributes
            DEFAULT_ADVENTURE_CATEGORIES.forEach(category => {
                const categoryData = (editingTemplate as any)[category.id];
                if (categoryData) {
                    result[category.id] = Object.entries(categoryData || {})
                        .map(([key, value]) => ({
                            key,
                            value: String(value)
                        }));
                }
            });
        }

        return result;
    };
    
    const [attributes, setAttributes] = useState<Record<string, { key: string; value: string }[]>>(
        initializeAttributes()
    );
    
    // Effect for loading custom categories from editing adventure using CategoryService
    useEffect(() => {
        if (editingTemplate) {
            const savedCustomCategories = CategoryService.loadCategories(editingTemplate, 'details');
            
            if (savedCustomCategories.length > 0) {
                setCustomCategories(savedCustomCategories);
                
                // Update all categories list
                setAttributeCategories([
                    ...DEFAULT_ADVENTURE_CATEGORIES,
                    ...savedCustomCategories
                ]);
                
                // Initialize attributes for all categories using CategoryService
                const allCategories = [...DEFAULT_ADVENTURE_CATEGORIES, ...savedCustomCategories];
                const initializedAttributes = CategoryService.initializeAttributes(
                    editingTemplate,
                    allCategories,
                    'details'
                );
                
                setAttributes(initializedAttributes);
            }
        }
    }, [editingTemplate]);

    // Add a new custom category using CategoryService
    const addCategory = (name: string, description: string) => {
        const newCategory = CategoryService.createCategory(name, description);
        
        // Add the new category to customCategories state
        setCustomCategories(prev => [...prev, newCategory]);
        
        // Add to all categories
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
        if (!categoryToDelete || DEFAULT_ADVENTURE_CATEGORIES.some(c => c.id === categoryId)) {
            console.warn('Cannot delete default categories');
            return;
        }
        
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
        if (!scenario) return;
        
        setIsSubmitting(true);
        
        try {
            // Prepare adventure data with selected characters and world
            let adventure: Adventure = {
                id,
                scenario,
                characters: selectedCharacters
                    .map(charId => characters.find(c => c.id === charId))
                    .filter((character): character is Character => character !== undefined),
                world: selectedWorld ? worlds.find(w => w.id === selectedWorld) : undefined,
                createdAt: editingTemplate?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // Initialize empty objects for base categories that are in the interface
                objectives: {},
                notes: {}
            };
            
            // Use centralized CategoryService to save the adventure, custom categories, and attributes
            const updatedTemplates = await CategoryService.saveAdventure(
                adventure,
                templateAdventures,
                customCategories,
                attributes
            );
            
            // Update React state
            setTemplateAdventures(updatedTemplates);
            setEditingTemplate(null);
            setPage('landing');
        } catch (error) {
            console.error('Failed to save adventure:', error);
            alert('Failed to save adventure. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        setEditingTemplate(null);
        setPage('landing');
    };

    const scenarioInputRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
        if (scenarioInputRef.current) {
            scenarioInputRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
            handleBack();
        }
    };

    const handleCharacterChange = (characterId: string, checked: boolean) => {
        if (checked) {
            setSelectedCharacters(prev => [...prev, characterId]);
        } else {
            setSelectedCharacters(prev => prev.filter(id => id !== characterId));
        }
    };

    return (
        <CreatorLayout
            title={editingTemplate ? 'Edit Adventure' : 'Create Adventure'}
            icon="🗺️"
            theme="nature"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="creator-form" onKeyDown={handleKeyDown}>
                <div className="creator-form-section creator-form-section--nature">
                    <CreatorField label="Scenario:" htmlFor="adventure-scenario" required>
                        <div className="adventure-field-wrapper">
                            <CreatorTextarea
                                id="adventure-scenario"
                                value={scenario}
                                onChange={setScenario}
                                rows={4}
                                required
                                autoFocus
                            />
                        </div>
                    </CreatorField>
                </div>

                <div className="adventure-selection-section">
                    <div className="adventure-character-selection">
                        <CreatorField label="Characters:">
                            {characters.length === 0 ? (
                                <div className="adventure-empty-state">
                                    No characters available. 
                                    <button 
                                        type="button" 
                                        className="adventure-btn-link" 
                                        onClick={() => setPage('character')}
                                    >
                                        Create one
                                    </button>
                                </div>
                            ) : (
                                <div className="adventure-character-options">
                                    {characters.map(character => (
                                        <div key={character.id} className="adventure-character-option">
                                            <label className="adventure-checkbox-label">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedCharacters.includes(character.id)}
                                                    onChange={(e) => handleCharacterChange(character.id, e.target.checked)}
                                                />
                                                <span className="adventure-checkbox-text">{character.name}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CreatorField>
                    </div>

                    <div className="adventure-world-selection">
                        <CreatorField label="World (optional):">
                            <div className="adventure-world-options">
                                <div className="adventure-world-option">
                                    <label className="adventure-radio-label">
                                        <input 
                                            type="radio" 
                                            name="world" 
                                            checked={!selectedWorld}
                                            onChange={() => setSelectedWorld(undefined)}
                                        />
                                        <span className="adventure-radio-text">None</span>
                                    </label>
                                </div>
                                
                                {worlds.length === 0 ? (
                                    <div className="adventure-empty-state">
                                        No worlds available. 
                                        <button 
                                            type="button" 
                                            className="adventure-btn-link" 
                                            onClick={() => setPage('world')}
                                        >
                                            Create one
                                        </button>
                                    </div>
                                ) : (
                                    worlds.map(world => (
                                        <div key={world.id} className="adventure-world-option">
                                            <label className="adventure-radio-label">
                                                <input 
                                                    type="radio" 
                                                    name="world" 
                                                    checked={selectedWorld === world.id}
                                                    onChange={() => setSelectedWorld(world.id)}
                                                />
                                                <span className="adventure-radio-text">{world.name}</span>
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CreatorField>
                    </div>
                </div>
                
                <AttributeManager
                    title="Adventure Components"
                    icon="🎯"
                    categories={attributeCategories}
                    attributes={attributes}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    onAddAttribute={addAttribute}
                    onUpdateAttribute={updateAttribute}
                    onRemoveAttribute={removeAttribute}
                    theme="nature"
                    categoryConfig={Object.fromEntries(
                        attributeCategories.map(category => [
                            category.id,
                            {
                                keyPlaceholder: getKeyPlaceholder(category.id),
                                valuePlaceholder: getValuePlaceholder(category.id),
                                addButtonLabel: getAddButtonLabel(category.id),
                                valueIsTextarea: category.id === 'notes' || category.id === 'npcs'
                            }
                        ])
                    )}
                />

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingTemplate ? 'Update Adventure' : 'Create Adventure'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    );
} 