import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AiCardRequestOptions } from '@/shared'
import { AiGeneratePanel } from './AiGeneratePanel'

interface SavedCardGeneratorProps<T> {
    cardType: 'character' | 'world' | 'item' | 'adventure'
    generate: (description: string, options: AiCardRequestOptions) => Promise<T>
    onSaved: (card: T) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
}

/** Only saved results can leave the read-only preview and enter the editor. */
export function SavedCardGenerator<T>({ cardType, generate, onSaved, isAuthenticated, onAuthRequired }: SavedCardGeneratorProps<T>) {
    const { t } = useTranslation()
    const epoch = useRef(0)
    useEffect(() => () => { epoch.current += 1 }, [])

    return (
        <div className="mt-6">
            <AiGeneratePanel
                noun={t(`streaming.nouns.${cardType}`)}
                onGenerate={async (description, options) => {
                    if (!isAuthenticated) {
                        onAuthRequired()
                        throw new Error(t('streaming.loginRequired'))
                    }
                    const owner = ++epoch.current
                    const card = await generate(description, options)
                    // Stop can recover a commit already in progress. Leaving the
                    // gallery, however, must never navigate back on a late result.
                    if (owner !== epoch.current) throw new DOMException('Creator closed', 'AbortError')
                    onSaved(card)
                }}
            />
        </div>
    )
}
