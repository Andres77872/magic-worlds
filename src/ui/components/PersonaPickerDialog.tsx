import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, Loader2, UserCircle } from 'lucide-react'
import type { Character } from '@/shared'
import { resolveMediaUrl } from '@/infrastructure/api'
import { characterRole, defaultPersona, personaCandidates } from '@/utils/characterRoles'
import { Avatar, Badge, Button, Icon, Modal, Tag, cx } from '@/ui/primitives'
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
                    <Button kind="ghost" disabled={isConfirming} onClick={onClose}>Cancel</Button>
                    <Button
                        kind="primary"
                        disabled={!selected || isConfirming}
                        iconLeft={isConfirming ? <Loader2 size={15} className="animate-spin" /> : undefined}
                        onClick={() => selected && onConfirm(selected)}
                    >
                        {isConfirming ? 'Starting...' : actionLabel}
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
                        <div
                            role="alert"
                            className="rounded-md border border-blood-500/30 bg-blood-500/10 px-3 py-2 font-ui text-xs leading-relaxed text-blood-500"
                        >
                            {error}
                        </div>
                    )}
                </div>
            )}
            {candidates.length === 0 ? (
                <EmptyState
                    icon={<Icon icon={UserCircle} size={32} />}
                    message="No persona cards available"
                    secondaryText="Create a character or persona before starting."
                    button={onCreateCharacter ? { label: 'Create Character', onClick: onCreateCharacter } : undefined}
                />
            ) : (
                <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
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
                                    'flex w-full items-start gap-3 rounded-lg border bg-ink-800 p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-70',
                                    selectedRow
                                        ? 'border-ember-500/70 ring-1 ring-ember-500/40'
                                        : 'border-parchment-50/10 hover:border-ember-500/45',
                                )}
                            >
                                <Avatar
                                    name={character.name}
                                    src={resolveMediaUrl(character.image_url)}
                                    size={42}
                                    ring={role === 'persona' ? 'ember' : 'arcane'}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-display text-[15px] font-semibold text-parchment-50">
                                            {character.name || 'Untitled'}
                                        </span>
                                        <Tag>{role === 'persona' ? 'Persona' : 'Character'}</Tag>
                                        {character.is_default_persona && <Badge tone="ember">Default</Badge>}
                                    </span>
                                    {character.description && (
                                        <span className="mt-1 line-clamp-2 block font-narrative text-xs leading-snug text-parchment-400">
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
