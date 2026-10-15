/**
 * The Docs page's in-page state lives in its hash so views and sections are
 * linkable: `#/docs?view=roadmap&section=novel-studio`. The router only reads
 * the path (`#/docs`), so these params never change the page; updates go
 * through `replaceHash` (no history entry) to keep Back leaving the Docs page.
 *
 * The local state follows external hash changes (an assistant link, a pasted
 * URL) with the "adjust state while rendering" pattern rather than an effect.
 */
import { useCallback, useState } from 'react'
import { useNavigation } from '@/app/hooks'
import { pageHash } from '@/features/gallery/galleryLinks'

export type DocsView = 'guide' | 'roadmap'

export interface DocsRoute {
    view: DocsView
    section: string | null
}

export function parseDocsHash(hash: string): DocsRoute {
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const params = new URLSearchParams(query)
    return {
        view: params.get('view') === 'roadmap' ? 'roadmap' : 'guide',
        section: params.get('section') || null,
    }
}

export function buildDocsHash({ view, section }: Partial<DocsRoute>): string {
    const params = new URLSearchParams()
    if (view === 'roadmap') params.set('view', 'roadmap')
    if (section) params.set('section', section)
    const query = params.toString()
    return `${pageHash('docs')}${query ? `?${query}` : ''}`
}

export function useDocsRoute() {
    const { currentHash = '', replaceHash } = useNavigation()
    const [route, setRoute] = useState(() => parseDocsHash(currentHash))
    const [seenHash, setSeenHash] = useState(currentHash)
    if (seenHash !== currentHash) {
        setSeenHash(currentHash)
        setRoute(parseDocsHash(currentHash))
    }

    const navigate = useCallback(
        (next: DocsRoute) => {
            setRoute(next)
            replaceHash?.(buildDocsHash(next))
        },
        [replaceHash],
    )

    return { route, navigate }
}
