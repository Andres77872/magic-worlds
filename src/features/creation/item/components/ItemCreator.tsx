/**
 * Item creator — a guided "Creator Studio" for playable objects: create mode
 * opens on a template gallery (artifact, key, clue, equipment, consumable),
 * then a two-pane editor where guided fields answer the two questions that
 * matter — what can the player do with it, and what changes when they do.
 * The API payload is unchanged.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
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
    QualityHint,
    TriggerHints,
    type StudioNavItem,
    type AttributePreset,
} from '../../common/components'
import { GuidedSection, UseExampleLink, useGuidedCard, type CardTemplate } from '../../common/engine'
import { CreatorIntro, TemplateGallery } from '../../common/templates'
import { ITEM_FIELDS, ITEM_RARITY_OPTIONS, ITEM_SECTIONS, ITEM_TYPE_OPTIONS } from '../fields'
import { ITEM_GALLERY_HEADING, ITEM_GALLERY_SUBHEADING, ITEM_TEMPLATES } from '../templates'
import { ItemPreviewCard } from './ItemPreviewCard'

const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'traits', name: 'Traits', type: 'detail', description: 'Compact facts that make this item easy to use in scenes.' },
]

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
    const { setPage } = useNavigation()
    const { editingItem, setEditingItem, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

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
        fields: ITEM_FIELDS,
        defaults: DEFAULT_CATEGORIES,
        entity: editingItem,
    })

    const nameError = touched && !name.trim() ? 'Name is required.' : undefined
    const descriptionError = touched && !description.trim() ? 'Description is required.' : undefined

    const traitKeys = useMemo(
        () => (guided.attributes['traits'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => ITEM_SECTIONS.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! })),
        [],
    )

    const sectionById = useMemo(() => Object.fromEntries(ITEM_SECTIONS.map((s) => [s.id, s])), [])

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
            throw new Error('Please log in to continue.')
        }
        if (!name.trim() || !description.trim()) {
            setTouched(true)
            throw new Error('Add a name and description before generating media.')
        }
        if (editingItem) {
            await apiService.updateItem(editingItem.id, buildPayload())
            savedIdRef.current = editingItem.id
            return editingItem.id
        }
        const created = await apiService.createItem(buildPayload())
        const saved = toItem(created as ItemCardResponse)
        if (saved.id) setEditingItem(saved)
        savedIdRef.current = saved.id
        return saved.id
    }

    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id && url) {
            void apiService
                .updateItem(id, { ...buildPayload(), image_url: url })
                .catch(() => {
                    /* best-effort — Save re-persists the link */
                })
        }
    }

    const handleThemeSongUrl = (url: string | undefined) => {
        setThemeSongUrl(url)
        const id = savedIdRef.current ?? editingItem?.id
        if (id && url) {
            void apiService
                .updateItem(id, { ...buildPayload(), theme_song_url: url })
                .catch(() => {
                    /* best-effort — Save re-persists the link */
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
                await apiService.updateItem(editingItem.id, payload)
            } else {
                await apiService.createItem(payload)
            }
            setEditingItem(null)
            await loadData()
            setPage('landing')
        } catch (error) {
            console.error(`Failed to ${editingItem ? 'update' : 'create'} item:`, error)
            const transient = error instanceof ApiError && error.isTransient
            setSaveError(
                transient
                    ? 'The service is briefly unavailable — please try again in a moment.'
                    : `Couldn't ${editingItem ? 'update' : 'create'} your item. Please try again.`,
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: ItemCardResponse) => {
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
        setEditingItem(toItem(card))
        savedIdRef.current = card.id || card.uuid || null
        setAssistantApplied(true)
        // AI generation skips the gallery; a picked template's scaffolding survives.
        setTemplate((current) => (current === undefined ? null : current))
        void loadData()
    }

    const handleBack = () => {
        setEditingItem(null)
        setPage('landing')
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
            title={name.trim() || 'Untitled Item'}
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
                <CreatorIntro title="Create Item" icon={<Icon icon={Gem} size={28} />} onBack={handleBack}>
                    <TemplateGallery
                        templates={ITEM_TEMPLATES}
                        fields={ITEM_FIELDS}
                        noun="item"
                        heading={ITEM_GALLERY_HEADING}
                        subheading={ITEM_GALLERY_SUBHEADING}
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
            title={editingItem ? 'Edit Item' : 'Create Item'}
            icon={<Icon icon={Gem} size={28} />}
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </Button>
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
                <StudioSection
                    id={sectionById['identity'].id}
                    icon={sectionById['identity'].icon}
                    title={sectionById['identity'].title}
                    description={sectionById['identity'].description}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CreatorField
                            label="Name"
                            htmlFor="item-name"
                            required
                            error={nameError}
                            tooltip="The name players will say in chat — also the item's strongest trigger."
                        >
                            <CreatorInput
                                id="item-name"
                                value={name}
                                onChange={setName}
                                autoFocus
                                className="font-display text-xl font-medium"
                                placeholder={firstClass.name ?? 'e.g. Moonlit Compass'}
                            />
                        </CreatorField>

                        <CreatorField
                            label="Alias"
                            htmlFor="item-alias"
                            tooltip="What people call it in rumor and song — a second handle for recognition."
                        >
                            <CreatorInput
                                id="item-alias"
                                value={alias ?? ''}
                                onChange={setAlias}
                                placeholder="e.g. The Wayfinder"
                            />
                        </CreatorField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CreatorField
                            label="Type"
                            htmlFor="item-type"
                            tooltip="What kind of object this is — type tells the AI how it's held, used, and lost."
                        >
                            <SuggestInput
                                id="item-type"
                                value={type ?? ''}
                                onChange={setType}
                                options={ITEM_TYPE_OPTIONS}
                                placeholder={firstClass.type ?? 'e.g. Relic, Weapon, Key'}
                            />
                        </CreatorField>

                        <CreatorField
                            label="Rarity"
                            htmlFor="item-rarity"
                            tooltip="How hard it is to find another — rarity sets how much attention it attracts."
                        >
                            <SuggestInput
                                id="item-rarity"
                                value={rarity ?? ''}
                                onChange={setRarity}
                                options={ITEM_RARITY_OPTIONS}
                                placeholder={firstClass.rarity ?? 'e.g. Rare, Cursed, Unique'}
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
                        label="Description"
                        htmlFor="item-description"
                        required
                        error={descriptionError}
                        tooltip="Appearance plus the one sentence that says why it matters — the AI quotes this when it appears."
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
                        label="Effects"
                        values={effects}
                        onChange={setEffects}
                        placeholder={firstClass.effects ?? 'e.g. Points toward whatever the bearer most recently lost'}
                        helper="What it concretely does in play — one effect per entry, in plain language the AI can act on."
                        removeLabel="Remove effect"
                    />
                    {effects.length > 0 &&
                        requirements.length === 0 &&
                        limitations.length === 0 &&
                        !guided.values['use.cost']?.trim() && (
                            <QualityHint>
                                Powerful and free is boring — add a cost or a limit so using it stays a choice.
                            </QualityHint>
                        )}
                </StudioSection>

                <GuidedSection section={sectionById['limits']} guided={guided}>
                    <StringListField
                        label="Requirements"
                        values={requirements}
                        onChange={setRequirements}
                        placeholder={firstClass.requirements ?? 'e.g. The bearer must truly miss what they seek'}
                        helper="What using it demands — ownership, timing, place, or a price of activation."
                        removeLabel="Remove requirement"
                    />
                    <StringListField
                        label="Limitations"
                        values={limitations}
                        onChange={setLimitations}
                        placeholder={firstClass.limitations ?? 'e.g. Cannot find the living; spins uselessly for the lying'}
                        helper="Where it fails — limits keep a powerful item playable instead of a plot solvent."
                        removeLabel="Remove limitation"
                    />
                </GuidedSection>

                <GuidedSection section={sectionById['whereabouts']} guided={guided} />

                <GuidedSection
                    section={sectionById['story']}
                    guided={guided}
                    footer={
                        guided.values['story.truth']?.trim() && !guided.values['story.reveal']?.trim() ? (
                            <QualityHint>
                                A secret with no reveal rule either leaks at random or never surfaces — add a condition.
                            </QualityHint>
                        ) : undefined
                    }
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CreatorField
                            label="Origin"
                            htmlFor="item-origin"
                            tooltip="Who made it and why — origin is where its hooks and enemies come from."
                        >
                            <CreatorInput
                                id="item-origin"
                                value={origin ?? ''}
                                onChange={setOrigin}
                                placeholder={firstClass.origin ?? 'e.g. Built by a lighthouse keeper who lost her daughter to the fog.'}
                            />
                        </CreatorField>

                        <CreatorField
                            label="Value"
                            htmlFor="item-value"
                            tooltip="What it's worth and to whom — value invites theft, trade, and temptation."
                        >
                            <CreatorInput
                                id="item-value"
                                value={value ?? ''}
                                onChange={setValue}
                                placeholder={firstClass.value ?? 'e.g. Priceless to the grieving; ten coins to a scrap dealer.'}
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
                            Quick add traits
                        </span>
                        <SuggestedAttributes
                            presets={TRAIT_PRESETS}
                            existingKeys={traitKeys}
                            onAdd={(preset) => guided.addAttributeWith('traits', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title="Trait groups"
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
                        label="Triggers"
                        helper="Words that summon this card — its name, alias, inscription, and what it does."
                        placeholder="e.g. compass, Wayfinder, the cracked glass"
                    />
                    <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                </StudioSection>

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingItem ? 'Update Item' : 'Create Item'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        </>
    )
}
