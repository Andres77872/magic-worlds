/**
 * Plain-language explanation of the user's own provider key (BYOK): when it is
 * asked for, where it lives (this tab only) and who bills it, plus a control to
 * forget every key held in this session.
 */
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { Button, Card, SectionHeader } from '@/ui/primitives'

export function ByokKeyPanel({ onForget, disabled = false }: { onForget: () => void; disabled?: boolean }) {
    const { t } = useTranslation()
    return <Card className="flex flex-col gap-3 p-4 sm:p-5">
        <SectionHeader icon={KeyRound} title={t('llmProfiles.byok.title')} />
        <p className="max-w-[72ch] font-ui text-body text-parchment-200">{t('llmProfiles.byok.body')}</p>
        <p className="font-ui text-label text-parchment-300">{t('llmProfiles.byok.billing')}</p>
        <div>
            <Button variant="secondary" size="sm" disabled={disabled} onClick={onForget}>{t('llmProfiles.byok.forget')}</Button>
        </div>
    </Card>
}
