import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shuffle, Sparkles } from 'lucide-react'
import { Icon, TabPanel, Tabs, type TabOption } from '@/ui/primitives'
import { ConsoleSection } from '../shell/ConsoleSection'
import { VoiceDesignPanel } from './VoiceDesignPanel'
import { VoiceRemixPanel } from './VoiceRemixPanel'

type CreateMode = 'design' | 'remix'
const ID_BASE = 'admin-voices-create'

/** Create: Voice Design and Remix (IVC stays off until S-22 and L-13). Both panels stay mounted to keep their sessions. */
export function CreateModule() {
    const { t } = useTranslation()
    const [mode, setMode] = useState<CreateMode>('design')
    const options: TabOption<CreateMode>[] = [
        { value: 'design', label: t('admin.voices.create.design'), icon: <Icon icon={Sparkles} size={15} /> },
        { value: 'remix', label: t('admin.voices.create.remix'), icon: <Icon icon={Shuffle} size={15} /> },
    ]
    return (
        <ConsoleSection icon={Sparkles} title={t('admin.voices.create.title')}>
            <p className="font-ui text-body text-parchment-300">{t('admin.voices.workspace.createHelp')}</p>
            <ol aria-label={t('admin.voices.workspace.createSteps')} className="grid gap-3 font-ui text-label text-parchment-200 sm:grid-cols-3">
                {(['describe', 'compare', 'save'] as const).map((step, index) => <li key={step} className="rounded-lg border border-line-faint bg-surface-raised p-3">
                    <span className="mr-2 font-semibold text-ember-400">{index + 1}.</span>{t(`admin.voices.workspace.${step}`)}
                </li>)}
            </ol>
            <Tabs options={options} value={mode} onChange={setMode} idBase={ID_BASE} aria-label={t('admin.voices.create.modeAria')} size="sm" />
            <TabPanel value="design" idBase={ID_BASE} active={mode}>
                <VoiceDesignPanel />
            </TabPanel>
            <TabPanel value="remix" idBase={ID_BASE} active={mode}>
                <VoiceRemixPanel />
            </TabPanel>
        </ConsoleSection>
    )
}
