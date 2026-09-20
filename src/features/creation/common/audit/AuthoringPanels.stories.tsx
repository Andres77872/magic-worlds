import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardHistoryDrawer } from '../components/CardHistoryDrawer'
import { VersionHistoryDrawer } from '../components/VersionHistoryDrawer'
import { MediaHistoryDrawer } from '../components/MediaHistoryDrawer'
import { NovelCreateModal } from '@/features/novel/components/NovelCreateModal'
import { NovelGenerationHistoryDrawer } from '@/features/novel/components/NovelGenerationHistoryDrawer'
import { CodexEntryDrawer } from '@/features/novel/components/codex/CodexEntryDrawer'
import { CodexLorebookPickerDrawer } from '@/features/novel/components/codex/CodexLorebookPickerDrawer'
import { LorebookResourcePickerDrawer } from '@/features/lorebook/components/LorebookResourcePickerDrawer'
import { ResourceDetailView } from '@/features/lorebook/components/resources/ResourceDetailView'
import { LorebookPreviewBody } from '@/features/lorebook/components/LorebookPreviewBody'
import { LoreEntryPreviewBody } from '@/features/lorebook/components/LoreEntryPreviewBody'
import { Callout } from '@/ui/primitives'
import { AuthoringProviders, auditEntry, auditGeneration, auditLorebook, auditRef, auditResource, installAuthoringApi, noop, type AuditState } from './authoringFixtures'

const panels = ['history', 'versions', 'media', 'new-novel', 'generations', 'codex-entry', 'codex-lorebook', 'resources', 'resource-detail', 'lorebook-preview', 'entry-preview'] as const
type Panel = typeof panels[number]
function AuthoringPanel({ panel, state, create }: { panel: Panel; state: AuditState; create: boolean }) {
    const [tab, setTab] = useState<'images' | 'themes'>('images')
    const [open, setOpen] = useState(true)
    const close = () => setOpen(false)
    const busy = state === 'loading'
    const body = panel === 'history' ? <CardHistoryDrawer open={open} onClose={close} cardType="character" cardId="fixture" cardName="Lyra Dawnwhisper" hasDraft basedOnVersionNumber={3} latestVersionNumber={3} busy={busy} onPublish={noop} onDiscard={noop} onRestore={noop} onView={noop} />
        : panel === 'versions' ? <VersionHistoryDrawer open={open} onClose={close} cardType="character" cardName="Lyra Dawnwhisper" cardId={create ? undefined : 'fixture'} hasDraft onEdit={noop} />
        : panel === 'media' ? <MediaHistoryDrawer open={open} onClose={close} cardType="character" cardName="Lyra Dawnwhisper" themeTargetId={create ? undefined : 'fixture'} tab={tab} onTabChange={setTab} onSelectImage={noop} onSelectTheme={noop} />
        : panel === 'new-novel' ? <NovelCreateModal open={open} onClose={close} creating={busy} onCreate={noop} />
        : panel === 'generations' ? <NovelGenerationHistoryDrawer open={open} onClose={close} generations={state === 'empty' ? [] : [{...auditGeneration, chapterTitle: 'The gate held', prompt: 'Let the keeper recognize the traveler.'}]} />
        : panel === 'codex-entry' ? <CodexEntryDrawer entry={open ? {id:auditRef.id, ref:auditRef, label:'Lyra Dawnwhisper', description:auditRef.snapshot.description, kind:'character', enabled:true} : null} busy={busy} onClose={close} onSave={async () => {}} />
        : panel === 'codex-lorebook' ? <CodexLorebookPickerDrawer open={open} busy={busy} existingEntryIds={new Set()} onClose={close} onClone={async () => {}} />
        : panel === 'resources' ? <LorebookResourcePickerDrawer open={open} lorebook={auditLorebook} onClose={close} onAttached={noop} />
        : panel === 'resource-detail' ? <ResourceDetailView resource={create ? {...auditResource, id:'new',title:'',content:'',description:'',triggers:[]} : auditResource} isCreate={create} loading={busy} saving={false} onSave={async () => false} onSyncMetadata={async () => false} onDelete={noop} onBack={noop} banner={state === 'error' ? <Callout tone="danger">This resource could not be saved. Your edits are still here.</Callout> : undefined} />
        : panel === 'lorebook-preview' ? <div className="mx-auto max-w-xl p-6"><LorebookPreviewBody lorebook={auditLorebook} /></div>
        : <div className="mx-auto max-w-xl p-6"><LoreEntryPreviewBody entry={auditEntry} sourceName={auditLorebook.name} /></div>
    return <AuthoringProviders state={state}>{body}</AuthoringProviders>
}
const meta = {
    title: 'Authoring/Panels', component: AuthoringPanel, tags: ['autodocs'], parameters: {layout:'fullscreen'},
    args: {panel:'history', state:'populated', create:false},
    argTypes: {panel:{control:'select',options:panels},state:{control:'select',options:['populated','empty','error','loading']},create:{control:'boolean'}},
    beforeEach: ({args}) => installAuthoringApi(args.state),
} satisfies Meta<typeof AuthoringPanel>
export default meta
type Story = StoryObj<typeof meta>
export const CardHistory: Story = {}
export const CardHistoryEmpty: Story = {args:{state:'empty'}}
export const CardHistoryError: Story = {args:{state:'error'}}
export const CardHistoryLoading: Story = {args:{state:'loading'}}
export const VersionHistory: Story = {args:{panel:'versions'}}
export const VersionHistoryUnsaved: Story = {args:{panel:'versions',create:true}}
export const MediaPopulated: Story = {args:{panel:'media'}}
export const MediaEmpty: Story = {args:{panel:'media',state:'empty'}}
export const MediaError: Story = {args:{panel:'media',state:'error'}}
export const MediaLoading: Story = {args:{panel:'media',state:'loading'}}
export const MediaUnsaved: Story = {args:{panel:'media',create:true}}
export const NewNovel: Story = {args:{panel:'new-novel'}}
export const NewNovelBusy: Story = {args:{panel:'new-novel',state:'loading'}}
export const GenerationHistory: Story = {args:{panel:'generations'}}
export const GenerationHistoryEmpty: Story = {args:{panel:'generations',state:'empty'}}
export const CodexEntry: Story = {args:{panel:'codex-entry'}}
export const CodexLorebooks: Story = {args:{panel:'codex-lorebook'}}
export const CodexLorebooksEmpty: Story = {args:{panel:'codex-lorebook',state:'empty'}}
export const CodexLorebooksError: Story = {args:{panel:'codex-lorebook',state:'error'}}
export const ResourcePicker: Story = {args:{panel:'resources'}}
export const ResourcePickerEmpty: Story = {args:{panel:'resources',state:'empty'}}
export const ResourcePickerError: Story = {args:{panel:'resources',state:'error'}}
export const ResourceDetail: Story = {args:{panel:'resource-detail'}}
export const ResourceCreate: Story = {args:{panel:'resource-detail',create:true}}
export const ResourceLoading: Story = {args:{panel:'resource-detail',state:'loading'}}
export const ResourceError: Story = {args:{panel:'resource-detail',state:'error'}}
export const LorebookPreview: Story = {args:{panel:'lorebook-preview'}}
export const LoreEntryPreview: Story = {args:{panel:'entry-preview'}}
