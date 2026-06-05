/**
 * Login / Register modal — Reverie (composed from the Modal primitive).
 */
import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Sparkles, User } from 'lucide-react'
import { useAuth } from '../../app/hooks'
import { Button, Field, Icon, Input, Modal } from '../primitives'

interface LoginModalProps {
    isOpen: boolean
    onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { login, register, isLoading, error, clearError } = useAuth()
    const [isLoginMode, setIsLoginMode] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const success = isLoginMode ? await login(credentials) : await register(credentials)
        if (success) {
            handleClose()
        }
    }

    const handleClose = () => {
        setCredentials({ username: '', password: '' })
        setShowPassword(false)
        setIsLoginMode(true)
        onClose()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setCredentials((prev) => ({ ...prev, [name]: value }))
        if (error) clearError()
    }

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title={isLoginMode ? 'Login' : 'Register'}
            icon={<Icon icon={Sparkles} size={20} className="text-ember-400" />}
        >
            <div className="flex flex-col gap-5">
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
                                placeholder="Enter your password"
                                required
                                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
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
                        iconLeft={isLoading ? <Loader2 size={16} className="animate-spin" /> : undefined}
                    >
                        {isLoading ? 'Authenticating…' : isLoginMode ? 'Login' : 'Register'}
                    </Button>
                </form>

                <div className="text-center text-[14px] text-parchment-400">
                    {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        className="font-semibold text-ember-400 transition-colors hover:text-ember-300"
                        onClick={() => setIsLoginMode(!isLoginMode)}
                    >
                        {isLoginMode ? 'Register' : 'Login'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
