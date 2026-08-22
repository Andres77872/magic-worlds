/**
 * useAiActionRow — builds the model for the in-document action row and keeps
 * the decoration honest about it.
 *
 * The row is a ProseMirror widget, so it reads its model through a ref at
 * decoration time. The phase, though, flips during a dispatch — one render
 * before the ref catches up — so a no-op transaction after the render is what
 * closes that gap.
 *
 * The live region lives here, in React, rather than inside the widget: a node
 * ProseMirror re-inserts in the same tick is not reliably announced.
 */

import { useEffect, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import type { AiActionRowModel } from '../extensions/aiActionRow'
import { AI_SUGGESTION_META } from '../extensions/aiSuggestion'
import type { InlineAIPhase } from '../types'
import type { InlineAIApi } from './useInlineAI'

const IS_APPLE =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
const REGENERATE_KEY = IS_APPLE ? '⌘↵' : 'Ctrl+↵'

/**
 * Writes into `rowModelRef` rather than owning it: the extension is memoized
 * before this hook can run (it needs the editor, which needs the extension), so
 * the ref has to be created by the caller.
 */
export function useAiActionRow(
    editorRef: RefObject<Editor | null>,
    phase: InlineAIPhase,
    inlineAI: InlineAIApi,
    rowModelRef: RefObject<AiActionRowModel | null>,
) {
    const { t } = useTranslation()
    const { words, previous, prompt } = inlineAI.rowMeta
    const live = phase === 'pending' || phase === 'reviewing'

    const model: AiActionRowModel | null = live
        ? {
              state: phase === 'pending' ? 'generating' : 'reviewing',
              meta:
                  phase === 'reviewing'
                      ? previous != null
                          ? t('novelEditor.suggestion.wordsReplaced', { count: words, previous })
                          : t('novelEditor.suggestion.wordsAdded', { count: words })
                      : '',
              // Once the prose lands, the beat note in the document carries the
              // prompt — repeating it here would say the same thing twice. A
              // mid-paragraph rewrite gets no note (a block cannot go inline),
              // so there the row stays the only place it shows.
              prompt:
                  prompt && (phase === 'pending' || previous != null)
                      ? t('novelEditor.suggestion.prompt', { text: prompt })
                      : '',
              labels: {
                  actions: t('novelEditor.suggestion.actions'),
                  accept: t('novelEditor.suggestion.accept'),
                  decline: t('novelEditor.suggestion.decline'),
                  regenerate: t('novelEditor.suggestion.regenerate'),
                  cancel: t('novelEditor.suggestion.cancel'),
                  generating: t('novelEditor.suggestion.generating'),
                  acceptKey: t('novelEditor.suggestion.acceptKey'),
                  declineKey: t('novelEditor.suggestion.declineKey'),
                  regenerateKey: REGENERATE_KEY,
              },
              canRegenerate: inlineAI.canRegenerate,
              onAccept: () => void inlineAI.accept(),
              onDecline: () => void inlineAI.reject(),
              onRegenerate: () => void inlineAI.regenerate(),
              onCancel: () => inlineAI.abortPending(),
          }
        : null

    // The decoration reads the ref during a ProseMirror state update, which can
    // land a frame before React commits — so publish the model and then poke the
    // view with a no-op transaction to recompute with it.
    useEffect(() => {
        rowModelRef.current = model
        if (!live) return
        const editor = editorRef.current
        if (!editor || editor.isDestroyed) return
        editor.view.dispatch(editor.state.tr.setMeta(AI_SUGGESTION_META, true))
    }, [editorRef, live, model, rowModelRef])

    return { announcement: phase === 'reviewing' ? t('novelEditor.suggestion.announce', { count: words }) : '' }
}
