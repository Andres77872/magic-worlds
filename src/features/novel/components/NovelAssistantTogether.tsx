import { useTranslation } from 'react-i18next'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { MAX_CHANGESET_SCENES, MIN_CHANGESET_SCENES } from '@/infrastructure/api/storyGenerationChangesetContract'
import { Button, Callout, Card } from '@/ui/primitives'
import { latestSceneSuggestions, type SuggestionsTogether } from '../hooks/useSuggestionsTogether'

/**
 * Where a conversation holds suggestions for several scenes, accept the latest one of each together as one manuscript
 * change (R14, prose half). One Undo puts every scene back, except a scene written since, which keeps that writing.
 * The result and its Undo stay here, whichever conversation is open, until dismissed.
 */
export function NovelAssistantTogether({ records, story, together, readOnly }: {
    records: NovelAssistantRecord[]; story: StoryOutline; readOnly: boolean
    /** Accepts and undoes behind the studio's save barrier; absent where the manuscript cannot change. */
    together?: SuggestionsTogether
}) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.together.' + key, values)
    if (!together) return null
    const heads = new Map(story.chapters.flatMap((chapter) => chapter.scenes.map((scene) => [scene.id, { scene, chapter }] as const)))
    const label = (sceneId: string) => {
        const found = heads.get(sceneId)
        return found ? (found.chapter.title || text('untitledChapter')) + ' · ' + (found.scene.title || text('untitledScene')) : text('missingScene')
    }
    // Only suggestions still made for their scene's saved text can be accepted; the server checks again.
    const ready = latestSceneSuggestions(records).filter((record) => {
        const proposal = record.result.proposal!, head = heads.get(proposal.sceneId)?.scene
        return head && head.revision === proposal.baseRevision && head.contentHash === proposal.baseContentHash
    })
    const { changeset, undoResult, failure, busy } = together
    if (readOnly || together.readOnly || (ready.length < MIN_CHANGESET_SCENES && !changeset && !failure)) return null
    const tooMany = ready.length > MAX_CHANGESET_SCENES
    return <Card className="space-y-3 p-3" aria-label={text('title')}>
        <h4 className="text-label">{text('title')}</h4>
        {ready.length >= MIN_CHANGESET_SCENES && <>
            <p className="text-body text-parchment-300">{text('help')}</p>
            <ul className="list-disc space-y-1 pl-5 text-body">{ready.map((record) => <li key={record.result.proposal!.id}>{label(record.result.proposal!.sceneId)}</li>)}</ul>
            {tooMany && <Callout tone="warning" role="note">{text('tooMany', { count: MAX_CHANGESET_SCENES })}</Callout>}
            <Button size="sm" disabled={busy || tooMany} onClick={() => void together.accept(ready)}>
                {busy && !changeset ? text('accepting') : text('accept', { count: ready.length })}</Button>
        </>}
        {failure && <Callout tone="warning" role="alert">{text('failure.' + failure)}
            <span className="mt-2 flex flex-wrap gap-2">
                {together.canRetry && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void together.retry()}>{text('retry')}</Button>}
                {!changeset && <Button size="sm" variant="ghost" disabled={busy} onClick={together.dismiss}>{text('dismiss')}</Button>}
            </span></Callout>}
        {changeset && !undoResult && <Callout tone="info" role="status">
            <p>{text('accepted', { count: changeset.scenes.length })}</p>
            <ul className="mt-1 list-disc pl-5">{changeset.scenes.map((scene) => <li key={scene.id}>{label(scene.id)}</li>)}</ul>
            <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void together.undo()}>{busy ? text('undoing') : text('undo')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={together.dismiss}>{text('dismiss')}</Button>
            </div>
        </Callout>}
        {undoResult && <Callout tone={undoResult.kept.length ? 'warning' : 'info'} role="status">
            <p>{text('undone', { count: undoResult.scenes.length })}</p>
            {undoResult.kept.length > 0 && <ul className="mt-1 list-disc pl-5">{undoResult.kept.map((row) =>
                <li key={row.sceneId}>{text('kept.' + row.reason, { scene: label(row.sceneId) })}</li>)}</ul>}
            <Button size="sm" variant="ghost" className="mt-2" onClick={together.dismiss}>{text('dismiss')}</Button>
        </Callout>}
    </Card>
}
