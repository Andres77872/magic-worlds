import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Loader2, UserCircle } from 'lucide-react'
import type { Character } from '@/shared'
import { resolveMediaUrl } from '@/infrastructure/api'
import { characterRole, defaultPersona, personaCandidates } from '@/utils/characterRoles'
import { Avatar, Badge, Button, Callout, Icon, Modal, Tag, cx } from '@/ui/primitives'
import { EmptyState } from './common/EmptyState'

interface PersonaPickerDialogProps {
    open: boolean
    title: string
    actionLabel: string
    description?: string
    error?: string | null
    isConfirming?: boolean
    characters: Character[]
    onConfirm: (persona: Character) => void | Promise<void>
    onClose: () => void
    onCreateCharacter?: () => void
}

export function PersonaPickerDialog({
    open,
    title,
    actionLabel,
    description,
    error,
    isConfirming = false,
    characters,
    onConfirm,
    onClose,
    onCreateCharacter,
}: PersonaPickerDialogProps) {
    const { t } = useTranslation()
    const candidates = useMemo(() => personaCandidates(characters), [characters])
    const preferred = useMemo(() => defaultPersona(characters) ?? candidates[0], [characters, candidates])
    const [selectedId, setSelectedId] = useState<string | undefined>(preferred?.id)

    useEffect(() => {
        if (open) setSelectedId(preferred?.id)
    }, [open, preferred?.id])

    const selected = candidates.find((candidate) => candidate.id === selectedId)

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            icon={<Icon icon={UserCircle} size={20} className="text-ember-300" />}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" disabled={isConfirming} onClick={onClose}>{t('common.cancel')}</Button>
                    <Button
                        variant="primary"
                        disabled={!selected || isConfirming}
                        iconLeft={isConfirming ? <Loader2 size={15} className="animate-spin" /> : undefined}
                        onClick={() => selected && onConfirm(selected)}
                    >
                        {isConfirming ? t('ui.personaPicker.starting') : actionLabel}
                    </Button>
                </>
            }
        >
            {(description || error) && (
                <div className="mb-4 flex flex-col gap-2">
                    {description && (
                        <p className="font-narrative text-sm leading-relaxed text-parchment-300">{description}</p>
                    )}
                    {error && (
                        <Callout tone="danger" role="alert">
                            {error}
                        </Callout>
                    )}
                </div>
            )}
            {candidates.length === 0 ? (
                <EmptyState
                    icon={<Icon icon={UserCircle} size={32} />}
                    message={t('ui.personaPicker.noPersonas')}
                    secondaryText={t('ui.personaPicker.noPersonasHint')}
                    button={
                        onCreateCharacter
                            ? { label: t('ui.personaPicker.createCharacter'), onClick: onCreateCharacter }
                            : undefined
                    }
                />
            ) : (
                <div className="flex flex-col divide-y divide-line-faint">
                    {candidates.map((character) => {
                        const selectedRow = character.id === selectedId
                        const role = characterRole(character)
                        return (
                            <button
                                key={character.id}
                                type="button"
                                aria-pressed={selectedRow}
                                disabled={isConfirming}
                                onClick={() => setSelectedId(character.id)}
                                className={cx(
                                    'flex w-full items-start gap-3 rounded-md px-2 py-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-70',
                                    selectedRow
                                        ? 'bg-ember-500/10'
                                        : 'hover:bg-parchment-50/[.04]',
                                )}
                            >
                                <Avatar
                                    name={character.name}
                                    src={resolveMediaUrl(character.image_url)}
                                    size={42}
                                    ring="none"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-display text-body font-semibold text-parchment-50">
                                            {character.name || t('ui.personaPicker.untitled')}
                                        </span>
                                        <Tag>{role === 'persona' ? t('ui.personaPicker.persona') : t('ui.personaPicker.character')}</Tag>
                                        {character.is_default_persona && <Badge tone="ember">{t('ui.personaPicker.default')}</Badge>}
                                    </span>
                                    {character.description && (
                                        <span className="mt-1 line-clamp-2 block font-ui text-label leading-relaxed text-parchment-300">
                                            {character.description}
                                        </span>
                                    )}
                                </span>
                                <Icon
                                    icon={selectedRow ? CheckCircle2 : Circle}
                                    size={18}
                                    className={selectedRow ? 'mt-0.5 text-ember-400' : 'mt-0.5 text-parchment-400'}
                                />
                            </button>
                        )
                    })}
                </div>
            )}
        </Modal>
    )
}
