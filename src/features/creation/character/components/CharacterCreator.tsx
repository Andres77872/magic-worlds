/**
 * Character creator — a guided "Creator Studio": create mode opens on a
 * template gallery (starting shapes + empty card), then a two-pane editor of
 * role-adaptive guided fields that serialize into the unchanged API payload.
 * Edit hydration, media generation, and the card assistant flows are preserved
 * from the original creator.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Bot, Plus, UserCircle } from 'lucide-react'
import type { Character } from '@/shared'
import type { CharacterRole } from '@/shared/types/character.types'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type { CharacterCardResponse } from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Button, Chip, Icon, SuggestInput, SwitchRow } from '@/ui/primitives'
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
import { GuidedSection, UseExampleLink, useGuidedCard, type CardTemplate } from '../../common/engine'
import { CreatorIntro, TemplateGallery } from '../../common/templates'
import { getCharacterFields, getCharacterSections, RACE_OPTIONS } from '../fields'
import { CHARACTER_GALLERY_HEADING, CHARACTER_GALLERY_SUBHEADING, CHARACTER_TEMPLATES } from '../templates'
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

const DESCRIPTION_GHOST: Record<CharacterRole, string> = {
    character:
        'A scarred firesmith with ash-gray braids who talks to her forge like an old friend. Generous with strangers, ruthless with cheats, incapable of leaving a broken thing unmended.',
    persona: 'More or less me: curious, a little guarded, braver in writing than in person.',
}

const GREETING_GHOST =
    '*looks up from the forge, sparks dying* Well met, traveler. Mind the coals — and tell me who sent you.'

const DIRECTION_GHOST: Record<CharacterRole, string> = {
    character:
        "Speak in short, warm sentences. Never reveal the vault's location. Call the player 'stranger' until they earn a name.",
    persona: 'Address me directly. Never summarize my feelings back to me — show me the scene and wait.',
}

/** Map the AI/persisted card response into the local Character edit shape. */
function toCharacter(card: CharacterCardResponse): Character {
    return {
        id: card.id || card.uuid || '',
        name: card.name ?? '',
        role: card.role === 'persona' ? 'persona' : 'character',
        is_default_persona: Boolean(card.is_default_persona),
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
    const [role, setRole] = useState<CharacterRole>(editingCharacter?.role === 'persona' ? 'persona' : 'character')
    const [isDefaultPersona, setIsDefaultPersona] = useState(Boolean(editingCharacter?.is_default_persona))
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
    const [assistantApplied, setAssistantApplied] = useState(false)
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingCharacter ? null : undefined)
    // Personas rarely need a greeting — it starts dormant for them until added.
    const [greetingRevealed, setGreetingRevealed] = useState(false)

    const characterFields = useMemo(() => getCharacterFields(role), [role])
    const sections = useMemo(() => getCharacterSections(role), [role])

    const guided = useGuidedCard({
        fields: characterFields,
        defaults: DEFAULT_CATEGORIES,
        entity: editingCharacter,
        role,
    })

    const nameError = touched && !name.trim() ? 'Name is required.' : undefined
    const raceError = touched && !race.trim() ? 'Race / species is required.' : undefined

    const statKeys = useMemo(
        () => (guided.attributes['stats'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(() => {
        const ordered =
            role === 'persona'
                ? [sections.identity, sections.portrayal, sections.drives, sections.boundaries, sections.ties, sections.voice, sections.traits, sections.triggers]
                : [sections.identity, sections.portrayal, sections.drives, sections.voice, sections.ties, sections.traits, sections.triggers]
        return ordered.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! }))
    }, [role, sections])

    /** Build the create/update payload from current form state. */
    const buildPayload = () => ({
        name,
        role,
        is_default_persona: role === 'persona' && isDefaultPersona,
        race,
        description,
        greeting: greeting.trim() || null,
        system_instructions: systemInstructions.trim() || null,
        triggers,
        category: guided.toCategoryPayload(),
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
            template={{ name, description, subtype: race, category: guided.toCategoryPayload() }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
            onGeneratedThemeSongUrl={setThemeSongUrl}
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

    const applyAssistantCard = (card: CharacterCardResponse) => {
        setName(card.name ?? '')
        setRole(card.role === 'persona' ? 'persona' : 'character')
        setIsDefaultPersona(Boolean(card.is_default_persona))
        setRace(card.race ?? '')
        setDescription(card.description ?? '')
        setGreeting(card.greeting ?? '')
        setSystemInstructions(card.system_instructions ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        guided.hydrateFrom(card, { preserveActive: true })
        setEditingCharacter(toCharacter(card))
        savedIdRef.current = card.id || card.uuid || null
        setAssistantApplied(true)
        // AI generation skips the gallery; a picked template's scaffolding survives.
        setTemplate((current) => (current === undefined ? null : current))
        void loadData()
    }

    const handleBack = () => {
        setEditingCharacter(null)
        setPage('landing')
    }

    /** Back from the form: to the gallery while creating, to the library otherwise. */
    const handleStudioBack = () => {
        if (!editingCharacter && template !== undefined) {
            setTemplate(undefined)
            return
        }
        handleBack()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleStudioBack()
    }

    const setCardRole = (nextRole: CharacterRole) => {
        setRole(nextRole)
        if (nextRole !== 'persona') setIsDefaultPersona(false)
        // Surface the new role's recommended fields without dropping anything.
        guided.activateDefaultsForRole(nextRole)
    }

    const pickTemplate = (picked: CardTemplate | null) => {
        if (picked?.role === 'persona' || picked?.role === 'character') {
            setRole(picked.role)
            if (picked.role !== 'persona') setIsDefaultPersona(false)
        }
        guided.applyTemplate(picked)
        setTemplate(picked)
    }

    const firstClass = template?.firstClassExamples ?? {}
    const isPersona = role === 'persona'
    const greetingVisible = !isPersona || Boolean(greeting.trim()) || greetingRevealed

    const chatbot = (
        <CardAssistantChatbot<CharacterCardResponse>
            cardType="character"
            cardId={editingCharacter?.id ?? null}
            title={name.trim() || 'Untitled Character'}
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
                <CreatorIntro title="Create Character" icon="🎭" onBack={handleBack}>
                    <TemplateGallery
                        templates={CHARACTER_TEMPLATES}
                        fields={characterFields}
                        noun="character"
                        heading={CHARACTER_GALLERY_HEADING}
                        subheading={CHARACTER_GALLERY_SUBHEADING}
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
            title={editingCharacter ? 'Edit Character' : 'Create Character'}
            icon="🎭"
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : editingCharacter ? 'Update' : 'Create'}
                </Button>
            }
            preview={
                <StudioPreviewDock
                    notice={assistantApplied ? <GeneratedDraftNotice noun="character" /> : undefined}
                    footer={mediaPanel}
                >
                    <CharacterPreviewCard
                        name={name}
                        race={race}
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
                    id={sections.identity.id}
                    icon={sections.identity.icon}
                    title={sections.identity.title}
                    description={sections.identity.description}
                >
                    <CreatorField label="Card role">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                aria-pressed={role === 'character'}
                                onClick={() => setCardRole('character')}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                    role === 'character'
                                        ? 'border-arcane-500/70 bg-arcane-500/15'
                                        : 'border-parchment-50/10 bg-ink-700 hover:border-arcane-500/45'
                                }`}
                            >
                                <Bot size={18} className="shrink-0 text-arcane-300" />
                                <span>
                                    <span className="block font-ui text-sm font-semibold text-parchment-50">AI character</span>
                                    <span className="block font-narrative text-xs text-parchment-400">Cast and chat target</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={role === 'persona'}
                                onClick={() => setCardRole('persona')}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                    role === 'persona'
                                        ? 'border-ember-500/70 bg-ember-500/15'
                                        : 'border-parchment-50/10 bg-ink-700 hover:border-ember-500/45'
                                }`}
                            >
                                <UserCircle size={18} className="shrink-0 text-ember-300" />
                                <span>
                                    <span className="block font-ui text-sm font-semibold text-parchment-50">User persona</span>
                                    <span className="block font-narrative text-xs text-parchment-400">Player identity</span>
                                </span>
                            </button>
                        </div>
                    </CreatorField>

                    {isPersona && (
                        <SwitchRow
                            label="Use as default persona"
                            checked={isDefaultPersona}
                            onChange={setIsDefaultPersona}
                        />
                    )}

                    <CreatorField
                        label="Name"
                        htmlFor="character-name"
                        required
                        error={nameError}
                        tooltip="The name the AI and every other card uses to recognize them."
                    >
                        <CreatorInput
                            id="character-name"
                            value={name}
                            onChange={setName}
                            autoFocus
                            className="text-xl font-medium font-display"
                            placeholder={firstClass.name ?? 'e.g. Lyra Emberwind'}
                        />
                    </CreatorField>

                    <CreatorField
                        label="Race / Species"
                        htmlFor="character-race"
                        required
                        error={raceError}
                        tooltip="Shapes how the AI imagines their body, lifespan, and instincts — pick one or invent your own."
                    >
                        <SuggestInput
                            id="character-race"
                            value={race}
                            onChange={setRace}
                            options={RACE_OPTIONS}
                            placeholder={firstClass.race ?? 'e.g. Elf, Human, Construct'}
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id={sections.portrayal.id}
                    icon={sections.portrayal.icon}
                    title={sections.portrayal.title}
                    description={sections.portrayal.description}
                >
                    <CreatorField
                        label="Description"
                        htmlFor="character-description"
                        tooltip="The AI reads this every turn — blend appearance with how they act and what they want, not looks alone."
                    >
                        <CreatorTextarea
                            id="character-description"
                            value={description}
                            onChange={setDescription}
                            placeholder={firstClass.description ?? DESCRIPTION_GHOST[role]}
                            rows={6}
                        />
                        <UseExampleLink
                            value={description}
                            hint={firstClass.description ?? DESCRIPTION_GHOST[role]}
                            onUse={setDescription}
                        />
                        {!isPersona &&
                            description.trim().length >= 200 &&
                            !guided.values['personality.motivation']?.trim() &&
                            !guided.values['personality.fear']?.trim() &&
                            !guided.values['personality.secret']?.trim() && (
                                <QualityHint>
                                    This reads like a portrait. Add a drive in{' '}
                                    <a href="#drives" className="underline underline-offset-2">Heart &amp; Drives</a> so the
                                    AI can act as them — not just describe them.
                                </QualityHint>
                            )}
                    </CreatorField>

                    {greetingVisible ? (
                        <CreatorField
                            label="Greeting"
                            htmlFor="character-greeting"
                            tooltip={
                                isPersona
                                    ? 'Rarely needed for personas — only used if this persona opens a chat.'
                                    : 'Their first line when a one-on-one chat opens — it sets voice, pacing, and how bold replies will be.'
                            }
                        >
                            <CreatorTextarea
                                id="character-greeting"
                                value={greeting}
                                onChange={setGreeting}
                                placeholder={firstClass.greeting ?? GREETING_GHOST}
                                rows={2}
                            />
                            <UseExampleLink value={greeting} hint={firstClass.greeting} onUse={setGreeting} />
                        </CreatorField>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <Chip
                                onClick={() => setGreetingRevealed(true)}
                                icon={<Icon icon={Plus} size={13} />}
                                title="Rarely needed for personas — only used if this persona opens a chat."
                            >
                                Greeting
                            </Chip>
                        </div>
                    )}

                    <CreatorField
                        label={isPersona ? 'How the AI should treat you' : 'Roleplay direction'}
                        htmlFor="character-system-instructions"
                        tooltip={
                            isPersona
                                ? 'Standing instructions for how the story handles your character.'
                                : 'Hard rules the AI must follow when playing them — the strictest lever you have over behavior.'
                        }
                    >
                        <CreatorTextarea
                            id="character-system-instructions"
                            value={systemInstructions}
                            onChange={setSystemInstructions}
                            placeholder={firstClass.system_instructions ?? DIRECTION_GHOST[role]}
                            rows={4}
                        />
                        <UseExampleLink
                            value={systemInstructions}
                            hint={firstClass.system_instructions}
                            onUse={setSystemInstructions}
                        />
                    </CreatorField>
                </StudioSection>

                <GuidedSection section={sections.drives} guided={guided} />
                {isPersona && <GuidedSection section={sections.boundaries} guided={guided} />}
                {isPersona ? (
                    <>
                        <GuidedSection section={sections.ties} guided={guided} />
                        <GuidedSection section={sections.voice} guided={guided} />
                    </>
                ) : (
                    <>
                        <GuidedSection section={sections.voice} guided={guided} />
                        <GuidedSection section={sections.ties} guided={guided} />
                    </>
                )}

                <StudioSection
                    id={sections.traits.id}
                    icon={sections.traits.icon}
                    title={sections.traits.title}
                    description={sections.traits.description}
                >
                    <div className="flex flex-col gap-2.5">
                        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                            Quick add stats
                        </span>
                        <SuggestedAttributes
                            presets={STAT_PRESETS}
                            existingKeys={statKeys}
                            onAdd={(preset) => guided.addAttributeWith('stats', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title="Attribute groups"
                        icon="⚔️"
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
                    id={sections.triggers.id}
                    icon={sections.triggers.icon}
                    title={sections.triggers.title}
                    description={sections.triggers.description}
                >
                    <TriggersField
                        values={triggers}
                        onChange={setTriggers}
                        label="Triggers"
                        helper="When any of these words appear in chat, this card is pulled into the scene — add their name, nicknames, and titles."
                        placeholder="e.g. Lyra, firesmith, the Emberwind"
                    />
                    <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                </StudioSection>

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingCharacter ? 'Update Character' : 'Create Character'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        </>
    )
}
