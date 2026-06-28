/**
 * WorldSelector — single-select world list (optional). A leading "None" row
 * keeps the setting freeform. Selection is by library id.
 */

import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import type { World } from '@/shared'
import { Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { CastMemberCard, NoneOption, SelectorLoading } from './CastMemberCard'

export interface WorldSelectorProps {
    worlds: World[]
    selectedId?: string
    onSelect: (id: string | undefined) => void
    onCreateWorld: () => void
    loading: boolean
}

export function WorldSelector({ worlds, selectedId, onSelect, onCreateWorld, loading }: WorldSelectorProps) {
    const { t } = useTranslation()
    if (loading) return <SelectorLoading text={t('creation.adventure.scene.loadingWorlds')} />
    if (worlds.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={Globe} size={32} />}
                message={t('creation.adventure.scene.worldEmptyMessage')}
                secondaryText={t('creation.adventure.scene.worldEmptySecondary')}
                button={{ label: t('creation.adventure.scene.createWorld'), onClick: onCreateWorld }}
            />
        )
    }

    return (
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            <NoneOption label={t('creation.adventure.scene.noWorld')} selected={!selectedId} onSelect={() => onSelect(undefined)} />
            {worlds.map((w) => (
                <CastMemberCard
                    key={w.id}
                    name={w.name}
                    race={[w.place_type, w.type].filter(Boolean).join(' / ')}
                    description={w.description}
                    selected={selectedId === w.id}
                    onToggle={() => onSelect(w.id)}
                />
            ))}
        </div>
    )
}
