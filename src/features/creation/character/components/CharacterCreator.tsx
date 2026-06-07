/**
 * Character creator — a two-pane "Creator Studio": titled editor sections on the
 * left with a sticky live card preview on the right. The API payload and edit
 * hydration are unchanged from the original linear form.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useState } from 'react'
import { ScrollText, Sparkles, Swords, Tags, User } from 'lucide-react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button } from '@/ui/primitives'
import {
    CreatorStudio,
    StudioSection,
    StudioSectionNav,
    StudioPreviewDock,
    SuggestedAttributes,
    CreatorField,
    CreatorInput,
    CreatorTextarea,
    AttributeManager,
    AiGeneratePanel,
    TriggersField,
    FormActions,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import { useAttributeCategories, toCategoryPayload } from '../../common/hooks'
import { CharacterPreviewCard } from './CharacterPreviewCard'

// One minimal default category; users add attributes here or create more groups.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'stats', name: 'Stats', type: 'stat', description: 'Core attributes like Strength or Agility — add only what you need.' },
]

// One-click presets for the default "Stats" category.
const STAT_PRESETS: AttributePreset[] = [
    { key: 'Strength' },
    { key: 'Agility' },
    { key: 'Intelligence' },
    { key: 'Charisma' },
    { key: 'Constitution' },
    { key: 'Wisdom' },
]

const FORM_ID = 'character-form'

export function CharacterCreator() {
    const { setPage } = useNavigation()
    const { editingCharacter, setEditingCharacter, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingCharacter?.name ?? '')
    const [race, setRace] = useState(editingCharacter?.race ?? '')
    const [description, setDescription] = useState(editingCharacter?.description ?? '')
    const [triggers, setTriggers] = useState<string[]>(editingCharacter?.triggers ?? [])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [touched, setTouched] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingCharacter })

    const nameError = touched && !name.trim() ? 'Name is required.' : undefined
    const raceError = touched && !race.trim() ? 'Race / species is required.' : undefined

    const statKeys = useMemo(
        () => (attrs.attributes['stats'] || []).map((row) => row.key.toLowerCase()),
        [attrs.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => [
            ...(editingCharacter ? [] : [{ id: 'ai', label: 'AI Draft', icon: Sparkles }]),
            { id: 'identity', label: 'Identity', icon: User },
            { id: 'persona', label: 'Persona', icon: ScrollText },
            { id: 'traits', label: 'Traits', icon: Swords },
            { id: 'triggers', label: 'Triggers', icon: Tags },
        ],
        [editingCharacter],
    )

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setTouched(true)
        if (!name || !race) return

        setIsSubmitting(true)
        setSaveError(null)
        try {
            const payload = {
                name,
                race,
                description,
                triggers,
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
            // Gentle, non-blocking inline message — the form stays put so the
            // user can retry. Transient backend outages get reassuring copy.
            const transient = error instanceof ApiError && error.isTransient
            setSaveError(
                transient
                    ? 'The service is briefly unavailable — please try again in a moment.'
                    : `Couldn't ${editingCharacter ? 'update' : 'create'} your character. Please try again.`
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGenerate = async (prompt: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        await apiService.createCharacterAI(prompt)
        await loadData()
        setPage('landing')
    }

    const handleBack = () => {
        setEditingCharacter(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    return (
        <CreatorStudio
            title={editingCharacter ? 'Edit Character' : 'Create Character'}
            icon="🎭"
            onBack={handleBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : editingCharacter ? 'Update' : 'Create'}
                </Button>
            }
            preview={
                <StudioPreviewDock>
                    <CharacterPreviewCard
                        name={name}
                        race={race}
                        description={description}
                        triggers={triggers}
                        attributes={attrs.attributes}
                        categories={attrs.categories}
                    />
                </StudioPreviewDock>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
                {!editingCharacter && (
                    <div id="ai" className="scroll-mt-20">
                        <AiGeneratePanel
                            noun="character"
                            placeholder="A grizzled dwarven blacksmith who guards an ancient secret…"
                            onGenerate={handleGenerate}
                        />
                    </div>
                )}

                <StudioSection
                    id="identity"
                    icon={User}
                    title="Identity"
                    description="The essentials that name and root your character."
                >
                    <CreatorField label="Name" htmlFor="character-name" required error={nameError}>
                        <CreatorInput
                            id="character-name"
                            value={name}
                            onChange={setName}
                            autoFocus
                            className="text-xl font-medium font-display"
                            placeholder="e.g. Lyra Emberwind"
                        />
                    </CreatorField>

                    <CreatorField label="Race / Species" htmlFor="character-race" required error={raceError}>
                        <CreatorInput
                            id="character-race"
                            value={race}
                            onChange={setRace}
                            className="capitalize"
                            placeholder="e.g. Elf, Human, Construct"
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="persona"
                    icon={ScrollText}
                    title="Persona"
                    description="Appearance, personality, and backstory — this prose guides the AI's voice."
                >
                    <CreatorField label="Description" htmlFor="character-description">
                        <CreatorTextarea
                            id="character-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your character's appearance, personality, and background…"
                            rows={6}
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="traits"
                    icon={Swords}
                    title="Traits & Features"
                    description="Add stats, skills, or any traits — group them however you like."
                >
                    <div className="flex flex-col gap-2.5">
                        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                            Quick add stats
                        </span>
                        <SuggestedAttributes
                            presets={STAT_PRESETS}
                            existingKeys={statKeys}
                            onAdd={(preset) => attrs.addAttributeWith('stats', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title="Attribute groups"
                        icon="⚔️"
                        categories={attrs.categories}
                        attributes={attrs.attributes}
                        onAddCategory={attrs.addCategory}
                        onDeleteCategory={attrs.deleteCategory}
                        onAddAttribute={attrs.addAttribute}
                        onUpdateAttribute={attrs.updateAttribute}
                        onRemoveAttribute={attrs.removeAttribute}
                    />
                </StudioSection>

                <StudioSection
                    id="triggers"
                    icon={Tags}
                    title="Scene Triggers"
                    description="Keywords that pull this character into the scene when mentioned in the adventure chat."
                >
                    <TriggersField values={triggers} onChange={setTriggers} label="Triggers" />
                </StudioSection>

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingCharacter ? 'Update Character' : 'Create Character'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
    )
}
