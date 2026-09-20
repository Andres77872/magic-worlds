/** In-memory Storybook fixtures. No authenticated API operation leaves these stories. */
import { useMemo, type ComponentProps, type ReactNode } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { ApiStatusContext } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { apiService } from '@/infrastructure/api'
import type { Item, Story, StoryCardRef, StoryGeneration } from '@/shared'
import { characters, worlds, templates } from '@/ui/components/lists/fixtures'
import { blankEntryDraft, normalizeLorebook } from '@/features/lorebook/lorebookTransforms'
import { normalizeLorebookResource } from '@/features/lorebook/lorebookResources'
import characterArtwork from '@/assets/marketing/features/characters.webp'

export type AuditState = 'populated' | 'empty' | 'error' | 'loading' | 'draft' | 'historical' | 'persona'
export const noop = () => {}
const done = async () => {}
export const auditItem: Item = { id: 'item-fixture', name: 'The compass of lost things', type: 'relic', rarity: 'rare', description: 'Its needle points toward the last thing its bearer cannot bear to lose.', effects: [], requirements: [], limitations: [] }
export const auditEntry = { ...blankEntryDraft(0), id: 'entry-fixture', lorebookId: 'lore-fixture', title: 'The moonwell', entryType: 'place' as const, content: 'At the heart of Silverwood, the moonwell reflects stars that disappeared centuries ago. The keeper trades a safe passage for a true memory.', keys: ['moonwell', 'Silverwood'], secondaryKeys: ['keeper'] }
export const auditLorebook = normalizeLorebook({ id: 'lore-fixture', name: 'The Silverwood chronicles', description: 'People, places, and secrets beneath the silver trees.', enabled: true, tags: ['forest', 'mystery'], entries: [auditEntry, { ...auditEntry, id: 'secret-fixture', title: 'The keeper’s bargain', entryType: 'secret', isSecret: true, keys: ['bargain'], content: 'The keeper is the last witness to the vanished queen.', revealCondition: 'The traveler offers a memory of the queen.' }], attachments: [], settings: { scanDepth: 4, tokenBudget: 4000, matchWholeWords: true, caseSensitive: false, recursiveScanning: false } })
export const auditResource = normalizeLorebookResource({ id: 'resource-fixture', title: 'Field notes from Silverwood', fileName: 'silverwood.md', fileType: 'md', content: '# Silverwood\n\nThe moonwell lies beyond the old watchtower.\n\n## The keeper\n\nBring a memory to trade for safe passage.', description: 'A traveler’s guide to the forest and its guardian.', triggers: ['Silverwood', 'moonwell'], extractionStatus: 'completed', extraction: { short_summary: 'A guide to Silverwood, the moonwell, and its keeper.', keywords: ['moonwell', 'keeper'], snippets: [] }, createdAt: '2026-09-19T12:00:00Z' })!
export const auditRef: StoryCardRef = { id: 'ref-fixture', storyId: 'story-fixture', chapterId: null, kind: 'character', cardId: characters[0].id!, source: 'manual', enabled: true, precedence: 10, snapshot: { id: characters[0].id!, name: characters[0].name, description: characters[0].description ?? '', race: characters[0].race, story_card_kind: 'character' } }
export const auditGeneration: StoryGeneration = { id: 'generation-fixture', storyId: 'story-fixture', chapterId: 'chapter-fixture', command: 'continue', inputRange: null, promptSummary: 'Let the keeper recognize the traveler.', contextTrace: { cards: [], loreEntries: [], chapters: [], totalEstimatedTokens: 420 }, output: 'The keeper raised her lantern. “You carry a familiar memory,” she said.', status: 'accepted', createdAt: '2026-09-19T12:00:00Z' }
export const auditStory: Story = { id: 'story-fixture', title: 'The last light of Silverwood', description: 'A traveler follows the last map into a forest that remembers everyone.', source: { kind: 'blank', id: null, title: null }, activeCardRefs: [auditRef], activeContext: { includeSelectedCards: true, includeLorebooks: true, includeRecentChapters: 2, tokenBudget: 6000, styleSource: 'current_chapter', customStyleInstruction: null }, chapters: Array.from({ length: 5 }, (_, index) => ({ id: index === 0 ? 'chapter-fixture' : `chapter-${index}`, storyId: 'story-fixture', title: ['The gate held', 'A memory for the keeper', 'The vanished stars', 'Under the silver branches', 'The road home'][index], body: index === 0 ? 'The gate held. Beyond its iron bars, the forest whispered Lyra’s name.\n\nShe unfolded the map one last time. The ink had changed overnight: a silver path now ran straight to the moonwell.\n\n“Someone has been expecting you,” said the keeper.' : '', order: index, status: 'draft', povCardId: null, locationCardId: null, activeCardRefs: [], generationHistory: index === 0 ? [auditGeneration] : [], wordGoal: 1200 })), createdAt: '2026-09-19T12:00:00Z', updatedAt: '2026-09-19T12:00:00Z' }

