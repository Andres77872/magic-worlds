/**
 * PersonaSelector — single-select "Play as…" list. Optional: a leading "None"
 * row leaves the player as an observer. The chosen character is marked "You".
 */

import { UserCircle } from 'lucide-react'
import type { Character } from '@/shared'
import { Badge, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { CastMemberCard, NoneOption, SelectorLoading } from './CastMemberCard'

export interface PersonaSelectorProps {
    characters: Character[]
    selectedId?: string
    onSelect: (id: string | undefined) => void
    onCreateCharacter: () => void
    loading: boolean
}

export function PersonaSelector({ characters, selectedId, onSelect, onCreateCharacter, loading }: PersonaSelectorProps) {
    if (loading) return <SelectorLoading text="Loading your characters…" />
    if (characters.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={UserCircle} size={32} />}
                message="No characters to play as"
                secondaryText="Create a character to step into the story as your own persona."
                button={{ label: 'Create a Character', onClick: onCreateCharacter }}
            />
        )
    }

    return (
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            <NoneOption label="No persona — observe the story" selected={!selectedId} onSelect={() => onSelect(undefined)} />
            {characters.map((c) => (
                <CastMemberCard
                    key={c.id}
                    name={c.name}
                    race={c.race}
                    description={c.description}
                    mode="radio"
                    selected={selectedId === c.id}
                    onToggle={() => onSelect(c.id)}
                    badge={selectedId === c.id ? <Badge tone="ember">You</Badge> : undefined}
                />
            ))}
        </div>
    )
}
