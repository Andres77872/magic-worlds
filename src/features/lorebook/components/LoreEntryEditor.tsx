import { EyeOff, KeyRound, Route, ScrollText, Settings2, SlidersHorizontal } from 'lucide-react'
import type { LorebookEntry, LorebookEntryType, LorebookInsertionPosition, LorebookSelectiveLogic } from '@/shared'
import { Button, Field, Icon, Input, Select, Textarea } from '@/ui/primitives'
import { TriggersField } from '@/features/creation/common/components'
import { estimateTokens } from '../lorebookTransforms'

const ENTRY_TYPES: LorebookEntryType[] = ['character', 'world', 'faction', 'place', 'item', 'rule', 'secret', 'quest', 'state', 'relationship', 'other']
const SELECTIVE_LOGIC: LorebookSelectiveLogic[] = ['any', 'all', 'and_any', 'and_all', 'not_any', 'not_all']
const INSERTION_POSITIONS: LorebookInsertionPosition[] = ['before_context', 'after_context', 'author_note', 'system']

interface LoreEntryEditorProps {
    entry?: LorebookEntry
    onChange: (entry: LorebookEntry) => void
    onDelete?: (entryId: string) => void
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-start justify-between gap-4 rounded-lg border border-parchment-50/[.08] bg-ink-700/70 px-3.5 py-3">
            <span className="min-w-0">
                <span className="block font-ui text-sm font-semibold text-parchment-50">{label}</span>
                <span className="mt-0.5 block font-ui text-xs leading-snug text-parchment-300">{description}</span>
            </span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-1 h-4 w-4 accent-ember-500"
            />
        </label>
    )
}

export function LoreEntryEditor({ entry, onChange, onDelete }: LoreEntryEditorProps) {
    if (!entry) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-parchment-50/15 bg-ink-700/30 px-6 text-center">
                <Icon icon={ScrollText} size={36} className="text-ember-400" />
                <p className="mt-3 font-display text-xl font-semibold text-parchment-50">Select an entry</p>
                <p className="mt-1 max-w-[34ch] font-narrative text-sm text-parchment-300">
                    Choose an entry from the table to edit activation keys, content, and prompt placement.
                </p>
            </div>
        )
    }

    const patch = (changes: Partial<LorebookEntry>) => onChange({ ...entry, ...changes })

    return (
        <div className="flex flex-col gap-5 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-arcane-500/10 px-3 py-1 font-ui text-xs font-semibold text-arcane-300">
                        <Icon icon={SlidersHorizontal} size={13} />
                        {estimateTokens(entry.content)} estimated tokens
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-semibold text-parchment-50">
                        {entry.title || 'Untitled entry'}
                    </h3>
                </div>
                {onDelete && (
                    <Button kind="danger" size="sm" onClick={() => onDelete(entry.id)}>
                        Delete
                    </Button>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <Field label="Title">
                    <Input value={entry.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Glass Market" />
                </Field>
                <Field label="Type">
                    <Select value={entry.entryType} onChange={(event) => patch({ entryType: event.target.value as LorebookEntryType })}>
                        {ENTRY_TYPES.map((type) => (
                            <option key={type} value={type}>{type.replace('_', ' ')}</option>
                        ))}
                    </Select>
                </Field>
            </div>

            <Field label="Prompt content" helper="Write standalone facts. Titles and keys are not prompt content.">
                <Textarea
                    value={entry.content}
                    onChange={(event) => patch({ content: event.target.value })}
                    placeholder="The Glass Market is a moonlit bazaar beneath Aurelian Bridge..."
                    className="min-h-[180px]"
                />
            </Field>

            <div className="rounded-xl border border-parchment-50/[.08] bg-ink-700/40 p-4">
                <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                    <Icon icon={KeyRound} size={16} className="text-ember-400" />
                    Activation
                </div>
                <div className="grid gap-4">
                    <TriggersField
                        values={entry.keys}
                        onChange={(keys) => patch({ keys })}
                        label="Primary keys"
                        helper="Words or phrases that activate this entry."
                        placeholder="glass market, Aurelian Bridge"
                    />
                    <TriggersField
                        values={entry.secondaryKeys}
                        onChange={(secondaryKeys) => patch({ secondaryKeys })}
                        label="Secondary keys"
                        helper="Optional additional conditions for selective matching."
                        placeholder="moonlit bazaar, silver stalls"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Secondary logic">
                            <Select value={entry.selectiveLogic} onChange={(event) => patch({ selectiveLogic: event.target.value as LorebookSelectiveLogic })}>
                                {SELECTIVE_LOGIC.map((logic) => (
                                    <option key={logic} value={logic}>{logic}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Entry token cap">
                            <Input
                                type="number"
                                min={0}
                                value={entry.tokenBudget ?? ''}
                                onChange={(event) => patch({ tokenBudget: event.target.value ? Number(event.target.value) : null })}
                                placeholder="inherit"
                            />
                        </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleRow label="Enabled" description="Disabled entries stay visible but do not activate." checked={entry.enabled} onChange={(enabled) => patch({ enabled })} />
                        <ToggleRow label="Constant" description="Always include this entry when the book is active." checked={entry.constant} onChange={(constant) => patch({ constant })} />
                        <ToggleRow label="Whole words" description="Avoid accidental partial-word matches." checked={entry.matchWholeWords} onChange={(matchWholeWords) => patch({ matchWholeWords })} />
                        <ToggleRow label="Case sensitive" description="Require exact casing for key matches." checked={entry.caseSensitive} onChange={(caseSensitive) => patch({ caseSensitive })} />
                        <ToggleRow label="Regex keys" description="Treat keys as regular expressions." checked={entry.regex} onChange={(regex) => patch({ regex })} />
                        <ToggleRow label="Secret" description="Mark sensitive lore for editor-only review." checked={entry.isSecret} onChange={(isSecret) => patch({ isSecret })} />
                    </div>
                    {entry.isSecret && (
                        <Field label={<span className="inline-flex items-center gap-2"><Icon icon={EyeOff} size={14} /> Reveal condition</span>}>
                            <Input
                                value={entry.revealCondition ?? ''}
                                onChange={(event) => patch({ revealCondition: event.target.value })}
                                placeholder="Reveal after the pact is discovered"
                            />
                        </Field>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-parchment-50/[.08] bg-ink-700/40 p-4">
                <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                    <Icon icon={Route} size={16} className="text-arcane-300" />
                    Prompt placement
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Position">
                        <Select value={entry.insertionPosition} onChange={(event) => patch({ insertionPosition: event.target.value as LorebookInsertionPosition })}>
                            {INSERTION_POSITIONS.map((position) => (
                                <option key={position} value={position}>{position.replace('_', ' ')}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Insertion order">
                        <Input type="number" value={entry.insertionOrder} onChange={(event) => patch({ insertionOrder: Number(event.target.value) })} />
                    </Field>
                    <Field label="Priority">
                        <Input type="number" value={entry.priority} onChange={(event) => patch({ priority: Number(event.target.value) })} />
                    </Field>
                </div>
            </div>

            <div className="rounded-lg border border-arcane-500/20 bg-arcane-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                <span className="inline-flex items-center gap-2">
                    <Icon icon={Settings2} size={15} className="text-arcane-300" />
                    Backend activation preview uses the same endpoint shape as live chat prompt assembly.
                </span>
            </div>
        </div>
    )
}
