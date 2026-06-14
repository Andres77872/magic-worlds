/**
 * PersonaSelector — single-select "Play as…" list. Optional: a leading "None"
 * row leaves the player as an observer. The chosen character is marked "You".
 */

import { useTranslation } from 'react-i18next'
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
    const { t } = useTranslation()
    if (loading) return <SelectorLoading text={t('creation.adventure.scene.loadingCharacters')} />
    if (characters.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={UserCircle} size={32} />}
                message={t('creation.adventure.scene.personaEmptyMessage')}
                secondaryText={t('creation.adventure.scene.personaEmptySecondary')}
                button={{ label: t('creation.adventure.scene.createCharacter'), onClick: onCreateCharacter }}
            />
        )
    }

    return (
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            <NoneOption label={t('creation.adventure.scene.noPersona')} selected={!selectedId} onSelect={() => onSelect(undefined)} />
            {characters.map((c) => (
                <CastMemberCard
                    key={c.id}
                    name={c.name}
                    race={c.race}
                    description={c.description}
                    mode="radio"
                    selected={selectedId === c.id}
                    onToggle={() => onSelect(c.id)}
                    badge={selectedId === c.id ? <Badge tone="ember">{t('creation.adventure.scene.you')}</Badge> : undefined}
                />
            ))}
        </div>
    )
}
