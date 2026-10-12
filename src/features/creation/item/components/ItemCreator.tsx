/**
 * Item creator — a guided "Creator Studio" for playable objects: create mode
 * opens on a template gallery (artifact, key, clue, equipment, consumable),
 * then a two-pane editor where guided fields answer the two questions that
 * matter — what can the player do with it, and what changes when they do.
 * The API payload is unchanged.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gem } from 'lucide-react'
import type { Item } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { readCardOrganization } from '@/infrastructure/api/workspaceContract'
import type { OrganizationWarning } from '@/shared/types/workspace.types'
import type { ItemCardResponse } from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button, Eyebrow, Icon, SuggestInput } from '@/ui/primitives'
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
    StringListField,
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
    useCardDraft,
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
import { getItemFields, getItemRarityOptions, getItemSections, getItemTypeOptions } from '../fields'
import { ITEM_GALLERY_HEADING_KEY, ITEM_GALLERY_SUBHEADING_KEY, ITEM_TEMPLATES } from '../templates'
import { ItemPreviewCard } from './ItemPreviewCard'

// Bearer/Condition/Secret/Hook from the old presets are guided fields now;
// existing cards' rows still hydrate into Traits unchanged.
const TRAIT_PRESETS: AttributePreset[] = [
    { key: 'Material' },
    { key: 'Charges' },
    { key: 'Weight' },
    { key: 'Inscription' },
]

const FORM_ID = 'item-form'

const DESCRIPTION_GHOST =
    'A brass compass whose needle ignores north and points instead to whatever its bearer has lost. The glass is cracked; the needle never trembles.'

function stringList(value?: string[]): string[] {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []
}

function toItem(card: ItemCardResponse): Item {
    return {
        id: card.id || card.uuid || '',
        name: card.name ?? '',
        alias: card.alias ?? null,
        type: card.type ?? '',
        rarity: card.rarity ?? '',
        description: card.description ?? '',
        effects: stringList(card.effects),
        requirements: stringList(card.requirements),
        limitations: stringList(card.limitations),
        origin: card.origin ?? '',
        value: card.value ?? '',
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
        // Server-owned placement (read-only): keeps edits in the card's own workspace.
        ...(readCardOrganization(card.organization) ? { organization: readCardOrganization(card.organization) } : {}),
    }
}

/** A committed workspace switch starts a fresh form and assistant (document 08: reset local origin forms). */
export function ItemCreator() {
    const { workspaceEpoch } = useWorkspace()
    return <ItemCreatorForm key={workspaceEpoch} />
}

