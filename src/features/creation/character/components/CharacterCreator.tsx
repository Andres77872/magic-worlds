/**
 * Character creator — a two-pane "Creator Studio": titled editor sections on the
 * left with a sticky live card preview on the right. The API payload and edit
 * hydration are unchanged from the original linear form.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { ScrollText, Sparkles, Swords, Tags, User } from 'lucide-react'
import type { Character } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type { CharacterCardResponse } from '@/shared/types/aiCard.types'
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
    MediaStudioSection,
    GeneratedDraftNotice,
    TriggersField,
    FormActions,
    type AiGenerateOptions,
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

/** Map the AI/persisted card response into the local Character edit shape. */
function toCharacter(card: CharacterCardResponse): Character {
    return {
        id: card.id || card.uuid || '',
        name: card.name ?? '',
        race: card.race ?? '',
        description: card.description ?? '',
        greeting: card.greeting,
        system_instructions: card.system_instructions,
        stats: {},
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
}

export function CharacterCreator() {
    const { setPage } = useNavigation()
    const { editingCharacter, setEditingCharacter, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingCharacter?.name ?? '')
    const [race, setRace] = useState(editingCharacter?.race ?? '')
    const [description, setDescription] = useState(editingCharacter?.description ?? '')
    const [greeting, setGreeting] = useState(editingCharacter?.greeting ?? '')
    const [systemInstructions, setSystemInstructions] = useState(editingCharacter?.system_instructions ?? '')
    const [triggers, setTriggers] = useState<string[]>(editingCharacter?.triggers ?? [])
    const [imageUrl, setImageUrl] = useState<string | undefined>(editingCharacter?.image_url)
    const [themeSongUrl, setThemeSongUrl] = useState<string | undefined>(editingCharacter?.theme_song_url)
    // Card id resolved at save time, so theme persistence never races `editingCharacter` state.
    const savedIdRef = useRef<string | null>(editingCharacter?.id ?? null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [touched, setTouched] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    // AI draft lifecycle for the live preview (separate from `isSubmitting` so the
    // page is never dimmed/blocked while generating).
    const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'done'>('idle')

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

    /** Build the create/update payload from current form state. */
    const buildPayload = () => ({
        name,
        race,
        description,
        greeting: greeting.trim() || null,
        system_instructions: systemInstructions.trim() || null,
        triggers,
        category: toCategoryPayload(attrs.categories, attrs.attributes),
        image_url: imageUrl ?? null,
        theme_song_url: themeSongUrl,
    })

    /**
     * Ensure the card exists on the server and return its id — auto-saving first
     * if needed (theme generation needs a real target id). Throws a user-facing
     * message when required fields are missing.
     */
    const ensureSaved = async (): Promise<string> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Please log in to continue.')
        }
        if (!name.trim() || !race.trim()) {
            setTouched(true)
            throw new Error('Add a name and race before generating a theme.')
        }
        if (editingCharacter) {
            await apiService.updateCharacter(editingCharacter.id, buildPayload())
            savedIdRef.current = editingCharacter.id
            return editingCharacter.id
        }
        const created = await apiService.createCharacter(buildPayload())
        const saved = toCharacter(created as CharacterCardResponse)
        if (saved.id) setEditingCharacter(saved)
        savedIdRef.current = saved.id
        // No loadData() here: a refresh would unmount this creator mid-generation (AppRouter
        // shows a spinner while loading). The new card lands in the gallery on Save.
        return saved.id
    }

    /**
     * Persist a freshly generated/uploaded/gallery-selected portrait onto the card
     * (mirrors `handleThemeSongUrl`). Without this, the image only lives in form
     * state until Save — navigating away left the card unassigned even though the
     * asset shows in the user gallery. Unsaved new cards persist it on Create via
     * `buildPayload()`; removal stays a Save-time change so Back still backs out.
     */
    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingCharacter?.id
        if (id && url) {
            void apiService
                .updateCharacter(id, { ...buildPayload(), image_url: url })
                .catch(() => {
                    /* best-effort — the asset still exists; Save re-persists the link */
                })
        }
    }

    /**
     * Persist a freshly generated theme onto the card. Theme generation always runs
     * after `ensureSaved()`, so the id is known — write it immediately (overriding the
     * not-yet-committed `themeSongUrl` state) so the gallery shows it without a re-save.
     */
    const handleThemeSongUrl = (url: string | undefined) => {
        setThemeSongUrl(url)
        const id = savedIdRef.current ?? editingCharacter?.id
        if (id && url) {
            // Persist the link only — do NOT loadData() here. A refresh flips isLoading,
            // which makes AppRouter unmount the whole creator (discarding in-progress edits)
            // and re-run the theme effect. The gallery refreshes on Save / next navigation.
            void apiService
                .updateCharacter(id, { ...buildPayload(), theme_song_url: url })
                .catch(() => {
                    /* best-effort — the asset still exists; Save re-persists the link */
                })
        }
    }

    // Portrait + theme generators, docked under the live preview card.
    const mediaPanel = (
        <MediaStudioSection
            layout="compact"
            cardType="character"
            noun="character"
            template={{ name, description, subtype: race, category: toCategoryPayload(attrs.categories, attrs.attributes) }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
            ensureSaved={ensureSaved}
            themeTargetId={editingCharacter?.id}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
        />
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
            const payload = buildPayload()
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

    // The AI endpoint generates AND persists the card, then returns it. Rather than
    // discard it and navigate away, populate the live form + preview in place and
    // switch to edit mode so the user can review and Save (which UPDATES the same
    // card — no duplicate). The library refresh runs in the background.
    const handleGenerate = async (prompt: string, options: AiGenerateOptions) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setGenStatus('generating')
        try {
            const card = await apiService.createCharacterAI(prompt, options)
            if (options.signal?.aborted) {
                setGenStatus('idle')
                return
            }
            setName(card.name ?? '')
            setRace(card.race ?? '')
            setDescription(card.description ?? '')
            setGreeting(card.greeting ?? '')
            setSystemInstructions(card.system_instructions ?? '')
            setTriggers(card.triggers ?? [])
            setImageUrl(card.image_url)
            setThemeSongUrl(card.theme_song_url)
            attrs.hydrateFrom(card)
            setEditingCharacter(toCharacter(card))
            // The AI endpoint already persisted the card — record its id so a media
            // generation right after the draft persists without racing provider state.
            savedIdRef.current = card.id || card.uuid || null
            setGenStatus('done')
            // Keep the landing list fresh for when the user navigates back. Do not
            // await or navigate — generation must never block the page.
            void loadData()
        } catch (err) {
            setGenStatus('idle')
            throw err // let AiGeneratePanel surface the structured error copy
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
                <StudioPreviewDock
                    busy={genStatus === 'generating'}
                    notice={genStatus === 'done' ? <GeneratedDraftNotice noun="character" /> : undefined}
                    footer={mediaPanel}
                >
                    <CharacterPreviewCard
                        name={name}
                        race={race}
                        description={description}
                        triggers={triggers}
                        attributes={attrs.attributes}
                        categories={attrs.categories}
                        imageUrl={imageUrl}
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

                    <CreatorField
                        label="Greeting"
                        htmlFor="character-greeting"
                        tooltip="The first thing they say when a one-on-one chat opens. Optional."
                    >
                        <CreatorTextarea
                            id="character-greeting"
                            value={greeting}
                            onChange={setGreeting}
                            placeholder="e.g. *looks up from her forge* Well met, traveler. What brings you to my flames?"
                            rows={2}
                        />
                    </CreatorField>

                    <CreatorField
                        label="Roleplay direction"
                        htmlFor="character-system-instructions"
                        tooltip="Behind-the-scenes guidance for how this character speaks and behaves in 1:1 chat. Optional."
                    >
                        <CreatorTextarea
                            id="character-system-instructions"
                            value={systemInstructions}
                            onChange={setSystemInstructions}
                            placeholder="e.g. Speak tersely and warily; never reveal the location of the hidden vault; refer to the player as 'stranger'."
                            rows={4}
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
