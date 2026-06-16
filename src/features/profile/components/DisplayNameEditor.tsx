/**
 * Inline display-name editor for the profile hero. In view mode it renders the
 * effective name (chosen `display_name`, else the login `username`) with a pencil
 * affordance; clicking it swaps in an input + Save/Cancel. Self-contained: calls
 * `apiService.updateDisplayName` and bubbles the saved value via `onUpdated` so the
 * container can sync the auth context + re-fetch. Provider-free (takes `onUpdated`
 * as a prop) so it renders in Storybook/tests without an AuthProvider.
 *
 * Clearing the field (empty / whitespace) sends `null`, reverting to the username.
 */
import { useEffect, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { apiService, ApiError } from '@/infrastructure/api'
import { Button, Field, Icon, IconButton, Input, Toast } from '@/ui/primitives'
import { effectiveName } from '@/utils/displayName'

/** Display names are capped well under the backend column (VARCHAR(255)). */
const MAX_LENGTH = 50

interface DisplayNameEditorProps {
    /** Immutable login identity — the fallback when no display name is set. */
    username: string
    /** Current persisted display name (null when unset). */
    displayName: string | null
    /** Called with the saved value (null when cleared) after a successful save. */
    onUpdated?: (displayName: string | null) => void
}

interface Notice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

export function DisplayNameEditor({ username, displayName, onUpdated }: DisplayNameEditorProps) {
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(displayName ?? '')
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [ready, setReady] = useState(false)
    const [, startTransition] = useTransition()

    // Resync when the persisted value changes externally (e.g. after refresh()).
    useEffect(() => {
        setValue(displayName ?? '')
    }, [displayName])

    // React 19 phantom-submit guard (see the `react19-phantom-submit` note):
    // opening the editor swaps the pencil for a type=submit button at the same
    // spot. startTransition defers that render out of the discrete click, and this
    // ready-flag (set on the next frame) keeps the same click from firing Save.
    useEffect(() => {
        if (!editing) {
            setReady(false)
            return
        }
        const id = requestAnimationFrame(() => setReady(true))
        return () => cancelAnimationFrame(id)
    }, [editing])

    const trimmed = value.trim()
    const normalized = trimmed.length > 0 ? trimmed : null
    const tooLong = trimmed.length > MAX_LENGTH
    const unchanged = normalized === (displayName ?? null)
    const canSave = ready && !saving && !tooLong && !unchanged

    const openEditor = () => {
        setNotice(null)
        setValue(displayName ?? '')
        startTransition(() => setEditing(true))
    }

    const closeEditor = () => {
        setValue(displayName ?? '')
        startTransition(() => setEditing(false))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSave) return
        setSaving(true)
        try {
            const res = await apiService.updateDisplayName(normalized)
            const saved = res.display_name ?? null
            onUpdated?.(saved)
            setNotice({ tone: 'success', title: t('profile.identity.saved') })
            startTransition(() => setEditing(false))
        } catch (err) {
            setNotice({
                tone: 'error',
                title: t('profile.identity.saveError'),
                message: err instanceof ApiError ? err.message : undefined,
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            {editing ? (
                <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
                    <Field
                        error={tooLong ? t('profile.identity.tooLong', { max: MAX_LENGTH }) : undefined}
                        helper={t('profile.identity.helper', { username })}
                        className="w-full sm:w-auto"
                    >
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') closeEditor()
                            }}
                            placeholder={username}
                            maxLength={80}
                            autoFocus
                            aria-label={t('profile.identity.label')}
                            className="min-w-[15rem]"
                        />
                    </Field>
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={!canSave}
                            iconLeft={saving ? <Loader2 size={15} className="animate-spin" /> : <Icon icon={Check} size={15} />}
                        >
                            {saving ? t('profile.identity.saving') : t('profile.identity.save')}
                        </Button>
                        <IconButton label={t('profile.identity.cancel')} size="sm" onClick={closeEditor} disabled={saving}>
                            <Icon icon={X} size={16} />
                        </IconButton>
                    </div>
                </form>
            ) : (
                <div className="flex items-center gap-2">
                    <h1 className="font-display text-h1 font-semibold text-parchment-50">
                        {effectiveName(displayName, username)}
                    </h1>
                    <IconButton label={t('profile.identity.edit')} size="sm" onClick={openEditor}>
                        <Icon icon={Pencil} size={16} />
                    </IconButton>
                </div>
            )}

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title ?? ''}
                message={notice?.message}
                onClose={() => setNotice(null)}
                autoCloseMs={notice?.tone === 'success' ? 4000 : undefined}
            />
        </>
    )
}
