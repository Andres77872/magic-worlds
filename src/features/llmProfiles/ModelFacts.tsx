/**
 * Catalog model facts for the profile editor and read-only summary: display
 * name, provider, context window, max output and capability chips.
 */
import { useTranslation } from 'react-i18next'
import type { LlmCatalogModel } from '@/shared/types/llmProfile.types'
import { Badge, Tag } from '@/ui/primitives'
import { capabilityLabel, formatTokens } from './llmProfileModel'

export function ModelFacts({ model, fallbackKey, compact = false }: { model: LlmCatalogModel | undefined; fallbackKey?: string; compact?: boolean }) {
    const { t, i18n } = useTranslation()
    if (!model) {
        return fallbackKey ? <p className="font-mono text-caption text-parchment-300 break-all">{fallbackKey}</p> : null
    }
    const locale = i18n.resolvedLanguage
    return <div className="flex min-w-0 flex-col gap-2">
        {!compact && <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-ui text-sm font-semibold text-parchment-50">{model.display_name}</span>
            <span className="font-mono text-meta text-parchment-400 break-all">{model.provider_target_key}</span>
        </div>}
        <div className="flex flex-wrap gap-1.5">
            <Tag>{t('llmProfiles.editor.context', { value: formatTokens(model.context_window, locale) })}</Tag>
            <Tag>{t('llmProfiles.editor.output', { value: formatTokens(model.max_output_tokens, locale) })}</Tag>
            {model.capabilities.filter(capability => capability !== 'chat').map(capability =>
                <Badge key={capability} tone="arcane">{capabilityLabel(capability, t)}</Badge>)}
        </div>
        {model.status === 'deprecated' && <p className="font-ui text-caption text-amber-500">{t('llmProfiles.editor.deprecated')}</p>}
    </div>
}
