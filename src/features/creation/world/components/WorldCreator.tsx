/**
 * World creator — minimal core fields + optional, user-extensible details.
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

// One minimal default category; users add details here or create more groups.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'details', name: 'Details', type: 'detail', description: 'Key facts about your world — add only what matters.' },
]

export function WorldCreator() {
    const { setPage } = useNavigation()
    const { editingWorld, setEditingWorld, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingWorld?.name ?? '')
    const [type, setType] = useState(editingWorld?.type ?? '')
    const [description, setDescription] = useState(editingWorld?.description ?? '')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingWorld })

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        if (!name || !type) return

        setIsSubmitting(true)
        try {
            const payload = {
                name,
                type,
                description,
                category: toCategoryPayload(attrs.categories, attrs.attributes),
            }
            if (editingWorld) {
                await apiService.updateWorld(editingWorld.id, payload)
            } else {
                await apiService.createWorld(payload)
            }
            setEditingWorld(null)
            await loadData()
            setPage('landing')
        } catch (error) {
            console.error(`Failed to ${editingWorld ? 'update' : 'create'} world:`, error)
            alert(`Failed to ${editingWorld ? 'update' : 'create'} world. Please try again.`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBack = () => {
        setEditingWorld(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    return (
        <CreatorLayout
            title={editingWorld ? 'Edit World' : 'Create World'}
            icon="✨"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-8" onKeyDown={handleKeyDown}>
                <div className="flex flex-col gap-6 rounded-md border border-parchment-50/10 bg-ink-800 p-6">
                    <CreatorField label="Name:" htmlFor="world-name" required>
                        <CreatorInput
                            id="world-name"
                            value={name}
                            onChange={setName}
                            required
                            autoFocus
                            className="text-xl font-medium"
                        />
                    </CreatorField>

                    <CreatorField label="Type:" htmlFor="world-type" required>
                        <CreatorInput
                            id="world-type"
                            value={type}
                            onChange={setType}
                            placeholder="e.g., Fantasy, Sci-Fi, Modern"
                            required
                            className="capitalize"
                        />
                    </CreatorField>

                    <CreatorField label="Description:" htmlFor="world-description">
                        <CreatorTextarea
                            id="world-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your world's setting, atmosphere, and key characteristics…"
                            rows={4}
                        />
                    </CreatorField>
                </div>

                <AttributeManager
                    title="World Details"
                    subtitle="Optional. Add terrain, climate, factions — and group them into your own categories."
                    icon="🌍"
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
                    submitLabel={editingWorld ? 'Update World' : 'Create World'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    )
}
