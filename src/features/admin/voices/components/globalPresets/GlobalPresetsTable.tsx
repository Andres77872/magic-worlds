/**
 * The global preset list (R1-FE-06, 05 §8.12, A5): V2 presets with their voice,
 * language, seed key and the reasons users could not apply them; stored V1
 * (legacy) rows are labelled Legacy, are hidden from users and offer no action
 * (read-only, D22). Every state is text, never colour alone.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import type { AdminGlobalPresetRow } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { globalPresetWarnings, isEditableGlobalPreset, type GlobalPresetV2Row } from '../../globalPresetRules'
import { voiceName } from '../../voiceOptions'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface GlobalPresetsTableProps {
    rows: readonly AdminGlobalPresetRow[]
    onEdit: (row: GlobalPresetV2Row) => void
    onDelete: (row: GlobalPresetV2Row) => void
}

const cell = 'border-b border-line-faint py-2.5 pr-3 align-top'
const COLUMNS = ['name', 'voice', 'language', 'seedKey', 'status', 'actions'] as const

export function GlobalPresetsTable({ rows, onEdit, onDelete }: GlobalPresetsTableProps) {
    const { t } = useTranslation()
    const { catalog, languageName } = useVoiceConsole()

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse font-ui text-sm">
                <caption className="sr-only">{t('admin.voices.globalPresets.columns.caption')}</caption>
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                        {COLUMNS.map((column) => (
                            <th key={column} scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">
                                {t(`admin.voices.globalPresets.columns.${column}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        if (!isEditableGlobalPreset(row)) {
                            return (
                                <tr key={row.preset_id} data-testid="global-preset-legacy-row">
                                    <th scope="row" className={`${cell} text-left font-normal`}>
                                        <span className="block font-semibold text-parchment-50">{row.name}</span>
                                        {row.description && <span className="block text-caption text-fg-muted">{row.description}</span>}
                                    </th>
                                    <td className={`${cell} text-parchment-200`}>{row.base_voice_name ?? row.base_voice_id}</td>
                                    <td className={`${cell} text-parchment-300`}>—</td>
                                    <td className={`${cell} font-mono text-xs text-parchment-300`}>{row.seed_key ?? t('admin.voices.common.none')}</td>
                                    <td className={cell}>
                                        <span className="flex flex-wrap gap-1">
                                            <Badge tone="neutral">{t('admin.voices.globalPresets.legacy')}</Badge>
                                            {row.legacy_hidden && <Badge tone="warning">{t('admin.voices.globalPresets.hiddenForUsers')}</Badge>}
                                        </span>
                                    </td>
                                    <td className={`${cell} max-w-[220px] text-caption text-fg-muted`}>{t('admin.voices.globalPresets.legacyHint')}</td>
                                </tr>
                            )
                        }
                        const v2Row = row
                        const voice = catalog.byKey.get(v2Row.voice_key)
                        const warnings = globalPresetWarnings(voice, v2Row.voice_public)
                        return (
                            <tr key={v2Row.preset_id}>
                                <th scope="row" className={`${cell} text-left font-normal`}>
                                    <span className="block font-semibold text-parchment-50">{v2Row.name}</span>
                                    {v2Row.description && <span className="block text-caption text-fg-muted">{v2Row.description}</span>}
                                </th>
                                <td className={`${cell} text-parchment-200`}>{voice ? voiceName(voice, v2Row.voice_key, t) : v2Row.voice_name || voiceName(undefined, v2Row.voice_key, t)}</td>
                                <td className={`${cell} text-parchment-200`}>
                                    {v2Row.language_code ? languageName(v2Row.language_code) : t('admin.voices.globalPresets.anyLanguage')}
                                </td>
                                <td className={`${cell} font-mono text-xs text-parchment-300`}>{v2Row.seed_key ?? t('admin.voices.common.none')}</td>
                                <td className={cell}>
                                    <span className="flex flex-wrap gap-1">
                                        {warnings.includes('notPublic') && <Badge tone="warning">{t('admin.voices.globalPresets.notPublic')}</Badge>}
                                        {voice && voice.status !== 'active' && <Badge tone="warning">{t(`admin.voices.status.${voice.status}`)}</Badge>}
                                        {voice && warnings.length === 0 && <Badge tone="live">{t('admin.voices.status.active')}</Badge>}
                                    </span>
                                </td>
                                <td className={cell}>
                                    <span className="flex flex-wrap gap-1.5">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            iconLeft={<Icon icon={Pencil} size={14} />}
                                            aria-label={t('admin.voices.globalPresets.editNamed', { name: v2Row.name })}
                                            onClick={() => onEdit(v2Row)}
                                        >
                                            {t('admin.voices.globalPresets.edit')}
                                        </Button>
                                        <Button
                                            variant="danger-ghost"
                                            size="sm"
                                            iconLeft={<Icon icon={Trash2} size={14} />}
                                            aria-label={t('admin.voices.globalPresets.deleteNamed', { name: v2Row.name })}
                                            onClick={() => onDelete(v2Row)}
                                        >
                                            {t('admin.voices.globalPresets.delete')}
                                        </Button>
                                    </span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
