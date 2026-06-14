import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, AudioLines, Check, Globe, Info, Pencil, Plus, UserCircle, Users, Volume2, X } from 'lucide-react'
import type { Adventure, AdventureSnapshot, CharacterVoice } from '../../../shared'
import { readWorldPlaceType, worldPlaceTypeLabel } from '../../../shared'
import { Button, Icon, IconButton, SectionHeader, SwitchRow, Tag, Textarea } from '../../../ui/primitives'
import { VoicePickerDialog } from '../../voices/components/VoicePickerDialog'
import { Card } from '../../../ui/components/lists/Card'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'
import { resolveMediaUrl } from '../../../infrastructure/api'
import { useData } from '../../../app/hooks'
import { isAiCharacterCard, personaCandidates as orderedPersonaCandidates } from '../../../utils/characterRoles'
import { AdventureCardDrawer } from './AdventureCardDrawer'
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
}

export function InteractionLeftPanel({ adventure, onBack, onSnapshotChange }: InteractionLeftPanelProps) {
    const { t } = useTranslation()
    const { characters: libraryCharacters, worlds: libraryWorlds } = useData()
    const snapshot = ensureAdventureSnapshot(adventure)
    const persona = personaEntry(snapshot)
    const cast = characterEntries(snapshot)
    const worlds = worldEntries(snapshot)
    const scenario = (snapshot.template.description ?? '').trim()
    const editable = Boolean(onSnapshotChange)

    const [selectedRef, setSelectedRef] = useState<SnapshotCardRef | null>(null)
    const [picker, setPicker] = useState<PickerKind | null>(null)
    const selectedEntry = selectedRef ? findSnapshotEntry(snapshot, selectedRef) : null

    const usedIds = snapshotSourceIds(snapshot)
    const personaSourceId = persona?.card.source_card_id || persona?.card.id

    const toCandidate = (c: { id: string; name: string; race?: string; place_type?: string; type?: string; description?: string }): AddCandidate => ({
        id: c.id,
        name: c.name,
        badge: c.race ?? [c.place_type, c.type].filter(Boolean).join(' / '),
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
        <div className="flex flex-col gap-6 p-5">
            <div className="flex items-center gap-2">
                <Button kind="secondary" full iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack} className="flex-1">
                    {t('interaction.leftPanel.backToAdventures')}
                </Button>
                <ModeBadge mode="adventure" />
            </div>

            <ScenarioSection scenario={scenario} editable={editable} onSave={handleSaveScenario} />

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={UserCircle}
                    title={t('interaction.leftPanel.personaTitle')}
                    tone="arcane"
                    right={editable && !persona ? <AddButton label={t('interaction.leftPanel.choosePersona')} onClick={() => setPicker('persona')} /> : undefined}
                />
                {persona ? (
                    <CardList entries={[persona]} onOpen={setSelectedRef} />
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
                    <CardList entries={worlds} onOpen={setSelectedRef} />
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
                {cast.length > 0 ? (
                    <CardList entries={cast} onOpen={setSelectedRef} />
                ) : (
                    <EmptyState>{t('interaction.leftPanel.noCharacters')}</EmptyState>
                )}
            </section>

            {editable && (
                <NarrationSection
                    voice={snapshot.narrator_voice ?? null}
                    narrateThoughts={Boolean(snapshot.narrate_thoughts)}
                    onVoiceChange={(narrator_voice) => onSnapshotChange?.({ ...snapshot, narrator_voice })}
                    onNarrateThoughtsChange={(narrate_thoughts) => onSnapshotChange?.({ ...snapshot, narrate_thoughts })}
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
                        : t('interaction.leftPanel.noMoreCharacters')
                }
                onClose={() => setPicker(null)}
                onConfirm={handleAddConfirm}
            />
        </div>
    )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
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
    narrateThoughts,
    onVoiceChange,
    onNarrateThoughtsChange,
}: {
    voice: CharacterVoice | null
    narrateThoughts: boolean
    onVoiceChange: (voice: CharacterVoice | null) => void
    onNarrateThoughtsChange: (value: boolean) => void
}) {
    const { t } = useTranslation()
    const [pickerOpen, setPickerOpen] = useState(false)
    return (
        <section className="flex flex-col gap-2.5">
            <SectionHeader icon={Volume2} title={t('interaction.narration.title')} tone="ember" />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700/70 px-3.5 py-3">
                <div className="min-w-0">
                    <p className="font-ui text-sm font-semibold text-parchment-50">{t('interaction.narration.narratorVoice')}</p>
                    {voice?.voice_id ? (
                        <code className="font-mono text-xs text-parchment-400">{voice.preset_name || voice.voice_id}</code>
                    ) : (
                        <p className="font-ui text-xs text-parchment-300">{t('interaction.narration.usesDefault')}</p>
                    )}
                </div>
                <Button
                    kind="secondary"
                    size="sm"
                    iconLeft={<Icon icon={AudioLines} size={14} />}
                    onClick={() => setPickerOpen(true)}
                >
                    {voice?.voice_id ? t('interaction.narration.change') : t('interaction.narration.chooseVoice')}
                </Button>
            </div>
            <SwitchRow
                label={t('interaction.narration.narrateThoughts')}
                description={t('interaction.narration.narrateThoughtsDesc')}
                checked={narrateThoughts}
                onChange={onNarrateThoughtsChange}
            />
            <VoicePickerDialog
                open={pickerOpen}
                currentVoice={voice}
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
    onOpen,
}: {
    entries: SnapshotCardEntry[]
    onOpen: (ref: SnapshotCardRef) => void
}) {
    // A lone card reads better full-width; multiples tile two-up in the column.
    const layout = entries.length > 1 ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'
    return (
        <div className={layout}>
            {entries.map((entry) => (
                <CompactCard key={entry.key} entry={entry} onOpen={onOpen} />
            ))}
        </div>
    )
}

function CompactCard({ entry, onOpen }: { entry: SnapshotCardEntry; onOpen: (ref: SnapshotCardRef) => void }) {
    const { t } = useTranslation()
    const { card, ref } = entry
    const isWorld = ref.kind === 'world'
    const badge = isWorld
        ? [worldPlaceTypeLabel(readWorldPlaceType(card)), card.type].filter(Boolean).join(' / ')
        : card.race || ''
    return (
        <Card
            title={card.name || t('interaction.leftPanel.untitled')}
            subtitle={badge ? <Tag>{badge}</Tag> : undefined}
            highlight={ref.kind === 'persona'}
            onClick={() => onOpen(ref)}
            imageUrl={resolveMediaUrl(card.image_url)}
            themeSongUrl={resolveMediaUrl(card.theme_song_url)}
        />
    )
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lg border border-dashed border-parchment-50/12 bg-ink-700/40 p-4">
            <p className="font-narrative text-[14px] italic text-parchment-400">{children}</p>
        </div>
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
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(scenario)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} autoFocus />
                    {error && <p className="font-ui text-[12px] text-blood-500">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <Button
                            kind="ghost"
                            size="sm"
                            iconLeft={<Icon icon={X} size={15} />}
                            onClick={() => setEditing(false)}
                            disabled={saving}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button kind="primary" size="sm" iconLeft={<Icon icon={Check} size={15} />} onClick={submit} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-parchment-50/10 bg-ink-700 p-4">
                    {scenario ? (
                        <p className="whitespace-pre-line font-narrative text-[15px] leading-relaxed text-parchment-200">
                            {scenario}
                        </p>
                    ) : (
                        <p className="font-narrative text-[14px] italic text-parchment-400">
                            {editable ? t('interaction.scenario.emptyEditable') : t('interaction.scenario.empty')}
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}
