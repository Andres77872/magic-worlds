import { useCallback, useEffect, useState } from 'react'
import { apiService } from './index'
import { isProtectedMediaUrl, resolveMediaUrl } from './mediaUrl'

interface AuthenticatedMediaUrlState {
    src?: string
    loading: boolean
    error: Error | null
    retry: () => void
}

export function useAuthenticatedMediaUrl(url?: string | null, accept: string = '*/*'): AuthenticatedMediaUrlState {
    const resolved = resolveMediaUrl(url)
    const protectedMedia = isProtectedMediaUrl(resolved)
    const [attempt, setAttempt] = useState(0)
    const [state, setState] = useState<Omit<AuthenticatedMediaUrlState, 'retry'>>({
        src: protectedMedia ? undefined : resolved,
        loading: Boolean(resolved && protectedMedia),
        error: null,
    })

    const retry = useCallback(() => {
        setAttempt((current) => current + 1)
    }, [])

    useEffect(() => {
        if (!resolved || !protectedMedia) {
            setState({ src: resolved, loading: false, error: null })
            return
        }

        let canceled = false
        let objectUrl: string | null = null
        setState({ src: undefined, loading: true, error: null })

        const fetchProtectedMediaBlob = apiService.fetchProtectedMediaBlob
        if (typeof fetchProtectedMediaBlob !== 'function') {
            setState({
                src: undefined,
                loading: false,
                error: new Error('Protected media could not be loaded.'),
            })
            return
        }

        fetchProtectedMediaBlob.call(apiService, resolved, accept)
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
    }, [accept, attempt, protectedMedia, resolved])

    return { ...state, retry }
}

