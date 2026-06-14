/**
 * Common category form component for adding new attribute categories
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus } from 'lucide-react';
import { Button, SectionHeader } from '@/ui/primitives';
import { CreatorField, CreatorInput, CreatorTextarea } from './CreatorField';

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
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent the event from bubbling up to parent forms
        if (name.trim()) {
            onSubmit(name.trim(), description.trim());
        }
    };

    const placeholders = {
        name: t(`creation.common.categoryForm.placeholders.${theme}.name`),
        description: t(`creation.common.categoryForm.placeholders.${theme}.description`),
    };

    // Use FormWrapper component to conditionally render as form or div
    const FormWrapper = useFormWrapper ? 'form' : 'div';
    
    return (
        <FormWrapper
            {...(useFormWrapper ? { onSubmit: handleSubmit } : {})}
            className="relative mb-6 rounded-md border border-parchment-50/20 bg-ink-600 p-6 max-sm:p-4">

            <SectionHeader
                icon={FolderPlus}
                title={theme === 'nature'
                    ? t('creation.common.categoryForm.adventureComponentTitle')
                    : t('creation.common.categoryForm.attributeCategoryTitle')}
                className="mb-6"
            />

            <div className="flex flex-col gap-6">
                <CreatorField
                    label={t('creation.common.categoryForm.nameLabel')}
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
                    label={t('creation.common.categoryForm.descriptionLabel')}
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

            <div className="mt-6 flex justify-end gap-4 border-t border-parchment-50/10 pt-6 max-sm:flex-col max-sm:gap-2">
                <Button
                    kind="secondary"
                    size="sm"
                    onClick={onCancel}
                    className="max-sm:w-full"
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    kind="primary"
                    size="sm"
                    type={useFormWrapper ? "submit" : "button"}
                    onClick={useFormWrapper ? undefined : (e) => {
                        e.preventDefault();
                        if (name.trim()) {
                            onSubmit(name.trim(), description.trim());
                        }
                    }}
                    className="max-sm:w-full"
                >
                    {t('creation.common.categoryForm.create')}
                </Button>
            </div>
        </FormWrapper>
    );
} 