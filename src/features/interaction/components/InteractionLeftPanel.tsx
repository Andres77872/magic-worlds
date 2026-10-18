import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { useContext, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, AudioLines, Check, Globe, Info, Pencil, Plus, UserCircle, Users, Volume2, X } from 'lucide-react'
import type { Adventure, AdventureSnapshot, Character, EffectiveVoice, StoredCharacterVoice, World } from '../../../shared'
import { readWorldPlaceType, worldPlaceTypeLabel } from '../../../shared'
import { hasAssignedVoice, isElevenLabsProjection, voiceDisplayName } from '../../../shared/voice'
import { isLorebooksFeatureEnabled, isVoicesFeatureEnabled } from '../../../shared/featureFlags'
import { Avatar, Button, Icon, IconButton, SectionHeader, SwitchRow, Textarea, ThemeSongButton } from '@/ui/primitives'
import { ReferenceRow } from '@/ui/components'
import { VoicePickerDialog } from '../../voices/components/VoicePickerDialog'
import { EffectiveVoiceLabel } from '../../voices/components/EffectiveVoiceLabel'
import { VoiceBadges } from '../../voices/components/VoiceBadges'
import { isLeaving, leavingVoiceKey, useLeavingVoice } from '../../voices/hooks/useLeavingVoice'
import { useCatalogLookup } from '../../voices/hooks/useCatalogLookup'
import { AuthContext } from '@/app/providers/AuthProvider'
import { SessionLorebookPanel } from '@/features/lorebook'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { cardWindow } from '@/features/floatingWindows'
import { snapshotToCardPreview } from '@/features/codex'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'
import { resolveMediaUrl } from '../../../infrastructure/api'
import { useData, useFloatingWindows } from '../../../app/hooks'
import { isAiCharacterCard, sessionPersonaCandidates as orderedPersonaCandidates } from '../../../utils/characterRoles'
import { AdventureCardDrawer } from './AdventureCardDrawer'
import { CastVoiceMenu } from './voice/CastVoiceMenu'
import { CastVoiceRefreshPanel } from './voice/CastVoiceRefreshPanel'
import { useCastVoiceRefresh, type CastVoiceRefresh } from './voice/useCastVoiceRefresh'
import { AddCardModal, type AddCandidate } from './AddCardModal'
import {
    addSnapshotCard,
    applySnapshotCardEdit,
    applySnapshotScenarioEdit,
    characterEntries,
    ensureAdventureSnapshot,
    findSnapshotEntry,
    libraryCardToSnapshotCard,
    personaEntry,
    removeSnapshotCard,
    setSnapshotNarratorVoice,
    setSnapshotPersona,
    snapshotSourceIds,
    worldEntries,
    type SnapshotCardEntry,
    type SnapshotCardRef,
} from '../utils/adventureSnapshot'

type PickerKind = 'cast' | 'world' | 'persona'

interface InteractionLeftPanelProps {
    adventure: Adventure
    onBack: () => void
    /** Persist an edit to this adventure's own cloned snapshot. */
    onSnapshotChange?: (snapshot: AdventureSnapshot) => Promise<void>
    /** Workspace R1: the session's workspace is archived; narration settings are read-only. */
    readOnly?: boolean
    /** Rendered in the narration section under the narrator voice row (the session narration tier control). */
    narrationTierSlot?: ReactNode
    /** Controlled narrator voice picker; uncontrolled when omitted. */
    narratorPickerOpen?: boolean
    onNarratorPickerOpenChange?: (open: boolean) => void
    /** The story language: catalog badges and samples in the narrator picker. */
    language?: string | null
}

