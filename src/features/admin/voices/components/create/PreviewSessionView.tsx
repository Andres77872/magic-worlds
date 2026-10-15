import { useTranslation } from 'react-i18next'
import { Clock, Star } from 'lucide-react'
import { Button, Callout, Icon } from '@/ui/primitives'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import { DesignPreviewGrid } from './DesignPreviewGrid'
import { SaveDesignForm } from './SaveDesignForm'
import type { usePreviewSession } from './usePreviewSession'

/** Previews, the same-session warning, and the save form for the chosen preview. */
export function PreviewSessionView({ state, filenameBase }: { state: ReturnType<typeof usePreviewSession>; filenameBase: string }) {
    const { t } = useTranslation()
    const { languageName, sendToAcceptance } = useVoiceConsole()

    return (
        <div className="flex flex-col gap-4" aria-live="polite">
            {state.generating && <p className="font-ui text-sm text-parchment-200">{t('admin.voices.design.generating')}</p>}
            {state.generateError && (
                <p role="alert" className="font-ui text-sm text-blood-300">
                    {state.generateError}
                </p>
            )}
            {state.saved && (
                <Callout
                    tone="success"
                    role="status"
                    action={
                        <Button variant="secondary" size="sm" iconLeft={<Icon icon={Star} size={14} />} onClick={() => sendToAcceptance(state.saved!.voice_key)}>
                            {t('admin.voices.workspace.reviewVoice')}
                        </Button>
                    }
                >
                    {t('admin.voices.toasts.designSaved')}: {state.saved.display_name}
                    <p>{t('admin.voices.workspace.savedHelp')}</p>
                </Callout>
            )}
            {state.session && (
                <>
                    <p className="font-ui text-caption text-fg-muted">{state.session.provider === 'fish_audio' ? 'Fish Audio' : 'ElevenLabs'}</p>
                    <Callout tone="warning" role="note" icon={<Icon icon={Clock} size={16} />}>
                        {t('admin.voices.design.sessionOnly')}
                    </Callout>
                    <DesignPreviewGrid
                        previews={state.session.previews}
                        chosenId={state.chosenId}
                        onChoose={state.setChosenId}
                        languageName={languageName}
                        filenameBase={filenameBase}
                    />
                    {state.chosen?.save_supported === false && <Callout tone="warning">{t('admin.voices.fish.designSignatureMissing')}</Callout>}
                    {state.chosen && state.chosen.save_supported !== false && (
                        <SaveDesignForm
                            key={state.chosen.generated_voice_id}
                            defaultLanguage={state.chosen.language}
                            saving={state.saving}
                            error={state.saveError}
                            provider={state.session.provider}
                            onSave={(values) => void state.save(values)}
                        />
                    )}
                </>
            )}
        </div>
    )
}
