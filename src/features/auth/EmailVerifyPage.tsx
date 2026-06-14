import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Loader2, LogIn, MailCheck } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import { clearAuthDeepLink } from '@/app/bootstrap/authDeepLink'
import { Button, Card, Icon } from '@/ui/primitives'
import { parseAuthToken } from '@/features/gallery/galleryLinks'

type VerifyStatus = 'verifying' | 'done' | 'missing' | 'error'

/**
 * Landing page for an email-activation link. Auto-submits the single-use token on
 * mount. The provider returns a generic accepted body (it never discloses whether
 * the token was valid), so we show a generic confirmation; on a successful call
 * the provider has revoked ALL of the user's sessions, so we proactively clear
 * local auth and prompt a fresh sign-in.
 */
export function EmailVerifyPage() {
    const { t } = useTranslation()
    const { openLoginModal, logout, isAuthenticated } = useAuth()
    const { setPage } = useNavigation()
    const [token] = useState(() => parseAuthToken('verify-email'))
    const [status, setStatus] = useState<VerifyStatus>('verifying')
    const ranRef = useRef(false)

    useEffect(() => {
        // StrictMode mounts effects twice in dev; the token is single-use, so guard.
        if (ranRef.current) return
        ranRef.current = true
        clearAuthDeepLink()

        if (!token) {
            setStatus('missing')
            return
        }
        let cancelled = false
        void apiService
            .verifyEmail(token)
            .then(() => {
                if (cancelled) return
                // The provider revoked every session on a valid token; drop the now
                // (possibly) dead local session so a stale Bearer isn't reused.
                if (isAuthenticated) logout()
                setStatus('done')
            })
            .catch(() => {
                if (!cancelled) setStatus('error')
            })
        return () => {
            cancelled = true
        }
        // Run once on mount; token is captured in state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const goToSignIn = () => {
        setPage('landing')
        openLoginModal()
    }

    return (
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-5 py-10 sm:px-8">
            <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                {status === 'verifying' && (
                    <>
                        <Loader2 size={40} className="animate-spin text-ember-400" />
                        <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('emailVerify.verifying')}</h1>
                    </>
                )}

                {status === 'done' && (
                    <>
                        <Icon icon={CheckCircle2} size={40} className="text-ember-400" />
                        <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('emailVerify.success.title')}</h1>
                        <p className="font-ui text-[14px] text-parchment-300">{t('emailVerify.success.body')}</p>
                        <Button iconLeft={<Icon icon={LogIn} size={16} />} onClick={goToSignIn}>
                            {t('emailVerify.signIn')}
                        </Button>
                    </>
                )}

                {(status === 'error' || status === 'missing') && (
                    <>
                        <Icon icon={status === 'missing' ? MailCheck : AlertTriangle} size={40} className="text-blood-500" />
                        <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('emailVerify.fail.title')}</h1>
                        <p className="font-ui text-[14px] text-parchment-300">
                            {status === 'missing' ? t('emailVerify.missingToken') : t('emailVerify.fail.body')}
                        </p>
                        <Button kind="secondary" iconLeft={<Icon icon={LogIn} size={16} />} onClick={goToSignIn}>
                            {t('emailVerify.signIn')}
                        </Button>
                    </>
                )}
            </Card>
        </div>
    )
}