export function InteractionLeftPanel({
    adventure,
    onBack,
    onSnapshotChange,
    readOnly = false,
    narrationTierSlot,
    narratorPickerOpen,
    onNarratorPickerOpenChange,
    language,
}: InteractionLeftPanelProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const { characters: libraryCharacters, worlds: libraryWorlds } = useData()
    const { openWindow } = useFloatingWindows()
    const snapshot = ensureAdventureSnapshot(adventure)
    const persona = personaEntry(snapshot)
    const cast = characterEntries(snapshot)
    const worlds = worldEntries(snapshot)
    const scenario = (snapshot.template.description ?? '').trim()
    const editable = Boolean(onSnapshotChange)
    const lorebooksEnabled = isLorebooksFeatureEnabled()
    // D36 (R1-FE-04): cast voices that differ from their cards' current voices.
    const castVoice = useCastVoiceRefresh({ adventure, cast, editable, readOnly })

    const [selectedRef, setSelectedRef] = useState<SnapshotCardRef | null>(null)
    const [picker, setPicker] = useState<PickerKind | null>(null)
    const selectedEntry = selectedRef ? findSnapshotEntry(snapshot, selectedRef) : null

    // Clicking a card opens a floating preview window; its Edit action opens the
    // existing card drawer (driven by selectedRef) above the window.
    const openCardPreview = (entry: SnapshotCardEntry) => {
        openWindow(
            cardWindow(snapshotToCardPreview(entry.card as unknown as Record<string, unknown>, entry.ref.kind, entry.key), {
                onEdit: () => setSelectedRef(entry.ref),
                editLabel: t('floatingWindows.edit'),
            }),
        )
    }

    const usedIds = snapshotSourceIds(snapshot)
    const personaSourceId = persona?.card.source_card_id || persona?.card.id

    const toCandidate = (c: Character | World): AddCandidate => ({
        id: c.id,
        name: c.name,
        badge: 'race' in c ? c.race : [worldPlaceTypeLabel(readWorldPlaceType(c)), c.type].filter(Boolean).join(' / '),
        description: c.description,
    })

    const castCandidates = libraryCharacters.filter((c) => isAiCharacterCard(c) && !usedIds.has(c.id)).map(toCandidate)
    const worldCandidates = libraryWorlds.filter((w) => !usedIds.has(w.id)).map(toCandidate)
    const personaCandidates = orderedPersonaCandidates(libraryCharacters).filter((c) => c.id !== personaSourceId).map(toCandidate)

    const handleSaveCard = async (ref: SnapshotCardRef, card: SnapshotCardEntry['card']) => {
        if (!onSnapshotChange) return
        await onSnapshotChange(applySnapshotCardEdit(snapshot, ref, card))
    }

    const handleRemoveCard = async (ref: SnapshotCardRef) => {
        if (!onSnapshotChange) return
        await onSnapshotChange(removeSnapshotCard(snapshot, ref))
    }

    const handleSaveScenario = async (text: string) => {
        if (!onSnapshotChange) return
        await onSnapshotChange(applySnapshotScenarioEdit(snapshot, text))
    }

    const handleAddConfirm = async (ids: string[]) => {
        if (!onSnapshotChange || ids.length === 0) return
        if (picker === 'persona') {
            const lib = libraryCharacters.find((c) => c.id === ids[0])
            if (lib) await onSnapshotChange(setSnapshotPersona(snapshot, libraryCardToSnapshotCard(lib, 'character')))
            return
        }
        const kind = picker === 'world' ? 'world' : 'character'
        const lib = kind === 'world' ? libraryWorlds : libraryCharacters
        let next = snapshot
        for (const id of ids) {
            const card = lib.find((x) => x.id === id)
            if (card) next = addSnapshotCard(next, kind, libraryCardToSnapshotCard(card, kind))
        }
        await onSnapshotChange(next)
    }

    return (
        <div className="flex min-w-0 flex-col gap-6 p-5">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack} className="min-w-0 whitespace-normal! text-left">
                    {t('interaction.leftPanel.backToAdventures')}
                </Button>
                <ModeBadge mode="adventure" />
            </div>

            <ScenarioSection scenario={scenario} editable={editable} onSave={handleSaveScenario} />

            {lorebooksEnabled && !adventure.draft && <SessionLorebookPanel targetKind="adventure_session" targetId={adventure.id} framed={false} workspaceId={organizationWorkspaceId(adventure)} />}

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={UserCircle}
                    title={t('interaction.leftPanel.personaTitle')}
                    tone="ember"
                    right={editable && !persona ? <AddButton label={t('interaction.leftPanel.choosePersona')} onClick={() => setPicker('persona')} /> : undefined}
                />
                {persona ? (
                    <CardList entries={[persona]} onPreview={openCardPreview} />
                ) : (
                    <EmptyState>{t('interaction.leftPanel.noPersona')}</EmptyState>
                )}
            </section>

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={Globe}
                    title={t('interaction.leftPanel.worldTitle')}
                    right={editable ? <AddButton label={t('interaction.leftPanel.addWorld')} onClick={() => setPicker('world')} /> : undefined}
                />
                {worlds.length > 0 ? (
                    <CardList entries={worlds} onPreview={openCardPreview} />
                ) : (
                    <EmptyState>{t('interaction.leftPanel.noWorld')}</EmptyState>
                )}
            </section>

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={Users}
                    title={t('interaction.leftPanel.charactersTitle')}
                    right={editable ? <AddButton label={t('interaction.leftPanel.addCharacter')} onClick={() => setPicker('cast')} /> : undefined}
                />
                <CastVoiceRefreshPanel cast={castVoice} />
                {cast.length > 0 ? (
                    <CardList entries={cast} onPreview={openCardPreview} castVoice={castVoice} />
                ) : (
                    <EmptyState>{t('interaction.leftPanel.noCharacters')}</EmptyState>
                )}
            </section>

            {editable && isVoicesFeatureEnabled() && (
                <NarrationSection
                    voice={snapshot.narrator_voice ?? null}
                    effective={snapshot.effective_narrator_voice ?? null}
                    language={language}
                    narrateThoughts={Boolean(snapshot.narrate_thoughts)}
                    onVoiceChange={(narrator_voice) => onSnapshotChange?.(setSnapshotNarratorVoice(snapshot, narrator_voice))}
                    onNarrateThoughtsChange={(narrate_thoughts) => onSnapshotChange?.({ ...snapshot, narrate_thoughts })}
                    disabled={readOnly}
                    tierSlot={narrationTierSlot}
                    pickerOpen={narratorPickerOpen}
                    onPickerOpenChange={onNarratorPickerOpenChange}
                />
            )}

            <AdventureCardDrawer
                open={Boolean(selectedEntry)}
                entry={selectedEntry}
                onClose={() => setSelectedRef(null)}
                onSave={handleSaveCard}
                onRemove={editable ? handleRemoveCard : undefined}
            />

            <AddCardModal
                open={picker !== null}
                single={picker === 'persona'}
                title={picker === 'world' ? t('interaction.leftPanel.addWorldModalTitle') : picker === 'persona' ? t('interaction.leftPanel.choosePersonaModalTitle') : t('interaction.leftPanel.addCharactersModalTitle')}
                confirmKind={picker === 'world' ? 'world' : 'character'}
                candidates={picker === 'world' ? worldCandidates : picker === 'persona' ? personaCandidates : castCandidates}
                emptyHint={
                    picker === 'world'
                        ? t('interaction.leftPanel.noMoreWorlds')
                        : picker === 'persona'
                          ? t('ui.personaPicker.noPersonasHint')
                          : t('interaction.leftPanel.noMoreCharacters')
                }
                onClose={() => setPicker(null)}
                onConfirm={handleAddConfirm}
            />
        </div>
    )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    useFeatureFlags()
    return (
        <IconButton label={label} size="sm" onClick={onClick}>
            <Plus size={16} strokeWidth={1.75} />
        </IconButton>
    )
}

