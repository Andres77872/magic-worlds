/**
 * World creator component - refactored with common components
 */

import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { World } from '../../../../shared';
import { useNavigation, useData } from '../../../../app/hooks';
import { apiService } from '../../../../infrastructure/api';
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
import './WorldCreator.css';

// Interface for world creation API request
interface WorldCreationRequest {
    name: string;
    type: string;
    description: string;
    category: Array<{
        name: string;
        description: string;
        attributes: Array<Record<string, string>>;
    }>;
}

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

// Helper function to transform world data to API format
const transformToApiFormat = (
    name: string,
    type: string,
    description: string,
    attributes: Record<string, { key: string; value: string }[]>,
    attributeCategories: AttributeCategory[]
): WorldCreationRequest => {
    const categories = attributeCategories
        .filter(category => attributes[category.id] && attributes[category.id].length > 0)
        .map(category => ({
            name: category.name,
            description: category.description,
            attributes: attributes[category.id]
                .filter(attr => attr.key && attr.value)
                .map(attr => ({ [attr.key]: attr.value }))
        }))
        .filter(category => category.attributes.length > 0);

    return {
        name,
        type,
        description,
        category: categories
    };
};

export function WorldCreator() {
    const { setPage } = useNavigation();
    const { editingWorld, setEditingWorld } = useData();
    
    const [name, setName] = useState(editingWorld?.name ?? '');
    const [type, setType] = useState(editingWorld?.type ?? '');
    const [description, setDescription] = useState(editingWorld?.description ?? '');
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

    // Handle form submission using API endpoints
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        if (!name || !type) {
            setIsSubmitting(false);
            return;
        }
        
        try {
            // Transform data to API format
            const apiPayload = transformToApiFormat(
                name,
                type,
                description,
                attributes,
                attributeCategories
            );
            
            let result;
            
            if (editingWorld) {
                // Update existing world
                result = await apiService.updateWorld(editingWorld.id, apiPayload);
            } else {
                // Create new world
                result = await apiService.createWorld(apiPayload);
            }
            
            // Only use the id from the response, ignore other debug fields
            const worldId = result.id;
            
            console.log(`World ${editingWorld ? 'updated' : 'created'} successfully with ID:`, worldId);
            
            // Navigate back to landing page
            setEditingWorld(null);
            setPage('landing');
        } catch (error) {
            console.error(`Failed to ${editingWorld ? 'update' : 'create'} world:`, error);
            alert(`Failed to ${editingWorld ? 'update' : 'create'} world. Please try again.`);
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

    useEffect(() => {
        // Load custom categories from existing world if available using CategoryService
        if (editingWorld) {
            // Load custom categories using CategoryService
            const savedCustomCategories = CategoryService.loadCategories(editingWorld);
            
            if (savedCustomCategories.length > 0) {
                setCustomCategories(savedCustomCategories);
                
                // Update all categories
                setAttributeCategories([
                    ...DEFAULT_WORLD_CATEGORIES,
                    ...savedCustomCategories
                ]);
                
                // Initialize attributes for all categories using CategoryService
                const allCategories = [...DEFAULT_WORLD_CATEGORIES, ...savedCustomCategories];
                const initializedAttributes = CategoryService.initializeAttributes(
                    editingWorld,
                    allCategories,
                    'details'
                );
                
                setAttributes(initializedAttributes);
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

                    <CreatorField label="Description:" htmlFor="world-description">
                        <CreatorTextarea
                            id="world-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your world's setting, atmosphere, and key characteristics..."
                            rows={4}
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