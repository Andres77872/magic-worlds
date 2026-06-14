import { Loader2, Globe } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useLanguage } from '@/app/hooks'
import { SUPPORTED_LANGUAGE_OPTIONS, isSupportedLanguage } from '@/app/i18n'
import { Button, Field, Icon, Modal, Select, type SelectOption } from '@/ui/primitives'

interface LanguageSelectorDialogProps {
    open: boolean
    onClose: () => void
}

export function LanguageSelectorDialog({ open, onClose }: LanguageSelectorDialogProps) {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const { language, isSyncing, syncError, setLanguage } = useLanguage()

    const options = useMemo<readonly SelectOption[]>(
        () => SUPPORTED_LANGUAGE_OPTIONS.map((option) => ({
            value: option.code,
            label: t(`language.options.${option.code}.label`),
            textValue: option.nativeLabel,
            description: t(`language.options.${option.code}.description`),
        })),
        [t],
    )

    const handleLanguageChange = (value: string) => {
        if (!isSupportedLanguage(value)) return
        void setLanguage(value)
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t('language.title')}
            icon={<Icon icon={Globe} size={21} className="text-ember-400" />}
            size="sm"
            closeLabel={t('common.close')}
            footer={
                <Button kind="secondary" onClick={onClose}>
                    {t('common.close')}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-[14px] leading-relaxed text-parchment-300">
                    {t('language.description')}
                </p>
                <Field
                    label={t('language.fieldLabel')}
                    helper={isAuthenticated ? t('language.fieldHelperSignedIn') : t('language.fieldHelperLocal')}
                    error={syncError ? t(syncError) : undefined}
                >
                    <Select
                        options={options}
                        value={language}
                        onChange={handleLanguageChange}
                        aria-label={t('language.fieldLabel')}
                        disabled={isSyncing}
                    />
                </Field>
                {isSyncing && (
                    <div className="flex items-center gap-2 font-ui text-[12px] text-parchment-400">
                        <Loader2 size={14} className="animate-spin" />
                        {t('common.saving')}
                    </div>
                )}
            </div>
        </Modal>
    )
}
