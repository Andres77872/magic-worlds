/**
 * "What the assistant knows" — the source switches and the focus shelf.
 *
 * Arcane throughout: this panel describes the AI side (what reaches the model),
 * not the user's own work. Counts come from the composed sections so a toggle
 * always says exactly what it adds; the meter is the shared word-based token
 * estimate, labelled as approximate.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Crosshair, Plus, X } from 'lucide-react'
import { Badge, Button, Eyebrow, Icon, IconButton, Switch, cx } from '@/ui/primitives'
import type { FocusRef, KnowledgeSection, KnowledgeSourceKey } from '../appKnowledge'
import { FOCUS_ICONS, SOURCE_ICONS, type FocusChip } from './knowledgeIcons'

export interface AssistantKnowledgePanelProps {
    /** Sources the user can toggle (feature-gated ones are already removed). */
    sources: readonly KnowledgeSourceKey[]
    sections: readonly KnowledgeSection[]
    enabled: ReadonlySet<KnowledgeSourceKey>
    onToggle: (key: KnowledgeSourceKey, enabled: boolean) => void
    focus: readonly FocusChip[]
    focusLimit: number
    onAddFocus: () => void
    onRemoveFocus: (ref: FocusRef) => void
    tokens: number
    truncated: boolean
    /** True while library lists (resources) are still loading. */
    loading?: boolean
    disabled?: boolean
}

export function AssistantKnowledgePanel({
    sources,
    sections,
    enabled,
    onToggle,
    focus,
    focusLimit,
    onAddFocus,
    onRemoveFocus,
    tokens,
    truncated,
    loading = false,
    disabled = false,
}: AssistantKnowledgePanelProps) {
    const { t, i18n } = useTranslation()
    const byKey = new Map(sections.map((section) => [section.key, section]))
    const headingId = useId()

    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-arcane-500/25 bg-arcane-500/[.07] p-3" data-testid="assistant-context-meter">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-ui text-label font-semibold text-parchment-100">{t('appAssistant.knowledge.meterTitle')}</span>
                    <span className="font-mono text-caption text-arcane-300">{t('appAssistant.knowledge.tokens', { count: tokens, formatted: tokens.toLocaleString(i18n.language) })}</span>
                </div>
                <p className="mt-1 font-ui text-caption leading-relaxed text-parchment-300">
                    {t('appAssistant.knowledge.meterHint')}
                </p>
                {truncated && (
                    <Badge tone="arcane" className="mt-2">{t('appAssistant.knowledge.partial')}</Badge>
                )}
            </div>

            <section aria-labelledby={`${headingId}-sources`} className="flex flex-col gap-1.5">
                <Eyebrow tone="arcane" id={`${headingId}-sources`} className="px-1">{t('appAssistant.knowledge.sourcesTitle')}</Eyebrow>
                <ul className="flex flex-col">
                    {sources.map((key) => {
                        const section = byKey.get(key)
                        const on = enabled.has(key)
                        const count = section?.count ?? 0
                        return (
                            <li key={key} className="flex items-center gap-3 border-b border-parchment-50/[.06] py-2.5 last:border-b-0">
                                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md', on ? 'bg-arcane-500/15 text-arcane-300' : 'bg-ink-600 text-parchment-400')}>
                                    <Icon icon={SOURCE_ICONS[key]} size={16} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-ui text-label font-semibold text-parchment-100">{t(`appAssistant.sources.${key}.label`)}</span>
                                    <span className="block truncate font-ui text-caption text-parchment-400">
                                        {loading && key === 'resources' ? t('appAssistant.knowledge.loading') : t(`appAssistant.sources.${key}.count`, { count })}
                                    </span>
                                </span>
                                <Switch
                                    checked={on}
                                    onChange={(next) => onToggle(key, next)}
                                    disabled={disabled}
                                    size="sm"
                                    aria-label={t('appAssistant.knowledge.toggle', { source: t(`appAssistant.sources.${key}.label`) })}
                                />
                            </li>
                        )
                    })}
                </ul>
            </section>

            <section aria-labelledby={`${headingId}-focus`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 px-1">
                    <Eyebrow tone="arcane" id={`${headingId}-focus`}>{t('appAssistant.focus.title')}</Eyebrow>
                    <span className="font-mono text-caption text-parchment-400">{focus.length}/{focusLimit}</span>
                </div>
                <p className="px-1 font-ui text-caption leading-relaxed text-parchment-300">{t('appAssistant.focus.hint')}</p>
                {focus.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                        {focus.map((chip) => (
                            <li key={`${chip.kind}:${chip.id}`} className="flex items-center gap-2 rounded-md border border-arcane-500/25 bg-ink-700 py-1 pl-2.5 pr-1">
                                <Icon icon={FOCUS_ICONS[chip.kind]} size={14} className="shrink-0 text-arcane-300" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-ui text-label text-parchment-100">{chip.name}</span>
                                    <span className="block font-ui text-micro uppercase tracking-wider text-parchment-500">{t(`appAssistant.focusKinds.${chip.kind}`)}</span>
                                </span>
                                <IconButton label={t('appAssistant.focus.remove', { name: chip.name })} size="sm" disabled={disabled} onClick={() => onRemoveFocus(chip)}>
                                    <X size={14} />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                )}
                <Button
                    variant="arcane"
                    size="sm"
                    disabled={disabled || focus.length >= focusLimit}
                    iconLeft={<Icon icon={focus.length ? Plus : Crosshair} size={15} />}
                    onClick={onAddFocus}
                >
                    {t('appAssistant.focus.add')}
                </Button>
            </section>

            <p className="px-1 font-ui text-caption leading-relaxed text-parchment-400">{t('appAssistant.knowledge.privacy')}</p>
        </div>
    )
}
