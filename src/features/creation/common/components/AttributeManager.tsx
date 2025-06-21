/**
 * Common attribute manager component for all creator views
 */

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { AttributeList } from '../../../../ui/components/common/AttributeList';
import { CategoryForm } from './CategoryForm';
import '../styles/AttributeManager.css';

export interface AttributeManagerProps {
    title: string;
    icon?: string;
    categories: AttributeCategory[];
    attributes: Record<string, { key: string; value: string }[]>;
    onAddCategory: (name: string, description: string) => void;
    onDeleteCategory: (categoryId: string) => void;
    onAddAttribute: (categoryId: string) => void;
    onUpdateAttribute: (categoryId: string, index: number, field: 'key' | 'value', value: string) => void;
    onRemoveAttribute: (categoryId: string, index: number) => void;
    theme?: 'magical' | 'fire' | 'nature';
    categoryConfig?: {
        [categoryId: string]: {
            keyPlaceholder?: string;
            valuePlaceholder?: string;
            addButtonLabel?: string;
            valueIsTextarea?: boolean;
        };
    };
}

export function AttributeManager({
    title,
    icon,
    categories,
    attributes,
    onAddCategory,
    onDeleteCategory,
    onAddAttribute,
    onUpdateAttribute,
    onRemoveAttribute,
    theme = 'magical',
    categoryConfig = {}
}: AttributeManagerProps) {
    const [showAddCategory, setShowAddCategory] = useState(false);

    const handleAddCategory = (name: string, description: string) => {
        onAddCategory(name, description);
        setShowAddCategory(false);
    };

    return (
        <div className={`attribute-manager attribute-manager-${theme}`}>
            <div className="attribute-manager-header">
                <h3 className="attribute-manager-title">
                    {icon && <span className="attribute-manager-icon">{icon}</span>}
                    {title}
                </h3>
                <button
                    type="button"
                    className="creator-btn creator-btn-accent creator-btn-sm"
                    onClick={() => setShowAddCategory(prev => !prev)}
                >
                    <FaPlus /> Add Category
                </button>
            </div>

            {showAddCategory && (
                <CategoryForm
                    onSubmit={handleAddCategory}
                    onCancel={() => setShowAddCategory(false)}
                    theme={theme}
                />
            )}

            <div className="attribute-categories">
                {categories.map(category => {
                    const config = categoryConfig[category.id] || {};
                    
                    return (
                        <div key={category.id} className="attribute-category-wrapper">
                            <AttributeList
                                category={category}
                                attributes={attributes[category.id] || []}
                                onAddAttribute={() => onAddAttribute(category.id)}
                                onUpdateAttribute={(index, field, value) =>
                                    onUpdateAttribute(category.id, index, field, value)
                                }
                                onRemoveAttribute={(index) => onRemoveAttribute(category.id, index)}
                                onDeleteCategory={() => onDeleteCategory(category.id)}
                                isDeletable={category.type === 'custom'}
                                keyPlaceholder={config.keyPlaceholder}
                                valuePlaceholder={config.valuePlaceholder}
                                addButtonLabel={config.addButtonLabel}
                                valueIsTextarea={config.valueIsTextarea}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
} 