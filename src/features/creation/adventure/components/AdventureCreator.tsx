/**
 * Adventure creator — a two-pane "Creator Studio" scene-builder: titled editor
 * sections (scenario, cast, persona, world, objectives, triggers) on the left
 * with a sticky "playbill" live preview on the right.
 *
 * The persisted payload is unchanged: characters/world are embedded as snapshots
 * (by value, name-based), persona is a snapshot-or-null, world is a single-item
 * array-or-undefined, and the name is derived from the scenario. Edit mode still
 * remaps those snapshots back to the user's library by name.
 */

import type { FormEvent, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Adventure, Character, World } from '@/shared'
import { readWorldPlaceType } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type {
    AdventureTemplateCardResponse,
    CharacterCardResponse,
    WorldCardResponse,
} from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Badge, Button } from '@/ui/primitives'
import { isAiCharacterCard, personaCandidates } from '@/utils/characterRoles'
import {
    CreatorStudio,
    StudioSection,
    StudioSectionNav,
    StudioPreviewDock,
    SuggestedAttributes,
    CreatorField,
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
import { ADVENTURE_FIELDS, ADVENTURE_SECTIONS } from '../fields'
import { ADVENTURE_GALLERY_HEADING, ADVENTURE_GALLERY_SUBHEADING, ADVENTURE_TEMPLATES } from '../templates'
import { CastSelector, PersonaSelector, WorldSelector } from './scene'
import { AdventurePreviewCard, type PreviewMember } from './preview'

// One minimal default component; users add more or create their own categories.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'objectives', name: 'Objectives', type: 'detail', description: 'Goals to accomplish in this adventure — optional.' },
]

// One-click presets for the default "Objectives" category.
const OBJECTIVE_PRESETS: AttributePreset[] = [
    { key: 'Primary objective' },
    { key: 'Hidden objective' },
    { key: 'Personal stake' },
]

const FORM_ID = 'adventure-form'

const PREMISE_GHOST =
    'The tavern door bursts open. A hooded courier presses a sealed letter into your hand and whispers, “They\'re already here.”…'

/** Map an embedded AI character response into the local Character shape. */
function toCharacter(c: CharacterCardResponse): Character {
    return {
        id: c.id || c.uuid || c.name || '',
        name: c.name ?? '',
        role: c.role === 'persona' ? 'persona' : 'character',
        is_default_persona: Boolean(c.is_default_persona),
        race: c.race ?? '',
        description: c.description ?? '',
        stats: {},
        category: c.category ?? undefined,
        triggers: c.triggers ?? [],
        image_url: c.image_url,
        theme_song_url: c.theme_song_url,
    }
}

/** Map an embedded AI world response into the local World shape. */
function toWorld(w: WorldCardResponse): World {
    return {
        id: w.id || w.uuid || w.name || '',
        name: w.name ?? '',
        place_type: readWorldPlaceType(w),
        type: w.type ?? '',
        description: w.description ?? '',
        details: {},
        category: w.category ?? undefined,
        triggers: w.triggers ?? [],
        image_url: w.image_url,
        theme_song_url: w.theme_song_url,
    }
}

/** AI-invented scene members, projected for the read-only preview. */
interface GeneratedScene {
    persona?: PreviewMember
    cast: PreviewMember[]
    world?: { name: string; type: string }
}

/** Project an AI adventure response into preview members (by name — no library ids). */
function sceneFromResponse(card: AdventureTemplateCardResponse): GeneratedScene {
    const member = (c: CharacterCardResponse): PreviewMember => ({ id: c.id || c.uuid || c.name || '', name: c.name ?? '' })
    const w = card.world?.[0]
    return {
        persona: card.persona ? member(card.persona) : undefined,
        cast: (card.characters ?? []).map(member),
        world: w ? { name: w.name ?? '', type: [readWorldPlaceType(w), w.type].filter(Boolean).join(' / ') } : undefined,
    }
}

