import type { Meta, StoryObj } from '@storybook/react-vite'
import { CharacterCreator } from '../../character/components/CharacterCreator'
import { WorldCreator } from '../../world/components/WorldCreator'
import { ItemCreator } from '../../item/components/ItemCreator'
import { AdventureCreator } from '../../adventure/components/AdventureCreator'
import { LorebookStudio } from '@/features/lorebook/components/LorebookStudio'
import { LorebookGalleryPage } from '@/features/lorebook/components/LorebookGalleryPage'
import { LorebookResourcesGalleryPage } from '@/features/lorebook/components/LorebookResourcesGalleryPage'
import { NovelStudio } from '@/features/novel/components/NovelStudio'
import { NovelGalleryPage } from '@/features/novel/components/NovelGalleryPage'
import { AuthoringProviders, installAuthoringApi, type AuditState } from './authoringFixtures'
import { MobileTopBar } from '@/ui/components/MobileTopBar'

const routes = { character: CharacterCreator, world: WorldCreator, item: ItemCreator, adventure: AdventureCreator, lorebook: LorebookStudio, lorebooks: LorebookGalleryPage, resources: LorebookResourcesGalleryPage, novel: NovelStudio, novels: NovelGalleryPage }
function AuthoringRoute({ route, state, editing, inAppShell = false }: { route: keyof typeof routes; state: AuditState; editing: boolean; inAppShell?: boolean }) {
    const View = routes[route]
    return <AuthoringProviders route={route} state={state} editing={editing}>{inAppShell
        ? <main data-app-main className="-m-6 flex h-dvh min-w-0 flex-col overflow-y-auto"><MobileTopBar onOpenNav={() => {}} /><View /></main>
        : <View />}</AuthoringProviders>
}
const meta = {
    title: 'Authoring/Routes', component: AuthoringRoute, tags: ['autodocs'],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'The actual authoring routes, isolated with in-memory providers. All API methods are stubbed before render; write and generation actions reject locally. Use these fixtures for desktop/mobile and draft/history/empty/error review.' } } },
    args: { route: 'character', state: 'populated', editing: true },
    argTypes: { route: { options: Object.keys(routes), control: 'select' }, state: { options: ['populated', 'empty', 'error', 'loading', 'draft', 'historical'], control: 'select' }, editing: { control: 'boolean' } },
    beforeEach: ({ args }) => installAuthoringApi(args.state),
} satisfies Meta<typeof AuthoringRoute>
export default meta
type Story = StoryObj<typeof meta>
export const CharacterEdit: Story = {}
export const PersonaEdit: Story = { args: { state: 'persona' } }
export const PersonaInAppShell: Story = { args: { state: 'persona', inAppShell: true } }
export const CharacterNew: Story = { args: { editing: false } }
export const CharacterDraft: Story = { args: { state: 'draft' } }
export const CharacterHistorical: Story = { args: { state: 'historical' } }
export const WorldEdit: Story = { args: { route: 'world' } }
export const WorldNew: Story = { args: { route: 'world', editing: false } }
export const ItemEdit: Story = { args: { route: 'item' } }
export const ItemNew: Story = { args: { route: 'item', editing: false } }
export const AdventureEdit: Story = { args: { route: 'adventure' } }
export const AdventureNew: Story = { args: { route: 'adventure', editing: false } }
export const LorebookEdit: Story = { args: { route: 'lorebook' } }
export const LorebookNew: Story = { args: { route: 'lorebook', editing: false } }
export const LorebookGallery: Story = { args: { route: 'lorebooks' } }
export const LorebookGalleryEmpty: Story = { args: { route: 'lorebooks', state: 'empty' } }
export const LorebookGalleryError: Story = { args: { route: 'lorebooks', state: 'error' } }
export const LorebookGalleryLoading: Story = { args: { route: 'lorebooks', state: 'loading' } }
export const ResourceGallery: Story = { args: { route: 'resources' } }
export const ResourceGalleryEmpty: Story = { args: { route: 'resources', state: 'empty' } }
export const ResourceGalleryError: Story = { args: { route: 'resources', state: 'error' } }
export const ResourceGalleryLoading: Story = { args: { route: 'resources', state: 'loading' } }
export const NovelStudioPopulated: Story = { args: { route: 'novel' } }
export const NovelStudioEmpty: Story = { args: { route: 'novel', state: 'empty' } }
export const NovelGallery: Story = { args: { route: 'novels' } }
export const NovelGalleryEmpty: Story = { args: { route: 'novels', state: 'empty' } }
export const NovelGalleryError: Story = { args: { route: 'novels', state: 'error' } }
export const NovelGalleryLoading: Story = { args: { route: 'novels', state: 'loading' } }
