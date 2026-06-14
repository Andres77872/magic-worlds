import { useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { WandSparkles } from 'lucide-react'
import { Card, Chip, SectionHeader } from '@/ui/primitives'
import type { StudioToast } from '../hooks/useVoiceStudio'
import { VoiceCloneForm } from './VoiceCloneForm'
import { VoiceDesignForm } from './VoiceDesignForm'

type CreateMode = 'design' | 'clone'

interface VoiceCreatePanelProps {
    onCreated: () => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
    onSendToLab: (voiceId: string) => void
}

export function VoiceCreatePanel(props: VoiceCreatePanelProps) {
    const { t } = useTranslation()
    const [mode, setMode] = useState<CreateMode>('design')
    const [, startTransition] = useTransition()

    // Swap forms inside a transition so the freshly mounted submit button can't
    // fire a synchronous phantom submit (React 19 discrete-event commit).
    const switchMode = (next: CreateMode) => startTransition(() => setMode(next))

    return (
        <Card>
            <div className="flex flex-col gap-5 p-5">
                <SectionHeader
                    icon={WandSparkles}
                    title={t('admin.voices.create.title')}
                    tone="arcane"
                    right={
                        <div className="flex gap-2" role="group" aria-label={t('admin.voices.create.modeAria')}>
                            <Chip active={mode === 'design'} onClick={() => switchMode('design')}>
                                {t('admin.voices.create.design')}
                            </Chip>
                            <Chip active={mode === 'clone'} onClick={() => switchMode('clone')}>
                                {t('admin.voices.create.clone')}
                            </Chip>
                        </div>
                    }
                />
                {mode === 'design' ? <VoiceDesignForm {...props} /> : <VoiceCloneForm {...props} />}
            </div>
        </Card>
    )
}
