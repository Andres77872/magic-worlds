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
import type { Character } from '@/shared'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
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
    TriggersField,
    FormActions,
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
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showErrors, setShowErrors] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

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

    const objectivesCount = (attrs.attributes['objectives'] ?? []).filter((r) => r.key.trim() || r.value.trim()).length
    const derivedTitle = scenario.trim().split('\n')[0].slice(0, 80) || 'Untitled Adventure'

    const scenarioError = showErrors && !scenario.trim() ? 'A scenario premise is required.' : undefined
    const noCast = !dataLoading && castMembers.length === 0 && !personaMember

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
            })
            const selectedWorldObj = selectedWorld ? worlds.find((w) => w.id === selectedWorld) : undefined
            const personaObj = selectedPersona ? characters.find((c) => c.id === selectedPersona) : undefined
            const payload = {
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
                      }]
                    : undefined,
                category: toCategoryPayload(attrs.categories, attrs.attributes),
            }

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

    const handleGenerate = async (prompt: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        await apiService.createAdventureTemplateAI(prompt)
        setEditingTemplate(null)
        await loadData()
        setPage('landing')
    }

    const handleBack = () => {
        setEditingTemplate(null)
        setPage('landing')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) handleBack()
    }

    const toggleCharacter = (id: string) =>
        setSelectedCharacters((prev) => (prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]))

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
                <StudioPreviewDock>
                    <AdventurePreviewCard
                        title={derivedTitle}
                        scenario={scenario}
                        cast={castMembers}
                        persona={personaMember}
                        world={worldMeta}
                        objectivesCount={objectivesCount}
                        triggers={triggers}
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
                        onSelect={setSelectedPersona}
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
                        onSelect={setSelectedWorld}
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
