/**
 * World creator — a guided "Creator Studio": create mode opens on a template
 * gallery (starting frames + empty card), then a two-pane editor of guided
 * scene-setting fields that serialize into the unchanged API payload.
 *
 * Place type is stored exactly in the `Setting / Place type` category
 * attribute; it is editor state, not a top-level API field.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Sparkles } from 'lucide-react'
import type { World } from '@/shared'
import {
    CUSTOM_WORLD_PLACE_TYPE,
    DEFAULT_WORLD_PLACE_TYPE,
    readWorldPlaceType,
    worldPlaceTypeLabel,
    worldPlaceTypeOptionValue,
} from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { readCardOrganization } from '@/infrastructure/api/workspaceContract'
import type { OrganizationWarning } from '@/shared/types/workspace.types'
import type { WorldCardResponse } from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button, Eyebrow, Icon, Select, SuggestInput } from '@/ui/primitives'
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
    AssistantChatbot,
    cardAssistantAdapter,
    SavedCardGenerator,
    MediaStudioSection,
    GeneratedDraftNotice,
    TriggersField,
    FormActions,
    CardDraftControls,
    HistoricalVersionBanner,
    QualityHint,
    TriggerHints,
    CreationDestination,
    OrganizationWarningNotice,
    ReadOnlyFieldset,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import type { AssistantTargetMeta } from '../../common/components/assistant/useAssistant'
import {
    GuidedSection,
    UseExampleLink,
    readCategoryAttribute,
    useCardDraft,
    isDraftChanged,
    useCardEditorRoute,
    useCreatorWorkspace,
    workspaceSaveErrorKey,
    useDirtyPayload,
    useGuidedCard,
    type CardTemplate,
} from '../../common/engine'
import { buildCardEditHash } from '@/features/gallery/galleryLinks'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { ConfirmDialog, LoadingSpinner } from '@/ui/components'
import { Toast } from '@/ui/primitives/Toast'
import { CreatorIntro, TemplateGallery } from '../../common/templates'
import {
    PLACE_TYPE_MIRROR,
    getGenreOptions,
    getPlaceTypeSelectOptions,
    getWorldFields,
    getWorldSections,
    placeTypeMirror,
} from '../fields'
import {
    WORLD_GALLERY_HEADING_KEY,
    WORLD_GALLERY_SUBHEADING_KEY,
    WORLD_TEMPLATE_PLACE_TYPE,
    WORLD_TEMPLATES,
} from '../templates'
import { WorldPreviewCard } from './WorldPreviewCard'

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
        type: card.type ?? '',
        description: card.description ?? '',
        details: {},
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
        // Server-owned placement (read-only): keeps edits in the card's own workspace.
        ...(readCardOrganization(card.organization) ? { organization: readCardOrganization(card.organization) } : {}),
    }
}

/** Place scale lives only in the stored Setting / Place type category. */
function initialPlaceType(world: World | null | undefined): string {
    return readCategoryAttribute(world, PLACE_TYPE_MIRROR.group, PLACE_TYPE_MIRROR.key) ?? DEFAULT_WORLD_PLACE_TYPE
}

/** A committed workspace switch starts a fresh form and assistant (document 08: reset local origin forms). */
export function WorldCreator() {
    const { workspaceEpoch } = useWorkspace()
    return <WorldCreatorForm key={workspaceEpoch} />
}

