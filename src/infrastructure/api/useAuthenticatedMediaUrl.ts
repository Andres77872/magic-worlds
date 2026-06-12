import { useEffect, useState } from 'react'
import { apiService, isProtectedMediaUrl, resolveMediaUrl } from './index'

interface AuthenticatedMediaUrlState {
    src?: string
    loading: boolean
    error: Error | null
}

export function useAuthenticatedMediaUrl(url?: string | null, accept: string = '*/*'): AuthenticatedMediaUrlState {
    const resolved = resolveMediaUrl(url)
    const protectedMedia = isProtectedMediaUrl(resolved)
    const [state, setState] = useState<AuthenticatedMediaUrlState>({
        src: protectedMedia ? undefined : resolved,
        loading: Boolean(resolved && protectedMedia),
        error: null,
    })

    useEffect(() => {
        if (!resolved || !protectedMedia) {
            setState({ src: resolved, loading: false, error: null })
            return
        }

        let canceled = false
        let objectUrl: string | null = null
        setState({ src: undefined, loading: true, error: null })

        apiService.fetchProtectedMediaBlob(resolved, accept)
            .then((blob) => {
                if (canceled) return
                objectUrl = URL.createObjectURL(blob)
                setState({ src: objectUrl, loading: false, error: null })
            })
            .catch((error) => {
                if (canceled) return
                setState({ src: undefined, loading: false, error: error instanceof Error ? error : new Error('Protected media could not be loaded.') })
            })

        return () => {
            canceled = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [accept, protectedMedia, resolved])

    return state
}
