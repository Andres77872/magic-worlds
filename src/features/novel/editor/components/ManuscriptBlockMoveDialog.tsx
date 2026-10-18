import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button, Callout, Field, Icon, Modal, Select } from '@/ui/primitives'
import { applyBlockMove, blockMoveCurrent, moveBlockAdjacent, type BlockMoveOption, type BlockMoveResult, type BlockMoveTarget } from '../blockMovement'

interface Props { target: BlockMoveTarget; blocked: boolean; canWrite: () => boolean; onClose: () => void; onMoved: () => void }
export function ManuscriptBlockMoveDialog({ target, blocked, canWrite, onClose, onMoved }: Props) {
    const { t } = useTranslation()
    const [destination, setDestination] = useState(target.next ?? target.previous ?? '')
    const [side, setSide] = useState<'before' | 'after'>(target.next ? 'after' : 'before')
    const [error, setError] = useState<BlockMoveResult | null>(null)
    const current = useSyncExternalStore((notify) => {
        target.editor.on('transaction', notify); target.editor.on('destroy', notify)
        return () => { target.editor.off('transaction', notify); target.editor.off('destroy', notify) }
    }, () => blockMoveCurrent(target))
    const disabled = blocked || !current
    const label = (option: BlockMoveOption) => t('novelEditor.blocks.option', { number: option.index + 1, kind: t(`novelEditor.blocks.kind.${option.kind}`), text: option.excerpt || t('novelEditor.blocks.empty') })
    const finish = (result: BlockMoveResult) => { if (result === 'moved') { onMoved(); onClose() } else setError(result) }
    return <Modal open onClose={onClose} title={t('novelEditor.blocks.title')} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{t('novelEditor.blocks.close')}</Button>
        <Button disabled={disabled || !destination} onClick={() => finish(applyBlockMove(target, destination, side, canWrite))}>{t('novelEditor.blocks.apply')}</Button>
    </>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{t('novelEditor.blocks.help')}</p>
            <p className="text-caption text-parchment-300">{t('novelEditor.blocks.notes')}</p>
            <div><p className="font-ui text-label font-semibold text-parchment-100">{t('novelEditor.blocks.selection', { count: target.selected.length })}</p>
                <p className="mt-1 text-caption text-parchment-300">{t(`novelEditor.blocks.parent.${target.parentKind}`)}</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto pl-4 text-caption text-parchment-200">{target.selected.map((option) => <li key={option.id} className="break-words">{label(option)}</li>)}</ul>
            </div>
            {!current && <Callout tone="warning" role="status">{t('novelEditor.blocks.stale')}</Callout>}
            {blocked && <Callout tone="warning" role="status">{t('novelEditor.blocks.blocked')}</Callout>}
            {error && <Callout tone="warning" role="alert">{t(`novelEditor.blocks.${error}`)}</Callout>}
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={ArrowUp} size={16} />} disabled={disabled || !target.previous} onClick={() => finish(moveBlockAdjacent(target, 'up', canWrite))}>{t('novelEditor.blocks.up')}</Button>
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={ArrowDown} size={16} />} disabled={disabled || !target.next} onClick={() => finish(moveBlockAdjacent(target, 'down', canWrite))}>{t('novelEditor.blocks.down')}</Button>
            </div>
            <Field label={t('novelEditor.blocks.destination')}><Select disabled={disabled} value={destination} onChange={setDestination} options={target.destinations.map((option) => ({ value: option.id, label: label(option) }))} /></Field>
            <Field label={t('novelEditor.blocks.placement')}><Select disabled={disabled} value={side} onChange={(value) => setSide(value as typeof side)} options={['before', 'after'].map((value) => ({ value, label: t(`novelEditor.blocks.${value}`) }))} /></Field>
            <p className="text-caption text-parchment-400">{t('novelEditor.blocks.shortcut')}</p>
        </div>
    </Modal>
}
