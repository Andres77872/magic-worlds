import { useEffect, useRef } from 'react'
import { createLorebookExtractionSession } from '../lorebookExtractionSession'

export function useLorebookExtraction() {
    const session = useRef<ReturnType<typeof createLorebookExtractionSession> | null>(null)
    useEffect(() => () => { session.current?.close(); session.current = null }, [])
    return (...args: Parameters<ReturnType<typeof createLorebookExtractionSession>['execute']>) => {
        session.current ??= createLorebookExtractionSession()
        return session.current.execute(...args)
    }
}
