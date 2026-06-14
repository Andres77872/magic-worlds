import { useTranslation } from 'react-i18next'
import { Chip } from '@/ui/primitives'
import { INTERJECTION_TAGS } from '../constants'

/** Inserts MiniMax T2A text artifacts (pause, interjections, pronunciation) at the caret. */
export function TextArtifactToolbar({ onInsert }: { onInsert: (snippet: string) => void }) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('admin.voices.artifacts.aria')}>
            <span className="font-ui text-xs text-parchment-400">{t('admin.voices.artifacts.insert')}</span>
            <Chip onClick={() => onInsert('<#0.4#>')}>{t('admin.voices.artifacts.pause')}</Chip>
            {INTERJECTION_TAGS.map((tag) => (
                <Chip key={tag} onClick={() => onInsert(tag)}>
                    {tag.replace(/[()]/g, '')}
                </Chip>
            ))}
            <Chip onClick={() => onInsert('word/(wɜːrd)')}>{t('admin.voices.artifacts.pronounce')}</Chip>
        </div>
    )
}
