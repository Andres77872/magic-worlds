/**
 * Common category form component for adding new attribute categories
 */

import { useState } from 'react';
import { CreatorField, CreatorInput, CreatorTextarea } from './CreatorField';
import '../styles/CategoryForm.css';

export interface CategoryFormProps {
    /**
     * Whether to use a <form> wrapper (true) or a <div> wrapper (false)
     * Set to false when this component is used within another form
     */
    useFormWrapper?: boolean;
    onSubmit: (name: string, description: string) => void;
    onCancel: () => void;
    theme?: 'magical' | 'fire' | 'nature';
}

export function CategoryForm({ onSubmit, onCancel, theme = 'magical', useFormWrapper = true }: CategoryFormProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent the event from bubbling up to parent forms
        if (name.trim()) {
            onSubmit(name.trim(), description.trim());
        }
    };

    const getPlaceholderByTheme = () => {
        switch (theme) {
            case 'fire':
                return {
                    name: 'e.g., Magic Abilities, Backgrounds',
                    description: 'What kind of attributes belong in this category?'
                };
            case 'nature':
                return {
                    name: 'e.g., Encounters, Treasures, Events',
                    description: 'What kind of information belongs in this category?'
                };
            default:
                return {
                    name: 'e.g., Magic Systems, Factions',
                    description: 'What kind of attributes belong in this category?'
                };
        }
    };

    const placeholders = getPlaceholderByTheme();

    // Use FormWrapper component to conditionally render as form or div
    const FormWrapper = useFormWrapper ? 'form' : 'div';
    
    return (
        <FormWrapper 
            {...(useFormWrapper ? { onSubmit: handleSubmit } : {})}
            className={`category-form category-form-${theme}`}>

            <h4 className="category-form-title">
                New {theme === 'nature' ? 'Adventure Component' : 'Attribute Category'}
            </h4>
            
            <div className="category-form-fields">
                <CreatorField 
                    label="Category Name:" 
                    htmlFor="category-name"
                    required
                >
                    <CreatorInput
                        id="category-name"
                        value={name}
                        onChange={setName}
                        placeholder={placeholders.name}
                        required
                        autoFocus
                    />
                </CreatorField>

                <CreatorField 
                    label="Description (optional):" 
                    htmlFor="category-description"
                >
                    <CreatorTextarea
                        id="category-description"
                        value={description}
                        onChange={setDescription}
                        placeholder={placeholders.description}
                        rows={2}
                    />
                </CreatorField>
            </div>

            <div className="category-form-actions">
                <button
                    type="button"
                    className="creator-btn creator-btn-secondary creator-btn-sm"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    type={useFormWrapper ? "submit" : "button"}
                    className="creator-btn creator-btn-primary creator-btn-sm"
                    onClick={useFormWrapper ? undefined : (e) => {
                        e.preventDefault();
                        if (name.trim()) {
                            onSubmit(name.trim(), description.trim());
                        }
                    }}
                >
                    Create Category
                </button>
            </div>
        </FormWrapper>
    );
} 