function WorldCreatorForm() {
    const { t } = useTranslation()
    const { goBack, cardEdit, replaceHash } = useNavigation()
    const { editingWorld, setEditingWorld, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
    // Workspace R1: new cards save to the captured origin; existing ones stay in their own workspace.
    const creator = useCreatorWorkspace(editingWorld)
    const routeHasId = cardEdit?.cardType === 'world' && Boolean(cardEdit.cardId)

    // One minimal default category; users add details here or create more groups.
    // `id`/`name` are saved-card data; the description is display copy.
    const defaultCategories = useMemo<AttributeCategory[]>(
        () => [{ id: 'details', name: 'Details', type: 'detail', description: t('creation.world.detailsCategory.description') }],
        [t],
    )

    const worldFields = useMemo(() => getWorldFields(t), [t])
    const worldSections = useMemo(() => getWorldSections(t), [t])
    const genreOptions = useMemo(() => getGenreOptions(t), [t])
    const placeTypeSelectOptions = useMemo(() => getPlaceTypeSelectOptions(t), [t])

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
    // Requested initial collections deleted while a generated card was saved (normally empty).
    const [organizationWarnings, setOrganizationWarnings] = useState<OrganizationWarning[]>([])
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingWorld ? null : undefined)

    const guided = useGuidedCard({
        fields: worldFields,
        defaults: defaultCategories,
        entity: editingWorld,
        mirrors: [
            {
                ...placeTypeMirror(t),
                value: placeType.trim() || DEFAULT_WORLD_PLACE_TYPE,
                onHydrate: (value) => setPlaceType(value),
            },
        ],
    })

    // Per-field blur tracking gives early feedback; submit (`touched`) still
    // flags every untouched required field at once.
    const [touchedFields, setTouchedFields] = useState<{ name?: boolean; placeType?: boolean; type?: boolean }>({})
    const markFieldTouched = (field: 'name' | 'placeType' | 'type') =>
        setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }))

    const nameError = (touched || touchedFields.name) && !name.trim() ? t('creation.world.validation.nameRequired') : undefined
    const placeTypeError = (touched || touchedFields.placeType) && !placeType.trim() ? t('creation.world.validation.placeTypeRequired') : undefined
    const typeError = (touched || touchedFields.type) && !type.trim() ? t('creation.world.validation.genreRequired') : undefined
    const selectedPlaceTypeOption = worldPlaceTypeOptionValue(placeType)

    const detailKeys = useMemo(
        () => (guided.attributes['details'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => worldSections.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! })),
        [worldSections],
    )

    const sectionById = useMemo(() => Object.fromEntries(worldSections.map((s) => [s.id, s])), [worldSections])

    /** Re-seed the form fields from a card body (published, draft, or restored version). */
    const hydrateFromCardBody = (card: WorldCardResponse) => {
        setName(card.name ?? '')
        setPlaceType(readWorldPlaceType(card))
        setType(card.type ?? '')
        setDescription(card.description ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        // The Setting/Place type mirror overrides the place type set above when present.
        guided.hydrateFrom(card, { preserveActive: true })
        // The hydrated body is the persisted state — re-baseline dirty tracking.
        markClean()
    }

    // Deep-link / refresh: when the URL carries `?card=<id>` but no card is in memory, fetch it and
    // hydrate the form. No-ops on normal navigation (the gallery sets the card before mount).
    const { bootstrapping, version } = useCardEditorRoute('world', {
        onCardLoaded: (raw) => hydrateFromCardBody(raw as WorldCardResponse),
    })

    // Draft/publish lifecycle: edits save to a private draft; Publish makes it live + a version.
    const draft = useCardDraft({
        cardType: 'world',
        cardId: editingWorld?.id ?? null,
        version,
        onDraftLoaded: (body) => hydrateFromCardBody(body as unknown as WorldCardResponse),
        workspaceId: creator.cardWorkspaceId,
    })
    const [draftToast, setDraftToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

    /** Build the create/update payload from current form state. */
    const buildPayload = () => ({
        name,
        type,
        description,
        triggers,
        category: guided.toCategoryPayload(),
        image_url: imageUrl ?? null,
        theme_song_url: themeSongUrl,
    })

    // Unsaved-changes protection: dirty when the payload drifted from the last
    // hydrated/saved baseline. Guards in-app navigation and tab close.
    const { dirty, markClean } = useDirtyPayload(JSON.stringify(buildPayload()))
    const guard = useUnsavedChangesGuard({ when: dirty })

    /**
     * Ensure the card exists on the server and return its id — auto-saving first
     * if needed (theme generation needs a real target id).
     */
    const ensureSaved = async (): Promise<string> => {
        // Archived workspace: read-only until restored.
        if (creator.readOnly) throw new Error(t('workspaceContent.saveErrors.archived'))
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error(t('creation.world.validation.loginToContinue'))
        }
        if (!name.trim() || !type.trim() || !placeType.trim()) {
            setTouched(true)
            throw new Error(t('creation.world.validation.fieldsForTheme'))
        }
        if (editingWorld) {
            // The card already exists — media generation only needs its id. Authored edits stay
            // in the draft (saved via "Save draft"); we must not publish the body here.
            savedIdRef.current = editingWorld.id
            return editingWorld.id
        }
        const payload = buildPayload()
        const scope = creator.capture()
        const created = await creator.newCardClient().createWorld(payload)
        // Switched workspace meanwhile: the card is saved at its origin, but this form is gone.
        if (!creator.isCurrent(scope)) throw new DOMException('Workspace changed', 'AbortError')
        const saved = toWorld(created as WorldCardResponse)
        creator.rememberCreated(saved.organization)
        if (saved.id) {
            setEditingWorld(saved)
            // Stamp the new id into the URL so a refresh mid-edit restores this card.
            replaceHash(buildCardEditHash('world', saved.id))
        }
        markClean(JSON.stringify(payload))
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
        if (id) {
            // Media is a published-body property persisted immediately (not part of the draft).
            void creator.cardClient().setCardMedia('world', id, { image_url: url ?? null }).catch(() => {
                setDraftToast({
                    tone: 'error',
                    message: t(url ? 'creation.common.media.errors.imageSaveFailed' : 'creation.common.media.errors.imageRemoveFailed'),
                })
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
            void creator.cardClient().setCardMedia('world', id, { theme_song_url: url ?? null }).catch(() => {
                setDraftToast({ tone: 'error', message: t('creation.common.media.errors.themeSaveFailed') })
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
                category: guided.toCategoryPayload(),
            }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
            onGeneratedThemeSongUrl={setThemeSongUrl}
            ensureSaved={ensureSaved}
            themeTargetId={editingWorld?.id}
            workspaceId={creator.cardWorkspaceId}
            readOnly={creator.readOnly}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
        />
    )

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (creator.readOnly) {
            setSaveError(t('workspaceContent.saveErrors.archived'))
            return
        }
        // Read-only historical view: nothing to save until the version is restored into the draft.
        if (draft.isHistorical) return
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
                // Edit mode: save to the private draft and stay; Publish makes it live + a version.
                let failure: unknown = null
                const ok = await draft.saveDraft(payload, { onError: (cause) => { failure = cause } })
                if (ok) markClean(JSON.stringify(payload))
                // A draft changed elsewhere (a novel staged a fact) opens the draft controls' conflict dialog instead.
                if (ok || !isDraftChanged(failure)) setDraftToast(
                    ok
                        ? { tone: 'success', message: t('cardVersions.draft.saved') }
                        : { tone: 'error', message: t('cardVersions.errors.draftSave') },
                )
            } else {
                // Create mode: create the live card, then transition into edit mode (drafts onward).
                // Opened from the Library: go back there and highlight the new card.
                const scope = creator.capture()
                const created = await creator.newCardClient().createWorld(payload)
                // Switched workspace meanwhile: the card is saved at its origin; ignore the late result.
                if (!creator.isCurrent(scope)) return
                const saved = toWorld(created as WorldCardResponse)
                creator.rememberCreated(saved.organization)
                markClean(JSON.stringify(payload))
                let returned = false
                // The payload was just persisted: leave without consulting the (stale-dirty) guard.
                if (saved.id) guard.skip(() => { returned = creator.returnToLibrary({ cardType: 'world', cardId: saved.id }) })
                if (returned) {
                    void loadData({ silent: true })
                    return
                }
                if (saved.id) {
                    setEditingWorld(saved)
                    savedIdRef.current = saved.id
                    // Stamp the new id into the URL so a refresh keeps the freshly-created card.
                    replaceHash(buildCardEditHash('world', saved.id))
                }
                await loadData({ silent: true })
            }
        } catch (error) {
            console.error(`Failed to ${editingWorld ? 'save draft for' : 'create'} world:`, error)
            // Gentle, non-blocking inline message — the form stays put so the
            // user can retry. Transient backend outages get reassuring copy.
            const transient = error instanceof ApiError && error.isTransient
            const workspaceError = workspaceSaveErrorKey(error)
            setSaveError(
                workspaceError
                    ? t(workspaceError)
                    : transient
                    ? t('creation.world.save.transient')
                    : editingWorld
                      ? t('creation.world.save.updateFailed')
                      : t('creation.world.save.createFailed')
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: WorldCardResponse, meta?: AssistantTargetMeta) => {
        hydrateFromCardBody(card)
        const applied = toWorld(card)
        // A generated/assistant card created here lives at the origin even if the response omits it.
        if (!editingWorld) creator.rememberCreated(applied.organization)
        setOrganizationWarnings(meta?.organizationWarnings ?? [])
        setEditingWorld(applied)
        const newId = card.id || card.uuid || null
        savedIdRef.current = newId
        if (newId) replaceHash(buildCardEditHash('world', newId))
        setAssistantApplied(true)
        // AI generation skips the gallery; a picked template's scaffolding survives.
        setTemplate((current) => (current === undefined ? null : current))
        void loadData({ silent: true })
    }

    /** Leave the read-only historical view by staging that version into the draft for editing. */
    const handleRestoreHistorical = async () => {
        if (creator.readOnly) return
        const number = draft.viewingVersionNumber
        if (number == null) return
        const body = await draft.restoreIntoDraft(number)
        if (body) {
            hydrateFromCardBody(body as unknown as WorldCardResponse)
            if (editingWorld?.id) replaceHash(buildCardEditHash('world', editingWorld.id))
            setDraftToast({ tone: 'success', message: t('cardVersions.history.restored', { number }) })
        }
    }

    const handleBack = () => {
        guard.confirm(() => {
            setEditingWorld(null)
            // Opened from the Library: Back restores its captured folder/search/scroll.
            if (!creator.returnToLibrary(null)) goBack('landing')
        })
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
        <AssistantChatbot
            adapter={cardAssistantAdapter}
            binding={{
                cardType: 'world',
                targetId: editingWorld?.id ?? null,
                title: name.trim() || t('creation.world.untitled'),
                current: buildPayload(),
            }}
            onTarget={applyAssistantCard}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
            workspaceId={creator.cardWorkspaceId}
            readOnly={creator.readOnly}
            initialCollectionIds={editingWorld ? [] : creator.initialCollectionIds}
        />
    )

    // Deep-link / refresh: while the card behind `?card=<id>` loads, show a spinner instead of
    // flashing the "create" template gallery (its useState mounted empty before the fetch lands).
    if (bootstrapping || (routeHasId && !editingWorld)) {
        return (
            <div className="flex min-h-full flex-1 items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    // The chatbot is rendered as a stable sibling of BOTH screens so the
    // gallery → form transition never remounts an in-flight conversation.
    // The template gallery is the true "create" entry — only when there's no card and no route id.
    if (template === undefined && !editingWorld && !routeHasId) {
        return (
            <>
                <CreatorIntro title={t('creation.world.createTitle')} icon={<Icon icon={Sparkles} size={28} />} onBack={handleBack} destination={<CreationDestination origin={creator.origin} />}>
                    <TemplateGallery
                        templates={WORLD_TEMPLATES}
                        fields={worldFields}
                        noun="world"
                        heading={t(WORLD_GALLERY_HEADING_KEY)}
                        subheading={t(WORLD_GALLERY_SUBHEADING_KEY)}
                        onPick={pickTemplate}
                        onSkip={() => setTemplate(null)}
                    />
                    <ReadOnlyFieldset disabled={creator.readOnly}>
                        <SavedCardGenerator
                            cardType="world"
                            generate={(description, options) => creator.newCardClient().createWorldAI(description, options)}
                            onSaved={(card) => applyAssistantCard(card, { organizationWarnings: card.organization_warnings ?? [] })}
                            isAuthenticated={isAuthenticated}
                            onAuthRequired={openLoginModal}
                        />
                    </ReadOnlyFieldset>
                </CreatorIntro>
                {chatbot}
                <ConfirmDialog
                    {...guard.dialogProps}
                    variant="danger"
                    title={t('common.unsavedChanges.title')}
                    message={t('common.unsavedChanges.body')}
                    confirmLabel={t('common.unsavedChanges.leave')}
                    cancelLabel={t('common.unsavedChanges.stay')}
                />
            </>
        )
    }

    return (
        <>
        <CreatorStudio
            title={editingWorld ? t('creation.world.editTitle') : t('creation.world.createTitle')}
            icon={<Icon icon={Sparkles} size={28} />}
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            destination={editingWorld ? undefined : <CreationDestination origin={creator.origin} />}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <>
                    <Button variant="primary" type="submit" form={FORM_ID} disabled={isSubmitting || draft.isHistorical || creator.readOnly}>
                        {isSubmitting
                            ? t('common.saving')
                            : editingWorld
                              ? t('cardVersions.draft.saveButton')
                              : t('creation.world.create')}
                    </Button>
                    <CardDraftControls
                        cardType="world"
                        cardId={editingWorld?.id ?? null}
                        cardName={name.trim() || t('creation.world.untitled')}
                        draft={draft}
                        onHydrate={(body) => hydrateFromCardBody(body as unknown as WorldCardResponse)}
                        onDraftSaved={(body) => markClean(JSON.stringify(body))}
                        onPublished={() => {
                            void loadData({ silent: true })
                        }}
                        disabled={isSubmitting}
                        workspaceId={creator.cardWorkspaceId}
                        readOnly={creator.readOnly}
                    />
                </>
            }
            preview={
                <StudioPreviewDock
                    notice={assistantApplied || organizationWarnings.length > 0 ? (
                        <>
                            {assistantApplied && <GeneratedDraftNotice noun="world" />}
                            <OrganizationWarningNotice warnings={organizationWarnings} />
                        </>
                    ) : undefined}
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
                {/* Archived workspace: every field and in-form action is read-only. */}
                <ReadOnlyFieldset disabled={creator.readOnly} className="flex flex-col gap-6">
                    {draft.isHistorical && draft.viewingVersionNumber != null && (
                        <HistoricalVersionBanner
                            versionNumber={draft.viewingVersionNumber}
                            onRestore={() => void handleRestoreHistorical()}
                            busy={draft.busy}
                        />
                    )}
                    <StudioSection
                        id="identity"
                        icon={sectionById['identity'].icon}
                        title={sectionById['identity'].title}
                        description={sectionById['identity'].description}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CreatorField
                                label={t('creation.world.fieldsForm.nameLabel')}
                                htmlFor="world-name"
                                required
                                error={nameError}
                                tooltip={t('creation.world.fieldsForm.nameTooltip')}
                            >
                                <CreatorInput
                                    id="world-name"
                                    value={name}
                                    onChange={setName}
                                    onBlur={() => markFieldTouched('name')}
                                    autoFocus
                                    className="text-xl font-medium font-display"
                                    placeholder={firstClass.name ?? t('creation.world.fieldsForm.namePlaceholder')}
                                />
                            </CreatorField>

                            <CreatorField
                                label={t('creation.world.fieldsForm.placeTypeLabel')}
                                htmlFor="world-place-type"
                                required
                                error={placeTypeError}
                                tooltip={t('creation.world.fieldsForm.placeTypeTooltip')}
                            >
                                <Select
                                    id="world-place-type"
                                    value={selectedPlaceTypeOption}
                                    onChange={(next) => {
                                        setPlaceType(next === CUSTOM_WORLD_PLACE_TYPE ? '' : next)
                                    }}
                                    options={placeTypeSelectOptions}
                                />
                            </CreatorField>
                        </div>

                        {selectedPlaceTypeOption === CUSTOM_WORLD_PLACE_TYPE && (
                            <CreatorField label={t('creation.world.fieldsForm.customPlaceTypeLabel')} htmlFor="world-place-type-custom" required error={placeTypeError}>
                                <CreatorInput
                                    id="world-place-type-custom"
                                    value={placeType}
                                    onChange={setPlaceType}
                                    onBlur={() => markFieldTouched('placeType')}
                                    placeholder={t('creation.world.fieldsForm.customPlaceTypePlaceholder')}
                                />
                            </CreatorField>
                        )}

                        <CreatorField
                            label={t('creation.world.fieldsForm.genreLabel')}
                            htmlFor="world-type"
                            required
                            error={typeError}
                            tooltip={t('creation.world.fieldsForm.genreTooltip')}
                        >
                            <SuggestInput
                                id="world-type"
                                value={type}
                                onChange={setType}
                                onBlur={() => markFieldTouched('type')}
                                options={genreOptions}
                                placeholder={firstClass.type ?? t('creation.world.fieldsForm.genrePlaceholder')}
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
                            label={t('creation.world.fieldsForm.descriptionLabel')}
                            htmlFor="world-description"
                            tooltip={t('creation.world.fieldsForm.descriptionTooltip')}
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
                                    {t('creation.world.secretHint')}
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
                            <Eyebrow tone="muted">{t('creation.world.quickAddDetails')}</Eyebrow>
                            <SuggestedAttributes
                                presets={DETAIL_PRESETS}
                                existingKeys={detailKeys}
                                onAdd={(preset) => guided.addAttributeWith('details', { key: preset.key, value: preset.value ?? '' })}
                            />
                        </div>

                        <AttributeManager
                            title={t('creation.world.detailGroups')}
                            icon={Globe}
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
                            label={t('creation.world.fieldsForm.triggersLabel')}
                            helper={t('creation.world.fieldsForm.triggersHelper')}
                            placeholder={t('creation.world.fieldsForm.triggersPlaceholder')}
                        />
                        <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                    </StudioSection>

                </ReadOnlyFieldset>
                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingWorld ? t('cardVersions.draft.saveButton') : t('creation.world.actions.createWorld')}
                    isSubmitting={isSubmitting}
                    disabled={draft.isHistorical || creator.readOnly}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        <Toast
            open={draftToast !== null}
            tone={draftToast?.tone ?? 'success'}
            title={draftToast?.message ?? ''}
            onClose={() => setDraftToast(null)}
            autoCloseMs={3000}
        />
        <ConfirmDialog
            {...guard.dialogProps}
            variant="danger"
            title={t('common.unsavedChanges.title')}
            message={t('common.unsavedChanges.body')}
            confirmLabel={t('common.unsavedChanges.leave')}
            cancelLabel={t('common.unsavedChanges.stay')}
        />
        </>
    )
}
