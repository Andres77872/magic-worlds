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
import { Globe, ScrollText, Sparkles, Tags, Target, UserCircle, Users } from 'lucide-react'
import type { Adventure, Character, World } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import type {
    AdventureTemplateCardResponse,
    CharacterCardResponse,
    WorldCardResponse,
} from '@/shared/types/aiCard.types'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Badge, Button } from '@/ui/primitives'
import {
    CreatorStudio,
    StudioSection,
    StudioSectionNav,
    StudioPreviewDock,
    CreatorField,
    CreatorTextarea,
    AttributeManager,
    AiGeneratePanel,
    MediaStudioSection,
    GeneratedDraftNotice,
    TriggersField,
    FormActions,
    type AiGenerateOptions,
    type StudioNavItem,
} from '../../common/components'
import { useAttributeCategories, toCategoryPayload } from '../../common/hooks'
import { CastSelector, PersonaSelector, WorldSelector } from './scene'
import { AdventurePreviewCard, type PreviewMember } from './preview'

// One minimal default component; users add more or create their own categories.
const DEFAULT_CATEGORIES: AttributeCategory[] = [
    { id: 'objectives', name: 'Objectives', type: 'detail', description: 'Goals to accomplish in this adventure — optional.' },
]

const FORM_ID = 'adventure-form'

