/**
 * Planning views — board, timeline and matrix over the one saved outline.
 * Nothing here copies scene content: every view derives from `story` and
 * opens a scene in Write, where the working position is restored per scene.
 * Unit metadata (status, cast, threads, story-time order) stays in scene
 * details; only the chosen view is local to this panel.
 */

import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import type { StoryOutline } from '@/shared'
import { Badge, Button, Callout, Drawer, Icon, IconButton, TabPanel, Tabs, cx } from '@/ui/primitives'
import { snapshotLabel } from '../utils/codexUtils'
import { chaptersFor } from '../utils/novelUtils'
import { planningScenes, sceneMatrix, storyTimeline, type PlanningScene, type PlanningView } from '../utils/planningViews'
import type { PlanItems } from '../hooks/usePlanItems'
import { NovelFactsPanel, type PassageSelection } from './NovelFactsPanel'
import type { FactCodex } from './NovelFactCodexReview'
import { NovelAppearances, type AppearanceSearch, type AppearanceState } from './NovelAppearances'
import { NovelBulkScenes, type BulkScenes } from './NovelBulkScenes'
import { NovelSummaryStatus, type SummaryRefresh } from './NovelSummaryStatus'
import { LARGE_OUTLINE_SCENES } from './NovelChapterRail'
import type { SceneSummaryWriter } from './NovelAssistantSummaries'

export interface NovelPlanningViewsProps {
    open: boolean
    onClose: () => void
    story: StoryOutline
    activeSceneId: string | null
    /** Resolves false when the writer's current change blocks leaving the scene. */
    onOpenScene: (sceneId: string) => Promise<boolean>
    onEditScene?: (sceneId: string) => void
    /** Story facts for the Facts view; absent while planning items are unavailable. */
    facts?: PlanItems<'fact'>
    /** Open revision tasks per scene, shown on the board. */
    openTasks?: ReadonlyMap<string, number>
    readOnly?: boolean
    getSelection?: () => PassageSelection | null
    /** Manuscript search for character appearances; absent while search is unavailable. */
    appearances?: AppearanceSearch
    /** This novel's Codex, where approved facts are applied after review. */
    codex?: FactCodex
    /** One reviewed action over several selected scenes; absent while the novel is read-only. */
    bulk?: BulkScenes
    /** The Summaries view (rest of K09): re-tie saved summaries, or refresh them with one reviewed assistant request. */
    summaries?: { writer?: SceneSummaryWriter; refresh?: SummaryRefresh }
}

export function NovelPlanningViews(props: NovelPlanningViewsProps) {
    const { t } = useTranslation()
    // The chosen view, bulk selection and appearance results outlive closing the drawer.
    const [view, setView] = useState<PlanningView>('board')
    const [opening, setOpening] = useState<string | null>(null)
    const [blocked, setBlocked] = useState(false)
    const [appearance, setAppearance] = useState<AppearanceState | null>(null)
    const [selecting, setSelecting] = useState(false)
    const [chosen, setChosen] = useState<string[]>([])
    const [boardOpen, setBoardOpen] = useState<ReadonlyMap<string, boolean>>(() => new Map())
    const state: PlanningState = { view, setView, opening, setOpening, blocked, setBlocked, appearance, setAppearance, selecting, setSelecting, chosen, setChosen, boardOpen, setBoardOpen }
    // The Drawer renders nothing while closed, so the views below are not built on every Studio
    // render: in a 1,500-scene novel that cost about 95 ms per keystroke.
    return (
        <Drawer open={props.open} onClose={props.onClose} size="2xl" title={t('novelEditor.planningViews.title')} eyebrow={t('novelEditor.planningViews.eyebrow')} icon={<Icon icon={LayoutGrid} size={18} />}>
            <PlanningContent {...props} state={state} />
        </Drawer>
    )
}

interface PlanningState {
    view: PlanningView; setView: (view: PlanningView) => void
    opening: string | null; setOpening: (id: string | null) => void
    blocked: boolean; setBlocked: (blocked: boolean) => void
    appearance: AppearanceState | null; setAppearance: Dispatch<SetStateAction<AppearanceState | null>>
    selecting: boolean; setSelecting: (selecting: boolean) => void
    chosen: string[]; setChosen: Dispatch<SetStateAction<string[]>>
    /** The author's own show/hide choices for board chapters in a long novel. */
    boardOpen: ReadonlyMap<string, boolean>; setBoardOpen: Dispatch<SetStateAction<ReadonlyMap<string, boolean>>>
}

