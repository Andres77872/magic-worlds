import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeOff, KeyRound, Route, ScrollText, Settings2, SlidersHorizontal } from 'lucide-react'
import type { LorebookEntry, LorebookEntryType, LorebookInsertionPosition, LorebookSelectiveLogic } from '@/shared'
import { Button, Callout, Field, Icon, Input, Select, SwitchRow, Textarea, type SelectOption } from '@/ui/primitives'
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
            <div className="flex min-h-64 flex-col items-center justify-center px-4 py-8 text-center">
                <Icon icon={ScrollText} size={34} className="text-arcane-300" />
                <p className="mt-3 font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.entryEditor.empty.title')}</p>
                <p className="mt-1 max-w-[34ch] font-narrative text-sm text-parchment-300">
                    {t('lorebookStudio.entryEditor.empty.description')}
                </p>
            </div>
        )
    }

    const patch = (changes: Partial<LorebookEntry>) => onChange({ ...entry, ...changes })

    return (
        <section aria-label={entry.title || t('lorebookStudio.entryEditor.untitled')} className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 font-ui text-caption text-parchment-400">
                        <Icon icon={SlidersHorizontal} size={13} />
                        {t('lorebookStudio.entryEditor.estimatedTokens', { count: estimateTokens(entry.content) })}
                    </div>
                    <h3 className="mt-2 break-words font-display text-h3 font-semibold text-parchment-50">
                        {entry.title || t('lorebookStudio.entryEditor.untitled')}
                    </h3>
                </div>
                {onDelete && (
                    <Button variant="danger-ghost" size="sm" onClick={() => onDelete(entry.id)}>
                        {t('common.delete')}
                    </Button>
                )}
            </div>

            <div className="grid gap-4">
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

            <section className="border-t border-parchment-50/10 pt-5">
                <h4 className="mb-4 flex items-center gap-2 font-ui text-body font-semibold text-parchment-50">
                    <Icon icon={KeyRound} size={16} className="text-arcane-300" />
                    {t('lorebookStudio.entryEditor.activation.heading')}
                </h4>
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
                    <div className="divide-y divide-parchment-50/10">
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.enabled.label')} description={t('lorebookStudio.entryEditor.switches.enabled.description')} checked={entry.enabled} onChange={(enabled) => patch({ enabled })} />
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.constant.label')} description={t('lorebookStudio.entryEditor.switches.constant.description')} checked={entry.constant} onChange={(constant) => patch({ constant })} />
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.wholeWords.label')} description={t('lorebookStudio.entryEditor.switches.wholeWords.description')} checked={entry.matchWholeWords} onChange={(matchWholeWords) => patch({ matchWholeWords })} />
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.caseSensitive.label')} description={t('lorebookStudio.entryEditor.switches.caseSensitive.description')} checked={entry.caseSensitive} onChange={(caseSensitive) => patch({ caseSensitive })} />
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.regex.label')} description={t('lorebookStudio.entryEditor.switches.regex.description')} checked={entry.regex} onChange={(regex) => patch({ regex })} />
                        <SwitchRow variant="plain" label={t('lorebookStudio.entryEditor.switches.secret.label')} description={t('lorebookStudio.entryEditor.switches.secret.description')} checked={entry.isSecret} onChange={(isSecret) => patch({ isSecret })} />
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
            </section>

            <section className="border-t border-parchment-50/10 pt-5">
                <h4 className="mb-4 flex items-center gap-2 font-ui text-body font-semibold text-parchment-50">
                    <Icon icon={Route} size={16} className="text-arcane-300" />
                    {t('lorebookStudio.entryEditor.placement.heading')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('lorebookStudio.entryEditor.placement.position.label')} className="col-span-2">
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
            </section>

            <Callout tone="info" icon={<Icon icon={Settings2} size={15} />}>
                {t('lorebookStudio.entryEditor.placement.note')}
            </Callout>
        </section>
    )
}
