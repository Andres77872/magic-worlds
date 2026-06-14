/**
 * CastSelector — multi-select list of the user's library characters for the
 * adventure cast. Holds library ids (selection is by id, exactly as the payload
 * expects). Shows a search box when the library is large, a loading row while
 * the library loads, and an EmptyState CTA when the library is empty.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import type { Character } from '@/shared'
import { Icon, Input } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { CastMemberCard, SelectorLoading } from './CastMemberCard'

export interface CastSelectorProps {
    characters: Character[]
    selectedIds: string[]
    onToggle: (id: string) => void
    onCreateCharacter: () => void
    loading: boolean
}

export function CastSelector({ characters, selectedIds, onToggle, onCreateCharacter, loading }: CastSelectorProps) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')

    if (loading) return <SelectorLoading text={t('creation.adventure.scene.loadingCharacters')} />
    if (characters.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={Users} size={32} />}
                message={t('creation.adventure.scene.castEmptyMessage')}
                secondaryText={t('creation.adventure.scene.castEmptySecondary')}
                button={{ label: t('creation.adventure.scene.createCharacter'), onClick: onCreateCharacter }}
            />
        )
    }

    const showSearch = characters.length > 8
    const q = query.trim().toLowerCase()
    const filtered = q
        ? characters.filter((c) => `${c.name} ${c.race ?? ''} ${c.description ?? ''}`.toLowerCase().includes(q))
        : characters

    return (
        <div className="flex flex-col gap-3">
            {showSearch && (
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('creation.adventure.scene.searchCharacters')} />
            )}
            <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
                {filtered.map((c) => (
                    <CastMemberCard
                        key={c.id}
                        name={c.name}
                        race={c.race}
                        description={c.description}
                        mode="check"
                        selected={selectedIds.includes(c.id)}
                        onToggle={() => onToggle(c.id)}
                    />
                ))}
                {filtered.length === 0 && (
                    <p className="px-1 py-3 text-center font-narrative text-sm italic text-parchment-400">
                        {t('creation.adventure.scene.noCharacterMatch', { query })}
                    </p>
                )}
            </div>
        </div>
    )
}
