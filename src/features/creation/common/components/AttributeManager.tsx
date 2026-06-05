/**
 * Common attribute manager component for all creator views
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Icon, SectionHeader } from '@/ui/primitives';
import type { AttributeCategory } from '../../../../ui/components/common/AttributeList';
import { AttributeList } from '../../../../ui/components/common/AttributeList';
import { CategoryForm } from './CategoryForm';

export interface AttributeManagerProps {
    title: string;
    subtitle?: string;
    icon?: string;
    categories: AttributeCategory[];
    attributes: Record<string, { key: string; value: string }[]>;
    onAddCategory: (name: string, description: string) => void;
    onDeleteCategory: (categoryId: string) => void;
    onAddAttribute: (categoryId: string) => void;
    onUpdateAttribute: (categoryId: string, index: number, field: 'key' | 'value', value: string) => void;
    onRemoveAttribute: (categoryId: string, index: number) => void;
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
    subtitle,
    icon,
    categories,
    attributes,
    onAddCategory,
    onDeleteCategory,
    onAddAttribute,
    onUpdateAttribute,
    onRemoveAttribute,
    categoryConfig = {}
}: AttributeManagerProps) {
    const [showAddCategory, setShowAddCategory] = useState(false);

    const handleAddCategory = (name: string, description: string) => {
        onAddCategory(name, description);
        setShowAddCategory(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 border-b-2 border-parchment-50/10 pb-4">
                <SectionHeader
                    title={
                        <span className="flex items-center gap-2">
                            {icon && <span className="text-xl">{icon}</span>}
                            {title}
                        </span>
                    }
                    className="max-sm:flex-col max-sm:items-start max-sm:gap-4"
                    right={
                        <Button
                            kind="secondary"
                            size="sm"
                            onClick={() => setShowAddCategory(prev => !prev)}
                            iconLeft={<Icon icon={Plus} size={16} />}
                            className="max-sm:w-full"
                        >
                            Add Category
                        </Button>
                    }
                />
                {subtitle && <p className="font-narrative text-sm text-parchment-400">{subtitle}</p>}
            </div>

            {showAddCategory && (
                <div onClick={(e) => e.stopPropagation()}>
                    <CategoryForm
                        onSubmit={handleAddCategory}
                        onCancel={() => setShowAddCategory(false)}
                        useFormWrapper={false}
                    />
                </div>
            )}

            <div className="flex flex-col gap-6">
                {categories.map(category => {
                    const config = categoryConfig[category.id] || {};

                    return (
                        <div key={category.id}>
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