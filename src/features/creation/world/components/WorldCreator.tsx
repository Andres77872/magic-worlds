/**
 * World creator — a two-pane "Creator Studio": titled editor sections on the
 * left with a sticky live card preview on the right. The API payload and edit
 * hydration are unchanged from the original linear form.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Globe, Layers, ScrollText, Tags } from 'lucide-react'
import type { World } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type { WorldCardResponse } from '@/shared/types/aiCard.types'
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
    CardAssistantChatbot,
    MediaStudioSection,
    GeneratedDraftNotice,
    TriggersField,
    FormActions,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import { useAttributeCategories, toCategoryPayload } from '../../common/hooks'
import { WorldPreviewCard } from './WorldPreviewCard'

// One minimal default category; users add details here or create more groups.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'details', name: 'Details', type: 'detail', description: 'Key facts about your world — add only what matters.' },
]

// One-click presets for the default "Details" category.
const DETAIL_PRESETS: AttributePreset[] = [
    { key: 'Climate' },
    { key: 'Terrain' },
    { key: 'Government' },
    { key: 'Magic' },
    { key: 'Technology' },
    { key: 'Religion' },
]

const FORM_ID = 'world-form'

/** Map the AI/persisted card response into the local World edit shape. */
function toWorld(card: WorldCardResponse): World {
    return {
        id: card.id || card.uuid || '',
        name: card.name ?? '',
        type: card.type ?? '',
        description: card.description ?? '',
        details: {},
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
}

export function WorldCreator() {
    const { setPage } = useNavigation()
    const { editingWorld, setEditingWorld, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingWorld?.name ?? '')
    const [type, setType] = useState(editingWorld?.type ?? '')
    const [description, setDescription] = useState(editingWorld?.description ?? '')
    const [triggers, setTriggers] = useState<string[]>(editingWorld?.triggers ?? [])
    const [imageUrl, setImageUrl] = useState<string | undefined>(editingWorld?.image_url)
    const [themeSongUrl, setThemeSongUrl] = useState<string | undefined>(editingWorld?.theme_song_url)
    // Card id resolved at save time, so theme persistence never races `editingWorld` state.
    const savedIdRef = useRef<string | null>(editingWorld?.id ?? null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [touched, setTouched] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [assistantApplied, setAssistantApplied] = useState(false)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingWorld })

    const nameError = touched && !name.trim() ? 'Name is required.' : undefined
    const typeError = touched && !type.trim() ? 'Type is required.' : undefined

    const detailKeys = useMemo(
        () => (attrs.attributes['details'] || []).map((row) => row.key.toLowerCase()),
        [attrs.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => [
            { id: 'identity', label: 'Identity', icon: Globe },
            { id: 'overview', label: 'Overview', icon: ScrollText },
            { id: 'details', label: 'Details', icon: Layers },
            { id: 'triggers', label: 'Triggers', icon: Tags },
        ],
        [],
    )

    /** Build the create/update payload from current form state. */
    const buildPayload = () => ({
        name,
        type,
        description,
        triggers,
        category: toCategoryPayload(attrs.categories, attrs.attributes),
        image_url: imageUrl ?? null,
        theme_song_url: themeSongUrl,
    })

    /**
     * Ensure the card exists on the server and return its id — auto-saving first
     * if needed (theme generation needs a real target id).
     */
    const ensureSaved = async (): Promise<string> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Please log in to continue.')
        }
        if (!name.trim() || !type.trim()) {
            setTouched(true)
            throw new Error('Add a name and type before generating a theme.')
        }
        if (editingWorld) {
            await apiService.updateWorld(editingWorld.id, buildPayload())
            savedIdRef.current = editingWorld.id
            return editingWorld.id
        }
        const created = await apiService.createWorld(buildPayload())
        const saved = toWorld(created as WorldCardResponse)
        if (saved.id) setEditingWorld(saved)
        savedIdRef.current = saved.id
        // No loadData() here: a refresh would unmount this creator mid-generation (AppRouter
        // shows a spinner while loading). The new card lands in the gallery on Save.
        return saved.id
    }

    /**
     * Persist a freshly generated/uploaded/gallery-selected image onto the card
     * (mirrors `handleThemeSongUrl`). Without this, the image only lives in form
     * state until Save — navigating away left the card unassigned even though the
     * asset shows in the user gallery. Unsaved new cards persist it on Create via
     * `buildPayload()`; removal stays a Save-time change so Back still backs out.
     */
    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingWorld?.id
        if (id && url) {
            void apiService
                .updateWorld(id, { ...buildPayload(), image_url: url })
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
        const id = savedIdRef.current ?? editingWorld?.id
        if (id && url) {
            // Persist the link only — do NOT loadData() here. A refresh flips isLoading,
            // which makes AppRouter unmount the whole creator (discarding in-progress edits)
            // and re-run the theme effect. The gallery refreshes on Save / next navigation.
            void apiService
                .updateWorld(id, { ...buildPayload(), theme_song_url: url })
                .catch(() => {
                    /* best-effort — the asset still exists; Save re-persists the link */
                })
        }
    }

    // Portrait + theme generators, docked under the live preview card.
    const mediaPanel = (
        <MediaStudioSection
            layout="compact"
            cardType="world"
            noun="world"
            template={{ name, description, subtype: type, category: toCategoryPayload(attrs.categories, attrs.attributes) }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
            onGeneratedThemeSongUrl={setThemeSongUrl}
            ensureSaved={ensureSaved}
            themeTargetId={editingWorld?.id}
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
        if (!name || !type) return

        setIsSubmitting(true)
        setSaveError(null)
        try {
            const payload = buildPayload()
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
            // Gentle, non-blocking inline message — the form stays put so the
            // user can retry. Transient backend outages get reassuring copy.
            const transient = error instanceof ApiError && error.isTransient
            setSaveError(
                transient
                    ? 'The service is briefly unavailable — please try again in a moment.'
                    : `Couldn't ${editingWorld ? 'update' : 'create'} your world. Please try again.`
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: WorldCardResponse) => {
        setName(card.name ?? '')
        setType(card.type ?? '')
        setDescription(card.description ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        attrs.hydrateFrom(card)
        setEditingWorld(toWorld(card))
        savedIdRef.current = card.id || card.uuid || null
        setAssistantApplied(true)
        void loadData()
    }

    const handleBack = () => {
        setEditingWorld(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    return (
        <CreatorStudio
            title={editingWorld ? 'Edit World' : 'Create World'}
            icon="✨"
            onBack={handleBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : editingWorld ? 'Update' : 'Create'}
                </Button>
            }
            preview={
                <StudioPreviewDock
                    notice={assistantApplied ? <GeneratedDraftNotice noun="world" /> : undefined}
                    footer={mediaPanel}
                >
                    <WorldPreviewCard
                        name={name}
                        type={type}
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
                <StudioSection
                    id="identity"
                    icon={Globe}
                    title="Identity"
                    description="The name and genre that frame your world."
                >
                    <CreatorField label="Name" htmlFor="world-name" required error={nameError}>
                        <CreatorInput
                            id="world-name"
                            value={name}
                            onChange={setName}
                            autoFocus
                            className="text-xl font-medium font-display"
                            placeholder="e.g. The Shattered Isles"
                        />
                    </CreatorField>

                    <CreatorField label="Type" htmlFor="world-type" required error={typeError}>
                        <CreatorInput
                            id="world-type"
                            value={type}
                            onChange={setType}
                            placeholder="e.g. Fantasy, Sci-Fi, Modern"
                            className="capitalize"
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="overview"
                    icon={ScrollText}
                    title="Overview"
                    description="Setting, atmosphere, and the key characteristics that make this world feel alive."
                >
                    <CreatorField label="Description" htmlFor="world-description">
                        <CreatorTextarea
                            id="world-description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe your world's setting, atmosphere, and key characteristics…"
                            rows={6}
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="details"
                    icon={Layers}
                    title="World Details"
                    description="Add terrain, climate, factions — group them however you like."
                >
                    <div className="flex flex-col gap-2.5">
                        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                            Quick add details
                        </span>
                        <SuggestedAttributes
                            presets={DETAIL_PRESETS}
                            existingKeys={detailKeys}
                            onAdd={(preset) => attrs.addAttributeWith('details', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title="Detail groups"
                        icon="🌍"
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
                    description="Keywords that pull this world into the scene when mentioned in the adventure chat."
                >
                    <TriggersField values={triggers} onChange={setTriggers} label="Triggers" />
                </StudioSection>

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingWorld ? 'Update World' : 'Create World'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
            <CardAssistantChatbot<WorldCardResponse>
                cardType="world"
                cardId={editingWorld?.id ?? null}
                title={name.trim() || 'Untitled World'}
                currentCard={buildPayload()}
                onCard={applyAssistantCard}
                isAuthenticated={isAuthenticated}
                onAuthRequired={openLoginModal}
            />
        </CreatorStudio>
    )
}
