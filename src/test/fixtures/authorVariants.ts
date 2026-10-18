import native from './storyVariantsNative.json'
import { novel, storyChapter, storyGeneration, storyScene } from './story'
import { studioIndex } from './storyStudio'
import type { StoryGenerationDetail, StoryVariantRecord, StoryVariantSnapshot } from '@/shared'
import type { AuthorVariantContext } from '@/features/novel/persistence/authorVariantJournal'

/** Fictional retained MySQL material; no account, provider or credentials. */
export function authorVariantFixture() {
    const snapshot = structuredClone(native.preview) as StoryVariantSnapshot, parent = snapshot.parent.parent
    const scene = storyScene({ id: parent.sceneId, storyId: snapshot.storyId, chapterId: parent.chapterId, title: 'The sealed letter',
        revision: snapshot.operation.expectedRevision, contentHash: snapshot.operation.expectedContentHash, document: snapshot.baseDocument })
    const index = studioIndex(novel({ id: snapshot.storyId, chapters: [storyChapter({ id: parent.chapterId, storyId: snapshot.storyId, title: 'The letter', scenes: [scene] })] }))
    const generation = storyGeneration({ id: parent.id, storyId: snapshot.storyId, sceneId: parent.sceneId, chapterId: parent.chapterId,
        baseRevision: parent.baseRevision, command: parent.command, inputRange: null, output: parent.output, instruction: parent.instruction })
    const detail: StoryGenerationDetail = { schemaVersion: 1, storyId: snapshot.storyId, generation, chapterTitle: 'The letter', sceneTitle: scene.title, location: 'active' }
    const context: AuthorVariantContext = { parent: snapshot.parent, baseDocument: snapshot.baseDocument, baseContentHash: snapshot.operation.expectedContentHash,
        inputRange: null, chapterTitle: detail.chapterTitle, sceneTitle: detail.sceneTitle }
    const record = structuredClone(native.creationReceipt) as StoryVariantRecord
    return { snapshot, record, scene, index, generation, detail, context }
}