function PlanningContent({ onClose, story, activeSceneId, onOpenScene, onEditScene, facts, openTasks, readOnly = false, getSelection, appearances, codex, bulk, summaries, state }: NovelPlanningViewsProps & { state: PlanningState }) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.' + key, values)
    const { view, setView, opening, setOpening, blocked, setBlocked, appearance, setAppearance, selecting, setSelecting, chosen, setChosen, boardOpen, setBoardOpen } = state
    const toggle = (id: string) => setChosen((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
    const findAppearances = async (q: string) => {
        if (!appearances) return
        setAppearance({ q, page: null, status: 'loading' })
        try {
            const page = await appearances.find(q)
            setAppearance((old) => old?.q === q ? { q, page, status: 'ready' } : old)
        } catch {
            setAppearance((old) => old?.q === q ? { q, page: null, status: 'failed' } : old)
        }
    }
    const scenes = planningScenes(story)
    const cardName = (id: string) => {
        const ref = story.activeCardRefs.find((item) => item.cardId === id)
        return ref ? snapshotLabel(ref) : copy('unknownCard')
    }
    const openScene = async (id: string) => {
        if (opening) return
        setOpening(id); setBlocked(false)
        try {
            if (await onOpenScene(id)) onClose()
            else setBlocked(true)
        } catch {
            setBlocked(true)
        } finally {
            setOpening(null)
        }
    }
    const sceneLink = (scene: PlanningScene, className?: string) => (
        <button type="button" onClick={() => void openScene(scene.id)} disabled={opening !== null}
            aria-label={copy('openScene', { title: scene.title })} aria-current={scene.id === activeSceneId ? 'location' : undefined}
            className={cx('min-w-0 cursor-pointer truncate text-left font-display font-semibold text-parchment-50 underline-offset-4 hover:underline disabled:cursor-wait', className)}>
            {scene.title}
        </button>
    )
    const detailsButton = (scene: PlanningScene) => onEditScene && (
        <Button size="sm" variant="ghost" aria-label={copy('detailsFor', { title: scene.title })} onClick={() => onEditScene(scene.id)}>{copy('details')}</Button>
    )
    // Archived scenes, and scenes inside archived units, are read-only and cannot join a bulk action.
    const lockedScene = (id: string) => chaptersFor(story).some((chapter) => chapter.scenes.some((scene) => scene.id === id && (scene.status === 'archived' || Boolean(scene.inheritance?.readOnly))))
    const timeline = storyTimeline(scenes)
    // In a long novel the board opens with the current chapter only, like the outline.
    const large = scenes.length > LARGE_OUTLINE_SCENES
    const activeChapterId = scenes.find((scene) => scene.id === activeSceneId)?.chapterId ?? null
    const matrix = sceneMatrix(scenes)
    const parts = [...story.parts].filter((part) => !part.trashedAt).sort((a, b) => a.order - b.order)
    const groups = [...parts.map((part) => ({ id: part.id as string | null, title: part.title })), { id: null, title: copy('noPart') }]
        .map((group) => ({ ...group, chapters: chaptersFor(story).filter((chapter) => (chapter.partId ?? null) === group.id) }))
        .filter((group) => group.chapters.length)

    return (
        <div className="flex flex-col gap-4" data-testid="novel-planning-views">
            <p className="text-caption text-parchment-300">{copy('help')}</p>
            <Tabs idBase="novel-planning" aria-label={copy('label')} value={view} onChange={setView} className="overflow-x-auto"
                options={[...(['board', 'timeline', 'matrix'] as const).map((value) => ({ value, label: copy('tabs.' + value) })), ...(facts ? [{ value: 'facts' as const, label: copy('facts.tab') }] : []), ...(summaries ? [{ value: 'summaries' as const, label: copy('summaries.tab') }] : [])]} />
            {blocked && <Callout tone="warning" role="alert">{copy('blocked')}</Callout>}
            {!scenes.length && <p className="text-caption text-parchment-400">{copy('empty')}</p>}

            <TabPanel value="board" idBase="novel-planning" active={view} className="flex flex-col gap-6">
                {bulk && !readOnly && scenes.length > 1 && <div className="flex flex-col gap-2">
                    <div><Button size="sm" variant="secondary" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setChosen([]) }}>{copy(selecting ? 'bulk.stop' : 'bulk.start')}</Button></div>
                    <NovelBulkScenes story={story} selected={selecting ? chosen.filter((id) => scenes.some((scene) => scene.id === id)) : []} onClear={() => setChosen([])} bulk={bulk} />
                </div>}
                {large && <p className="text-caption text-parchment-400">{copy('boardCollapsed')}</p>}
                {groups.map((group) => (
                    <section key={group.id ?? 'none'} aria-label={group.title} className="flex flex-col gap-4">
                        {(parts.length > 0) && <h3 className="font-display text-body font-semibold text-parchment-100">{group.title}</h3>}
                        {group.chapters.map((chapter) => {
                            const rows = scenes.filter((scene) => scene.chapterId === chapter.id)
                            const shown = !large || (boardOpen.get(chapter.id) ?? chapter.id === activeChapterId)
                            const listId = 'novel-planning-board-' + encodeURIComponent(chapter.id)
                            return (
                                <section key={chapter.id} aria-label={chapter.title} className="flex flex-col gap-2">
                                    <div className="flex min-w-0 items-center gap-1">
                                        {large && rows.length > 0 && <IconButton size="sm" aria-expanded={shown} aria-controls={shown ? listId : undefined}
                                            onClick={() => setBoardOpen((old) => new Map(old).set(chapter.id, !shown))}
                                            label={shown ? copy('hideScenes', { title: chapter.title }) : copy('showScenes', { count: rows.length, title: chapter.title })}><Icon icon={shown ? ChevronDown : ChevronRight} size={14} /></IconButton>}
                                        <h4 className="font-ui text-label font-semibold text-parchment-200">{chapter.title}</h4>
                                    </div>
                                    {shown && <ul id={listId} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {rows.map((scene) => (
                                            <li key={scene.id} className={cx('flex min-w-0 flex-col gap-2 rounded-md border bg-ink-800/60 p-3',
                                                scene.id === activeSceneId ? 'border-ember-500/50' : 'border-parchment-50/10')}>
                                                <div className="flex min-w-0 items-start justify-between gap-2">
                                                    {selecting && bulk && <input type="checkbox" className="mt-1.5 shrink-0" checked={chosen.includes(scene.id)} disabled={lockedScene(scene.id)}
                                                        aria-label={copy('bulk.selectScene', { title: scene.title })} onChange={() => toggle(scene.id)} />}
                                                    {sceneLink(scene)}
                                                    {detailsButton(scene)}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {scene.id === activeSceneId && <Badge tone="ember">{copy('current')}</Badge>}
                                                    {scene.status && <Badge tone="neutral">{t('novelEditor.structure.statuses.' + scene.status)}</Badge>}
                                                    {scene.storyTimeOrder !== null && <Badge tone="neutral">{copy('storyTime', { order: scene.storyTimeOrder })}</Badge>}
                                                    {(openTasks?.get(scene.id) ?? 0) > 0 && <Badge tone="warning">{copy('tasks', { count: openTasks?.get(scene.id) })}</Badge>}
                                                    <Badge tone="neutral">{scene.words === null ? copy('wordsUnknown') : copy('words', { count: scene.words })}</Badge>
                                                </div>
                                                {scene.povCardId && <p className="text-caption text-parchment-300">{copy('pov', { name: cardName(scene.povCardId) })}</p>}
                                                {scene.synopsis && <p className="line-clamp-2 font-narrative text-caption text-parchment-300">{scene.synopsis}</p>}
                                            </li>
                                        ))}
                                    </ul>}
                                </section>
                            )
                        })}
                    </section>
                ))}
            </TabPanel>

            <TabPanel value="timeline" idBase="novel-planning" active={view} mountOnEnter className="flex flex-col gap-4">
                {view === 'timeline' && <>
                    <p className="text-caption text-parchment-400">{copy('timelineHelp')}</p>
                    {scenes.length > 0 && !timeline.timed.length && <p className="text-caption text-parchment-400">{copy('noTimed')}</p>}
                    <ol className="flex flex-col gap-2" aria-label={copy('tabs.timeline')}>
                        {timeline.timed.map((scene) => (
                            <li key={scene.id} className={cx('flex min-w-0 flex-col gap-1.5 rounded-md border-l-2 bg-ink-800/60 px-3 py-2',
                                timeline.flashbacks.has(scene.id) ? 'border-amber-500/60' : 'border-parchment-50/20')}>
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    {sceneLink(scene)}
                                    {detailsButton(scene)}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-caption text-parchment-300">
                                    <Badge tone="neutral">{copy('storyTime', { order: scene.storyTimeOrder })}</Badge>
                                    <Badge tone="neutral">{copy('reading', { number: scene.reading })}</Badge>
                                    {timeline.flashbacks.has(scene.id) && <Badge tone="warning" title={copy('flashbackHelp')}>{copy('flashback')}</Badge>}
                                    {scene.narrativeTime && <span>{scene.narrativeTime}</span>}
                                    <span className="text-parchment-400">{scene.chapterTitle}</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                    {timeline.unknown.length > 0 && (
                        <section aria-label={copy('unknownTitle')} className="flex flex-col gap-2">
                            <h3 className="font-ui text-label font-semibold text-parchment-200">{copy('unknownTitle')}</h3>
                            <p className="text-caption text-parchment-400">{copy('unknownHelp')}</p>
                            <ul className="flex flex-col gap-1">
                                {timeline.unknown.map((scene) => (
                                    <li key={scene.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-ink-800/40 px-3 py-1.5">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Badge tone="neutral">{copy('reading', { number: scene.reading })}</Badge>
                                            {sceneLink(scene)}
                                        </span>
                                        {detailsButton(scene)}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>}
            </TabPanel>

            <TabPanel value="matrix" idBase="novel-planning" active={view} mountOnEnter className="flex flex-col gap-3">
                <p className="text-caption text-parchment-400">{copy('matrixHelp')}</p>
                {scenes.length > 0 && !matrix.characters.length && !matrix.threads.length
                    ? <p className="text-caption text-parchment-400">{copy('noMatrix')}</p>
                    : scenes.length > 0 && (
                        <div className="overflow-x-auto rounded-md border border-parchment-50/10">
                            <table className="w-max min-w-full border-collapse text-caption">
                                <thead>
                                    <tr>
                                        <th scope="col" className="sticky left-0 bg-ink-800 px-2 py-1.5 text-left font-ui text-parchment-300">{copy('scene')}</th>
                                        {scenes.map((scene) => (
                                            <th key={scene.id} scope="col" className="px-1 py-1.5 font-mono font-normal text-parchment-300">
                                                <button type="button" title={scene.title} aria-label={copy('openScene', { title: scene.title })} disabled={opening !== null}
                                                    aria-current={scene.id === activeSceneId ? 'location' : undefined} onClick={() => void openScene(scene.id)}
                                                    className={cx('min-w-7 cursor-pointer rounded-xs px-1 hover:bg-parchment-50/[.06]', scene.id === activeSceneId && 'text-ember-300')}>
                                                    {scene.reading}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                {([['characters', matrix.characters], ['threads', matrix.threads]] as const).map(([kind, rows]) => rows.length > 0 && (
                                    <tbody key={kind}>
                                        <tr><th scope="rowgroup" colSpan={scenes.length + 1} className="sticky left-0 bg-ink-900 px-2 py-1 text-left font-ui text-label font-semibold text-parchment-200">{copy(kind)}</th></tr>
                                        {rows.map((row) => {
                                            const label = kind === 'characters' ? cardName(row) : row
                                            return (
                                                <tr key={row} className="border-t border-parchment-50/5">
                                                    <th scope="row" className="sticky left-0 max-w-48 truncate bg-ink-800 px-2 py-1 text-left font-normal text-parchment-100">
                                                        {kind === 'characters' && appearances
                                                            ? <button type="button" onClick={() => void findAppearances(label)} aria-label={copy('appearances.findFor', { name: label })}
                                                                className="max-w-full cursor-pointer truncate underline-offset-4 hover:underline">{label}</button>
                                                            : label}
                                                    </th>
                                                    {scenes.map((scene) => {
                                                        const pov = kind === 'characters' && scene.povCardId === row
                                                        const present = pov || (kind === 'characters' ? scene.castIds.includes(row) : scene.plotThreads.includes(row))
                                                        return (
                                                            <td key={scene.id} className="px-1 py-1 text-center">
                                                                {pov ? <span className="font-mono text-[11px] text-ember-300">{copy('isPov')}</span>
                                                                    : present ? <span className="text-parchment-100" aria-hidden="true">●</span> : null}
                                                                <span className="sr-only">{pov ? '' : present ? copy('appears') : copy('absent')}</span>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    )}
                {appearances && <NovelAppearances search={appearances} value={appearance} onSearch={(q) => void findAppearances(q)} onOpened={onClose} />}
            </TabPanel>
            {summaries && (
                <TabPanel value="summaries" idBase="novel-planning" active={view} mountOnEnter>
                    <NovelSummaryStatus story={story} readOnly={readOnly} writer={summaries.writer} refresh={summaries.refresh}
                        onOpenScene={(id) => void openScene(id)} onEditScene={onEditScene} />
                </TabPanel>
            )}
            {facts && (
                <TabPanel value="facts" idBase="novel-planning" active={view} mountOnEnter>
                    <NovelFactsPanel scenes={scenes} facts={facts} readOnly={readOnly} activeSceneId={activeSceneId} getSelection={getSelection} codex={codex}
                        subjects={[...new Set(sceneMatrix(scenes).characters.map(cardName))]} />
                </TabPanel>
            )}
        </div>
    )
}
