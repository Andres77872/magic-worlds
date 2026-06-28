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
import { apiService, ApiError } from '@/infrastructure/api'
import type { ItemCardResponse } from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button, Icon, SuggestInput } from '@/ui/primitives'
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
    StringListField,
    FormActions,
    CardDraftControls,
    HistoricalVersionBanner,
    QualityHint,
    TriggerHints,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import { GuidedSection, UseExampleLink, useCardDraft, useCardEditorRoute, useGuidedCard, type CardTemplate } from '../../common/engine'
import { buildCardEditHash } from '@/features/gallery/galleryLinks'
import { LoadingSpinner } from '@/ui/components'
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
    }
}

export function ItemCreator() {
    const { t } = useTranslation()
    const { goBack, cardEdit, replaceHash } = useNavigation()
    const { editingItem, setEditingItem, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
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
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingItem ? null : undefined)

    const guided = useGuidedCard({
        fields: itemFields,
        defaults: defaultCategories,
        entity: editingItem,
    })

    const nameError = touched && !name.trim() ? t('creation.item.validation.nameRequired') : undefined
    const descriptionError = touched && !description.trim() ? t('creation.item.validation.descriptionRequired') : undefined

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

    const ensureSaved = async (): Promise<string> => {
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
        const created = await apiService.createItem(buildPayload())
        const saved = toItem(created as ItemCardResponse)
        if (saved.id) {
            setEditingItem(saved)
            // Stamp the new id into the URL so a refresh mid-edit restores this card.
            replaceHash(buildCardEditHash('item', saved.id))
        }
        savedIdRef.current = saved.id
        return saved.id
    }

    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id && url) {
            // Media is a published-body property persisted immediately (not part of the draft).
            void apiService.setCardMedia('item', id, { image_url: url }).catch(() => {
                /* best-effort — the asset still exists; it re-persists on the next media action */
            })
        }
    }

    const handleThemeSongUrl = (url: string | undefined) => {
        setThemeSongUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id && url) {
            void apiService.setCardMedia('item', id, { theme_song_url: url }).catch(() => {
                /* best-effort — the asset still exists; it re-persists on the next media action */
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
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
        />
    )

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
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
                setDraftToast(
                    ok
                        ? { tone: 'success', message: t('cardVersions.draft.saved') }
                        : { tone: 'error', message: t('cardVersions.errors.draftSave') },
                )
            } else {
                // Create mode: create the live card, then transition into edit mode (drafts onward).
                const created = await apiService.createItem(payload)
                const saved = toItem(created as ItemCardResponse)
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
            setSaveError(
                transient
                    ? t('creation.item.save.transient')
                    : editingItem
                      ? t('creation.item.save.updateFailed')
                      : t('creation.item.save.createFailed'),
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: ItemCardResponse) => {
        hydrateFromCardBody(card)
        setEditingItem(toItem(card))
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
        setEditingItem(null)
        goBack('landing')
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
        <CardAssistantChatbot<ItemCardResponse>
            cardType="item"
            cardId={editingItem?.id ?? null}
            title={name.trim() || t('creation.item.untitled')}
            currentCard={buildPayload()}
            onCard={applyAssistantCard}
            isAuthenticated={isAuthenticated}
            onAuthRequired={openLoginModal}
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
                <CreatorIntro title={t('creation.item.createTitle')} icon={<Icon icon={Gem} size={28} />} onBack={handleBack}>
                    <TemplateGallery
                        templates={ITEM_TEMPLATES}
                        fields={itemFields}
                        noun="item"
                        heading={t(ITEM_GALLERY_HEADING_KEY)}
                        subheading={t(ITEM_GALLERY_SUBHEADING_KEY)}
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
            title={editingItem ? t('creation.item.editTitle') : t('creation.item.createTitle')}
            icon={<Icon icon={Gem} size={28} />}
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <>
                    <Button variant="primary" type="submit" form={FORM_ID} disabled={isSubmitting || draft.isHistorical}>
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
                    />
                </>
            }
            preview={
                <StudioPreviewDock
                    notice={assistantApplied ? <GeneratedDraftNotice noun="item" /> : undefined}
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
                        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                            {t('creation.item.quickAddTraits')}
                        </span>
                        <SuggestedAttributes
                            presets={TRAIT_PRESETS}
                            existingKeys={traitKeys}
                            onAdd={(preset) => guided.addAttributeWith('traits', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title={t('creation.item.traitGroups')}
                        icon="*"
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

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingItem ? t('cardVersions.draft.saveButton') : t('creation.item.actions.createItem')}
                    isSubmitting={isSubmitting}
                    disabled={draft.isHistorical}
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
        </>
    )
}