/* ------------------------------ narration ------------------------------ */

/**
 * Session-level narration settings: the narrator/GM voice used for `<narrator>`
 * lines in multi-voice TTS (characters speak in their own assigned voices), plus
 * whether visible inner thoughts are voiced. Saved into the snapshot envelope.
 */
function NarrationSection({
    voice,
    effective,
    language,
    narrateThoughts,
    onVoiceChange,
    onNarrateThoughtsChange,
    disabled = false,
    tierSlot,
    pickerOpen: controlledPickerOpen,
    onPickerOpenChange,
}: {
    voice: StoredCharacterVoice | null
    /** The narrator voice's read-only projection (D35): name, badges and "Plays as" when the server sent one. */
    effective?: EffectiveVoice | null
    language?: string | null
    narrateThoughts: boolean
    onVoiceChange: (voice: StoredCharacterVoice | null) => void
    onNarrateThoughtsChange: (value: boolean) => void
    disabled?: boolean
    tierSlot?: ReactNode
    pickerOpen?: boolean
    onPickerOpenChange?: (open: boolean) => void
}) {
    useFeatureFlags()
    const { t } = useTranslation()
    const [uncontrolledPickerOpen, setUncontrolledPickerOpen] = useState(false)
    const pickerOpen = controlledPickerOpen ?? uncontrolledPickerOpen
    const setPickerOpen = (open: boolean) => {
        if (controlledPickerOpen === undefined) setUncontrolledPickerOpen(open)
        onPickerOpenChange?.(open)
    }
    const signedIn = useSignedIn()
    // 05 §9.3: "Leaving on {date}" from the catalog (read only for an ElevenLabs projection badged `leaving`).
    const leavingVoice = useLeavingVoice(voice, effective, signedIn && hasAssignedVoice(voice))
    // AC-C4 (D16, 05 §5.4): the description carries the thought-delivery helper.
    const thoughtsDescription = `${t('interaction.narration.narrateThoughtsDesc')} ${t('interaction.narration.narrateThoughtsHelp')}`
    return (
        <section className="flex flex-col gap-2.5">
            <SectionHeader icon={Volume2} title={t('interaction.narration.title')} tone="ember" />
            <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                    <p className="font-ui text-sm font-semibold text-parchment-50">{t('interaction.narration.narratorVoice')}</p>
                    {hasAssignedVoice(voice) && isElevenLabsProjection(effective) ? (
                        <EffectiveVoiceLabel
                            stored={voice}
                            effective={effective}
                            badgeContext={{ language, date: leavingVoice?.disable_at ?? null }}
                            nameClassName="font-ui text-xs text-parchment-300 break-words"
                        />
                    ) : hasAssignedVoice(voice) ? (
                        <p className="font-ui text-xs text-parchment-300 break-words">{voiceDisplayName(voice) ?? t('voices.display.fallbackName')}</p>
                    ) : (
                        <p className="font-ui text-xs text-parchment-300">{t('interaction.narration.usesDefault')}</p>
                    )}
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon icon={AudioLines} size={14} />}
                    onClick={() => setPickerOpen(true)}
                    disabled={disabled}
                >
                    {hasAssignedVoice(voice) ? t('interaction.narration.change') : t('interaction.narration.chooseVoice')}
                </Button>
            </div>
            {tierSlot}
            <SwitchRow
                variant="plain"
                label={t('interaction.narration.narrateThoughts')}
                description={thoughtsDescription}
                checked={narrateThoughts}
                onChange={onNarrateThoughtsChange}
                disabled={disabled}
            />
            <VoicePickerDialog
                open={pickerOpen && !disabled}
                currentVoice={voice}
                currentEffectiveVoice={effective}
                language={language}
                onSelect={(next) => {
                    onVoiceChange(next)
                    setPickerOpen(false)
                }}
                onClose={() => setPickerOpen(false)}
            />
        </section>
    )
}

