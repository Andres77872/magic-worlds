import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeOff, KeyRound, Route, ScrollText, Settings2, SlidersHorizontal } from 'lucide-react'
import type { LorebookEntry, LorebookEntryType, LorebookInsertionPosition, LorebookSelectiveLogic } from '@/shared'
import { Button, Field, Icon, Input, Select, SwitchRow, Textarea, type SelectOption } from '@/ui/primitives'
import { TriggersField } from '@/features/creation/common/components'
import { estimateTokens } from '../lorebookTransforms'
import { ENTRY_TYPE_OPTIONS, INSERTION_POSITION_OPTIONS, SELECTIVE_LOGIC_OPTIONS } from '../lorebookCopy'

interface LoreEntryEditorProps {
    entry?: LorebookEntry
    onChange: (entry: LorebookEntry) => void
    onDelete?: (entryId: string) => void
}

export function LoreEntryEditor({ entry, onChange, onDelete }: LoreEntryEditorProps) {
    const { t } = useTranslation()
    const entryTypeOptions = useMemo<SelectOption[]>(
        () => ENTRY_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        [t],
    )
    const selectiveLogicOptions = useMemo<SelectOption[]>(
        () =>
            SELECTIVE_LOGIC_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
                description: option.description ? t(option.description) : undefined,
            })),
        [t],
    )
    const insertionPositionOptions = useMemo<SelectOption[]>(
        () =>
            INSERTION_POSITION_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
                description: option.description ? t(option.description) : undefined,
            })),
        [t],
    )

    if (!entry) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-parchment-50/15 bg-ink-700/30 px-6 text-center">
                <Icon icon={ScrollText} size={34} className="text-ember-400" />
                <p className="mt-3 font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.entryEditor.empty.title')}</p>
                <p className="mt-1 max-w-[34ch] font-narrative text-sm text-parchment-300">
                    {t('lorebookStudio.entryEditor.empty.description')}
                </p>
            </div>
        )
    }

    const patch = (changes: Partial<LorebookEntry>) => onChange({ ...entry, ...changes })

    return (
        <div className="flex flex-col gap-5 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-arcane-500/10 px-3 py-1 font-ui text-xs font-semibold text-arcane-300">
                        <Icon icon={SlidersHorizontal} size={13} />
                        {t('lorebookStudio.entryEditor.estimatedTokens', { count: estimateTokens(entry.content) })}
                    </div>
                    <h3 className="mt-3 truncate font-display text-xl font-semibold text-parchment-50">
                        {entry.title || t('lorebookStudio.entryEditor.untitled')}
                    </h3>
                </div>
                {onDelete && (
                    <Button kind="danger" size="sm" onClick={() => onDelete(entry.id)}>
                        {t('common.delete')}
                    </Button>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <Field label={t('lorebookStudio.entryEditor.fields.title.label')}>
                    <Input value={entry.title} onChange={(event) => patch({ title: event.target.value })} placeholder={t('lorebookStudio.entryEditor.fields.title.placeholder')} />
                </Field>
                <Field label={t('lorebookStudio.entryEditor.fields.type.label')}>
                    <Select
                        options={entryTypeOptions}
                        value={entry.entryType}
                        onChange={(value) => patch({ entryType: value as LorebookEntryType })}
                    />
                </Field>
            </div>

            <Field label={t('lorebookStudio.entryEditor.fields.content.label')} helper={t('lorebookStudio.entryEditor.fields.content.helper')}>
                <Textarea
                    value={entry.content}
                    onChange={(event) => patch({ content: event.target.value })}
                    placeholder={t('lorebookStudio.entryEditor.fields.content.placeholder')}
                    className="min-h-[180px]"
                />
            </Field>

            <div className="rounded-xl border border-parchment-50/[.08] bg-ink-700/40 p-4">
                <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                    <Icon icon={KeyRound} size={16} className="text-ember-400" />
                    {t('lorebookStudio.entryEditor.activation.heading')}
                </div>
                <div className="grid gap-4">
                    <TriggersField
                        values={entry.keys}
                        onChange={(keys) => patch({ keys })}
                        label={t('lorebookStudio.entryEditor.activation.primaryKeys.label')}
                        helper={t('lorebookStudio.entryEditor.activation.primaryKeys.helper')}
                        placeholder={t('lorebookStudio.entryEditor.activation.primaryKeys.placeholder')}
                    />
                    <TriggersField
                        values={entry.secondaryKeys}
                        onChange={(secondaryKeys) => patch({ secondaryKeys })}
                        label={t('lorebookStudio.entryEditor.activation.secondaryKeys.label')}
                        helper={t('lorebookStudio.entryEditor.activation.secondaryKeys.helper')}
                        placeholder={t('lorebookStudio.entryEditor.activation.secondaryKeys.placeholder')}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('lorebookStudio.entryEditor.activation.secondaryLogic.label')}>
                            <Select
                                options={selectiveLogicOptions}
                                value={entry.selectiveLogic}
                                onChange={(value) => patch({ selectiveLogic: value as LorebookSelectiveLogic })}
                            />
                        </Field>
                        <Field label={t('lorebookStudio.entryEditor.activation.tokenCap.label')}>
                            <Input
                                type="number"
                                min={0}
                                value={entry.tokenBudget ?? ''}
                                onChange={(event) => patch({ tokenBudget: event.target.value ? Number(event.target.value) : null })}
                                placeholder={t('lorebookStudio.entryEditor.activation.tokenCap.placeholder')}
                            />
                        </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.enabled.label')} description={t('lorebookStudio.entryEditor.switches.enabled.description')} checked={entry.enabled} onChange={(enabled) => patch({ enabled })} />
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.constant.label')} description={t('lorebookStudio.entryEditor.switches.constant.description')} checked={entry.constant} onChange={(constant) => patch({ constant })} />
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.wholeWords.label')} description={t('lorebookStudio.entryEditor.switches.wholeWords.description')} checked={entry.matchWholeWords} onChange={(matchWholeWords) => patch({ matchWholeWords })} />
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.caseSensitive.label')} description={t('lorebookStudio.entryEditor.switches.caseSensitive.description')} checked={entry.caseSensitive} onChange={(caseSensitive) => patch({ caseSensitive })} />
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.regex.label')} description={t('lorebookStudio.entryEditor.switches.regex.description')} checked={entry.regex} onChange={(regex) => patch({ regex })} />
                        <SwitchRow label={t('lorebookStudio.entryEditor.switches.secret.label')} description={t('lorebookStudio.entryEditor.switches.secret.description')} checked={entry.isSecret} onChange={(isSecret) => patch({ isSecret })} />
                    </div>
                    {entry.isSecret && (
                        <Field label={<span className="inline-flex items-center gap-2"><Icon icon={EyeOff} size={14} /> {t('lorebookStudio.entryEditor.fields.revealCondition.label')}</span>}>
                            <Input
                                value={entry.revealCondition ?? ''}
                                onChange={(event) => patch({ revealCondition: event.target.value })}
                                placeholder={t('lorebookStudio.entryEditor.fields.revealCondition.placeholder')}
                            />
                        </Field>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-parchment-50/[.08] bg-ink-700/40 p-4">
                <div className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold text-parchment-50">
                    <Icon icon={Route} size={16} className="text-arcane-300" />
                    {t('lorebookStudio.entryEditor.placement.heading')}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t('lorebookStudio.entryEditor.placement.position.label')}>
                        <Select
                            options={insertionPositionOptions}
                            value={entry.insertionPosition}
                            onChange={(value) => patch({ insertionPosition: value as LorebookInsertionPosition })}
                        />
                    </Field>
                    <Field label={t('lorebookStudio.entryEditor.placement.insertionOrder.label')}>
                        <Input type="number" value={entry.insertionOrder} onChange={(event) => patch({ insertionOrder: Number(event.target.value) })} />
                    </Field>
                    <Field label={t('lorebookStudio.entryEditor.placement.priority.label')}>
                        <Input type="number" value={entry.priority} onChange={(event) => patch({ priority: Number(event.target.value) })} />
                    </Field>
                </div>
            </div>

            <div className="rounded-lg border border-arcane-500/20 bg-arcane-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                <span className="inline-flex items-center gap-2">
                    <Icon icon={Settings2} size={15} className="text-arcane-300" />
                    {t('lorebookStudio.entryEditor.placement.note')}
                </span>
            </div>
        </div>
    )
}
