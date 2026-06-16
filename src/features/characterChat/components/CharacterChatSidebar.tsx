/**
 * Character-chat sidebar. Single chats show one profile; group chats show the
 * frozen AI cast plus the user's persona.
 */

import { ArrowLeft, MessageCircle, Pencil, Phone, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Character } from '../../../shared'
import { resolveMediaUrl } from '../../../infrastructure/api'
import { Avatar, Button, Eyebrow, Icon, Portrait, Tag } from '../../../ui/primitives'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'

interface CharacterChatSidebarProps {
    character?: Character
    characters?: Character[]
    title?: string
    isGroup?: boolean
    persona?: Character
    /** Current engine mode; enables the in-place call/text toggle. */
    mode?: 'text' | 'voice'
    voiceEnabled?: boolean
    onSetMode?: (mode: 'text' | 'voice') => void
    onBack: () => void
    onEditCharacter: (character: Character) => void
}

export function CharacterChatSidebar({ character, characters, title, isGroup = false, persona, mode = 'text', voiceEnabled = false, onSetMode, onBack, onEditCharacter }: CharacterChatSidebarProps) {
    const { t } = useTranslation()
    const cast: Character[] = isGroup ? (characters ?? []) : character ? [character] : []
    const lead = cast[0]
    const heading = title || cast.map((entry) => entry.name).filter(Boolean).join(', ') || t('characterChat.fallbackTitle')

    return (
        <div className="flex h-full flex-col bg-ink-900">
            <div className="flex items-center gap-2 border-b border-parchment-50/10 px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft size={16} />}>
                    {t('common.back')}
                </Button>
                <span className="ml-auto">
                    <ModeBadge mode="chat" />
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Portrait name={heading} src={resolveMediaUrl(lead?.image_url)} height={200}>
                    {isGroup && (
                        <div className="absolute bottom-3 left-3 z-[2] flex items-center gap-2 rounded-full border border-arcane-500/35 bg-ink-900/70 px-3 py-1.5 text-arcane-200 backdrop-blur">
                            <Icon icon={Users} size={14} />
                            <span className="font-ui text-xs font-semibold">{t('characterChat.sidebar.castCount', { count: cast.length })}</span>
                        </div>
                    )}
                </Portrait>

                <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex flex-col gap-1.5">
                        <Eyebrow tone="arcane" className="text-[11px] tracking-[0.16em]">
                            {isGroup ? t('characterChat.sidebar.groupChat') : t('characterChat.sidebar.chattingWith')}
                        </Eyebrow>
                        <h2 className="font-display text-[22px] font-semibold leading-tight text-parchment-50">
                            {heading}
                        </h2>
                        {!isGroup && lead?.race && (
                            <div className="mt-1">
                                <Tag>{lead.race}</Tag>
                            </div>
                        )}
                    </div>

                    {persona && (
                        <div className="rounded-lg border border-ember-500/25 bg-ember-500/10 px-4 py-3">
                            <Eyebrow tone="ember" className="mb-1 text-[10px] tracking-[0.16em]">
                                {t('characterChat.sidebar.youAre')}
                            </Eyebrow>
                            <p className="font-display text-[16px] font-semibold text-parchment-50">{persona.name}</p>
                            {persona.race && <p className="mt-0.5 font-narrative text-xs text-parchment-400">{persona.race}</p>}
                        </div>
                    )}

                    {isGroup ? (
                        <div className="flex flex-col gap-2">
                            {cast.map((member) => (
                                <div key={member.id} className="rounded-lg border border-parchment-50/10 bg-ink-800 px-3 py-3">
                                    <div className="flex items-start gap-3">
                                        <Avatar
                                            name={member.name}
                                            src={resolveMediaUrl(member.image_url)}
                                            size={42}
                                            ring="arcane"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <p className="min-w-0 truncate font-display text-[16px] font-semibold text-parchment-50">{member.name}</p>
                                                {member.race && <Tag>{member.race}</Tag>}
                                            </div>
                                            {member.greeting && (
                                                <p className="mt-1 line-clamp-2 font-narrative text-xs italic leading-snug text-parchment-400">
                                                    “{member.greeting}”
                                                </p>
                                            )}
                                            {member.description && !member.greeting && (
                                                <p className="mt-1 line-clamp-2 font-narrative text-xs leading-snug text-parchment-400">
                                                    {member.description}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditCharacter(member)}
                                            iconLeft={<Pencil size={14} />}
                                            aria-label={t('characterChat.sidebar.editAria', { name: member.name })}
                                        >
                                            {t('common.edit')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : lead?.greeting && (
                        <div className="rounded-lg border border-parchment-50/10 bg-ink-800 px-4 py-3">
                            <Eyebrow tone="ember" className="mb-1 text-[10px] tracking-[0.16em]">
                                {t('characterChat.sidebar.openingLine')}
                            </Eyebrow>
                            <p className="font-narrative text-[15px] italic leading-relaxed text-parchment-200">
                                “{lead.greeting}”
                            </p>
                        </div>
                    )}

                    {!isGroup && lead?.description && (
                        <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">
                            {lead.description}
                        </p>
                    )}
                </div>
            </div>

            {!isGroup && lead && (
                <div className="flex flex-col gap-2 border-t border-parchment-50/10 px-4 py-3">
                    {voiceEnabled && onSetMode && (
                        mode === 'voice' ? (
                            <Button
                                variant="secondary"
                                onClick={() => onSetMode('text')}
                                iconLeft={<Icon icon={MessageCircle} size={15} />}
                                className="w-full"
                            >
                                {t('characterChat.sidebar.switchToText')}
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={() => onSetMode('voice')}
                                iconLeft={<Icon icon={Phone} size={15} />}
                                className="w-full"
                            >
                                {t('characterChat.sidebar.call', { name: lead.name })}
                            </Button>
                        )
                    )}
                    <Button variant="secondary" onClick={() => onEditCharacter(lead)} iconLeft={<Pencil size={15} />} className="w-full">
                        {t('characterChat.sidebar.editCharacter')}
                    </Button>
                </div>
            )}
        </div>
    )
}
