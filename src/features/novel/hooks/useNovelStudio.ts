/** Studio orchestration over one novel/part/chapter/scene organization model. */
import { useCallback,useEffect,useMemo,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, workspaceStorageKey } from '@/shared/workspaceStorage'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import type { StoryChapterOutline } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'
import { useStoryWorkspace } from './useStoryWorkspace'
import { useStoryStructure } from './useStoryStructure'
import { useOutlineView } from './useOutlineView'
import { useStudioView } from './useStudioView'
import { useStudioScene } from './useStudioScene'
function scenesFor(chapter:StoryChapterOutline) {
    return chapter.scenes.filter((scene)=>!scene.trashedAt).sort((a,b)=>a.order-b.order)
}
export function useNovelStudio() {
    const {t}=useTranslation()
    const {activeStory,sceneConfirmation}=useData()
    const {userHash}=useAuth()
    const {setPage}=useNavigation()
    const workspace=useStoryWorkspace(activeStory)
    const workspaceReadOnly=useWorkspaceReadOnly(workspace.workspaceId)
    const readOnly=workspaceReadOnly||activeStory?.status==='archived'||Boolean(activeStory?.trashedAt)
    const [historyOpen,setHistoryOpen]=useState(false)
    const viewKey=userHash&&workspace.workspaceId&&activeStory ? workspaceStorageKey(`magic-worlds:novel-view:v1:${activeStory.id}`,{apiOrigin:apiStorageOrigin(API_BASE_URL),userHash,workspaceId:workspace.workspaceId}) : null
    const outline=useOutlineView(viewKey)
    const view=useStudioView(viewKey)
    const openingScene = sceneConfirmation?.select && sceneConfirmation.scene.storyId === activeStory?.id ? sceneConfirmation.scene.id : null
    const { selectedUnit: viewedUnit, selectUnit: setViewedUnit } = view
    const selectedUnit = openingScene ?? viewedUnit
    useEffect(() => { if (openingScene) setViewedUnit(openingScene) }, [openingScene, setViewedUnit])
    useEffect(()=>{
        if (!activeStory) setPage('gallery-stories')
    },[activeStory,setPage])
    const chapters=useMemo(()=>chaptersFor(activeStory),[activeStory])
    const scenes=useMemo(()=>chapters.flatMap(scenesFor),[chapters])
    const lookup=useMemo(()=>({chapters:new Map(chapters.map((chapter)=>[chapter.id,chapter])),
        parts:new Map((activeStory?.parts??[]).filter((part)=>!part.trashedAt).map((part)=>[part.id,part])),
        scenes:new Map(scenes.map((scene)=>[scene.id,scene]))}),[chapters,scenes,activeStory])
    const selectedChapter=lookup.chapters.get(selectedUnit??'')
    const selectedPart=lookup.parts.get(selectedUnit??'')
    const partChapters=useMemo(()=>selectedPart?chapters.filter((chapter)=>chapter.partId===selectedPart.id):[],[selectedPart,chapters])
    const requestedScene=useMemo(()=>selectedChapter?scenesFor(selectedChapter)[0]??null
        :selectedPart?partChapters.flatMap(scenesFor)[0]??null
        :lookup.scenes.get(selectedUnit??'')??scenes[0]??null,[selectedChapter,selectedPart,partChapters,lookup,selectedUnit,scenes])
    const load=useStudioScene({story:activeStory,requested:requestedScene,unitId:selectedUnit,workspace,confirmation:sceneConfirmation,onSelect:view.selectUnit})
    const selectScene=load.select
    const selectStructure=useCallback((id:string,source?:Parameters<typeof selectScene>[1])=>{void selectScene(id,source)},[selectScene])
    const structure=useStoryStructure(activeStory,workspace,readOnly,selectStructure)
    const activeScene=load.scene
    const activeChapter=activeScene?lookup.chapters.get(activeScene.chapterId)??null:selectedChapter??(selectedPart?partChapters[0]:chapters[0])??null
    const addChapter=async()=>{
        const result=await structure.perform({op:'create',kind:'chapter',...(selectedPart?{parentId:selectedPart.id}:{}),title:t('novelEditor.structure.defaultChapter',{number:chapters.length+1})})
        return result?.chapters.find((chapter)=>!activeStory?.chapters.some((current)=>current.id===chapter.id))??null
    }
    const addScene=async()=>{
        if (!activeChapter) return addChapter()
        return structure.perform({op:'create',kind:'scene',parentId:activeChapter.id,title:t('novelEditor.structure.defaultScene',{number:activeChapter.scenes.filter((scene)=>!scene.trashedAt).length+1})})
    }
    const deleteChapter=async(id:string)=>{await structure.perform({op:'trash',kind:'chapter',id})}
    return {story:activeStory,workspace,workspaceReadOnly,readOnly,chapters,activeChapter,activeScene,scenes,viewKey,...outline,
        selectChapter:selectScene,selectScene,addChapter,addScene,deleteChapter,structure,
        ...view, selectedUnit, viewStorageUnavailable:view.viewStorageUnavailable||outline.outlineStorageUnavailable,
        historyOpen,setHistoryOpen,sceneLoading:load.loading,sceneLoadError:load.error,retryScene:load.retry,setSelectionGuard:load.setSelectionGuard,recheckSelection:load.recheckSelection,deviceCacheStatus:load.deviceCacheStatus}
}