/** Storybook beforeEach installs mocks before child effects run; cleanup restores every method. */
export function installAuthoringApi(state: AuditState = 'populated') {
    const service = apiService as unknown as Record<string, unknown>
    const originals = new Map<string, { value: unknown; own: boolean }>()
    const replacements: Record<string, (...args: unknown[]) => Promise<unknown>> = {
        getCardDraft: async () => ({ ...characters[0], role: state === 'persona' ? 'persona' : 'character', is_draft: state === 'draft', latest_version_number: 3, based_on_version_number: 3 }),
        getCardVersion: async () => ({ ...characters[0], is_historical: true, viewing_version_number: 2 }),
        getPublishedBody: async () => characters[0],
        getCardUsage: async () => ({ sessions: 2, stories: 1 }),
        listCardVersions: async () => ({ latest_version_number: 3, versions: state === 'empty' ? [] : [3, 2, 1].map(number => ({ version_id: `v${number}`, version_number: number, label: number === 3 ? 'Ready for the next chapter' : 'A first glimpse of the traveler', created_at: '2026-09-19T12:00:00Z' })) }),
        getCharacters: async () => state === 'empty' ? [] : characters,
        getWorlds: async () => state === 'empty' ? [] : worlds,
        getItems: async () => state === 'empty' ? [] : [auditItem],
        getAdventureTemplates: async () => state === 'empty' ? [] : templates,
        getCharacter: async () => characters[0], getWorld: async () => worlds[0], getItem: async () => auditItem,
        getLorebooks: async (_skip, _limit, query) => state === 'empty' || query ? [] : [auditLorebook],
        getLorebookResources: async (_skip, _limit, query) => state === 'empty' || query ? [] : [auditResource],
        getLorebookResource: async () => auditResource,
        getStories: async (_skip, _limit, query) => state === 'empty' || query ? [] : [auditStory],
        listLorebookAttachments: async () => state === 'empty' ? [] : [{id:'attachment-fixture',lorebookId:auditLorebook.id,targetKind:'character_chat',targetId:'fixture',mode:'linked',enabled:true,priority:0}],
        listCardAssistantConversations: async () => ({ conversations: [] }),
        listLorebookAssistantConversations: async () => ({ conversations: [] }),
        listImageJobs: async () => ({ items: state === 'empty' ? [] : [{job_id:'image-fixture',status:'completed',created_at:'2026-09-19T12:00:00Z',assets:[{asset_id:'image-asset-fixture',url:new URL(characterArtwork, window.location.href).href}]}], next_offset: null }),
        listThemeSongs: async () => ({ items: state === 'empty' ? [] : [{job_id:'theme-fixture',status:'completed',target:{type:'character',id:'fixture',display_name:'Lyra Dawnwhisper'},created_at:'2026-09-19T12:00:00Z',assets:[{asset_id:'theme-asset-fixture',url:'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',duration_ms:90000}]}], next_offset: null }),
    }
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(apiService))) {
        const original = service[key]
        if (typeof original !== 'function' || original.constructor.name !== 'AsyncFunction') continue
        originals.set(key, { value: original, own: Object.prototype.hasOwnProperty.call(service, key) })
        service[key] = replacements[key]
            ? state === 'loading' ? () => new Promise(() => {}) : state === 'error' ? async () => { throw new Error('This preview could not load. Try again.')} : replacements[key]
            : async () => { throw new Error('This action is disabled in the visual audit preview.') }
    }
    return () => {
        for (const [key, original] of originals) {
            if (original.own) service[key] = original.value
            else delete service[key]
        }
    }
}

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
type NavigationValue = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>

export function AuthoringProviders({ children, route = 'character', state = 'populated', editing = true }: { children: ReactNode; route?: string; state?: AuditState; editing?: boolean }) {
    const values = useMemo(() => {
        const data = {
            characters, worlds, items: [auditItem], templateAdventures: templates, inProgressAdventures: [], lorebooks: [auditLorebook], stories: [auditStory],
            editingCharacter: editing && route === 'character' ? { ...characters[0], role: state === 'persona' ? 'persona' : 'character' } : null,
            editingWorld: editing && route === 'world' ? worlds[0] : null,
            editingItem: editing && route === 'item' ? auditItem : null,
            editingTemplate: editing && route === 'adventure' ? templates[0] : null,
            editingLorebook: editing && route === 'lorebook' ? (state === 'empty' ? { ...auditLorebook, entries: [] } : auditLorebook) : null,
            activeStory: state === 'empty' ? { ...auditStory, chapters: [{ ...auditStory.chapters[0], body: '' }], activeCardRefs: [] } : auditStory,
            loadingState: { status: 'loaded' }, isLoading: false,
        }
        return new Proxy(data, { get: (target, key) => key in target ? Reflect.get(target, key) : done }) as unknown as DataValue
    }, [editing, route, state])
    const auth = useMemo(() => ({ isAuthenticated: true, isLoading: false, error: null, user: { user_hash: 'visual-audit', username: 'Traveler' }, userHash: 'visual-audit', accountKey: 'visual-audit', authEpoch: 1, sessionPhase: 'authenticated', openLoginModal: noop, closeLoginModal: noop, isLoginModalOpen: false }) as unknown as AuthValue, [])
    const navigation = useMemo(() => ({ currentPage: route, currentHash: '', cardEdit: state === 'historical' ? { cardType: route, cardId: characters[0].id, version: 2 } : null, resourceEdit: null, setPage: noop, goBack: noop, replaceHash: noop, registerNavigationInterceptor: () => noop }) as unknown as NavigationValue, [route, state])
    return <AuthContext.Provider value={auth}><ApiStatusContext.Provider value={{ status: 'online' }}><NavigationContext.Provider value={navigation}><DataContext.Provider value={values}><BackgroundTasksContext.Provider value={{ tasks: [], taskBuckets: { active: [], completed: [], failed: [] }, activeTasks: [], activeCount: 0, drawerOpen: false, openDrawer: noop, closeDrawer: noop, refreshTasks: done, registerTask: noop, registerThemeSongJob: noop, cancelTask: done, clearTerminalTasks: done, terminalHasMore: { completed: false, failed: false }, loadMoreTerminalTasks: done }}><FloatingWindowsProvider>{children}</FloatingWindowsProvider></BackgroundTasksContext.Provider></DataContext.Provider></NavigationContext.Provider></ApiStatusContext.Provider></AuthContext.Provider>
}
