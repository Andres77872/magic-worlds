/**
 * Login / Register modal — Reverie (composed from the Modal primitive).
 *
 * A segmented switcher at the top makes the active mode (sign in vs create
 * account) unmistakable; register mode adds a confirm-password field since
 * accounts have no email recovery.
 */
import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, LogIn, ShieldCheck, Sparkles, User, UserPlus } from 'lucide-react'
import { useAuth } from '../../app/hooks'
import { Button, cx, Field, Icon, Input, Modal } from '../primitives'

interface LoginModalProps {
    isOpen: boolean
    onClose: () => void
}

type AuthMode = 'login' | 'register'

const COPY: Record<AuthMode, { title: string; subtitle: string; submit: string; submitting: string }> = {
    login: {
        title: 'Welcome back',
        subtitle: 'Sign in to continue your adventures.',
        submit: 'Sign in',
        submitting: 'Signing in…',
    },
    register: {
        title: 'Create your account',
        subtitle: 'Pick a username and password — that’s all you need.',
        submit: 'Create account',
        submitting: 'Creating account…',
    },
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { login, register, isLoading, error, clearError } = useAuth()
    const [mode, setMode] = useState<AuthMode>('login')
    const [showPassword, setShowPassword] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [confirmPassword, setConfirmPassword] = useState('')
    const [confirmError, setConfirmError] = useState<string | null>(null)

    const copy = COPY[mode]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (mode === 'register' && credentials.password !== confirmPassword) {
            setConfirmError("Passwords don't match")
            return
        }
        const success = mode === 'login' ? await login(credentials) : await register(credentials)
        if (success) {
            handleClose()
        }
    }

    const handleClose = () => {
        setCredentials({ username: '', password: '' })
        setConfirmPassword('')
        setConfirmError(null)
        setShowPassword(false)
        setMode('login')
        onClose()
    }

    const switchMode = (next: AuthMode) => {
        if (next === mode) return
        setMode(next)
        setConfirmPassword('')
        setConfirmError(null)
        if (error) clearError()
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

    const modeTab = (key: AuthMode, label: string) => (
        <button
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => switchMode(key)}
            className={cx(
                'rounded-md px-3 py-2 font-ui text-sm font-semibold transition-colors',
                mode === key
                    ? 'bg-ember-500/15 text-ember-300 shadow-[inset_0_0_0_1px_rgba(232,162,74,.35)]'
                    : 'text-parchment-400 hover:text-parchment-200',
            )}
        >
            {label}
        </button>
    )

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title={copy.title}
            icon={<Icon icon={Sparkles} size={20} className="text-ember-400" />}
        >
            <div className="flex flex-col gap-5">
                <div>
                    <div
                        role="tablist"
                        aria-label="Authentication mode"
                        className="grid grid-cols-2 gap-1 rounded-lg border border-parchment-50/10 bg-ink-800 p-1"
                    >
                        {modeTab('login', 'Sign in')}
                        {modeTab('register', 'Create account')}
                    </div>
                    <p className="mt-3 text-[14px] text-parchment-400">{copy.subtitle}</p>
                </div>

                {/* Alpha Version Disclaimer */}
                <div className="flex gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] leading-relaxed text-parchment-200">
                    <Icon icon={AlertTriangle} size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <p>
                        <strong className="text-parchment-50">Alpha Version Notice:</strong> This project is currently in
                        alpha development. Login and registration functionality may change in future updates. User
                        accounts and data may be deleted without prior notification during development phases.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Username" className="mb-0">
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
                                placeholder="Enter your username"
                                required
                                autoComplete="username"
                                className="pl-10"
                            />
                        </div>
                    </Field>

                    <Field label="Password" className="mb-0">
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
                                placeholder={mode === 'login' ? 'Enter your password' : 'Choose a password'}
                                required
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                className="px-10"
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-parchment-400 transition-colors hover:text-parchment-50"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                            </button>
                        </div>
                    </Field>

                    {mode === 'register' && (
                        <Field label="Confirm password" className="mb-0" error={confirmError}>
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
                                    placeholder="Repeat your password"
                                    required
                                    autoComplete="new-password"
                                    className="pl-10"
                                />
                            </div>
                        </Field>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-[13px] text-blood-500">
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

                <div className="text-center text-[14px] text-parchment-400">
                    {mode === 'login' ? 'New to Magic Worlds?' : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        className="font-semibold text-ember-400 transition-colors hover:text-ember-300"
                        onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    >
                        {mode === 'login' ? 'Create an account' : 'Sign in'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
