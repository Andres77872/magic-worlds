import { useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Globe, Info, Pencil, Plus, UserCircle, Users, X } from 'lucide-react'
import type { Adventure, AdventureSnapshot } from '../../../shared'
import { Button, Icon, IconButton, SectionHeader, Tag, Textarea } from '../../../ui/primitives'
import { Card } from '../../../ui/components/lists/Card'
import { useData } from '../../../app/hooks'
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

    const toCandidate = (c: { id: string; name: string; race?: string; type?: string; description?: string }): AddCandidate => ({
        id: c.id,
        name: c.name,
        badge: c.race ?? c.type,
        description: c.description,
    })

    const castCandidates = libraryCharacters.filter((c) => !usedIds.has(c.id)).map(toCandidate)
    const worldCandidates = libraryWorlds.filter((w) => !usedIds.has(w.id)).map(toCandidate)
    const personaCandidates = libraryCharacters.filter((c) => c.id !== personaSourceId).map(toCandidate)

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
            <Button kind="secondary" full iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack}>
                Back to Adventures
            </Button>

            <ScenarioSection scenario={scenario} editable={editable} onSave={handleSaveScenario} />

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={UserCircle}
                    title="Your Persona"
                    tone="arcane"
                    right={editable && !persona ? <AddButton label="Choose persona" onClick={() => setPicker('persona')} /> : undefined}
                />
                {persona ? (
                    <CardList entries={[persona]} onOpen={setSelectedRef} />
                ) : (
                    <EmptyState>No persona — you play as yourself.</EmptyState>
                )}
            </section>

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={Globe}
                    title="World Setting"
                    right={editable ? <AddButton label="Add world" onClick={() => setPicker('world')} /> : undefined}
                />
                {worlds.length > 0 ? (
                    <CardList entries={worlds} onOpen={setSelectedRef} />
                ) : (
                    <EmptyState>No world selected</EmptyState>
                )}
            </section>

            <section className="flex flex-col gap-2.5">
                <SectionHeader
                    icon={Users}
                    title="Characters"
                    right={editable ? <AddButton label="Add character" onClick={() => setPicker('cast')} /> : undefined}
                />
                {cast.length > 0 ? (
                    <CardList entries={cast} onOpen={setSelectedRef} />
                ) : (
                    <EmptyState>No characters selected</EmptyState>
                )}
            </section>

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
                title={picker === 'world' ? 'Add a world' : picker === 'persona' ? 'Choose your persona' : 'Add characters'}
                confirmNoun={picker === 'world' ? 'world' : 'character'}
                candidates={picker === 'world' ? worldCandidates : picker === 'persona' ? personaCandidates : castCandidates}
                emptyHint={
                    picker === 'world'
                        ? 'No more worlds in your library to add. Create one from the Worlds page first.'
                        : 'No more characters in your library to add. Create one from the Characters page first.'
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
    const { card, ref } = entry
    const isWorld = ref.kind === 'world'
    const badge = (isWorld ? card.type : card.race) || ''
    return (
        <Card
            title={card.name || 'Untitled'}
            subtitle={badge ? <Tag>{badge}</Tag> : undefined}
            highlight={ref.kind === 'persona'}
            onClick={() => onOpen(ref)}
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
            setError("Couldn't save. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="flex flex-col gap-2.5">
            <SectionHeader
                icon={Info}
                title="Adventure Scenario"
                right={
                    editable && !editing ? (
                        <IconButton label="Edit scenario" size="sm" onClick={startEdit}>
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
                            Cancel
                        </Button>
                        <Button kind="primary" size="sm" iconLeft={<Icon icon={Check} size={15} />} onClick={submit} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
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
                            No scenario set{editable ? ' — tap the pencil to add one.' : '.'}
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}
