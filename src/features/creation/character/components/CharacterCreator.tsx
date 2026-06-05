/**
 * Character creator — minimal core fields + optional, user-extensible attributes.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useState } from 'react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import {
    CreatorLayout,
    CreatorField,
    CreatorInput,
    CreatorTextarea,
    AttributeManager,
    FormActions,
} from '../../common/components'
import { useAttributeCategories, toCategoryPayload } from '../../common/hooks'

// One minimal default category; users add attributes here or create more groups.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'stats', name: 'Stats', type: 'stat', description: 'Core attributes like Strength or Agility — add only what you need.' },
]

export function CharacterCreator() {
    const { setPage } = useNavigation()
    const { editingCharacter, setEditingCharacter, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingCharacter?.name ?? '')
    const [race, setRace] = useState(editingCharacter?.race ?? '')
    const [description, setDescription] = useState(editingCharacter?.description ?? '')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingCharacter })

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        if (!name || !race) return

        setIsSubmitting(true)
        try {
            const payload = {
                name,
                race,
                description,
                category: toCategoryPayload(attrs.categories, attrs.attributes),
            }
            if (editingCharacter) {
                await apiService.updateCharacter(editingCharacter.id, payload)
            } else {
                await apiService.createCharacter(payload)
            }
            setEditingCharacter(null)
            await loadData()
            setPage('landing')
        } catch (error) {
            console.error(`Failed to ${editingCharacter ? 'update' : 'create'} character:`, error)
            alert(`Failed to ${editingCharacter ? 'update' : 'create'} character. Please try again.`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBack = () => {
        setEditingCharacter(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    return (
        <CreatorLayout
            title={editingCharacter ? 'Edit Character' : 'Create Character'}
            icon="🎭"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-8" onKeyDown={handleKeyDown}>
                <div className="flex flex-col gap-6 rounded-md border border-parchment-50/10 bg-ink-800 p-6">
                    <CreatorField
                        label="Name:"
                        htmlFor="character-name"
                        required
                        tooltip="The name of your character. Used to identify them throughout the game."
                    >
                        <CreatorInput
                            id="character-name"
                            value={name}
                            onChange={setName}
                            required
                            autoFocus
                            className="text-xl font-medium"
                        />
                    </CreatorField>

                    <CreatorField
                        label="Race/Species:"
                        htmlFor="character-race"
                        required
                        tooltip="The race or species of your character, which may influence traits and abilities."
                    >
                        <CreatorInput id="character-race" value={race} onChange={setRace} required className="capitalize" />
                    </CreatorField>

                    <CreatorField
                        label="Description:"
                        htmlFor="character-description"
                        tooltip="Optional. Background, appearance, and personality."
                    >
                        <CreatorTextarea
                            id="character-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your character's appearance, personality, and background…"
                            rows={4}
                        />
                    </CreatorField>
                </div>

                <AttributeManager
                    title="Attributes"
                    subtitle="Optional. Add stats, skills, or any traits — and group them into your own categories."
                    icon="⚔️"
                    categories={attrs.categories}
                    attributes={attrs.attributes}
                    onAddCategory={attrs.addCategory}
                    onDeleteCategory={attrs.deleteCategory}
                    onAddAttribute={attrs.addAttribute}
                    onUpdateAttribute={attrs.updateAttribute}
                    onRemoveAttribute={attrs.removeAttribute}
                />

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingCharacter ? 'Update Character' : 'Create Character'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    )
}
