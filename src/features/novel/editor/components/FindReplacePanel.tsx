/**
 * FindReplacePanel — a compact find & replace surface that floats over the
 * manuscript (Ctrl/Cmd-F). It drives the searchReplace extension: typing seeds
 * the query, the chevrons step through matches, and replace/replace-all rewrite
 * them. Replacement is disabled while an AI suggestion is alive so it can never
 * collide with the inline reveal. Closing clears the search and returns focus.
 */

import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { CaseSensitive, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Icon, IconButton, cx } from '@/ui/primitives'
import { SEARCH_PLUGIN_KEY } from '../extensions/searchReplace'

interface FindReplacePanelProps {
    editor: Editor
    /** True while a suggestion is alive — replacement is blocked. */
    disabled: boolean
    onClose: () => void
}

export function FindReplacePanel({ editor, disabled, onClose }: FindReplacePanelProps) {
    const { t } = useTranslation()
    const [find, setFind] = useState('')
    const [replace, setReplace] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const findRef = useRef<HTMLInputElement | null>(null)
    const [, tick] = useReducer((n: number) => n + 1, 0)

    // Re-render on editor transactions so the match counter stays live.
    useEffect(() => {
        editor.on('transaction', tick)
        return () => {
            editor.off('transaction', tick)
        }
    }, [editor])

    useEffect(() => {
        findRef.current?.focus()
        findRef.current?.select()
    }, [])

    // Push the query into the extension; clear it when the panel unmounts.
    useEffect(() => {
        editor.commands.setSearchTerm(find, caseSensitive)
    }, [editor, find, caseSensitive])
    useEffect(() => {
        return () => {
            editor.commands.clearSearch()
        }
    }, [editor])

    const search = SEARCH_PLUGIN_KEY.getState(editor.state)
    const total = search?.matches.length ?? 0
    const current = total > 0 ? (search?.activeIndex ?? 0) + 1 : 0

    const onFindKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) editor.commands.findPrev()
            else editor.commands.findNext()
        } else if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
        }
    }

    return (
        <div
            className="absolute right-3 top-3 z-40 w-[320px] rounded-lg border border-parchment-50/10 bg-ink-800/95 p-2.5 shadow-xl backdrop-blur"
            data-testid="find-replace-panel"
            role="search"
            aria-label={t('novelEditor.find.title')}
        >
            <div className="flex items-center gap-1.5">
                <input
                    ref={findRef}
                    value={find}
                    onChange={(event) => setFind(event.target.value)}
                    onKeyDown={onFindKeyDown}
                    placeholder={t('novelEditor.find.findPlaceholder')}
                    aria-label={t('novelEditor.find.findPlaceholder')}
                    className="min-w-0 flex-1 rounded-md border border-parchment-50/10 bg-ink-900 px-2.5 py-1.5 font-ui text-sm text-parchment-50 outline-none focus:border-ember-500"
                    data-testid="find-input"
                />
                <span className="w-14 shrink-0 text-center font-ui text-xs tabular-nums text-parchment-400" data-testid="find-count">
                    {t('novelEditor.find.matches', { current, total })}
                </span>
                <IconButton
                    label={t('novelEditor.find.caseSensitive')}
                    size="sm"
                    tone={caseSensitive ? 'active' : 'default'}
                    onClick={() => setCaseSensitive((value) => !value)}
                >
                    <Icon icon={CaseSensitive} size={15} />
                </IconButton>
                <IconButton label={t('novelEditor.find.prev')} size="sm" onClick={() => editor.commands.findPrev()} disabled={total === 0}>
                    <Icon icon={ChevronUp} size={15} />
                </IconButton>
                <IconButton label={t('novelEditor.find.next')} size="sm" onClick={() => editor.commands.findNext()} disabled={total === 0}>
                    <Icon icon={ChevronDown} size={15} />
                </IconButton>
                <IconButton label={t('novelEditor.find.close')} size="sm" onClick={onClose}>
                    <Icon icon={X} size={15} />
                </IconButton>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
                <input
                    value={replace}
                    onChange={(event) => setReplace(event.target.value)}
                    placeholder={t('novelEditor.find.replacePlaceholder')}
                    aria-label={t('novelEditor.find.replacePlaceholder')}
                    className="min-w-0 flex-1 rounded-md border border-parchment-50/10 bg-ink-900 px-2.5 py-1.5 font-ui text-sm text-parchment-50 outline-none focus:border-ember-500"
                    data-testid="replace-input"
                />
                <button
                    type="button"
                    onClick={() => editor.commands.replaceCurrent(replace)}
                    disabled={disabled || total === 0}
                    className={cx(
                        'shrink-0 rounded-md px-2.5 py-1.5 font-ui text-xs font-semibold transition-colors',
                        disabled || total === 0 ? 'cursor-not-allowed text-parchment-500' : 'text-parchment-100 hover:bg-ink-600/70',
                    )}
                    data-testid="replace-one"
                >
                    {t('novelEditor.find.replace')}
                </button>
                <button
                    type="button"
                    onClick={() => editor.commands.replaceAll(replace)}
                    disabled={disabled || total === 0}
                    className={cx(
                        'shrink-0 rounded-md px-2.5 py-1.5 font-ui text-xs font-semibold transition-colors',
                        disabled || total === 0 ? 'cursor-not-allowed text-parchment-500' : 'text-ember-300 hover:bg-ember-500/15',
                    )}
                    data-testid="replace-all"
                >
                    {t('novelEditor.find.replaceAll')}
                </button>
            </div>
            {disabled && <p className="m-0 mt-1.5 px-0.5 font-ui text-[11px] text-arcane-300">{t('novelEditor.find.suggestionActive')}</p>}
        </div>
    )
}
