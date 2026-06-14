import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { apiService, ApiError } from '@/infrastructure/api'
import { Button, Card, Field, Icon, Input, SectionHeader, Toast } from '@/ui/primitives'

interface Notice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

/**
 * Change-password form for the signed-in user. The BFF surfaces the provider's
 * structured errors, so a wrong current password (401/AUTH_1001), a weak new
 * password (422/VAL_3007) and rate-limiting (429 + Retry-After) map to precise
 * messages. The provider preserves the current session, so there is no logout.
 */
export function AccountSecuritySection() {
    const { t } = useTranslation()
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [confirm, setConfirm] = useState('')
    const [show, setShow] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [fieldError, setFieldError] = useState<{ field: 'current' | 'next' | 'confirm'; message: string } | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)

    const errorFor = (field: 'current' | 'next' | 'confirm') =>
        fieldError?.field === field ? fieldError.message : undefined

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFieldError(null)
        if (next !== confirm) {
            setFieldError({ field: 'confirm', message: t('profile.security.mismatch') })
            return
        }
        setSubmitting(true)
        try {
            await apiService.changePassword(current, next)
            setCurrent('')
            setNext('')
            setConfirm('')
            setNotice({ tone: 'success', title: t('profile.security.success'), message: t('profile.security.successBody') })
        } catch (err) {
            if (err instanceof ApiError) {
                // The BFF forwards the provider's error code, so a wrong current
                // password (AUTH_1001) is distinguishable from a genuinely expired
                // token (a different 401 code). Fall back to a bare 401 when the
                // code is absent.
                if (err.code === 'AUTH_1001' || (err.status === 401 && !err.code)) {
                    setFieldError({ field: 'current', message: t('profile.security.wrongPassword') })
                } else if (err.status === 422 || err.code === 'VAL_3007') {
                    setFieldError({ field: 'next', message: t('profile.security.weak') })
                } else if (err.status === 429) {
                    setNotice({
                        tone: 'error',
                        title: err.retryAfterSeconds
                            ? t('profile.security.rateLimited', { seconds: err.retryAfterSeconds })
                            : t('profile.security.rateLimitedGeneric'),
                    })
                } else {
                    setNotice({ tone: 'error', title: t('profile.security.genericError'), message: err.message })
                }
            } else {
                setNotice({ tone: 'error', title: t('profile.security.genericError') })
            }
        } finally {
            setSubmitting(false)
        }
    }

    const passwordField = (
        field: 'current' | 'next' | 'confirm',
        label: string,
        value: string,
        onChange: (v: string) => void,
        autoComplete: string,
        leadIcon: typeof Lock,
    ) => (
        <Field label={label} className="mb-0" error={errorFor(field)}>
            <div className="relative">
                <Icon icon={leadIcon} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                <Input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => { onChange(e.target.value); if (fieldError) setFieldError(null) }}
                    required
                    autoComplete={autoComplete}
                    className="px-10"
                />
                {field === 'current' && (
                    <button
                        type="button"
                        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-parchment-400 transition-colors hover:text-parchment-50"
                        onClick={() => setShow((v) => !v)}
                        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                        {show ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                    </button>
                )}
            </div>
        </Field>
    )

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader icon={ShieldCheck} title={t('profile.security.title')} />
            <Card className="px-5 py-5">
                <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
                    {passwordField('current', t('profile.security.current'), current, setCurrent, 'current-password', Lock)}
                    {passwordField('next', t('profile.security.new'), next, setNext, 'new-password', KeyRound)}
                    {passwordField('confirm', t('profile.security.confirm'), confirm, setConfirm, 'new-password', ShieldCheck)}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={submitting}
                            iconLeft={submitting ? <Loader2 size={15} className="animate-spin" /> : <Icon icon={KeyRound} size={15} />}
                        >
                            {submitting ? t('profile.security.submitting') : t('profile.security.submit')}
                        </Button>
                    </div>
                </form>
            </Card>

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title ?? ''}
                message={notice?.message}
                onClose={() => setNotice(null)}
                autoCloseMs={notice?.tone === 'success' ? 4000 : undefined}
            />
        </section>
    )
}
