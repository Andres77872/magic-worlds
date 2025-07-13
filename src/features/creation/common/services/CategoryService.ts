/**
 * Category Service - centralized management of attribute categories and entities
 * 
 * This service provides consistent operations for handling custom categories
 * and their properties across all creator components, as well as entity operations
 * such as save, create, update, and load.
 */

import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { generateUUID } from '../../../../utils/uuid';
import { storage } from '../../../../infrastructure/storage';
import type { World, Adventure, Character } from '../../../../shared';

// Interface for the base entity that will have categories
export interface CategorizedEntity {
    id: string;
    [key: string]: any;
}

// Default storage field where custom categories metadata is stored
const CUSTOM_CATEGORIES_META_KEY = '_customCategories';

export class CategoryService {
    /**
     * Create a new custom category with a unique ID
     */
    static createCategory(name: string, description: string): AttributeCategory {
        return {
            id: `custom_${generateUUID().substring(0, 8)}`,
            name,
            description,
            type: 'custom'
        };
    }
    
    /**
     * Create a new entity with basic properties
     * @param type The type of entity to create ('world', 'adventure', or 'character')
     * @param name The name of the entity
     * @param additionalProps Additional properties specific to this entity type
     */
    static createEntity(_type: 'world' | 'adventure' | 'character', name: string, additionalProps: Record<string, any> = {}): CategorizedEntity {
        const timestamp = new Date().toISOString();
        
        return {
            id: generateUUID(),
            name,
            createdAt: timestamp,
            updatedAt: timestamp,
            details: {},
            ...additionalProps
        };
    }

    /**
     * Save custom categories to an entity
     * @param entity The entity to save categories to (world, character, etc)
     * @param customCategories List of custom categories to save
     * @param primaryField The primary field to store custom categories metadata in (e.g. 'details', 'stats')
     */
    static saveCategories(
        entity: CategorizedEntity, 
        customCategories: AttributeCategory[],
        primaryField: string = 'details'
    ): CategorizedEntity {
        // Ensure primary field exists
        if (!entity[primaryField]) {
            entity[primaryField] = {};
        }
        
        // Add custom categories metadata
        entity[primaryField][CUSTOM_CATEGORIES_META_KEY] = JSON.stringify(customCategories);
        
        return entity;
    }

    /**
     * Load custom categories from an entity
     * @param entity The entity to load categories from
     * @param primaryField The field where custom categories metadata is stored
     */
    static loadCategories(
        entity: CategorizedEntity | null | undefined,
        primaryField: string = 'details'
    ): AttributeCategory[] {
        if (!entity || !entity[primaryField] || !entity[primaryField][CUSTOM_CATEGORIES_META_KEY]) {
            return [];
        }
        
        try {
            return JSON.parse(entity[primaryField][CUSTOM_CATEGORIES_META_KEY]);
        } catch (error) {
            console.error('Error parsing custom categories:', error);
            return [];
        }
    }
    
    /**
     * Save attributes for a custom category to an entity
     * @param entity The entity to save attributes to
     * @param categoryId The ID of the category to save attributes for
     * @param attributes The attributes to save
     * @param primaryField The field where attributes will be stored
     */
    static saveAttributes(
        entity: CategorizedEntity,
        categoryId: string,
        attributes: { key: string; value: string }[],
        primaryField: string = 'details'
    ): CategorizedEntity {
        // Ensure primary field exists
        if (!entity[primaryField]) {
            entity[primaryField] = {};
        }
        
        // For custom categories, store attributes in the primary field with prefixed keys
        if (categoryId.startsWith('custom_')) {
            attributes.forEach(attr => {
                const key = `${categoryId}_${attr.key}`;
                entity[primaryField][key] = attr.value;
            });
        } 
        // For default categories, check if they should be stored in a dedicated field or in primary field
        else if (entity[categoryId] !== undefined || categoryId !== primaryField) {
            // If the entity already has a field for this category or it's not the primary field
            if (!entity[categoryId]) {
                entity[categoryId] = {};
            }
            
            attributes.forEach(attr => {
                entity[categoryId][attr.key] = attr.value;
            });
        } 
        // Otherwise store directly in primary field
        else {
            attributes.forEach(attr => {
                entity[primaryField][attr.key] = attr.value;
            });
        }
        
        return entity;
    }
    
    /**
     * Load attributes for a category from an entity
     * @param entity The entity to load attributes from
     * @param categoryId The ID of the category to load attributes for
     * @param primaryField The field where attributes might be stored
     */
    static loadAttributes(
        entity: CategorizedEntity | null | undefined,
        categoryId: string,
        primaryField: string = 'details'
    ): { key: string; value: string }[] {
        if (!entity) {
            return [];
        }
        
        // For custom categories, load from primary field with prefix
        if (categoryId.startsWith('custom_') && entity[primaryField]) {
            return Object.entries(entity[primaryField])
                .filter(([key]) => key.startsWith(`${categoryId}_`))
                .map(([key, value]) => ({
                    key: key.replace(`${categoryId}_`, ''),
                    value: String(value)
                }));
        }
        // For default categories, check dedicated field first
        else if (entity[categoryId]) {
            return Object.entries(entity[categoryId])
                .filter(([key]) => !key.startsWith('_')) // Filter out metadata
                .map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
        }
        // If no dedicated field, try primary field
        else if (categoryId === primaryField && entity[primaryField]) {
            return Object.entries(entity[primaryField])
                .filter(([key]) => !key.startsWith('_')) // Filter out metadata
                .map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
        }
        
        return [];
    }
    
