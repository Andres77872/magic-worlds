/**
 * Adventure creator — minimal core (scenario + cast/world) plus optional,
 * user-extensible components. Persists the template to the API.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useState } from 'react'
import type { Character } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Avatar, Button, Card } from '@/ui/primitives'
import {
    CreatorLayout,
    CreatorField,
    CreatorTextarea,
    AttributeManager,
    FormActions,
} from '../../common/components'
import { useAttributeCategories, toCategoryPayload } from '../../common/hooks'

// One minimal default component; users add more or create their own categories.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'objectives', name: 'Objectives', type: 'detail', description: 'Goals to accomplish in this adventure — optional.' },
]

export function AdventureCreator() {
    const { setPage } = useNavigation()
    const { characters, worlds, isLoading: dataLoading, editingTemplate, setEditingTemplate, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [scenario, setScenario] = useState(editingTemplate?.scenario ?? '')
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
        editingTemplate?.characters?.map((c) => c.id) ?? [],
    )
    const [selectedWorld, setSelectedWorld] = useState<string | undefined>(editingTemplate?.world?.id)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingTemplate })

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        if (!scenario.trim()) return

        setIsSubmitting(true)
        try {
            const selectedWorldObj = selectedWorld ? worlds.find((w) => w.id === selectedWorld) : undefined
            const payload = {
                name: scenario.trim().slice(0, 80) || 'Untitled Adventure',
                description: scenario,
                characters: selectedCharacters
                    .map((id) => characters.find((c) => c.id === id))
                    .filter((c): c is Character => Boolean(c))
                    .map((c) => ({ name: c.name, race: c.race, description: c.description ?? '', category: c.category ?? [] })),
                world: selectedWorldObj
                    ? [{
                          name: selectedWorldObj.name,
                          type: selectedWorldObj.type,
                          description: selectedWorldObj.description ?? '',
                          category: selectedWorldObj.category ?? [],
                      }]
                    : undefined,
                category: toCategoryPayload(attrs.categories, attrs.attributes),
            }

            if (editingTemplate) {
                await apiService.updateAdventureTemplate(editingTemplate.id, payload)
            } else {
                await apiService.createAdventureTemplate(payload)
            }

            setEditingTemplate(null)
            await loadData()
            setPage('landing')
        } catch (error) {
            console.error('Failed to save adventure template:', error)
            alert('Failed to save adventure. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBack = () => {
        setEditingTemplate(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    const handleCharacterChange = (characterId: string, checked: boolean) => {
        setSelectedCharacters((prev) =>
            checked ? [...prev, characterId] : prev.filter((cid) => cid !== characterId),
        )
    }

    return (
        <CreatorLayout
            title={editingTemplate ? 'Edit Adventure' : 'Create Adventure'}
            icon="🗺️"
            onBack={handleBack}
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-8" onKeyDown={handleKeyDown}>
                <div className="flex flex-col gap-6 rounded-md border border-parchment-50/10 bg-ink-800 p-6">
                    <CreatorField label="Scenario:" htmlFor="adventure-scenario" required>
                        <CreatorTextarea
                            id="adventure-scenario"
                            value={scenario}
                            onChange={setScenario}
                            rows={4}
                            required
                            autoFocus
                            placeholder="Set the opening scene — where does the story begin?"
                        />
                    </CreatorField>
                </div>

                <div className="grid grid-cols-2 gap-8 rounded-md border border-parchment-50/10 bg-ink-800 p-6 max-sm:grid-cols-1 max-sm:gap-6">
                    {dataLoading ? (
                        <div className="col-span-full text-parchment-400">Loading characters and worlds…</div>
                    ) : (
                        <>
                            <CreatorField label="Characters:">
                                {characters.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-parchment-50/10 bg-ink-600 p-6 text-center italic text-parchment-400">
                                        No characters available.
                                        <Button kind="ghost" size="sm" onClick={() => setPage('character')}>
                                            Create one
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto rounded-md border border-parchment-50/10 bg-ink-700 p-2 max-sm:max-h-[150px]">
                                        {characters.map((character) => {
                                            const selected = selectedCharacters.includes(character.id)
                                            return (
                                                <Card
                                                    key={character.id}
                                                    interactive
                                                    className={selected ? 'border-ember-500/60' : undefined}
                                                >
                                                    <label className="flex w-full cursor-pointer items-center gap-3 p-2.5">
                                                        <input
                                                            type="checkbox"
                                                            className="h-[18px] w-[18px] cursor-pointer accent-ember-500"
                                                            checked={selected}
                                                            onChange={(e) => handleCharacterChange(character.id, e.target.checked)}
                                                        />
                                                        <Avatar name={character.name} size={32} ring={selected ? 'ember' : 'none'} />
                                                        <span className="font-medium text-parchment-50">{character.name}</span>
                                                    </label>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                )}
                            </CreatorField>

                            <CreatorField label="World (optional):">
                                <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto rounded-md border border-parchment-50/10 bg-ink-700 p-2 max-sm:max-h-[150px]">
                                    <Card interactive className={!selectedWorld ? 'border-ember-500/60' : undefined}>
                                        <label className="flex w-full cursor-pointer items-center gap-3 p-2.5">
                                            <input
                                                type="radio"
                                                name="world"
                                                className="h-[18px] w-[18px] cursor-pointer accent-ember-500"
                                                checked={!selectedWorld}
                                                onChange={() => setSelectedWorld(undefined)}
                                            />
                                            <span className="font-medium text-parchment-50">None</span>
                                        </label>
                                    </Card>

                                    {worlds.length === 0 ? (
                                        <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-parchment-50/10 bg-ink-600 p-6 text-center italic text-parchment-400">
                                            No worlds available.
                                            <Button kind="ghost" size="sm" onClick={() => setPage('world')}>
                                                Create one
                                            </Button>
                                        </div>
                                    ) : (
                                        worlds.map((world) => {
                                            const selected = selectedWorld === world.id
                                            return (
                                                <Card
                                                    key={world.id}
                                                    interactive
                                                    className={selected ? 'border-ember-500/60' : undefined}
                                                >
                                                    <label className="flex w-full cursor-pointer items-center gap-3 p-2.5">
                                                        <input
                                                            type="radio"
                                                            name="world"
                                                            className="h-[18px] w-[18px] cursor-pointer accent-ember-500"
                                                            checked={selected}
                                                            onChange={() => setSelectedWorld(world.id)}
                                                        />
                                                        <Avatar name={world.name} size={32} ring={selected ? 'ember' : 'none'} />
                                                        <span className="font-medium text-parchment-50">{world.name}</span>
                                                    </label>
                                                </Card>
                                            )
                                        })
                                    )}
                                </div>
                            </CreatorField>
                        </>
                    )}
                </div>

                <AttributeManager
                    title="Adventure Components"
                    subtitle="Optional. Add objectives, NPCs, locations — and group them into your own categories."
                    icon="🎯"
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
                    submitLabel={editingTemplate ? 'Update Adventure' : 'Create Adventure'}
                    isSubmitting={isSubmitting}
                />
            </form>
        </CreatorLayout>
    )
}
