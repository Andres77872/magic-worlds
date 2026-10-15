/**
 * Console-wide state for the root voice console: the catalog index, the
 * provider limits, toasts, the configuration banner and cross-module hand-offs
 * ("Send to lab", "Send to acceptance"). Mounted only for root (AC-R1).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceLimits } from '@/shared'
import { Toast, type ToastTone } from '@/ui/primitives'
import { describeConsoleError } from '../../consoleErrors'
import { languageName as formatLanguageName } from '../../format'
import { useAbortableLoad, type AbortableLoad } from '../../hooks/useAbortableLoad'
import { useCatalogIndex, type CatalogIndex } from '../../hooks/useCatalogIndex'

export type ConsoleModule = 'catalog' | 'acceptance' | 'defaults' | 'globalPresets' | 'library' | 'create' | 'lab' | 'metrics' | 'reports'

export interface ConsoleHandoff {
    voiceKey: string | null
    /** Bumped on every hand-off so the target module remounts with the prefill. */
    nonce: number
}

export interface VoiceConsoleValue {
    catalog: CatalogIndex
    limits: AbortableLoad<AdminVoiceLimits>
    module: ConsoleModule
    setModule: (module: ConsoleModule) => void
    labHandoff: ConsoleHandoff
    acceptanceHandoff: ConsoleHandoff
    sendToLab: (voiceKey: string) => void
    sendToAcceptance: (voiceKey: string) => void
    notify: (title: string, tone?: ToastTone) => void
    /** Describe an action error; raises the configuration banner when it is one. */
    reportError: (error: unknown) => string
    configIssue: string | null
    raiseConfigIssue: (message: string) => void
    dismissConfigIssue: () => void
    locale: string
    languageName: (code: string | null | undefined) => string
}

const VoiceConsoleContext = createContext<VoiceConsoleValue | null>(null)

const loadLimits = (signal: AbortSignal) => apiService.getVoiceLimits(signal)

interface ToastState {
    title: string
    tone: ToastTone
    id: number
}

export function VoiceConsoleProvider({ children, initialModule = 'catalog', onModuleChange }: {
    children: ReactNode
    initialModule?: ConsoleModule
    /** The open module changed (the page keeps it in the URL). */
    onModuleChange?: (module: ConsoleModule) => void
}) {
    const { t, i18n } = useTranslation()
    const catalog = useCatalogIndex()
    const limits = useAbortableLoad(loadLimits, 'limits')
    const [module, setModuleState] = useState<ConsoleModule>(initialModule)
    const setModule = useCallback((next: ConsoleModule) => {
        setModuleState(next)
        onModuleChange?.(next)
    }, [onModuleChange])
    const [labHandoff, setLabHandoff] = useState<ConsoleHandoff>({ voiceKey: null, nonce: 0 })
    const [acceptanceHandoff, setAcceptanceHandoff] = useState<ConsoleHandoff>({ voiceKey: null, nonce: 0 })
    const [toast, setToast] = useState<ToastState | null>(null)
    const [configIssue, setConfigIssue] = useState<string | null>(null)
    const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'

    const notify = useCallback((title: string, tone: ToastTone = 'success') => {
        setToast((previous) => ({ title, tone, id: (previous?.id ?? 0) + 1 }))
    }, [])

    const languageName = useCallback((code: string | null | undefined) => formatLanguageName(code, locale), [locale])

    const reportError = useCallback(
        (error: unknown) => {
            const info = describeConsoleError(error, t, languageName)
            if (info.configuration) setConfigIssue(info.message)
            return info.message
        },
        [t, languageName],
    )

    const sendToLab = useCallback((voiceKey: string) => {
        setLabHandoff((previous) => ({ voiceKey, nonce: previous.nonce + 1 }))
        setModule('lab')
    }, [setModule])

    const sendToAcceptance = useCallback((voiceKey: string) => {
        setAcceptanceHandoff((previous) => ({ voiceKey, nonce: previous.nonce + 1 }))
        setModule('acceptance')
    }, [setModule])

    const value = useMemo<VoiceConsoleValue>(
        () => ({
            catalog,
            limits,
            module,
            setModule,
            labHandoff,
            acceptanceHandoff,
            sendToLab,
            sendToAcceptance,
            notify,
            reportError,
            configIssue,
            raiseConfigIssue: setConfigIssue,
            dismissConfigIssue: () => setConfigIssue(null),
            locale,
            languageName,
        }),
        [catalog, limits, module, setModule, labHandoff, acceptanceHandoff, sendToLab, sendToAcceptance, notify, reportError, configIssue, locale, languageName],
    )

    return (
        <VoiceConsoleContext.Provider value={value}>
            {children}
            <Toast
                key={toast?.id ?? 0}
                open={toast !== null}
                tone={toast?.tone ?? 'success'}
                title={toast?.title ?? ''}
                onClose={() => setToast(null)}
                autoCloseMs={4000}
            />
        </VoiceConsoleContext.Provider>
    )
}

export function useVoiceConsole(): VoiceConsoleValue {
    const value = useContext(VoiceConsoleContext)
    if (!value) throw new Error('useVoiceConsole must be used inside VoiceConsoleProvider')
    return value
}

/**
 * Render-safe message for a loader error. A configuration error also raises
 * the console banner (in an effect, never during render).
 */
export function useLoadErrorMessage(error: unknown): string | null {
    const { t } = useTranslation()
    const { raiseConfigIssue, languageName } = useVoiceConsole()
    const info = error ? describeConsoleError(error, t, languageName) : null
    const configurationMessage = info?.configuration ? info.message : null
    useEffect(() => {
        if (configurationMessage) raiseConfigIssue(configurationMessage)
    }, [configurationMessage, raiseConfigIssue])
    return info?.message ?? null
}
