import { useTranslation } from 'react-i18next'
import { Phone, ScrollText } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'

interface CallDividerProps {
    voiceSessionId?: string | null
    onViewTranscript?: (voiceSessionId: string) => void
}

export function CallDivider({ voiceSessionId, onViewTranscript }: CallDividerProps) {
    const { t } = useTranslation()
    return (
        <div
            className="my-5 flex items-center gap-3 text-caption text-parchment-400"
            data-testid="call-divider"
        >
            <div className="h-px flex-1 bg-parchment-50/10" aria-hidden />
            <span className="inline-flex items-center gap-1.5 font-ui font-medium text-arcane-300">
                <Icon icon={Phone} size={12} />
                {t('interaction.chat.callDivider')}
            </span>
            {voiceSessionId && onViewTranscript && (
                <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Icon icon={ScrollText} size={12} />}
                    onClick={() => onViewTranscript(voiceSessionId)}
                    data-testid="call-divider-transcript"
                >
                    {t('interaction.chat.viewCallTranscript')}
                </Button>
            )}
            <div className="h-px flex-1 bg-parchment-50/10" aria-hidden />
        </div>
    )
}