/** Map the AI/persisted adventure-template response into the local edit shape. */
function toTemplate(card: AdventureTemplateCardResponse): Adventure {
    return {
        id: card.id || card.uuid || '',
        scenario: card.description ?? '',
        persona: card.persona ? toCharacter(card.persona) : undefined,
        characters: (card.characters ?? []).map(toCharacter),
        world: card.world?.[0] ? toWorld(card.world[0]) : undefined,
        objectives: {},
        notes: {},
        category: card.category ?? undefined,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
}

export function AdventureCreator() {
    const { setPage } = useNavigation()
    const {
        characters,
        worlds,
        isLoading: dataLoading,
        editingTemplate,
        setEditingTemplate,
        setEditingCharacter,
        setEditingWorld,
        loadData,
    } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [scenario, setScenario] = useState(editingTemplate?.scenario ?? '')
    // Templates persist embedded character/world snapshots (no library ids).
    // On edit, re-map those snapshots back to the user's library by name so the
    // matching items preselect instead of silently appearing unselected.
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(() =>
        (editingTemplate?.characters ?? [])
            .map((embedded) => characters.find((c) => c.name === embedded.name)?.id)
            .filter((id): id is string => Boolean(id)),
    )
    const [selectedPersona, setSelectedPersona] = useState<string | undefined>(() =>
        editingTemplate?.persona ? characters.find((c) => c.name === editingTemplate.persona?.name)?.id : undefined,
    )
    const [selectedWorld, setSelectedWorld] = useState<string | undefined>(() =>
        editingTemplate?.world ? worlds.find((w) => w.name === editingTemplate.world?.name)?.id : undefined,
    )
    const [triggers, setTriggers] = useState<string[]>(editingTemplate?.triggers ?? [])
    const [imageUrl, setImageUrl] = useState<string | undefined>(editingTemplate?.image_url)
    const [themeSongUrl, setThemeSongUrl] = useState<string | undefined>(editingTemplate?.theme_song_url)
    // Template id resolved at save time, so theme persistence never races `editingTemplate` state.
    const savedIdRef = useRef<string | null>(editingTemplate?.id ?? null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showErrors, setShowErrors] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [assistantApplied, setAssistantApplied] = useState(false)
    // AI-invented persona/cast/world, kept for a READ-ONLY preview: the form's
    // selectors are library-id based, so invented cards can't be "selected" — but
    // they're already saved on the persisted template. Cleared once the user edits
    // a selector (the preview then follows their library selections).
    const [generatedScene, setGeneratedScene] = useState<GeneratedScene | null>(null)
    // undefined = template gallery (create mode); a pick (or null = empty/skip) shows the form.
    const [template, setTemplate] = useState<CardTemplate | null | undefined>(editingTemplate ? null : undefined)

    const guided = useGuidedCard({ fields: ADVENTURE_FIELDS, defaults: DEFAULT_CATEGORIES, entity: editingTemplate })

    // Harden the edit-mode remap: the useState initializers read the library at
    // mount, but loadData() is async — on a cold deep-link into edit the library
    // may still be empty then. Once it resolves, re-derive selections one time
    // (ref-guarded so it never clobbers the user's later edits).
    const remappedRef = useRef(false)
    useEffect(() => {
        if (remappedRef.current || dataLoading || !editingTemplate) return
        remappedRef.current = true
        setSelectedCharacters(
            (editingTemplate.characters ?? [])
                .map((embedded) => characters.find((c) => c.name === embedded.name)?.id)
                .filter((id): id is string => Boolean(id)),
        )
        setSelectedPersona(
            editingTemplate.persona ? characters.find((c) => c.name === editingTemplate.persona?.name)?.id : undefined,
        )
        setSelectedWorld(
            editingTemplate.world ? worlds.find((w) => w.name === editingTemplate.world?.name)?.id : undefined,
        )
    }, [dataLoading, editingTemplate, characters, worlds])

    // --- Derived, client-side preview projection (no API) ---
    const characterById = useMemo(() => new Map(characters.map((c) => [c.id, c] as const)), [characters])
    const aiCharacters = useMemo(() => characters.filter(isAiCharacterCard), [characters])
    const playableCharacters = useMemo(() => personaCandidates(characters), [characters])
    const worldById = useMemo(() => new Map(worlds.map((w) => [w.id, w] as const)), [worlds])

    const personaMember = useMemo<PreviewMember | undefined>(() => {
        if (!selectedPersona) return undefined
        const c = characterById.get(selectedPersona)
        return c ? { id: c.id, name: c.name } : undefined
    }, [selectedPersona, characterById])

    const castMembers = useMemo<PreviewMember[]>(
        () =>
            selectedCharacters
                .filter((id) => id !== selectedPersona) // dedupe persona out of the cast row (preview only)
                .map((id) => characterById.get(id))
                .filter((c): c is Character => Boolean(c))
                .map((c) => ({ id: c.id, name: c.name })),
        [selectedCharacters, selectedPersona, characterById],
    )

    const worldMeta = useMemo(() => {
        if (!selectedWorld) return undefined
        const w = worldById.get(selectedWorld)
        return w ? { name: w.name, type: w.type } : undefined
    }, [selectedWorld, worldById])

    // Right after AI generation, show the invented (read-only) scene; once the user
    // touches a selector, `generatedScene` clears and the preview follows selections.
    const previewPersona = generatedScene ? generatedScene.persona : personaMember
    const previewCast = generatedScene ? generatedScene.cast : castMembers
    const previewWorld = generatedScene ? generatedScene.world : worldMeta

    const objectivesCount = (guided.attributes['objectives'] ?? []).filter((r) => r.key.trim() || r.value.trim()).length
    const derivedTitle = scenario.trim().split('\n')[0].slice(0, 80) || 'Untitled Adventure'

    const scenarioError = showErrors && !scenario.trim() ? 'A scenario premise is required.' : undefined
    const noCast = !dataLoading && previewCast.length === 0 && !previewPersona

    const objectiveKeys = useMemo(
        () => (guided.attributes['objectives'] || []).map((row) => row.key.toLowerCase()),
        [guided.attributes],
    )

    const navItems = useMemo<StudioNavItem[]>(
        () => ADVENTURE_SECTIONS.map((section) => ({ id: section.id, label: String(section.title), icon: section.icon! })),
        [],
    )

    const sectionById = useMemo(() => Object.fromEntries(ADVENTURE_SECTIONS.map((s) => [s.id, s])), [])

    /** Build the create/update payload from current form state. */
    const buildPayload = () => {
        // Carry each card's own triggers into the embedded snapshot — the chat
        // matcher reads triggers from the template's embedded persona/cast/world,
        // not from the user's library.
        const toCharacterCard = (c: Character) => ({
            // Keep the library card id so a started adventure can clone the CURRENT
            // original card (and so edits stay isolated to the adventure's copy).
            source_card_id: c.id,
            name: c.name,
            role: c.role === 'persona' ? 'persona' : 'character',
            is_default_persona: Boolean(c.is_default_persona),
            race: c.race,
            description: c.description ?? '',
            category: c.category ?? [],
            triggers: c.triggers ?? [],
            // Embed the card's own media so the template stays self-sufficient if the
            // original is later deleted (the session normally re-clones from the live card).
            image_url: c.image_url,
            theme_song_url: c.theme_song_url,
        })
        const selectedWorldObj = selectedWorld ? worlds.find((w) => w.id === selectedWorld) : undefined
        const personaObj = selectedPersona ? characters.find((c) => c.id === selectedPersona) : undefined
        return {
            name: scenario.trim().slice(0, 80) || 'Untitled Adventure',
            description: scenario,
            triggers,
            persona: personaObj ? toCharacterCard(personaObj) : null,
            characters: selectedCharacters
                .map((id) => characters.find((c) => c.id === id))
                .filter((c): c is Character => Boolean(c))
                .map(toCharacterCard),
            world: selectedWorldObj
                ? [{
                      source_card_id: selectedWorldObj.id,
                      name: selectedWorldObj.name,
                      place_type: selectedWorldObj.place_type,
                      type: selectedWorldObj.type,
                      description: selectedWorldObj.description ?? '',
                      category: selectedWorldObj.category ?? [],
                      triggers: selectedWorldObj.triggers ?? [],
                      image_url: selectedWorldObj.image_url,
                      theme_song_url: selectedWorldObj.theme_song_url,
                  }]
                : undefined,
            category: guided.toCategoryPayload(),
            image_url: imageUrl ?? null,
            theme_song_url: themeSongUrl,
        }
    }

    /**
     * Ensure the template exists on the server and return its id — auto-saving
     * first if needed (theme generation needs a real target id).
     */
    const ensureSaved = async (): Promise<string> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Please log in to continue.')
        }
        if (!scenario.trim()) {
            setShowErrors(true)
            throw new Error('Add a scenario before generating a theme.')
        }
        if (editingTemplate) {
            await apiService.updateAdventureTemplate(editingTemplate.id, buildPayload())
            savedIdRef.current = editingTemplate.id
            return editingTemplate.id
        }
        const created = await apiService.createAdventureTemplate(buildPayload())
        const saved = toTemplate(created as AdventureTemplateCardResponse)
        if (saved.id) setEditingTemplate(saved)
        savedIdRef.current = saved.id
        // No loadData() here: a refresh would unmount this creator mid-generation (AppRouter
        // shows a spinner while loading). The new card lands in the gallery on Save.
        return saved.id
    }

    /**
     * Persist a freshly generated/uploaded/gallery-selected cover onto the template
     * (mirrors `handleThemeSongUrl`). Without this, the image only lives in form
     * state until Save — navigating away left the card unassigned even though the
     * asset shows in the user gallery. Unsaved new cards persist it on Create via
     * `buildPayload()`; removal stays a Save-time change so Back still backs out.
     */
    const handleImageUrl = (url: string | undefined) => {
        setImageUrl(url)
        const id = savedIdRef.current ?? editingTemplate?.id
        if (id && url) {
            void apiService
                .updateAdventureTemplate(id, { ...buildPayload(), image_url: url })
                .catch(() => {
                    /* best-effort — the asset still exists; Save re-persists the link */
                })
        }
    }

    /**
     * Persist a freshly generated theme onto the template. Theme generation always
     * runs after `ensureSaved()`, so the id is known — write it immediately (overriding
     * the not-yet-committed `themeSongUrl` state) so the gallery shows it without a re-save.
     */
    const handleThemeSongUrl = (url: string | undefined) => {
        setThemeSongUrl(url)
        const id = savedIdRef.current ?? editingTemplate?.id
        if (id && url) {
            // Persist the link only — do NOT loadData() here. A refresh flips isLoading,
            // which makes AppRouter unmount the whole creator (discarding in-progress edits)
            // and re-run the theme effect. The gallery refreshes on Save / next navigation.
            void apiService
                .updateAdventureTemplate(id, { ...buildPayload(), theme_song_url: url })
                .catch(() => {
                    /* best-effort — the asset still exists; Save re-persists the link */
                })
        }
    }

    // Cover + theme generators, docked under the live preview card.
    const mediaPanel = (
        <MediaStudioSection
            layout="compact"
            cardType="adventure_template"
            noun="adventure"
            template={{ name: derivedTitle, description: scenario, category: guided.toCategoryPayload() }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
            onGeneratedThemeSongUrl={setThemeSongUrl}
            ensureSaved={ensureSaved}
            themeTargetId={editingTemplate?.id}
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
        setShowErrors(true)
        if (!scenario.trim()) return

        setIsSubmitting(true)
        setSaveError(null)
        try {
            const payload = buildPayload()

            if (editingTemplate) {
                await apiService.updateAdventureTemplate(editingTemplate.id, payload)
            } else {
                await apiService.createAdventureTemplate(payload)
            }

            setEditingTemplate(null)
            await loadData()
            setPage('landing')
        } catch (error) {
            console.error('Failed to save adventure template:', error)
            // Gentle, non-blocking inline message — the form stays put so the
            // user can retry. Transient backend outages get reassuring copy.
            const transient = error instanceof ApiError && error.isTransient
            setSaveError(
                transient
                    ? 'The service is briefly unavailable — please try again in a moment.'
                    : 'Couldn\'t save your adventure. Please try again.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyAssistantCard = (card: AdventureTemplateCardResponse) => {
        setScenario(card.description ?? '')
        setTriggers(card.triggers ?? [])
        setImageUrl(card.image_url)
        setThemeSongUrl(card.theme_song_url)
        guided.hydrateFrom(card, { preserveActive: true })
        setGeneratedScene(sceneFromResponse(card))
        setEditingTemplate(toTemplate(card))
        savedIdRef.current = card.id || card.uuid || null
        setAssistantApplied(true)
        // AI generation skips the gallery; a picked template's scaffolding survives.
        setTemplate((current) => (current === undefined ? null : current))
        void loadData()
    }

    const handleBack = () => {
        setEditingTemplate(null)
        setPage('landing')
    }

    /** Back from the form: to the gallery while creating, to the library otherwise. */
    const handleStudioBack = () => {
        if (!editingTemplate && template !== undefined) {
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

    // Touching any selector replaces the read-only generated scene with the user's
    // own library selections in the preview.
    const toggleCharacter = (id: string) => {
        setGeneratedScene(null)
        setSelectedCharacters((prev) => (prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]))
    }

    const selectPersona = (id: string | undefined) => {
        setGeneratedScene(null)
        setSelectedPersona(id)
        // Playing a persona makes the agency contract relevant — surface it.
        if (id) guided.activateField('direction.agency')
    }

    const selectWorld = (id: string | undefined) => {
        setGeneratedScene(null)
        setSelectedWorld(id)
    }

    const firstClass = template?.firstClassExamples ?? {}

    const chatbot = (
        <CardAssistantChatbot<AdventureTemplateCardResponse>
            cardType="adventure_template"
            cardId={editingTemplate?.id ?? null}
            title={derivedTitle}
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
                <CreatorIntro title="Create Adventure" icon="🗺️" onBack={handleBack}>
                    <TemplateGallery
                        templates={ADVENTURE_TEMPLATES}
                        fields={ADVENTURE_FIELDS}
                        noun="adventure"
                        heading={ADVENTURE_GALLERY_HEADING}
                        subheading={ADVENTURE_GALLERY_SUBHEADING}
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
            title={editingTemplate ? 'Edit Adventure' : 'Create Adventure'}
            icon="🗺️"
            onBack={handleStudioBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : editingTemplate ? 'Update' : 'Create'}
                </Button>
            }
            preview={
                <StudioPreviewDock
                    notice={assistantApplied ? <GeneratedDraftNotice noun="adventure" /> : undefined}
                    footer={mediaPanel}
                >
                    <AdventurePreviewCard
                        title={derivedTitle}
                        scenario={scenario}
                        cast={previewCast}
                        persona={previewPersona}
                        world={previewWorld}
                        objectivesCount={objectivesCount}
                        triggers={triggers}
                        imageUrl={imageUrl}
                    />
                </StudioPreviewDock>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
                <StudioSection
                    id={sectionById['scenario'].id}
                    icon={sectionById['scenario'].icon}
                    title={sectionById['scenario'].title}
                    description={sectionById['scenario'].description}
                >
                    <CreatorField
                        label="Premise"
                        htmlFor="adventure-scenario"
                        required
                        error={scenarioError}
                        tooltip="The standing brief the AI reads every turn: who you are, where it starts, and what's wrong."
                    >
                        <CreatorTextarea
                            id="adventure-scenario"
                            value={scenario}
                            onChange={setScenario}
                            rows={5}
                            autoFocus
                            placeholder={firstClass.description ?? PREMISE_GHOST}
                            className="font-narrative text-base"
                        />
                        <UseExampleLink value={scenario} hint={firstClass.description} onUse={setScenario} />
                        {Boolean(scenario.trim()) && !guided.values['opening.scene']?.trim() && (
                            <QualityHint>
                                You have a premise but no first image. Add an{' '}
                                <a href="#opening" className="underline underline-offset-2">opening scene</a> so turn one
                                starts in a place, not a summary.
                            </QualityHint>
                        )}
                    </CreatorField>
                </StudioSection>

                <GuidedSection section={sectionById['opening']} guided={guided} />
                <GuidedSection section={sectionById['stakes']} guided={guided} />
                <GuidedSection section={sectionById['opposition']} guided={guided} />

                <StudioSection
                    id={sectionById['cast'].id}
                    icon={sectionById['cast'].icon}
                    title={sectionById['cast'].title}
                    description={sectionById['cast'].description}
                    right={<Badge tone="ember">{castMembers.length} chosen</Badge>}
                >
                    <CastSelector
                        characters={aiCharacters}
                        selectedIds={selectedCharacters}
                        onToggle={toggleCharacter}
                        onCreateCharacter={() => {
                            setEditingCharacter(null)
                            setPage('character')
                        }}
                        loading={dataLoading}
                    />
                    {noCast && (
                        <p className="font-narrative text-xs italic text-parchment-400">
                            No cast yet — the AI will improvise characters as the story unfolds.
                        </p>
                    )}
                </StudioSection>

                <StudioSection
                    id={sectionById['persona'].id}
                    icon={sectionById['persona'].icon}
                    title={sectionById['persona'].title}
                    description={sectionById['persona'].description}
                >
                    <PersonaSelector
                        characters={playableCharacters}
                        selectedId={selectedPersona}
                        onSelect={selectPersona}
                        onCreateCharacter={() => {
                            setEditingCharacter(null)
                            setPage('character')
                        }}
                        loading={dataLoading}
                    />
                </StudioSection>

                <StudioSection
                    id={sectionById['world'].id}
                    icon={sectionById['world'].icon}
                    title={sectionById['world'].title}
                    description={sectionById['world'].description}
                >
                    <WorldSelector
                        worlds={worlds}
                        selectedId={selectedWorld}
                        onSelect={selectWorld}
                        onCreateWorld={() => {
                            setEditingWorld(null)
                            setPage('world')
                        }}
                        loading={dataLoading}
                    />
                </StudioSection>

                <GuidedSection
                    section={sectionById['objectives']}
                    guided={guided}
                    footer={
                        <>
                            <div className="flex flex-col gap-2.5">
                                <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                                    Quick add objectives
                                </span>
                                <SuggestedAttributes
                                    presets={OBJECTIVE_PRESETS}
                                    existingKeys={objectiveKeys}
                                    onAdd={(preset) =>
                                        guided.addAttributeWith('objectives', { key: preset.key, value: preset.value ?? '' })
                                    }
                                />
                            </div>
                            <AttributeManager
                                title="Objective groups"
                                icon="🎯"
                                categories={guided.categories}
                                attributes={guided.attributes}
                                onAddCategory={guided.addCategory}
                                onDeleteCategory={guided.deleteCategory}
                                onAddAttribute={guided.addAttribute}
                                onUpdateAttribute={guided.updateAttribute}
                                onRemoveAttribute={guided.removeAttribute}
                            />
                        </>
                    }
                />

                <GuidedSection section={sectionById['direction']} guided={guided} />

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
                        helper="Names and phrases that pull this adventure's context back into the scene mid-chat."
                        placeholder="e.g. the sealed letter, crowned serpent, Mother Coil"
                    />
                    <TriggerHints triggers={triggers} hasContent={Boolean(scenario.trim())} />
                </StudioSection>

                <FormActions
                    onCancel={handleStudioBack}
                    submitLabel={editingTemplate ? 'Update Adventure' : 'Create Adventure'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
        {chatbot}
        </>
    )
}
