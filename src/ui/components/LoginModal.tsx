/**
 * Login / Register / Forgot-password modal — Reverie (composed from the Modal
 * primitive).
 *
 * A segmented switcher at the top makes the active mode (sign in vs create
 * account) unmistakable; register mode adds a confirm-password field. The sign-in
 * view also offers a "Forgot your password?" affordance that swaps to a recovery
 * sub-mode, and notes that the username field accepts an email (email login).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, Lock, LogIn, Mail, MailCheck, ShieldCheck, Sparkles, User, UserPlus } from 'lucide-react'
import { useAuth } from '../../app/hooks'
import { apiService, ApiError } from '../../infrastructure/api'
import { Button, cx, Field, Icon, Input, Modal } from '../primitives'

interface LoginModalProps {
    isOpen: boolean
    onClose: () => void
}

type AuthMode = 'login' | 'register'

/** Google "G" brand mark (lucide ships no brand glyphs). */
function GoogleGlyph() {
    return (
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
    )
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { t } = useTranslation()
    const { login, register, loginWithGoogle, isLoading, error, clearError } = useAuth()
    const [mode, setMode] = useState<AuthMode>('login')
    const [forgotOpen, setForgotOpen] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [confirmPassword, setConfirmPassword] = useState('')
    const [confirmError, setConfirmError] = useState<string | null>(null)
    // Forgot-password sub-flow (kept local so it never pollutes auth error state).
    const [forgotIdentifier, setForgotIdentifier] = useState('')
    const [forgotSubmitting, setForgotSubmitting] = useState(false)
    const [forgotSent, setForgotSent] = useState(false)
    const [forgotError, setForgotError] = useState<string | null>(null)

    const copy = {
        title: t(`auth.${mode}.title`),
        subtitle: t(`auth.${mode}.subtitle`),
        submit: t(`auth.${mode}.submit`),
        submitting: t(`auth.${mode}.submitting`),
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (mode === 'register' && credentials.password !== confirmPassword) {
            setConfirmError(t('auth.passwordMismatch'))
            return
        }
        const success = mode === 'login' ? await login(credentials) : await register(credentials)
        if (success) {
            handleClose()
        }
    }

    const resetForgot = () => {
        setForgotOpen(false)
        setForgotIdentifier('')
        setForgotSubmitting(false)
        setForgotSent(false)
        setForgotError(null)
    }

    const handleClose = () => {
        setCredentials({ username: '', password: '' })
        setConfirmPassword('')
        setConfirmError(null)
        setShowPassword(false)
        setMode('login')
        resetForgot()
        onClose()
    }

    const switchMode = (next: AuthMode) => {
        if (next === mode) return
        setMode(next)
        setConfirmPassword('')
        setConfirmError(null)
        if (error) clearError()
    }

    const openForgot = () => {
        if (error) clearError()
        setForgotIdentifier(credentials.username)
        setForgotOpen(true)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setCredentials((prev) => ({ ...prev, [name]: value }))
        if (name === 'password' && confirmError) setConfirmError(null)
        if (error) clearError()
    }

    const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmPassword(e.target.value)
        if (confirmError) setConfirmError(null)
        if (error) clearError()
    }

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setForgotSubmitting(true)
        setForgotError(null)
        try {
            await apiService.requestPasswordReset(forgotIdentifier)
            setForgotSent(true)
        } catch (err) {
            // Privacy: only surface genuine network/5xx outages. Anything else still
            // shows the generic "sent" confirmation so account existence never leaks.
            if (err instanceof TypeError || (err instanceof ApiError && err.status >= 500)) {
                setForgotError(t('auth.errors.authUnavailable'))
            } else {
                setForgotSent(true)
            }
        } finally {
            setForgotSubmitting(false)
        }
    }

    const modeTab = (key: AuthMode, label: string) => (
        <button
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => switchMode(key)}
            className={cx(
                'rounded-md px-3 py-2 font-ui text-sm font-semibold transition-colors',
                mode === key
                    ? 'bg-ember-500/15 text-ember-300 ring-1 ring-inset ring-ember-500/35'
                    : 'text-parchment-400 hover:text-parchment-200',
            )}
        >
            {label}
        </button>
    )

    if (forgotOpen) {
        return (
            <Modal
                open={isOpen}
                onClose={handleClose}
                title={t('auth.forgot.title')}
                icon={<Icon icon={Mail} size={20} className="text-ember-400" />}
                closeLabel={t('common.close')}
            >
                <div className="flex flex-col gap-5">
                    {forgotSent ? (
                        <div className="flex flex-col items-center gap-3 py-2 text-center">
                            <Icon icon={MailCheck} size={36} className="text-ember-400" />
                            <p className="text-[14px] text-parchment-200">{t('auth.forgot.sent')}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-[14px] text-parchment-400">{t('auth.forgot.subtitle')}</p>
                            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                                <Field label={t('auth.forgot.identifier')} className="mb-0">
                                    <div className="relative">
                                        <Icon icon={User} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                                        <Input
                                            type="text"
                                            value={forgotIdentifier}
                                            onChange={(e) => { setForgotIdentifier(e.target.value); if (forgotError) setForgotError(null) }}
                                            placeholder={t('auth.forgot.identifierPlaceholder')}
                                            required
                                            autoComplete="username"
                                            className="pl-10"
                                        />
                                    </div>
                                </Field>

                                {forgotError && (
                                    <div className="flex items-center gap-2 text-label text-blood-500">
                                        <Icon icon={AlertTriangle} size={15} className="shrink-0" />
                                        <span>{forgotError}</span>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    full
                                    disabled={forgotSubmitting || !forgotIdentifier.trim()}
                                    iconLeft={forgotSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} strokeWidth={1.75} />}
                                >
                                    {forgotSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
                                </Button>
                            </form>
                        </>
                    )}

                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 text-center text-[14px] font-semibold text-ember-400 transition-colors hover:text-ember-300"
                        onClick={resetForgot}
                    >
                        <ArrowLeft size={15} strokeWidth={1.75} />
                        {t('auth.forgot.back')}
                    </button>
                </div>
            </Modal>
        )
    }

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title={copy.title}
            icon={<Icon icon={Sparkles} size={20} className="text-ember-400" />}
            closeLabel={t('common.close')}
        >
            <div className="flex flex-col gap-5">
                <div>
                    <div
                        role="tablist"
                        aria-label={t('auth.modeLabel')}
                        className="grid grid-cols-2 gap-1 rounded-lg border border-parchment-50/10 bg-ink-800 p-1"
                    >
                        {modeTab('login', t('auth.signIn'))}
                        {modeTab('register', t('auth.createAccount'))}
                    </div>
                    <p className="mt-3 text-[14px] text-parchment-400">{copy.subtitle}</p>
                </div>

                {/* Alpha Version Disclaimer */}
                <div className="flex gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-label leading-relaxed text-parchment-200">
                    <Icon icon={AlertTriangle} size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <p>
                        <strong className="text-parchment-50">{t('auth.alphaTitle')}</strong> {t('auth.alphaBody')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field
                        label={t('auth.username')}
                        className="mb-0"
                        helper={mode === 'login' ? t('auth.usernameOrEmailHint') : undefined}
                    >
                        <div className="relative">
                            <Icon
                                icon={User}
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400"
                            />
                            <Input
                                type="text"
                                name="username"
                                value={credentials.username}
                                onChange={handleInputChange}
                                placeholder={mode === 'login' ? t('auth.usernameOrEmailPlaceholder') : t('auth.usernamePlaceholder')}
                                required
                                autoComplete="username"
                                className="pl-10"
                            />
                        </div>
                    </Field>

                    <Field label={t('auth.password')} className="mb-0">
                        <div className="relative">
                            <Icon
                                icon={Lock}
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400"
                            />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={credentials.password}
                                onChange={handleInputChange}
                                placeholder={t(`auth.${mode}.passwordPlaceholder`)}
                                required
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                className="px-10"
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-parchment-400 transition-colors hover:text-parchment-50"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                            >
                                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                            </button>
                        </div>
                    </Field>

                    {mode === 'login' && (
                        <div className="-mt-1 flex justify-end">
                            <button
                                type="button"
                                className="text-label font-semibold text-ember-400 transition-colors hover:text-ember-300"
                                onClick={openForgot}
                            >
                                {t('auth.login.forgotLink')}
                            </button>
                        </div>
                    )}

                    {mode === 'register' && (
                        <Field label={t('auth.confirmPassword')} className="mb-0" error={confirmError}>
                            <div className="relative">
                                <Icon
                                    icon={ShieldCheck}
                                    size={16}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400"
                                />
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={confirmPassword}
                                    onChange={handleConfirmChange}
                                    placeholder={t('auth.confirmPasswordPlaceholder')}
                                    required
                                    autoComplete="new-password"
                                    className="pl-10"
                                />
                            </div>
                        </Field>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-label text-blood-500">
                            <Icon icon={AlertTriangle} size={15} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        full
                        disabled={isLoading}
                        iconLeft={
                            isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : mode === 'login' ? (
                                <LogIn size={16} strokeWidth={1.75} />
                            ) : (
                                <UserPlus size={16} strokeWidth={1.75} />
                            )
                        }
                    >
                        {isLoading ? copy.submitting : copy.submit}
                    </Button>
                </form>

                <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-parchment-50/10" />
                    <span className="font-ui text-caption uppercase tracking-wide text-parchment-400">
                        {t('auth.orContinueWith', { defaultValue: 'or' })}
                    </span>
                    <span className="h-px flex-1 bg-parchment-50/10" />
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    full
                    disabled={isLoading}
                    onClick={() => { if (error) clearError(); void loginWithGoogle() }}
                    iconLeft={<GoogleGlyph />}
                >
                    {t('auth.continueWithGoogle', { defaultValue: 'Continue with Google' })}
                </Button>

                <div className="text-center text-[14px] text-parchment-400">
                    {t(`auth.${mode}.footerText`)}{' '}
                    <button
                        type="button"
                        className="font-semibold text-ember-400 transition-colors hover:text-ember-300"
                        onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    >
                        {t(`auth.${mode}.footerAction`)}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
