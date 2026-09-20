import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Loader2, MessageCircle, UserCircle } from 'lucide-react'
import type { Character } from '@/shared'
import { resolveMediaUrl } from '@/infrastructure/api'
import { defaultPersonaForCharacter, isAiCharacterCard, isPersonaCard, personaCandidates } from '@/utils/characterRoles'
import { Avatar, Badge, Button, Field, Icon, Input, Modal, Tag, cx } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'

interface NewCharacterChatDialogProps {
    characters: Character[]
    loading?: boolean
    loadError?: string | null
    onRetry: () => void
    onStart: (character: Character, persona: Character) => Promise<unknown>
    onClose: () => void
    onBrowseCharacters: () => void
}

/** Mounted for each new chat so a canceled selection never leaks into the next one. */
export function NewCharacterChatDialog({
    characters,
    loading = false,
    loadError,
    onRetry,
    onStart,
    onClose,
    onBrowseCharacters,
}: NewCharacterChatDialogProps) {
    const { t } = useTranslation()
    const [step, setStep] = useState<'character' | 'persona'>('character')
    const [characterQuery, setCharacterQuery] = useState('')
    const [personaQuery, setPersonaQuery] = useState('')
    const [characterId, setCharacterId] = useState<string>()
    const [personaId, setPersonaId] = useState<string>()
    const [starting, setStarting] = useState(false)
    const [startError, setStartError] = useState(false)
    const startingRef = useRef(false)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const headingId = useId()
    const aiCharacters = useMemo(() => characters.filter(isAiCharacterCard), [characters])
    const personas = useMemo(() => personaCandidates(characters), [characters])
    const selectedCharacter = aiCharacters.find((character) => character.id === characterId)
    const selectedPersona = personas.find((persona) => persona.id === personaId)
    const preferredPersona = selectedCharacter && defaultPersonaForCharacter(selectedCharacter, characters)
    const choosingCharacter = step === 'character'
    const query = choosingCharacter ? characterQuery : personaQuery
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const candidates = choosingCharacter ? aiCharacters : personas
    const visibleCandidates = candidates.filter((character) =>
        [character.name, character.race, character.class, character.description]
            .filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery),
    )
    const available = !loading && !loadError

    // Announce the changed step and put keyboard users before its search/choices.
    useEffect(() => {
        if (available) headingRef.current?.focus()
    }, [step, available])

    const close = () => {
        if (!startingRef.current) onClose()
    }

    const choosePersona = () => {
        if (!selectedCharacter || !available || startingRef.current) return
        // Keep an explicitly chosen persona when reviewing the same character.
        setPersonaId((current) => current ?? preferredPersona?.id ?? personas[0]?.id)
        setStartError(false)
        setStep('persona')
    }

    const startChat = async () => {
        if (startingRef.current || !available || !selectedCharacter || !selectedPersona) return
        startingRef.current = true
        setStarting(true)
        setStartError(false)
        try {
            await onStart(selectedCharacter, selectedPersona)
        } catch {
            setStartError(true)
        } finally {
            startingRef.current = false
            setStarting(false)
        }
    }

    return (
        <Modal
            open
            onClose={close}
            showClose={!starting}
            title={t('characterChat.newChat.title')}
            icon={<Icon icon={MessageCircle} size={20} className="text-ember-300" />}
            size="lg"
            footer={
                <div className="flex w-full flex-col gap-3">
                    {startError && <p role="alert" className="rounded-md border border-blood-500/30 bg-blood-500/10 p-3 text-label text-blood-300">{t('characterChat.newChat.startFailed')}</p>}
                    {starting && <p role="status" className="text-label text-parchment-300">{t('characterChat.newChat.starting')}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" disabled={starting} onClick={close}>{t('common.cancel')}</Button>
                        {!choosingCharacter && (
                            <Button
                                variant="secondary"
                                disabled={starting}
                                onClick={() => {
                                    if (startingRef.current) return
                                    setStartError(false)
                                    setStep('character')
                                }}
                            >
                                {t('characterChat.newChat.back')}
                            </Button>
                        )}
                        {choosingCharacter ? (
                            <Button disabled={!available || !selectedCharacter} onClick={choosePersona}>
                                {t('characterChat.newChat.continue')}
                            </Button>
                        ) : (
                            <Button
                                disabled={!available || !selectedCharacter || !selectedPersona || starting}
                                iconLeft={starting ? <Icon icon={Loader2} size={16} className="animate-spin" /> : undefined}
                                onClick={() => { void startChat() }}
                            >
                                {starting ? t('characterChat.newChat.starting') : t('characterChat.newChat.start')}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4" aria-busy={loading || starting}>
                <div className="flex flex-col gap-1">
                    <p className="text-caption text-parchment-300">
                        {t('characterChat.newChat.step', { step: choosingCharacter ? 1 : 2 })}
                    </p>
                    <h3 ref={headingRef} id={headingId} tabIndex={-1} className="font-display text-h3 text-parchment-50">
                        {t(choosingCharacter ? 'characterChat.newChat.chooseCharacter' : 'characterChat.newChat.choosePersona')}
                    </h3>
                    <p className="text-label text-parchment-300">{t('characterChat.newChat.separateConversation')}</p>
                </div>
                {loading ? (
                    <div role="status" className="flex items-center justify-center gap-2 py-6 text-parchment-300">
                        <Icon icon={Loader2} size={18} className="animate-spin" />
                        {t('characterChat.newChat.loading')}
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col gap-3">
                        <p role="alert" className="text-body text-blood-300">{t('characterChat.newChat.loadFailed')}</p>
                        <Button variant="secondary" onClick={onRetry}>{t('characterChat.newChat.retry')}</Button>
                        <Button variant="ghost" onClick={onBrowseCharacters}>{t('characterChat.newChat.browse')}</Button>
                    </div>
                ) : aiCharacters.length === 0 ? (
                    <EmptyState
                        icon={<Icon icon={UserCircle} size={32} />}
                        message={t('characterChat.newChat.empty')}
                        secondaryText={t('characterChat.newChat.emptyHint')}
                        button={{ label: t('characterChat.newChat.browse'), onClick: onBrowseCharacters }}
                    />
                ) : (
                    <>
                        {!choosingCharacter && selectedCharacter && (
                            <div className="flex items-center gap-3 border-l-2 border-arcane-500/30 py-2 pl-3">
                                <Avatar name={selectedCharacter.name} src={resolveMediaUrl(selectedCharacter.image_url)} size={40} ring="none" />
                                <div className="min-w-0">
                                    <p className="text-caption text-arcane-300">{t('characterChat.newChat.chattingWith')}</p>
                                    <p className="break-words font-display text-body font-semibold text-parchment-50">{selectedCharacter.name}</p>
                                </div>
                            </div>
                        )}
                        <Field
                            label={t(choosingCharacter ? 'characterChat.newChat.searchCharacters' : 'characterChat.newChat.searchPersonas')}
                            helper={!choosingCharacter ? t('characterChat.newChat.personaHint') : undefined}
                        >
                            <Input
                                type="search"
                                value={query}
                                disabled={starting}
                                onChange={(event) => choosingCharacter ? setCharacterQuery(event.target.value) : setPersonaQuery(event.target.value)}
                            />
                        </Field>
                        {visibleCandidates.length === 0 ? (
                            <EmptyState
                                message={t('characterChat.newChat.noMatches')}
                                secondaryText={t('characterChat.newChat.noMatchesHint')}
                                button={{
                                    label: t('characterChat.newChat.clearSearch'),
                                    onClick: () => choosingCharacter ? setCharacterQuery('') : setPersonaQuery(''),
                                }}
                            />
                        ) : (
                            <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
                                {visibleCandidates.map((character) => {
                                    const selected = character.id === (choosingCharacter ? characterId : personaId)
                                    return (
                                        <button
                                            key={character.id}
                                            type="button"
                                            aria-label={t(choosingCharacter ? 'characterChat.newChat.selectCharacter' : 'characterChat.newChat.selectPersona', { name: character.name })}
                                            aria-pressed={selected}
                                            disabled={starting}
                                            onClick={() => {
                                                if (startingRef.current) return
                                                setStartError(false)
                                                if (choosingCharacter) {
                                                    if (character.id !== characterId) {
                                                        setPersonaId(undefined)
                                                        setPersonaQuery('')
                                                    }
                                                    setCharacterId(character.id)
                                                } else {
                                                    setPersonaId(character.id)
                                                }
                                            }}
                                            className={cx(
                                                'flex w-full items-start gap-3 border-l-2 px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-400 disabled:pointer-events-none disabled:opacity-70',
                                                selected ? 'border-l-ember-500 bg-ember-500/[.06]' : 'border-l-transparent hover:bg-surface-raised',
                                            )}
                                        >
                                            <Avatar name={character.name} src={resolveMediaUrl(character.image_url)} size={44} ring="none" />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="break-words font-display text-body font-semibold text-parchment-50">{character.name}</span>
                                                    {!choosingCharacter && <Tag>{t(isPersonaCard(character) ? 'characterChat.newChat.persona' : 'characterChat.newChat.characterCard')}</Tag>}
                                                    {!choosingCharacter && character.id === preferredPersona?.id && <Badge tone="ember">{t('characterChat.newChat.defaultPersona')}</Badge>}
                                                </span>
                                                {character.race && <span className="mt-1 block text-caption text-parchment-300">{[character.race, character.class].filter(Boolean).join(' · ')}</span>}
                                                {character.description && <span className="mt-1 line-clamp-2 font-narrative text-label text-parchment-300">{character.description}</span>}
                                                {choosingCharacter && selected && character.greeting && (
                                                    <span className="mt-3 block border-t border-parchment-50/10 pt-3">
                                                        <span className="block text-caption text-arcane-300">{t('characterChat.newChat.openingLine')}</span>
                                                        <span className="mt-1 line-clamp-4 whitespace-pre-line font-narrative text-label text-parchment-200">{character.greeting}</span>
                                                    </span>
                                                )}
                                            </span>
                                            <Icon icon={selected ? CheckCircle2 : Circle} size={18} className={selected ? 'mt-0.5 shrink-0 text-ember-400' : 'mt-0.5 shrink-0 text-parchment-400'} />
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}
