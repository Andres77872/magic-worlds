/**
 * WorldSelector — single-select world list (optional). A leading "None" row
 * keeps the setting freeform. Selection is by library id.
 */

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
    if (loading) return <SelectorLoading text="Loading your worlds…" />
    if (worlds.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={Globe} size={32} />}
                message="No worlds in your library yet"
                secondaryText="Create a world to ground this adventure in a setting — or leave it freeform."
                button={{ label: 'Create a World', onClick: onCreateWorld }}
            />
        )
    }

    return (
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            <NoneOption label="No world — freeform setting" selected={!selectedId} onSelect={() => onSelect(undefined)} />
            {worlds.map((w) => (
                <CastMemberCard
                    key={w.id}
                    name={w.name}
                    race={w.type}
                    description={w.description}
                    mode="radio"
                    selected={selectedId === w.id}
                    onToggle={() => onSelect(w.id)}
                />
            ))}
        </div>
    )
}