function ItemCreatorForm() {
    const { t } = useTranslation()
    const { goBack, cardEdit, replaceHash } = useNavigation()
    const { editingItem, setEditingItem, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
    // Workspace R1: new cards save to the captured origin; existing ones stay in their own workspace.
    const creator = useCreatorWorkspace(editingItem)
    const routeHasId = cardEdit?.cardType === 'item' && Boolean(cardEdit.cardId)

    // One minimal default category; `id`/`name` are saved-card data; description is display copy.
    const defaultCategories = useMemo<AttributeCategory[]>(
        () => [{ id: 'traits', name: 'Traits', type: 'detail', description: t('creation.item.traitsCategory.description') }],
        [t],
    )

    const itemFields = useMemo(() => getItemFields(t), [t])
    const itemSections = useMemo(() => getItemSections(t), [t])
    const itemTypeOptions = useMemo(() => getItemTypeOptions(t), [t])
    const itemRarityOptions = useMemo(() => getItemRarityOptions(t), [t])

    const [name, setName] = useState(editingItem?.name ?? '')
    const [alias, setAlias] = useState(editingItem?.alias ?? '')
    const [type, setType] = useState(editingItem?.type ?? '')
    const [rarity, setRarity] = useState(editingItem?.rarity ?? '')
    const [description, setDescription] = useState(editingItem?.description ?? '')
    const [effects, setEffects] = useState<string[]>(editingItem?.effects ?? [])
    const [requirements, setRequirements] = useState<string[]>(editingItem?.requirements ?? [])
    const [limitations, setLimitations] = useState<string[]>(editingItem?.limitations ?? [])
    const [origin, setOrigin] = useState(editingItem?.origin ?? '')
    const [value, setValue] = useState(editingItem?.value ?? '')
    const [triggers, setTriggers] = useState<string[]>(editingItem?.triggers ?? [])
    const [imageUrl, setImageUrl] = useState<string | undefined>(editingItem?.image_url)
    const [themeSongUrl, setThemeSongUrl] = useState<string | undefined>(editingItem?.theme_song_url)
    const savedIdRef = useRef<string | null>(editingItem?.id ?? null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [touched, setTouched] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [assistantApplied, setAssistantApplied] = useState(false)
    // Requested initial collections deleted while a generated card was saved (normally empty).
    const [organizationWarnings, setOrganizationWarnings] = useState<OrganizationWarning[]>([])
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingItem ? null : undefined)

    const guided = useGuidedCard({
        fields: itemFields,
        defaults: defaultCategories,
        entity: editingItem,
    })

    // Per-field blur tracking gives early feedback; submit (`touched`) still
    // flags every untouched required field at once.
    const [touchedFields, setTouchedFields] = useState<{ name?: boolean; description?: boolean }>({})
    const markFieldTouched = (field: 'name' | 'description') =>
        setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }))

    const nameError = (touched || touchedFields.name) && !name.trim() ? t('creation.item.validation.nameRequired') : undefined
    const descriptionError = (touched || touchedFields.description) && !description.trim() ? t('creation.item.validation.descriptionRequired') : undefined

    const traitKeys = useMemo(
        () => (guided.attributes['traits'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => itemSections.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! })),
        [itemSections],
    )

    const sectionById = useMemo(() => Object.fromEntries(itemSections.map((s) => [s.id, s])), [itemSections])

    /** Re-seed the form fields from a card body (published, draft, or restored version). */
    const hydrateFromCardBody = (card: ItemCardResponse) => {
        setName(card.name ?? '')
        setAlias(card.alias ?? '')
        setType(card.type ?? '')
        setRarity(card.rarity ?? '')
        setDescription(card.description ?? '')
        setEffects(stringList(card.effects))
        setRequirements(stringList(card.requirements))
        setLimitations(stringList(card.limitations))
        setOrigin(card.origin ?? '')
        setValue(card.value ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        guided.hydrateFrom(card, { preserveActive: true })
        // The hydrated body is the persisted state — re-baseline dirty tracking.
        markClean()
    }

    // Deep-link / refresh: when the URL carries `?card=<id>` but no card is in memory, fetch it and
    // hydrate the form. No-ops on normal navigation (the gallery sets the card before mount).
    const { bootstrapping, version } = useCardEditorRoute('item', {
        onCardLoaded: (raw) => hydrateFromCardBody(raw as ItemCardResponse),
    })

    // Draft/publish lifecycle: edits save to a private draft; Publish makes it live + a version.
    const draft = useCardDraft({
        cardType: 'item',
        cardId: editingItem?.id ?? null,
        version,
        onDraftLoaded: (body) => hydrateFromCardBody(body as unknown as ItemCardResponse),
        workspaceId: creator.cardWorkspaceId,
    })
    const [draftToast, setDraftToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

    const buildPayload = () => ({
        name,
        alias: alias.trim() || null,
        type: type.trim() || null,
        rarity: rarity.trim() || null,
        description,
        effects,
        requirements,
        limitations,
        origin: origin.trim() || null,
        value: value.trim() || null,
        triggers,
        category: guided.toCategoryPayload(),
        image_url: imageUrl ?? null,
        theme_song_url: themeSongUrl,
    })

    // Unsaved-changes protection: dirty when the payload drifted from the last
    // hydrated/saved baseline. Guards in-app navigation and tab close.
    const { dirty, markClean } = useDirtyPayload(JSON.stringify(buildPayload()))
    const guard = useUnsavedChangesGuard({ when: dirty })

    const ensureSaved = async (): Promise<string> => {
        // Archived workspace: read-only until restored.
        if (creator.readOnly) throw new Error(t('workspaceContent.saveErrors.archived'))
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error(t('creation.item.validation.loginToContinue'))
        }
        if (!name.trim() || !description.trim()) {
            setTouched(true)
            throw new Error(t('creation.item.validation.nameAndDescriptionForMedia'))
        }
        if (editingItem) {
            // The card already exists — media generation only needs its id. Authored edits stay
            // in the draft (saved via "Save draft"); we must not publish the body here.
            savedIdRef.current = editingItem.id
            return editingItem.id
        }
        const payload = buildPayload()
        const scope = creator.capture()
        const created = await creator.newCardClient().createItem(payload)
        // Switched workspace meanwhile: the card is saved at its origin, but this form is gone.
        if (!creator.isCurrent(scope)) throw new DOMException('Workspace changed', 'AbortError')
        const saved = toItem(created as ItemCardResponse)
        creator.rememberCreated(saved.organization)
        if (saved.id) {
            setEditingItem(saved)
            // Stamp the new id into the URL so a refresh mid-edit restores this card.
            replaceHash(buildCardEditHash('item', saved.id))
        }
        markClean(JSON.stringify(payload))
        savedIdRef.current = saved.id
        return saved.id
    }

    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id) {
            // Media is a published-body property persisted immediately (not part of the draft).
            void creator.cardClient().setCardMedia('item', id, { image_url: url ?? null }).catch(() => {
                setDraftToast({
                    tone: 'error',
                    message: t(url ? 'creation.common.media.errors.imageSaveFailed' : 'creation.common.media.errors.imageRemoveFailed'),
                })
            })
        }
    }

    const handleThemeSongUrl = (url: string | undefined) => {
        setThemeSongUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id && url) {
            void creator.cardClient().setCardMedia('item', id, { theme_song_url: url ?? null }).catch(() => {
                setDraftToast({ tone: 'error', message: t('creation.common.media.errors.themeSaveFailed') })
            })
        }
    }

    const mediaPanel = (
        <MediaStudioSection
            layout="compact"
            cardType="item"
            noun="item"
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
            themeTargetId={editingItem?.id}
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
        if (!name.trim() || !description.trim()) return

        setIsSubmitting(true)
        setSaveError(null)
        try {
            const payload = buildPayload()
            if (editingItem) {
                // Edit mode: save to the private draft and stay; Publish makes it live + a version.
                const ok = await draft.saveDraft(payload)
                if (ok) markClean(JSON.stringify(payload))
                setDraftToast(
                    ok
                        ? { tone: 'success', message: t('cardVersions.draft.saved') }
                        : { tone: 'error', message: t('cardVersions.errors.draftSave') },
                )
            } else {
                // Create mode: create the live card, then transition into edit mode (drafts onward).
                // Opened from the Library: go back there and highlight the new card.
                const scope = creator.capture()
                const created = await creator.newCardClient().createItem(payload)
                // Switched workspace meanwhile: the card is saved at its origin; ignore the late result.
                if (!creator.isCurrent(scope)) return
                const saved = toItem(created as ItemCardResponse)
                creator.rememberCreated(saved.organization)
                markClean(JSON.stringify(payload))
                let returned = false
                // The payload was just persisted: leave without consulting the (stale-dirty) guard.
                if (saved.id) guard.skip(() => { returned = creator.returnToLibrary({ cardType: 'item', cardId: saved.id }) })
                if (returned) {
                    void loadData({ silent: true })
                    return
                }
                if (saved.id) {
                    setEditingItem(saved)
                    savedIdRef.current = saved.id
                    // Stamp the new id into the URL so a refresh keeps the freshly-created card.
                    replaceHash(buildCardEditHash('item', saved.id))
                }
                await loadData({ silent: true })
            }
        } catch (error) {
            console.error(`Failed to ${editingItem ? 'save draft for' : 'create'} item:`, error)
            const transient = error instanceof ApiError && error.isTransient
            const workspaceError = workspaceSaveErrorKey(error)
            setSaveError(
                workspaceError
                    ? t(workspaceError)
                    : transient
                    ? t('creation.item.save.transient')
                    : editingItem
                      ? t('creation.item.save.updateFailed')
                      : t('creation.item.save.createFailed'),
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: ItemCardResponse, meta?: AssistantTargetMeta) => {
        hydrateFromCardBody(card)
        const applied = toItem(card)
        // A generated/assistant card created here lives at the origin even if the response omits it.
        if (!editingItem) creator.rememberCreated(applied.organization)
        setOrganizationWarnings(meta?.organizationWarnings ?? [])
        setEditingItem(applied)
        const newId = card.id || card.uuid || null
        savedIdRef.current = newId
        if (newId) replaceHash(buildCardEditHash('item', newId))
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
            hydrateFromCardBody(body as unknown as ItemCardResponse)
            if (editingItem?.id) replaceHash(buildCardEditHash('item', editingItem.id))
            setDraftToast({ tone: 'success', message: t('cardVersions.history.restored', { number }) })
        }
    }

    const handleBack = () => {
        guard.confirm(() => {
            setEditingItem(null)
            // Opened from the Library: Back restores its captured folder/search/scroll.
            if (!creator.returnToLibrary(null)) goBack('landing')
        })
    }

    /** Back from the form: to the gallery while creating, to the library otherwise. */
    const handleStudioBack = () => {
        if (!editingItem && template !== undefined) {
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
        setTemplate(picked)
    }

    const firstClass = template?.firstClassExamples ?? {}

    const chatbot = (
        <AssistantChatbot
            adapter={cardAssistantAdapter}
            binding={{
                cardType: 'item',
                targetId: editingItem?.id ?? null,
                title: name.trim() || t('creation.item.untitled'),
                current: buildPayload(),
            }}
            onTarget={applyAssistantCard}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
            workspaceId={creator.cardWorkspaceId}
            readOnly={creator.readOnly}
            initialCollectionIds={editingItem ? [] : creator.initialCollectionIds}
        />
    )

    // Deep-link / refresh: while the card behind `?card=<id>` loads, show a spinner instead of
    // flashing the "create" template gallery (its useState mounted empty before the fetch lands).
    if (bootstrapping || (routeHasId && !editingItem)) {
        return (
            <div className="flex min-h-full flex-1 items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    // The chatbot is rendered as a stable sibling of BOTH screens so the
    // gallery → form transition never remounts an in-flight conversation.
    // The template gallery is the true "create" entry — only when there's no card and no route id.
    if (template === undefined && !editingItem && !routeHasId) {
        return (
            <>
                <CreatorIntro title={t('creation.item.createTitle')} icon={<Icon icon={Gem} size={28} />} onBack={handleBack} destination={<CreationDestination origin={creator.origin} />}>
                    <TemplateGallery
                        templates={ITEM_TEMPLATES}
                        fields={itemFields}
                        noun="item"
                        heading={t(ITEM_GALLERY_HEADING_KEY)}
                        subheading={t(ITEM_GALLERY_SUBHEADING_KEY)}
                        onPick={pickTemplate}
                        onSkip={() => setTemplate(null)}
                    />
                    <ReadOnlyFieldset disabled={creator.readOnly}>
                        <SavedCardGenerator
                            cardType="item"
                            generate={(description, options) => creator.newCardClient().createItemAI(description, options)}
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
            title={editingItem ? t('creation.item.editTitle') : t('creation.item.createTitle')}
            icon={<Icon icon={Gem} size={28} />}
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            destination={editingItem ? undefined : <CreationDestination origin={creator.origin} />}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <>
                    <Button variant="primary" type="submit" form={FORM_ID} disabled={isSubmitting || draft.isHistorical || creator.readOnly}>
                        {isSubmitting
                            ? t('creation.common.formActions.saving')
                            : editingItem
                              ? t('cardVersions.draft.saveButton')
                              : t('creation.item.create')}
                    </Button>
                    <CardDraftControls
                        cardType="item"
                        cardId={editingItem?.id ?? null}
                        cardName={name.trim() || t('creation.item.untitled')}
                        draft={draft}
                        onHydrate={(body) => hydrateFromCardBody(body as unknown as ItemCardResponse)}
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
                            {assistantApplied && <GeneratedDraftNotice noun="item" />}
                            <OrganizationWarningNotice warnings={organizationWarnings} />
                        </>
                    ) : undefined}
                    footer={mediaPanel}
                >
                    <ItemPreviewCard
                        name={name}
                        type={type ?? ''}
                        rarity={rarity ?? ''}
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
                        id={sectionById['identity'].id}
                        icon={sectionById['identity'].icon}
                        title={sectionById['identity'].title}
                        description={sectionById['identity'].description}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CreatorField
                                label={t('creation.item.fieldsForm.nameLabel')}
                                htmlFor="item-name"
                                required
                                error={nameError}
                                tooltip={t('creation.item.fieldsForm.nameTooltip')}
                            >
                                <CreatorInput
                                    id="item-name"
                                    value={name}
                                    onChange={setName}
                                    onBlur={() => markFieldTouched('name')}
                                    autoFocus
                                    className="font-display text-xl font-medium"
                                    placeholder={firstClass.name ?? t('creation.item.fieldsForm.namePlaceholder')}
                                />
                            </CreatorField>

                            <CreatorField
                                label={t('creation.item.fieldsForm.aliasLabel')}
                                htmlFor="item-alias"
                                tooltip={t('creation.item.fieldsForm.aliasTooltip')}
                            >
                                <CreatorInput
                                    id="item-alias"
                                    value={alias ?? ''}
                                    onChange={setAlias}
                                    placeholder={t('creation.item.fieldsForm.aliasPlaceholder')}
                                />
                            </CreatorField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CreatorField
                                label={t('creation.item.fieldsForm.typeLabel')}
                                htmlFor="item-type"
                                tooltip={t('creation.item.fieldsForm.typeTooltip')}
                            >
                                <SuggestInput
                                    id="item-type"
                                    value={type ?? ''}
                                    onChange={setType}
                                    options={itemTypeOptions}
                                    placeholder={firstClass.type ?? t('creation.item.fieldsForm.typePlaceholder')}
                                />
                            </CreatorField>

                            <CreatorField
                                label={t('creation.item.fieldsForm.rarityLabel')}
                                htmlFor="item-rarity"
                                tooltip={t('creation.item.fieldsForm.rarityTooltip')}
                            >
                                <SuggestInput
                                    id="item-rarity"
                                    value={rarity ?? ''}
                                    onChange={setRarity}
                                    options={itemRarityOptions}
                                    placeholder={firstClass.rarity ?? t('creation.item.fieldsForm.rarityPlaceholder')}
                                />
                            </CreatorField>
                        </div>
                    </StudioSection>

                    <StudioSection
                        id={sectionById['overview'].id}
                        icon={sectionById['overview'].icon}
                        title={sectionById['overview'].title}
                        description={sectionById['overview'].description}
                    >
                        <CreatorField
                            label={t('creation.item.fieldsForm.descriptionLabel')}
                            htmlFor="item-description"
                            required
                            error={descriptionError}
                            tooltip={t('creation.item.fieldsForm.descriptionTooltip')}
                        >
                            <CreatorTextarea
                                id="item-description"
                                value={description}
                                onChange={setDescription}
                                onBlur={() => markFieldTouched('description')}
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

                    <StudioSection
                        id={sectionById['effects'].id}
                        icon={sectionById['effects'].icon}
                        title={sectionById['effects'].title}
                        description={sectionById['effects'].description}
                    >
                        <StringListField
                            label={t('creation.item.fieldsForm.effectsLabel')}
                            values={effects}
                            onChange={setEffects}
                            placeholder={firstClass.effects ?? t('creation.item.fieldsForm.effectsPlaceholder')}
                            helper={t('creation.item.fieldsForm.effectsHelper')}
                            removeLabel={t('creation.item.fieldsForm.removeEffect')}
                        />
                        {effects.length > 0 &&
                            requirements.length === 0 &&
                            limitations.length === 0 &&
                            !guided.values['use.cost']?.trim() && (
                                <QualityHint>
                                    {t('creation.item.effectsHint')}
                                </QualityHint>
                            )}
                    </StudioSection>

                    <GuidedSection section={sectionById['limits']} guided={guided}>
                        <StringListField
                            label={t('creation.item.fieldsForm.requirementsLabel')}
                            values={requirements}
                            onChange={setRequirements}
                            placeholder={firstClass.requirements ?? t('creation.item.fieldsForm.requirementsPlaceholder')}
                            helper={t('creation.item.fieldsForm.requirementsHelper')}
                            removeLabel={t('creation.item.fieldsForm.removeRequirement')}
                        />
                        <StringListField
                            label={t('creation.item.fieldsForm.limitationsLabel')}
                            values={limitations}
                            onChange={setLimitations}
                            placeholder={firstClass.limitations ?? t('creation.item.fieldsForm.limitationsPlaceholder')}
                            helper={t('creation.item.fieldsForm.limitationsHelper')}
                            removeLabel={t('creation.item.fieldsForm.removeLimitation')}
                        />
                    </GuidedSection>

                    <GuidedSection section={sectionById['whereabouts']} guided={guided} />

                    <GuidedSection
                        section={sectionById['story']}
                        guided={guided}
                        footer={
                            guided.values['story.truth']?.trim() && !guided.values['story.reveal']?.trim() ? (
                                <QualityHint>
                                    {t('creation.item.secretHint')}
                                </QualityHint>
                            ) : undefined
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CreatorField
                                label={t('creation.item.fieldsForm.originLabel')}
                                htmlFor="item-origin"
                                tooltip={t('creation.item.fieldsForm.originTooltip')}
                            >
                                <CreatorInput
                                    id="item-origin"
                                    value={origin ?? ''}
                                    onChange={setOrigin}
                                    placeholder={firstClass.origin ?? t('creation.item.fieldsForm.originPlaceholder')}
                                />
                            </CreatorField>

                            <CreatorField
                                label={t('creation.item.fieldsForm.valueLabel')}
                                htmlFor="item-value"
                                tooltip={t('creation.item.fieldsForm.valueTooltip')}
                            >
                                <CreatorInput
                                    id="item-value"
                                    value={value ?? ''}
                                    onChange={setValue}
                                    placeholder={firstClass.value ?? t('creation.item.fieldsForm.valuePlaceholder')}
                                />
                            </CreatorField>
                        </div>
                    </GuidedSection>

                    <StudioSection
                        id={sectionById['traits'].id}
                        icon={sectionById['traits'].icon}
                        title={sectionById['traits'].title}
                        description={sectionById['traits'].description}
                    >
                        <div className="flex flex-col gap-2.5">
                            <Eyebrow tone="muted">{t('creation.item.quickAddTraits')}</Eyebrow>
                            <SuggestedAttributes
                                presets={TRAIT_PRESETS}
                                existingKeys={traitKeys}
                                onAdd={(preset) => guided.addAttributeWith('traits', { key: preset.key, value: preset.value ?? '' })}
                            />
                        </div>

                        <AttributeManager
                            title={t('creation.item.traitGroups')}
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
                        id={sectionById['triggers'].id}
                        icon={sectionById['triggers'].icon}
                        title={sectionById['triggers'].title}
                        description={sectionById['triggers'].description}
                    >
                        <TriggersField
                            values={triggers}
                            onChange={setTriggers}
                            label={t('creation.item.fieldsForm.triggersLabel')}
                            helper={t('creation.item.fieldsForm.triggersHelper')}
                            placeholder={t('creation.item.fieldsForm.triggersPlaceholder')}
                        />
                        <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                    </StudioSection>

                </ReadOnlyFieldset>
                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingItem ? t('cardVersions.draft.saveButton') : t('creation.item.actions.createItem')}
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