/* --------------------------- compact card grid --------------------------- */

function CardList({
    entries,
    onPreview,
    castVoice,
}: {
    entries: SnapshotCardEntry[]
    onPreview: (entry: SnapshotCardEntry) => void
    /** Cast lists only: members whose voice differs from their card get a cast menu (D36). */
    castVoice?: CastVoiceRefresh
}) {
    useFeatureFlags()
    // 05 §9.3: leaving cast voices are dated from one catalog read ("Leaving on {date}"),
    // made only for ElevenLabs projections badged `leaving`.
    const signedIn = useSignedIn()
    const leavingKeys = entries.map(castLeavingKey)
    const catalog = useCatalogLookup(leavingKeys, signedIn && leavingKeys.some(Boolean))
    return (
        <div className="flex min-w-0 flex-col gap-1">
            {entries.map((entry, index) => {
                const key = leavingKeys[index]
                return (
                    <CompactCard
                        key={entry.key}
                        entry={entry}
                        onPreview={onPreview}
                        castVoice={castVoice}
                        leavingDate={key ? catalog.get(key)?.disable_at ?? null : null}
                    />
                )
            })}
        </div>
    )
}

/** Voice reads (catalog dates) run for a signed-in caller only; never outside the auth provider. */
function useSignedIn(): boolean {
    useFeatureFlags()
    return Boolean(useContext(AuthContext)?.isAuthenticated)
}

/** The catalog key of a cast member's leaving voice; null for anything else. */
function castLeavingKey({ card, ref }: SnapshotCardEntry): string | null {
    return ref.kind === 'character' && isLeaving(card.effective_voice) ? leavingVoiceKey(card.voice, card.effective_voice) : null
}