    /**
     * Initialize all attributes for a list of categories from an entity
     * @param entity The entity to load attributes from
     * @param categories List of categories to initialize attributes for
     * @param primaryField The primary field where attributes might be stored
     */
    static initializeAttributes(
        entity: CategorizedEntity | null | undefined,
        categories: AttributeCategory[],
        primaryField: string = 'details'
    ): Record<string, { key: string; value: string }[]> {
        const result: Record<string, { key: string; value: string }[]> = {};
        
        // Initialize all categories with empty arrays
        categories.forEach(category => {
            result[category.id] = [];
        });
        
        if (entity) {
            // Load attributes for each category
            categories.forEach(category => {
                result[category.id] = this.loadAttributes(entity, category.id, primaryField);
            });
        }
        
        return result;
    }
    
    /**
     * Save a world entity to storage
     * @param world The world entity to save
     * @param existingWorlds Optional array of existing worlds
     * @param customCategories Optional custom categories to save with the world
     * @param attributes Optional attributes to save with the world
     */
    static async saveWorld(
        world: World,
        existingWorlds: World[] = [],
        customCategories: AttributeCategory[] = [],
        attributes: Record<string, { key: string; value: string }[]> = {}
    ): Promise<World[]> {
        try {
            // Ensure updatedAt is current
            world.updatedAt = new Date().toISOString();
            
            // Save custom categories if provided
            if (customCategories.length > 0) {
                world = this.saveCategories(world, customCategories) as World;
            }
            
            // Save attributes if provided
            if (Object.keys(attributes).length > 0) {
                Object.keys(attributes).forEach(categoryId => {
                    world = this.saveAttributes(
                        world,
                        categoryId,
                        attributes[categoryId]?.filter(attr => attr.key && attr.value) || []
                    ) as World;
                });
            }
            
            // Update existing or add new world
            const updatedWorlds = existingWorlds.some(w => w.id === world.id)
                ? existingWorlds.map(w => w.id === world.id ? world : w)
                : [...existingWorlds, world];
            
            // Save to storage
            await storage.saveWorlds(updatedWorlds);
            return updatedWorlds;
        } catch (error) {
            console.error('Failed to save world:', error);
            throw new Error('Failed to save world.');
        }
    }
    
    /**
     * Save an adventure entity to storage
     * @param adventure The adventure entity to save
     * @param existingAdventures Optional array of existing adventures
     * @param customCategories Optional custom categories to save with the adventure
     * @param attributes Optional attributes to save with the adventure
     */
    static async saveAdventure(
        adventure: Adventure,
        existingAdventures: Adventure[] = [],
        customCategories: AttributeCategory[] = [],
        attributes: Record<string, { key: string; value: string }[]> = {}
    ): Promise<Adventure[]> {
        try {
            // Ensure updatedAt is current
            adventure.updatedAt = new Date().toISOString();
            
            // Save custom categories using standard method
            if (customCategories.length > 0) {
                adventure = this.saveCategories(adventure, customCategories) as Adventure;
            }
            
            // Process attributes for each category
            if (Object.keys(attributes).length > 0) {
                Object.keys(attributes).forEach(categoryId => {
                    adventure = this.saveAttributes(
                        adventure,
                        categoryId,
                        attributes[categoryId]?.filter(attr => attr.key && attr.value) || []
                    ) as Adventure;
                });
            }
            
            // Update existing or add new adventure
            const updatedAdventures = existingAdventures.some(a => a.id === adventure.id)
                ? existingAdventures.map(a => a.id === adventure.id ? adventure : a)
                : [...existingAdventures, adventure];
            
            // Save to storage
            await storage.saveTemplateAdventures(updatedAdventures);
            return updatedAdventures;
        } catch (error) {
            console.error('Failed to save adventure:', error);
            throw new Error('Failed to save adventure.');
        }
    }
    
    /**
     * Save a character entity to storage
     * @param character The character entity to save
     * @param existingCharacters Optional array of existing characters
     * @param customCategories Optional custom categories to save with the character
     * @param attributes Optional attributes to save with the character
     */
    static async saveCharacter(
        character: Character,
        existingCharacters: Character[] = [],
        customCategories: AttributeCategory[] = [],
        attributes: Record<string, { key: string; value: string }[]> = {}
    ): Promise<Character[]> {
        try {
            // Ensure updatedAt is current
            character.updatedAt = new Date().toISOString();
            
            // Save custom categories if provided
            if (customCategories.length > 0) {
                character = this.saveCategories(character, customCategories) as Character;
            }
            
            // Save attributes if provided
            if (Object.keys(attributes).length > 0) {
                Object.keys(attributes).forEach(categoryId => {
                    character = this.saveAttributes(
                        character,
                        categoryId,
                        attributes[categoryId]?.filter(attr => attr.key && attr.value) || []
                    ) as Character;
                });
            }
            
            // Update existing or add new character
            const updatedCharacters = existingCharacters.some(c => c.id === character.id)
                ? existingCharacters.map(c => c.id === character.id ? character : c)
                : [...existingCharacters, character];
            
            // Save to storage
            await storage.saveCharacters(updatedCharacters);
            return updatedCharacters;
        } catch (error) {
            console.error('Failed to save character:', error);
            throw new Error('Failed to save character.');
        }
    }
    
    /**
     * Load entities from storage
     * @param type The type of entity to load ('world', 'adventure', or 'character')
     */
    static async loadEntities(type: 'world' | 'adventure' | 'character'): Promise<any[]> {
        try {
            switch (type) {
                case 'world':
                    return await storage.loadWorlds();
                case 'adventure':
                    return await storage.loadTemplateAdventures();
                case 'character':
                    return await storage.loadCharacters();
                default:
                    throw new Error(`Unsupported entity type: ${type}`);
            }
        } catch (error) {
            console.error(`Failed to load ${type}s:`, error);
            return [];
        }
    }
}
