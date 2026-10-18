import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoryAnchorEdit, StoryManuscriptDocument } from '@/shared'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { generateUUID } from '@/utils/uuid'
import { AUTHOR_VARIANT_DOMAIN, editAuthorVariantDraft, writeAuthorVariantDraft, type AuthorVariantDraft, type RetainedAuthorVariant } from '../persistence/authorVariantJournal'

/** A new local writer; never replays, discards or rewrites the original request. */
export function useDeviceAuthorVariant(item: RetainedAuthorVariant, current: () => boolean, readOnly: boolean) {
    const [original] = useState(() => structuredClone(item)), [writer] = useState(generateUUID)
    const [copy, setCopy] = useState<AuthorVariantDraft | null>(null), value = useRef(copy)
    const [storageFailed, setStorageFailed] = useState(false), [savedLocally, setSavedLocally] = useState(false)
    const key = scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...original.scope, storyId: original.record.write.storyId }, original.record.write.context.parent.parent.id, writer)
    const live = useRef({ current, readOnly }), retired = useRef(false), mounted = useRef(true), timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useLayoutEffect(() => { live.current = { current, readOnly }; if (!current()) retired.current = true })
    const isCurrent = useCallback(() => mounted.current && !retired.current && live.current.current(), [])
    const persist = useCallback((next: AuthorVariantDraft) => {
        const saved = writeAuthorVariantDraft(key, next)
        if (isCurrent()) { setStorageFailed(!saved); setSavedLocally(saved) }
        return saved
    }, [key, isCurrent])
    const preserve = useCallback(() => {
        if (!isCurrent()) return false
        if (timer.current) clearTimeout(timer.current)
        return !value.current || persist(value.current)
    }, [isCurrent, persist])
    const begin = useCallback(() => {
        if (!isCurrent() || live.current.readOnly || value.current) return false
        const next = { ...structuredClone(original.record.write), id: generateUUID(), seeded: true }
        if (!persist(next)) return false
        value.current = next; setCopy(next)
        return true
    }, [original, isCurrent, persist])
    const edit = useCallback((patch: { title?: string; document?: StoryManuscriptDocument; anchorEdits?: StoryAnchorEdit[] | null }) => {
        if (!isCurrent() || live.current.readOnly || !value.current) return
        const next = editAuthorVariantDraft(value.current, patch)
        if (!next) return
        value.current = next; setCopy(next); setSavedLocally(false)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { if (isCurrent() && value.current === next) persist(next) }, 150)
    }, [isCurrent, persist])
    useEffect(() => {
        mounted.current = true
        const hidden = () => { if (document.visibilityState === 'hidden' && value.current) persist(value.current) }
        const unload = (event: BeforeUnloadEvent) => { if (!preserve()) { event.preventDefault(); event.returnValue = '' } }
        document.addEventListener('visibilitychange', hidden); window.addEventListener('beforeunload', unload)
        return () => {
            document.removeEventListener('visibilitychange', hidden); window.removeEventListener('beforeunload', unload)
            if (timer.current) clearTimeout(timer.current)
            // Synchronous final retention stays in the old account/origin/writer.
            if (value.current) writeAuthorVariantDraft(key, value.current)
            mounted.current = false
        }
    }, [key, persist, preserve])
    return { draft: copy ?? original.record.write, isCopy: copy !== null, storageFailed, savedLocally, key, begin, edit, preserve }
}
