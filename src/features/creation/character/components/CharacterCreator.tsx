/**
 * Character creator — a guided "Creator Studio": create mode opens on a
 * template gallery (starting shapes + empty card), then a two-pane editor of
 * role-adaptive guided fields that serialize into the unchanged API payload.
 * Edit hydration, media generation, and the card assistant flows are preserved
 * from the original creator.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AudioLines, Bot, Drama, Plus, UserCircle } from 'lucide-react'
import type { Character, CharacterVoice } from '@/shared'
import type { CharacterRole } from '@/shared/types/character.types'
import { VoicePickerDialog } from '@/features/voices'
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
import { getCharacterFields, getCharacterSections, getRaceOptions } from '../fields'
import { CHARACTER_TEMPLATES } from '../templates'
import { CharacterPreviewCard } from './CharacterPreviewCard'

const FORM_ID = 'character-form'

// Ghost example text seeds the user's own content (description/greeting/direction)
// and is model-facing flavor — left untranslated by design.
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

// Stat preset keys are saved-card data (round-trip with the attribute payload), not UI copy.
const STAT_PRESETS: AttributePreset[] = [
    { key: 'Strength' },
    { key: 'Agility' },
    { key: 'Intelligence' },
    { key: 'Charisma' },
    { key: 'Constitution' },
    { key: 'Wisdom' },
]

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
    const { t } = useTranslation()
    const { goBack } = useNavigation()
    const { editingCharacter, setEditingCharacter, loadData } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    // One minimal default category; users add attributes here or create more groups.
    // `id`/`name` are saved-card data; the description is display copy.
    const defaultCategories = useMemo<AttributeCategory[]>(
        () => [{ id: 'stats', name: 'Stats', type: 'stat', description: t('creation.character.statsCategory.description') }],
        [t],
    )

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
    const [voice, setVoice] = useState<CharacterVoice | null>(editingCharacter?.voice ?? null)
    const [voicePickerOpen, setVoicePickerOpen] = useState(false)
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

    const characterFields = useMemo(() => getCharacterFields(role, t), [role, t])
    const sections = useMemo(() => getCharacterSections(role, t), [role, t])
    const raceOptions = useMemo(() => getRaceOptions(t), [t])

    const guided = useGuidedCard({
        fields: characterFields,
        defaults: defaultCategories,
        entity: editingCharacter,
        role,
    })

    const nameError = touched && !name.trim() ? t('creation.character.validation.nameRequired') : undefined
    const raceError = touched && !race.trim() ? t('creation.character.validation.raceRequired') : undefined

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
        voice: voice ?? null,
    })

    /**
     * Ensure the card exists on the server and return its id — auto-saving first
     * if needed (theme generation needs a real target id). Throws a user-facing
     * message when required fields are missing.
     */
    const ensureSaved = async (): Promise<string> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error(t('creation.character.validation.loginToContinue'))
        }
        if (!name.trim() || !race.trim()) {
            setTouched(true)
            throw new Error(t('creation.character.validation.nameAndRaceForTheme'))
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
            goBack('landing')
        } catch (error) {
            console.error(`Failed to ${editingCharacter ? 'update' : 'create'} character:`, error)
            // Gentle, non-blocking inline message — the form stays put so the
            // user can retry. Transient backend outages get reassuring copy.
            const transient = error instanceof ApiError && error.isTransient
            setSaveError(
                transient
                    ? t('creation.character.save.transient')
                    : editingCharacter
                      ? t('creation.character.save.updateFailed')
                      : t('creation.character.save.createFailed')
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
        void loadData({ silent: true })
    }

    const handleBack = () => {
        setEditingCharacter(null)
        goBack('landing')
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
            title={name.trim() || t('creation.character.untitled')}
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
                <CreatorIntro title={t('creation.character.createTitle')} icon={<Icon icon={Drama} size={28} />} onBack={handleBack}>
                    <TemplateGallery
                        templates={CHARACTER_TEMPLATES}
                        fields={characterFields}
                        noun="character"
                        heading={t('creation.character.galleryHeading')}
                        subheading={t('creation.character.gallerySubheading')}
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
            title={editingCharacter ? t('creation.character.editTitle') : t('creation.character.createTitle')}
            icon={<Icon icon={Drama} size={28} />}
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button variant="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? t('common.saving') : editingCharacter ? t('creation.common.studio.update') : t('creation.character.create')}
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
                    <CreatorField label={t('creation.character.role.label')}>
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
                                    <span className="block font-ui text-sm font-semibold text-parchment-50">{t('creation.character.role.characterTitle')}</span>
                                    <span className="block font-narrative text-xs text-parchment-400">{t('creation.character.role.characterSubtitle')}</span>
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
                                    <span className="block font-ui text-sm font-semibold text-parchment-50">{t('creation.character.role.personaTitle')}</span>
                                    <span className="block font-narrative text-xs text-parchment-400">{t('creation.character.role.personaSubtitle')}</span>
                                </span>
                            </button>
                        </div>
                    </CreatorField>

                    {isPersona && (
                        <SwitchRow
                            label={t('creation.character.role.useAsDefaultPersona')}
                            checked={isDefaultPersona}
                            onChange={setIsDefaultPersona}
                        />
                    )}

                    <CreatorField
                        label={t('creation.character.fieldsForm.nameLabel')}
                        htmlFor="character-name"
                        required
                        error={nameError}
                        tooltip={t('creation.character.fieldsForm.nameTooltip')}
                    >
                        <CreatorInput
                            id="character-name"
                            value={name}
                            onChange={setName}
                            autoFocus
                            className="text-xl font-medium font-display"
                            placeholder={firstClass.name ?? t('creation.character.fieldsForm.namePlaceholder')}
                        />
                    </CreatorField>

                    <CreatorField
                        label={t('creation.character.fieldsForm.raceLabel')}
                        htmlFor="character-race"
                        required
                        error={raceError}
                        tooltip={t('creation.character.fieldsForm.raceTooltip')}
                    >
                        <SuggestInput
                            id="character-race"
                            value={race}
                            onChange={setRace}
                            options={raceOptions}
                            placeholder={firstClass.race ?? t('creation.character.fieldsForm.racePlaceholder')}
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
                        label={t('creation.character.fieldsForm.descriptionLabel')}
                        htmlFor="character-description"
                        tooltip={t('creation.character.fieldsForm.descriptionTooltip')}
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
                                    <Trans
                                        i18nKey="creation.character.qualityHint.portrait"
                                        components={[<a href="#drives" className="underline underline-offset-2" />]}
                                    />
                                </QualityHint>
                            )}
                    </CreatorField>

                    {greetingVisible ? (
                        <CreatorField
                            label={t('creation.character.fieldsForm.greetingLabel')}
                            htmlFor="character-greeting"
                            tooltip={
                                isPersona
                                    ? t('creation.character.fieldsForm.greetingTooltipPersona')
                                    : t('creation.character.fieldsForm.greetingTooltip')
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
                                title={t('creation.character.fieldsForm.greetingTooltipPersona')}
                            >
                                {t('creation.character.fieldsForm.greetingLabel')}
                            </Chip>
                        </div>
                    )}

                    <CreatorField
                        label={isPersona ? t('creation.character.fieldsForm.directionLabelPersona') : t('creation.character.fieldsForm.directionLabel')}
                        htmlFor="character-system-instructions"
                        tooltip={
                            isPersona
                                ? t('creation.character.fieldsForm.directionTooltipPersona')
                                : t('creation.character.fieldsForm.directionTooltip')
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

                    <CreatorField
                        label={t('creation.character.fieldsForm.voiceLabel')}
                        htmlFor="character-voice"
                        tooltip={t('creation.character.fieldsForm.voiceTooltip')}
                    >
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3">
                            <div className="min-w-0">
                                {voice?.voice_id ? (
                                    <>
                                        <p className="font-ui text-sm font-semibold text-parchment-50">{voice.preset_name || voice.voice_id}</p>
                                        <code className="font-mono text-xs text-parchment-400">{voice.voice_id}</code>
                                    </>
                                ) : (
                                    <p className="font-ui text-sm text-parchment-300">{t('creation.character.fieldsForm.voiceDefault')}</p>
                                )}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                iconLeft={<Icon icon={AudioLines} size={14} />}
                                onClick={() => setVoicePickerOpen(true)}
                            >
                                {voice?.voice_id ? t('creation.character.fieldsForm.voiceChange') : t('creation.character.fieldsForm.voiceChoose')}
                            </Button>
                        </div>
                    </CreatorField>
                </StudioSection>

                <VoicePickerDialog
                    open={voicePickerOpen}
                    currentVoice={voice}
                    onSelect={setVoice}
                    onClose={() => setVoicePickerOpen(false)}
                />

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
                            {t('creation.character.quickAddStats')}
                        </span>
                        <SuggestedAttributes
                            presets={STAT_PRESETS}
                            existingKeys={statKeys}
                            onAdd={(preset) => guided.addAttributeWith('stats', { key: preset.key, value: preset.value ?? '' })}
                        />
                    </div>

                    <AttributeManager
                        title={t('creation.character.attributeGroups')}
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
                    id={sections.triggers.id}
                    icon={sections.triggers.icon}
                    title={sections.triggers.title}
                    description={sections.triggers.description}
                >
                    <TriggersField
                        values={triggers}
                        onChange={setTriggers}
                        label={t('creation.character.fieldsForm.triggersLabel')}
                        helper={t('creation.character.fieldsForm.triggersHelper')}
                        placeholder={t('creation.character.fieldsForm.triggersPlaceholder')}
                    />
                    <TriggerHints triggers={triggers} hasContent={Boolean(description.trim())} />
                </StudioSection>

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingCharacter ? t('creation.character.actions.updateCharacter') : t('creation.character.actions.createCharacter')}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        </>
    )
}