/** Map an embedded AI character response into the local Character shape. */
function toCharacter(c: CharacterCardResponse): Character {
    return {
        id: c.id || c.uuid || c.name || '',
        name: c.name ?? '',
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
        world: w ? { name: w.name ?? '', type: w.type ?? '' } : undefined,
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
    const { characters, worlds, isLoading: dataLoading, editingTemplate, setEditingTemplate, loadData } = useData()
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
    // AI draft lifecycle for the live preview (separate from `isSubmitting` so the
    // page is never dimmed/blocked while generating).
    const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'done'>('idle')
    // AI-invented persona/cast/world, kept for a READ-ONLY preview: the form's
    // selectors are library-id based, so invented cards can't be "selected" — but
    // they're already saved on the persisted template. Cleared once the user edits
    // a selector (the preview then follows their library selections).
    const [generatedScene, setGeneratedScene] = useState<GeneratedScene | null>(null)

    const attrs = useAttributeCategories({ defaults: DEFAULT_CATEGORIES, entity: editingTemplate })

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

    const objectivesCount = (attrs.attributes['objectives'] ?? []).filter((r) => r.key.trim() || r.value.trim()).length
    const derivedTitle = scenario.trim().split('\n')[0].slice(0, 80) || 'Untitled Adventure'

    const scenarioError = showErrors && !scenario.trim() ? 'A scenario premise is required.' : undefined
    const noCast = !dataLoading && previewCast.length === 0 && !previewPersona

    const navItems = useMemo<StudioNavItem[]>(
        () => [
            ...(editingTemplate ? [] : [{ id: 'ai', label: 'AI Draft', icon: Sparkles }]),
            { id: 'scenario', label: 'Scenario', icon: ScrollText },
            { id: 'cast', label: 'Cast', icon: Users },
            { id: 'persona', label: 'Persona', icon: UserCircle },
            { id: 'world', label: 'World', icon: Globe },
            { id: 'objectives', label: 'Objectives', icon: Target },
            { id: 'triggers', label: 'Triggers', icon: Tags },
        ],
        [editingTemplate],
    )

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
                      type: selectedWorldObj.type,
                      description: selectedWorldObj.description ?? '',
                      category: selectedWorldObj.category ?? [],
                      triggers: selectedWorldObj.triggers ?? [],
                      image_url: selectedWorldObj.image_url,
                      theme_song_url: selectedWorldObj.theme_song_url,
                  }]
                : undefined,
            category: toCategoryPayload(attrs.categories, attrs.attributes),
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
            template={{ name: derivedTitle, description: scenario, category: toCategoryPayload(attrs.categories, attrs.attributes) }}
            imageUrl={imageUrl}
            onImageUrl={handleImageUrl}
            themeSongUrl={themeSongUrl}
            onThemeSongUrl={handleThemeSongUrl}
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

    // The AI endpoint generates AND persists the template, then returns it. Populate
    // the live form + preview in place and switch to edit mode (Save → Update, no
    // duplicate). Its AI-invented cast/world render read-only in the preview since
    // the form's selectors are library-id based. The library refresh runs in the bg.
    const handleGenerate = async (prompt: string, options: AiGenerateOptions) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setGenStatus('generating')
        try {
            const card = await apiService.createAdventureTemplateAI(prompt, options)
            if (options.signal?.aborted) {
                setGenStatus('idle')
                return
            }
            setScenario(card.description ?? '')
            setTriggers(card.triggers ?? [])
            setImageUrl(card.image_url)
            setThemeSongUrl(card.theme_song_url)
            attrs.hydrateFrom(card)
            setGeneratedScene(sceneFromResponse(card))
            setEditingTemplate(toTemplate(card))
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
        setEditingTemplate(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
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
    }

    const selectWorld = (id: string | undefined) => {
        setGeneratedScene(null)
        setSelectedWorld(id)
    }

    return (
        <CreatorStudio
            title={editingTemplate ? 'Edit Adventure' : 'Create Adventure'}
            icon="🗺️"
            onBack={handleBack}
            isLoading={isSubmitting}
            nav={<StudioSectionNav items={navItems} />}
            headerActions={
                <Button kind="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : editingTemplate ? 'Update' : 'Create'}
                </Button>
            }
            preview={
                <StudioPreviewDock
                    busy={genStatus === 'generating'}
                    notice={genStatus === 'done' ? <GeneratedDraftNotice noun="adventure" /> : undefined}
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
                {!editingTemplate && (
                    <div id="ai" className="scroll-mt-20">
                        <AiGeneratePanel
                            noun="adventure"
                            placeholder="A heist to steal a dragon's egg from a volcano fortress guarded by fire cultists…"
                            onGenerate={handleGenerate}
                        />
                    </div>
                )}

                <StudioSection
                    id="scenario"
                    icon={ScrollText}
                    title="The Scenario"
                    description="Set the opening scene — where does the story begin?"
                >
                    <CreatorField label="Premise" htmlFor="adventure-scenario" required error={scenarioError}>
                        <CreatorTextarea
                            id="adventure-scenario"
                            value={scenario}
                            onChange={setScenario}
                            rows={5}
                            autoFocus
                            placeholder="The tavern door bursts open. A hooded courier presses a sealed letter into your hand and whispers, “They're already here.”…"
                            className="font-narrative text-base"
                        />
                    </CreatorField>
                </StudioSection>

                <StudioSection
                    id="cast"
                    icon={Users}
                    title="The Cast"
                    description="Choose the characters who share this story."
                    right={<Badge tone="ember">{castMembers.length} chosen</Badge>}
                >
                    <CastSelector
                        characters={characters}
                        selectedIds={selectedCharacters}
                        onToggle={toggleCharacter}
                        onCreateCharacter={() => setPage('character')}
                        loading={dataLoading}
                    />
                    {noCast && (
                        <p className="font-narrative text-xs italic text-parchment-400">
                            No cast yet — the AI will improvise characters as the story unfolds.
                        </p>
                    )}
                </StudioSection>

                <StudioSection
                    id="persona"
                    icon={UserCircle}
                    title="Your Persona"
                    description="Play as one of your characters — optional."
                >
                    <PersonaSelector
                        characters={characters}
                        selectedId={selectedPersona}
                        onSelect={selectPersona}
                        onCreateCharacter={() => setPage('character')}
                        loading={dataLoading}
                    />
                </StudioSection>

                <StudioSection
                    id="world"
                    icon={Globe}
                    title="The World"
                    description="Ground the adventure in one of your worlds — optional."
                >
                    <WorldSelector
                        worlds={worlds}
                        selectedId={selectedWorld}
                        onSelect={selectWorld}
                        onCreateWorld={() => setPage('world')}
                        loading={dataLoading}
                    />
                </StudioSection>

                <StudioSection
                    id="objectives"
                    icon={Target}
                    title="Objectives & Components"
                    description="Add objectives, NPCs, or locations — and group them however you like. Optional."
                >
                    <AttributeManager
                        title="Objective groups"
                        icon="🎯"
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
                    description="Keywords that bring this adventure's context into the scene when mentioned in chat."
                >
                    <TriggersField values={triggers} onChange={setTriggers} label="Triggers" />
                </StudioSection>

                <FormActions
                    onCancel={handleBack}
                    submitLabel={editingTemplate ? 'Update Adventure' : 'Create Adventure'}
                    isSubmitting={isSubmitting}
                    error={saveError}
                />
            </form>
        </CreatorStudio>
    )
}
