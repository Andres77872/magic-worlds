/**
 * The global preset list (R1-FE-06, 05 §8.12, A5): presets with their voice,
 * language, seed key and the reasons users could not apply them. Every state is
 * text, never colour alone.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import type { AdminGlobalPresetRow } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { globalPresetWarnings } from '../../globalPresetRules'
import { voiceName } from '../../voiceOptions'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface GlobalPresetsTableProps {
    rows: readonly AdminGlobalPresetRow[]
    onEdit: (row: AdminGlobalPresetRow) => void
    onDelete: (row: AdminGlobalPresetRow) => void
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
                        const voice = catalog.byKey.get(row.voice_key)
                        const warnings = globalPresetWarnings(voice, row.voice_public)
                        return (
                            <tr key={row.preset_id}>
                                <th scope="row" className={`${cell} text-left font-normal`}>
                                    <span className="block font-semibold text-parchment-50">{row.name}</span>
                                    {row.description && <span className="block text-caption text-fg-muted">{row.description}</span>}
                                </th>
                                <td className={`${cell} text-parchment-200`}>{voice ? voiceName(voice, row.voice_key, t) : row.voice_name || voiceName(undefined, row.voice_key, t)}</td>
                                <td className={`${cell} text-parchment-200`}>
                                    {row.language_code ? languageName(row.language_code) : t('admin.voices.globalPresets.anyLanguage')}
                                </td>
                                <td className={`${cell} font-mono text-xs text-parchment-300`}>{row.seed_key ?? t('admin.voices.common.none')}</td>
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
                                            aria-label={t('admin.voices.globalPresets.editNamed', { name: row.name })}
                                            onClick={() => onEdit(row)}
                                        >
                                            {t('admin.voices.globalPresets.edit')}
                                        </Button>
                                        <Button
                                            variant="danger-ghost"
                                            size="sm"
                                            iconLeft={<Icon icon={Trash2} size={14} />}
                                            aria-label={t('admin.voices.globalPresets.deleteNamed', { name: row.name })}
                                            onClick={() => onDelete(row)}
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
