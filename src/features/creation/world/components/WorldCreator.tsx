/**
 * World creator — a guided "Creator Studio": create mode opens on a template
 * gallery (starting frames + empty card), then a two-pane editor of guided
 * scene-setting fields that serialize into the unchanged API payload.
 *
 * `place_type` is dual-written into the `Setting / Place type` category
 * attribute (the backend World model drops the first-class field, so the
 * mirror is what survives round-trips).
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import type { World } from '@/shared'
import {
    CUSTOM_WORLD_PLACE_TYPE,
    DEFAULT_WORLD_PLACE_TYPE,
    readWorldPlaceType,
    worldPlaceTypeLabel,
    worldPlaceTypeOptionValue,
} from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type { WorldCardResponse } from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button, Select, SuggestInput } from '@/ui/primitives'
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
    QualityHint,
    TriggerHints,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import {
    GuidedSection,
    UseExampleLink,
    readCategoryAttribute,
    useGuidedCard,
    type CardTemplate,
} from '../../common/engine'
import { CreatorIntro, TemplateGallery } from '../../common/templates'
import { GENRE_OPTIONS, PLACE_TYPE_MIRROR, PLACE_TYPE_SELECT_OPTIONS, WORLD_FIELDS, WORLD_SECTIONS } from '../fields'
import {
    WORLD_GALLERY_HEADING,
    WORLD_GALLERY_SUBHEADING,
    WORLD_TEMPLATE_PLACE_TYPE,
    WORLD_TEMPLATES,
} from '../templates'
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
    { key: 'Laws & Taboos' },
    { key: 'Currency' },
]

const FORM_ID = 'world-form'

const DESCRIPTION_GHOST =
    'A drowned kingdom of a hundred islands where the tide decides the map. Ferrymen are the real nobility, and every island keeps a bell to ring when the fog brings more than weather.'

/** Map the AI/persisted card response into the local World edit shape. */
function toWorld(card: WorldCardResponse): World {
    return {
        id: card.id || card.uuid || '',
        name: card.name ?? '',
        place_type: readWorldPlaceType(card),
        type: card.type ?? '',
        description: card.description ?? '',
        details: {},
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
}

/** First-class place_type when present, else the Setting/Place type mirror, else the default. */
function initialPlaceType(world: World | null | undefined): string {
    const direct = world?.place_type
    if (typeof direct === 'string' && direct.trim()) return direct.trim()
    return readCategoryAttribute(world, PLACE_TYPE_MIRROR.group, PLACE_TYPE_MIRROR.key) ?? DEFAULT_WORLD_PLACE_TYPE
}

export function WorldCreator() {
    const { setPage } = useNavigation()
    const { editingWorld, setEditingWorld, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [name, setName] = useState(editingWorld?.name ?? '')
    const [placeType, setPlaceType] = useState(() => initialPlaceType(editingWorld))
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
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingWorld ? null : undefined)

    const guided = useGuidedCard({
        fields: WORLD_FIELDS,
        defaults: DEFAULT_CATEGORIES,
        entity: editingWorld,
        mirrors: [
            {
                ...PLACE_TYPE_MIRROR,
                value: placeType.trim() || DEFAULT_WORLD_PLACE_TYPE,
                onHydrate: (value) => setPlaceType(value),
            },
        ],
    })

    const nameError = touched && !name.trim() ? 'Name is required.' : undefined
    const placeTypeError = touched && !placeType.trim() ? 'Choose a place type or enter a custom one.' : undefined
    const typeError = touched && !type.trim() ? 'Genre / vibe is required.' : undefined
    const selectedPlaceTypeOption = worldPlaceTypeOptionValue(placeType)

    const detailKeys = useMemo(
        () => (guided.attributes['details'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => WORLD_SECTIONS.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! })),
        [],
    )

    const sectionById = useMemo(() => Object.fromEntries(WORLD_SECTIONS.map((s) => [s.id, s])), [])

    /** Build the create/update payload from current form state. */
    const buildPayload = () => ({
        name,
        place_type: placeType.trim() || DEFAULT_WORLD_PLACE_TYPE,
        type,
        description,
        triggers,
        category: guided.toCategoryPayload(),
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
        if (!name.trim() || !type.trim() || !placeType.trim()) {
            setTouched(true)
            throw new Error('Add a name, place type, and genre before generating a theme.')
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
            template={{
                name,
                description,
                subtype: type,
                place_type: placeType.trim() || DEFAULT_WORLD_PLACE_TYPE,
                category: guided.toCategoryPayload(),
            }}
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
        if (!name || !type || !placeType.trim()) return

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
        setPlaceType(readWorldPlaceType(card))
        setType(card.type ?? '')
        setDescription(card.description ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        // The Setting/Place type mirror overrides the default set above when present.
        guided.hydrateFrom(card, { preserveActive: true })
        setEditingWorld(toWorld(card))
        savedIdRef.current = card.id || card.uuid || null
        setAssistantApplied(true)
        // AI generation skips the gallery; a picked template's scaffolding survives.
        setTemplate((current) => (current === undefined ? null : current))
        void loadData()
    }

    const handleBack = () => {
        setEditingWorld(null)
        setPage('landing')
    }

    /** Back from the form: to the gallery while creating, to the library otherwise. */
    const handleStudioBack = () => {
        if (!editingWorld && template !== undefined) {
            setTemplate(undefined)
            return
        }
        handleBack()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleStudioBack()
    }

    const pickTemplate = (picked: CardTemplate | null) => {
        guided.applyTemplate(picked)
        // Frame the template at its natural scale unless the user already chose one.
        const suggested = picked ? WORLD_TEMPLATE_PLACE_TYPE[picked.id] : undefined
        if (suggested && (!placeType.trim() || placeType === DEFAULT_WORLD_PLACE_TYPE)) {
            setPlaceType(suggested)
        }
        setTemplate(picked)
    }

    const firstClass = template?.firstClassExamples ?? {}

    const chatbot = (
        <CardAssistantChatbot<WorldCardResponse>
            cardType="world"
            cardId={editingWorld?.id ?? null}
            title={name.trim() || 'Untitled World'}
            currentCard={buildPayload()}
            onCard={applyAssistantCard}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
        />
    )

    // The chatbot is rendered as a stable sibling of BOTH screens so the
    // gallery → form transition never remounts an in-flight conversation.
    if (template === undefined) {
        return (
            <>
                <CreatorIntro title="Create World" icon="✨" onBack={handleBack}>
                    <TemplateGallery
                        templates={WORLD_TEMPLATES}
                        fields={WORLD_FIELDS}
                        noun="world"
                        heading={WORLD_GALLERY_HEADING}
                        subheading={WORLD_GALLERY_SUBHEADING}
                        onPick={pickTemplate}
                        onSkip={() => setTemplate(null)}
                    />
                </CreatorIntro>
                {chatbot}
            </>
        )
    }

    return (
        <>
        <CreatorStudio
            title={editingWorld ? 'Edit World' : 'Create World'}
            icon="✨"
            onBack={handleStudioBack}
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
                        placeType={worldPlaceTypeLabel(placeType)}
                        type={type}
                        description={description}
                        triggers={triggers}
                        attributes={guided.previewAttributes}
                        categories={guided.previewCategories}
                        imageUrl={imageUrl}
                    />
                </StudioPreviewDock>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
                <StudioSection
                    id="identity"
                    icon={sectionById['identity'].icon}
                    title={sectionById['identity'].title}
                    description={sectionById['identity'].description}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CreatorField
                            label="Name"
                            htmlFor="world-name"
                            required
                            error={nameError}
                            tooltip="The name that anchors the setting in chat — and its strongest trigger."
                        >
                            <CreatorInput
                                id="world-name"
                                value={name}
                                onChange={setName}
                                autoFocus
                                className="text-xl font-medium font-display"
                                placeholder={firstClass.name ?? 'e.g. The Shattered Isles'}
                            />
                        </CreatorField>

                        <CreatorField
                            label="Place type"
                            htmlFor="world-place-type"
                            required
                            error={placeTypeError}
                            tooltip="Sets the camera distance — the AI and image generation frame scenes at this scale."
                        >
                            <Select
                                id="world-place-type"
                                value={selectedPlaceTypeOption}
                                onChange={(next) => {
                                    setPlaceType(next === CUSTOM_WORLD_PLACE_TYPE ? '' : next)
                                }}
                                options={PLACE_TYPE_SELECT_OPTIONS}
                            />
                        </CreatorField>
                    </div>

                    {selectedPlaceTypeOption === CUSTOM_WORLD_PLACE_TYPE && (
                        <CreatorField label="Custom place type" htmlFor="world-place-type-custom" required error={placeTypeError}>
                            <CreatorInput
                                id="world-place-type-custom"
                                value={placeType}
                                onChange={setPlaceType}
                                placeholder="e.g. archipelago, province, moon, star system"
                            />
                        </CreatorField>
                    )}

                    <CreatorField
                        label="Genre / Vibe"
                        htmlFor="world-type"
                        required
                        error={typeError}
                        tooltip="The promise you're making about tone — the AI matches narration and dangers to it."
                    >
                        <SuggestInput
                            id="world-type"
                            value={type}
                            onChange={setType}
                            options={GENRE_OPTIONS}
                            placeholder={firstClass.type ?? 'e.g. Dark Fantasy, Sci-Fi, Cozy'}
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="overview"
                    icon={sectionById['overview'].icon}
                    title={sectionById['overview'].title}
                    description={sectionById['overview'].description}
                >
                    <CreatorField
                        label="Description"
                        htmlFor="world-description"
                        tooltip="Lead with what a visitor sees, hears, and must reckon with — this is the AI's standing picture."
                    >
                        <CreatorTextarea
                            id="world-description"
                            value={description}
                            onChange={setDescription}
                            placeholder={firstClass.description ?? DESCRIPTION_GHOST}
                            rows={6}
                        />
                        <UseExampleLink
                            value={description}
                            hint={firstClass.description ?? DESCRIPTION_GHOST}
                            onUse={setDescription}
                        />
                    </CreatorField>
                </StudioSection>

                <GuidedSection section={sectionById['atmosphere']} guided={guided} />
                <GuidedSection section={sectionById['powers']} guided={guided} />
                <GuidedSection section={sectionById['pressure']} guided={guided} />
                <GuidedSection
                    section={sectionById['secrets']}
                    guided={guided}
                    footer={
                        guided.values['secrets.truth']?.trim() && !guided.values['secrets.reveal']?.trim() ? (
                            <QualityHint>
                                A secret with no reveal rule either leaks at random or never surfaces — add a condition.
                            </QualityHint>
                        ) : undefined
                    }
                />
                <GuidedSection section={sectionById['ground']} guided={guided} />

                <StudioSection
                    id="details"
                    icon={sectionById['details'].icon}
                    title={sectionById['details'].title}
                    description={sectionById['details'].description}
                >
                    <div className="flex flex-col gap-2.5">
                        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                            Quick add details
                        </span>
                        <SuggestedAttributes
                            presets={DETAIL_PRESETS}
                            existingKeys={detailKeys}
                            onAdd={(preset) => guided.addAttributeWith('details', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title="Detail groups"
                        icon="🌍"
                        categories={guided.categories}
                        attributes={guided.attributes}
                        onAddCategory={guided.addCategory}
                        onDeleteCategory={guided.deleteCategory}
                        onAddAttribute={guided.addAttribute}
                        onUpdateAttribute={guided.updateAttribute}
                        onRemoveAttribute={guided.removeAttribute}
                    />
                </StudioSection>

                <StudioSection
                    id="triggers"
                    icon={sectionById['triggers'].icon}
                    title={sectionById['triggers'].title}
                    description={sectionById['triggers'].description}
                >
                    <TriggersField
                        values={triggers}
                        onChange={setTriggers}
                        label="Triggers"
                        helper="When chat mentions these names, factions, or landmarks, this world's lore enters the scene."
                        placeholder="e.g. Shattered Isles, fog bells, Ferrymen"
                    />
                    <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                </StudioSection>

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingWorld ? 'Update World' : 'Create World'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        </>
    )
}
