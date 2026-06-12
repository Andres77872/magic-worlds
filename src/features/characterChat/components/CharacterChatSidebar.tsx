/**
 * Single-character sidebar for the 1:1 chat screen. Read-only in v1 — editing a
 * character's persona/greeting lives in the creator (one click via "Edit character"),
 * so a chat doesn't need the adventure left panel's snapshot-card machinery.
 */

import { ArrowLeft, Pencil } from 'lucide-react'
import type { Character } from '../../../shared'
import { resolveMediaUrl } from '../../../infrastructure/api'
import { Button, Eyebrow, Portrait, Tag } from '../../../ui/primitives'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'

interface CharacterChatSidebarProps {
    character: Character
    persona?: Character
    onBack: () => void
    onEdit: () => void
}

export function CharacterChatSidebar({ character, persona, onBack, onEdit }: CharacterChatSidebarProps) {
    return (
        <div className="flex h-full flex-col bg-ink-900">
            <div className="flex items-center gap-2 border-b border-parchment-50/10 px-4 py-3">
                <Button kind="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft size={16} />}>
                    Back
                </Button>
                <span className="ml-auto">
                    <ModeBadge mode="chat" />
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Portrait name={character.name} src={resolveMediaUrl(character.image_url)} height={200} />

                <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex flex-col gap-1.5">
                        <Eyebrow tone="arcane" className="text-[11px] tracking-[0.16em]">
                            Chatting with
                        </Eyebrow>
                        <h2 className="font-display text-[22px] font-semibold leading-tight text-parchment-50">
                            {character.name}
                        </h2>
                        {character.race && (
                            <div className="mt-1">
                                <Tag>{character.race}</Tag>
                            </div>
                        )}
                    </div>

                    {persona && (
                        <div className="rounded-lg border border-ember-500/25 bg-ember-500/10 px-4 py-3">
                            <Eyebrow tone="ember" className="mb-1 text-[10px] tracking-[0.16em]">
                                You are
                            </Eyebrow>
                            <p className="font-display text-[16px] font-semibold text-parchment-50">{persona.name}</p>
                            {persona.race && <p className="mt-0.5 font-narrative text-xs text-parchment-400">{persona.race}</p>}
                        </div>
                    )}

                    {character.greeting && (
                        <div className="rounded-lg border border-parchment-50/10 bg-ink-800 px-4 py-3">
                            <Eyebrow tone="ember" className="mb-1 text-[10px] tracking-[0.16em]">
                                Opening line
                            </Eyebrow>
                            <p className="font-narrative text-[15px] italic leading-relaxed text-parchment-200">
                                “{character.greeting}”
                            </p>
                        </div>
                    )}

                    {character.description && (
                        <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">
                            {character.description}
                        </p>
                    )}
                </div>
            </div>

            <div className="border-t border-parchment-50/10 px-4 py-3">
                <Button kind="secondary" onClick={onEdit} iconLeft={<Pencil size={15} />} className="w-full">
                    Edit character
                </Button>
            </div>
        </div>
    )
}
