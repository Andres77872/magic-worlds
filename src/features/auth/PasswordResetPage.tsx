import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, LogIn, ShieldCheck } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure/api'
import { clearAuthDeepLink } from '@/app/bootstrap/authDeepLink'
import { Button, Card, Field, Icon, Input, PageHeader } from '@/ui/primitives'
import { parseAuthToken } from '@/features/gallery/galleryLinks'

type ResetStatus = 'form' | 'success' | 'invalid'

/**
 * Landing page for a password-reset email link. The single-use token is lifted
 * from the URL by the deep-link bootstrap; here the user sets a new password.
 * On success the provider revokes ALL sessions and mints none, so we send the
 * user to sign in.
 */
export function PasswordResetPage() {
    const { t } = useTranslation()
    const { openLoginModal } = useAuth()
    const { setPage } = useNavigation()
    const [token] = useState(() => parseAuthToken('password-reset'))
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [status, setStatus] = useState<ResetStatus>(token ? 'form' : 'invalid')

    // The token is captured in state above; drop the stash so a refresh/back can't replay it.
    useEffect(() => {
        clearAuthDeepLink()
    }, [])

    const goToSignIn = () => {
        setPage('landing')
        openLoginModal()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) {
            setStatus('invalid')
            return
        }
        if (password !== confirm) {
            setError(t('passwordReset.mismatch'))
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            await apiService.resetPassword(token, password)
            setStatus('success')
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 422 || err.code === 'VAL_3007') {
                    setError(t('passwordReset.weak'))
                } else {
                    setError(err.message || t('passwordReset.genericError'))
                }
            } else {
                setError(t('passwordReset.genericError'))
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-5 py-10 sm:px-8">
            {status === 'success' ? (
                <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                    <Icon icon={CheckCircle2} size={40} className="text-ember-400" />
                    <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('passwordReset.success.title')}</h1>
                    <p className="font-ui text-[14px] text-parchment-300">{t('passwordReset.success.body')}</p>
                    <Button iconLeft={<Icon icon={LogIn} size={16} />} onClick={goToSignIn}>
                        {t('passwordReset.signIn')}
                    </Button>
                </Card>
            ) : status === 'invalid' ? (
                <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                    <Icon icon={AlertTriangle} size={40} className="text-blood-500" />
                    <h1 className="font-display text-h2 font-semibold text-parchment-50">{t('passwordReset.invalidToken.title')}</h1>
                    <p className="font-ui text-[14px] text-parchment-300">{t('passwordReset.invalidToken.body')}</p>
                    <Button kind="secondary" iconLeft={<Icon icon={KeyRound} size={16} />} onClick={goToSignIn}>
                        {t('passwordReset.requestNew')}
                    </Button>
                </Card>
            ) : (
                <>
                    <PageHeader
                        icon={<Icon icon={ShieldCheck} size={24} className="text-ember-400" />}
                        title={t('passwordReset.title')}
                        subtitle={t('passwordReset.subtitle')}
                    />
                    <Card className="px-6 py-6">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <Field label={t('passwordReset.newPassword')} className="mb-0">
                                <div className="relative">
                                    <Icon icon={Lock} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        name="new-password"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); if (error) setError(null) }}
                                        placeholder={t('passwordReset.newPasswordPlaceholder')}
                                        required
                                        autoComplete="new-password"
                                        className="px-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-parchment-400 transition-colors hover:text-parchment-50"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                                    >
                                        {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                                    </button>
                                </div>
                            </Field>

                            <Field label={t('passwordReset.confirm')} className="mb-0" error={error}>
                                <div className="relative">
                                    <Icon icon={ShieldCheck} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        name="confirm-password"
                                        value={confirm}
                                        onChange={(e) => { setConfirm(e.target.value); if (error) setError(null) }}
                                        placeholder={t('passwordReset.confirmPlaceholder')}
                                        required
                                        autoComplete="new-password"
                                        className="pl-10"
                                    />
                                </div>
                            </Field>

                            <Button
                                type="submit"
                                full
                                disabled={submitting}
                                iconLeft={submitting ? <Loader2 size={16} className="animate-spin" /> : <Icon icon={KeyRound} size={16} />}
                            >
                                {submitting ? t('passwordReset.submitting') : t('passwordReset.submit')}
                            </Button>
                        </form>
                    </Card>
                </>
            )}
        </div>
    )
}
