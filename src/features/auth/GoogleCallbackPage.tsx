import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, LogIn } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { clearAuthDeepLink, readAuthDeepLinkError } from '@/app/bootstrap/authDeepLink'
import { parseAuthToken } from '@/features/gallery/galleryLinks'
import { Button, Card, Icon } from '@/ui/primitives'

type CallbackStatus = 'pending' | 'error'

/**
 * Maps the BFF's `?error=<reason>` slug (see magic-worlds-api google callback) to
 * the i18n key segment under `auth.google.errors.*`. Unknown/legacy reasons fall
 * back to the generic `failedTitle`/`failedBody`. The reasons are coarse,
 * non-sensitive categories — the BFF never forwards which auth check failed.
 */
const GOOGLE_ERROR_MESSAGE_KEY: Record<string, string> = {
    google_denied: 'denied',
    google_invalid_callback: 'invalidCallback',
    google_account_denied: 'accountDenied',
    google_unavailable: 'unavailable',
    google_start_failed: 'unavailable',
}

/**
 * Module-scoped holder for the Google return. React StrictMode mounts this page
 * twice in dev (mount → unmount → remount); a per-instance ref/state does NOT
 * survive that, so the first mount would clear the single-use code stash and the
 * second mount would read `null` and render the error card even though login
 * succeeded. Module state DOES survive the remount (and resets on the next full
 * page load — which is exactly how the BFF arrives here, via a top-level redirect),
 * so we capture the code once and run the exchange exactly once.
 */
let googleReturn: { code: string | null; error: string | null; promise: Promise<boolean> | null } | null = null

function captureGoogleReturn(): { code: string | null; error: string | null } {
    if (!googleReturn) {
        googleReturn = {
            code: parseAuthToken('google-login'),
            error: readAuthDeepLinkError('google-login'),
            promise: null,
        }
        // Clear the stash so a refresh/back can't replay the code; the captured
        // copy above is what we actually exchange.
        clearAuthDeepLink()
    }
    return { code: googleReturn.code, error: googleReturn.error }
}

/**
 * Landing page for the BFF-mediated Google return. The browser arrives at
 * `{SPA}/auth/google/return?code=<delivery>` (or `?error=`); the deep-link
 * bootstrap lifts the single-use code out of the URL and rewrites to this hash
 * route. Here we exchange the code for the session exactly once and route home.
 */
export function GoogleCallbackPage() {
    const { t } = useTranslation()
    const { completeGoogleLogin, openLoginModal, isAuthenticated } = useAuth()
    const { setPage } = useNavigation()
    // Captured once at module scope (survives the StrictMode remount).
    const [{ code, error: deepLinkError }] = useState(captureGoogleReturn)
    // Derive the initial status from the captured values so the effect never has to
    // setState synchronously — it only setStates inside the async exchange callbacks.
    const [status, setStatus] = useState<CallbackStatus>(deepLinkError || !code ? 'error' : 'pending')

    // Resolve a specific message for the BFF-forwarded error reason (falls back to
    // the generic copy for unknown/legacy reasons or a missing-code edge case).
    const messageKey = deepLinkError ? GOOGLE_ERROR_MESSAGE_KEY[deepLinkError] : undefined
    const errorTitle = messageKey
        ? t(`auth.google.errors.${messageKey}.title`, { defaultValue: 'Google sign-in failed' })
        : t('auth.google.failedTitle', { defaultValue: 'Google sign-in failed' })
    const errorBody = messageKey
        ? t(`auth.google.errors.${messageKey}.body`, { defaultValue: 'We could not complete your Google sign-in. Please try again.' })
        : t('auth.google.failedBody', { defaultValue: 'We could not complete your Google sign-in. Please try again.' })

    useEffect(() => {
        if (status !== 'pending' || !code || !googleReturn) return

        // Dedupe across the StrictMode remount: exchange the single-use code once
        // and have whichever mount survives navigate on the shared result.
        if (!googleReturn.promise) googleReturn.promise = completeGoogleLogin(code)

        let cancelled = false
        googleReturn.promise
            .then((ok) => {
                if (cancelled) return
                // Login may have already succeeded on the first (transient) mount —
                // treat an authenticated session as success regardless of `ok`.
                if (ok || isAuthenticated) setPage('landing')
                else setStatus('error')
            })
            .catch(() => {
                if (cancelled) return
                if (isAuthenticated) setPage('landing')
                else setStatus('error')
            })
        return () => {
            cancelled = true
        }
        // Run once on mount; code/status are captured above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const goToSignIn = () => {
        setPage('landing')
        openLoginModal()
    }

    return (
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-5 py-10 sm:px-8">
            {status === 'pending' ? (
                <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                    <Icon icon={Loader2} size={40} className="animate-spin text-ember-400" />
                    <h1 className="font-display text-h2 font-semibold text-parchment-50">
                        {t('auth.google.signingIn', { defaultValue: 'Signing you in…' })}
                    </h1>
                    <p className="font-ui text-[14px] text-parchment-300">
                        {t('auth.google.signingInBody', { defaultValue: 'Completing your Google sign-in. This only takes a moment.' })}
                    </p>
                </Card>
            ) : (
                <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                    <Icon icon={AlertTriangle} size={40} className="text-blood-500" />
                    <h1 className="font-display text-h2 font-semibold text-parchment-50">
                        {errorTitle}
                    </h1>
                    <p className="font-ui text-[14px] text-parchment-300">
                        {errorBody}
                    </p>
                    <Button iconLeft={<Icon icon={LogIn} size={16} />} onClick={goToSignIn}>
                        {t('auth.google.backToSignIn', { defaultValue: 'Back to sign in' })}
                    </Button>
                </Card>
            )}
        </div>
    )
}