function CompactCard({ entry, onPreview, castVoice, leavingDate = null }: { entry: SnapshotCardEntry; onPreview: (entry: SnapshotCardEntry) => void; castVoice?: CastVoiceRefresh; leavingDate?: string | null }) {
    useFeatureFlags()
    const { t } = useTranslation()
    const { card, ref } = entry
    const isWorld = ref.kind === 'world'
    const badge = isWorld
        ? [worldPlaceTypeLabel(readWorldPlaceType(card)), card.type].filter(Boolean).join(' / ')
        : card.race || ''
    const newer = Boolean(card.newer_version_available)
    const title = card.name || t('interaction.leftPanel.untitled')
    const description = [badge, newer ? t('cardVersions.newer.badge') : undefined].filter(Boolean).join(' · ')
    const themeSongUrl = resolveMediaUrl(card.theme_song_url)
    // Cast voices show their state only when the server sent a projection.
    const projection = ref.kind === 'character' && isElevenLabsProjection(card.effective_voice) ? card.effective_voice : null
    const row = (
        <ReferenceRow
            leading={<Avatar name={title} src={resolveMediaUrl(card.image_url)} size={36} ring={ref.kind === 'persona' ? 'ember' : 'none'} />}
            title={title}
            description={description || undefined}
            onTitleClick={() => onPreview(entry)}
            trailing={themeSongUrl ? <ThemeSongButton src={themeSongUrl} cardName={title} artworkUrl={resolveMediaUrl(card.image_url)} className="pointer-coarse:h-11 pointer-coarse:w-11" /> : undefined}
        />
    )
    // D36 cast menu: only for a member the refresh would change (its projection is ElevenLabs).
    const drift = projection && card.id ? castVoice?.byCard.get(card.id) ?? null : null
    if (!projection || (projection.badges.length === 0 && !drift)) return row
    if (drift && castVoice) {
        return (
            <div className="flex min-w-0 flex-col gap-1">
                {row}
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-12">
                    <VoiceBadges
                        badges={projection.badges}
                        context={{ original: voiceDisplayName(card.voice), name: projection.display_name || null, date: leavingDate }}
                    />
                    <CastVoiceMenu drift={drift} cast={castVoice} />
                </div>
            </div>
        )
    }
    return (
        <div className="flex min-w-0 flex-col gap-1">
            {row}
            <VoiceBadges
                className="pl-12"
                badges={projection.badges}
                context={{ original: voiceDisplayName(card.voice), name: projection.display_name || null, date: leavingDate }}
            />
        </div>
    )
}

function EmptyState({ children }: { children: ReactNode }) {
    useFeatureFlags()
    return (
        <p className="py-1 text-label text-parchment-300">{children}</p>
    )
}

/* ----------------------------- scenario editor ----------------------------- */

function ScenarioSection({
    scenario,
    editable,
    onSave,
}: {
    scenario: string
    editable: boolean
    onSave: (text: string) => Promise<void>
}) {
    useFeatureFlags()
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(scenario)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scenarioErrorId = useId()

    const startEdit = () => {
        setDraft(scenario)
        setError(null)
        setEditing(true)
    }

    const submit = async () => {
        setSaving(true)
        setError(null)
        try {
            await onSave(draft.trim())
            setEditing(false)
        } catch (e) {
            console.error('Failed to save scenario:', e)
            setError(t('interaction.scenario.saveError'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="flex flex-col gap-2.5">
            <SectionHeader
                icon={Info}
                title={t('interaction.scenario.title')}
                right={
                    editable && !editing ? (
                        <IconButton label={t('interaction.scenario.edit')} size="sm" onClick={startEdit}>
                            <Pencil size={15} strokeWidth={1.75} />
                        </IconButton>
                    ) : undefined
                }
            />
            {editing ? (
                <div className="flex flex-col gap-2">
                    {/* No <Field> wrapper here: SectionHeader above already prints a
                        visible "Scenario" heading, so an aria-label carries the name
                        without duplicating it on screen. */}
                    <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={5}
                        autoFocus
                        aria-label={t('interaction.scenario.title')}
                        aria-describedby={error ? scenarioErrorId : undefined}
                        aria-invalid={error ? true : undefined}
                    />
                    {error && (
                        <p id={scenarioErrorId} className="font-ui text-[12px] text-blood-500">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<Icon icon={X} size={15} />}
                            onClick={() => setEditing(false)}
                            disabled={saving}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" size="sm" iconLeft={<Icon icon={Check} size={15} />} onClick={submit} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    {scenario ? (
                        <p className="whitespace-pre-line font-narrative text-body text-parchment-200 break-words">
                            {scenario}
                        </p>
                    ) : (
                        <p className="text-label text-parchment-300">
                            {editable ? t('interaction.scenario.emptyEditable') : t('interaction.scenario.empty')}
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}
