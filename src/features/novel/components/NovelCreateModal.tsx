/**
 * NovelCreateModal — title/description plus a "begin from" choice: a blank
 * page, or an existing card (character/world/item/adventure). Picking a card
 * sets the story source; the backend clones that card into the codex on
 * creation. Reference reviews freeze the selected snapshots before submission.
 */

import { useState,type ReactNode } from 'react'
import { BookOpenText, Feather, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StoryCreateRequest,StoryWritingTemplate,StorySourceInput,StoryChapterCreateRequest } from '@/shared'
import { isStoryWritingTemplate } from '@/shared/storyWritingTemplate'
import { CardPicker } from '@/features/gallery/media/components/CardPicker'
import type { CardRef } from '@/features/gallery/media/mediaGalleryTypes'
import { Button, Callout, Chip, Field, Icon, Input, Modal, Select, Textarea } from '@/ui/primitives'
import { NovelTemplateEditor } from './NovelTemplateEditor'
import { writingTemplate,type WritingPreset } from '../utils/writingTemplates'
import { ApiError } from '@/infrastructure/api'
import { useCreationSourceReview,type CreationSourceApi } from '../hooks/useCreationSourceReview'
import { NovelCreationSources } from './NovelCreationSources'

type SourceMode = 'blank' | 'card'

export interface NovelCreateModalProps {
    open: boolean
    creating: boolean
    onClose: () => void
    onCreate: (request: StoryCreateRequest) => void|Promise<unknown>
    blocked?: boolean
    recovery?: ReactNode
    sourceApi?:CreationSourceApi
    initial?:{title?:string;card?:CardRef}
    initialRequest?:StoryCreateRequest
}

export function NovelCreateModal({ open, creating, onClose, onCreate,blocked=false,recovery,sourceApi,initial,initialRequest }: NovelCreateModalProps) {
    const { t } = useTranslation()
    const originalSource=initialRequest?.source
    const originalCard=originalSource&&originalSource.kind!=='blank'&&originalSource.kind!=='adventure_session'&&originalSource.id?{type:originalSource.kind,id:originalSource.id,name:originalSource.title??undefined}:initial?.card
    const [title, setTitle] = useState(initialRequest?.title??initial?.title??'')
    const [description, setDescription] = useState(initialRequest?.description??'')
    const [sourceMode, setSourceMode] = useState<SourceMode>(originalCard?'card':'blank')
    const [sourceCard, setSourceCard] = useState<CardRef | undefined>(originalCard)
    const [sourceOverride,setSourceOverride]=useState<StorySourceInput|undefined>(originalSource?.kind==='adventure_session'?structuredClone(originalSource):undefined)
    const source=sourceOverride??(sourceMode==='card'&&sourceCard?{kind:sourceCard.type,id:sourceCard.id,title:sourceCard.name?.trim()||t('novelGallery.create.untitledFallback')}:{kind:'blank' as const})
    const sources=useCreationSourceReview(source,sourceApi,initialRequest)
    const [submitting,setSubmitting]=useState(false),[submitError,setSubmitError]=useState(false)
    type Preset=WritingPreset|'blank'|'recovered'
    const initialTemplate=initialRequest?.template
    const defaultChapters=():StoryChapterCreateRequest[]=>[{title:t('novelGallery.create.firstChapterTitle'),status:null}]
    const [legacyChapters,setLegacyChapters]=useState(()=>structuredClone(initialRequest?.chapters??defaultChapters()))
    const [preset,setPreset]=useState<Preset>(initialTemplate?(['short_story','three_acts','custom'].includes(initialTemplate.key)?initialTemplate.key as WritingPreset:'custom'):initialRequest?.chapters?'recovered':'blank')
    const [template,setTemplate]=useState<StoryWritingTemplate|null>(()=>initialTemplate?structuredClone(initialTemplate):null)
    const [baseline,setBaseline]=useState(()=>JSON.stringify(initialTemplate??null))
    const [replacement,setReplacement]=useState<Preset|null>(null)
    const [templateEpoch,setTemplateEpoch]=useState(0)
    const templateCopy=(key:string)=>t('novelEditor.templates.'+key)
    const templateValid=template===null||isStoryWritingTemplate(template)
    function loadTemplate(next:Preset){
        const value=next==='blank'||next==='recovered'?null:writingTemplate(next,templateCopy)
        if(next==='blank')setLegacyChapters(defaultChapters())
        if(next==='recovered')setLegacyChapters(structuredClone(initialRequest?.chapters??defaultChapters()))
        setPreset(next);setTemplate(value);setBaseline(JSON.stringify(value));setReplacement(null);setTemplateEpoch((epoch)=>epoch+1)
    }
    function chooseTemplate(next:Preset){
        if(next===preset)return
        if(template&&JSON.stringify(template)!==baseline||preset==='recovered')setReplacement(next)
        else loadTemplate(next)
    }

    const reset = () => {
        setTitle('')
        setDescription('')
        setSourceMode('blank')
        setSourceCard(undefined)
        setSourceOverride(undefined)
        loadTemplate('blank')
        sources.reset();setSubmitError(false)
    }

    const close = () => {
        if (creating||submitting) return
        reset()
        onClose()
    }

    const submit = async () => {
        if (creating || submitting || blocked || !templateValid || !sources.canCreate || replacement!==null || (sourceMode === 'card' && !sourceCard)) return
        setSubmitting(true);setSubmitError(false)
        try{await onCreate({
            title: title.trim() || t('novelGallery.create.untitledFallback'),
            description: (initialRequest?description:description.trim()) || undefined,
            ...(initialRequest?.activeContext?{activeContext:initialRequest.activeContext}:{}),
            ...sources.selection,
            ...(sources.hasSources&&sources.current?{expectedSourceVersion:sources.current.value.sourceVersion}:{}),
            ...(template?{template}:{chapters:legacyChapters}),
        })}catch(error){
            if(error instanceof ApiError&&error.code==='STORY_CREATION_SOURCE_CHANGED')sources.changed()
            else setSubmitError(true)
        }finally{setSubmitting(false)}
    }

    const modeButton = (mode: SourceMode, label: string, icon: typeof Feather) => (
        <Chip
            onClick={() => {setSourceOverride(undefined);setSourceMode(mode)}}
            disabled={creating||submitting||blocked}
            active={!sourceOverride&&sourceMode===mode}
            aria-pressed={!sourceOverride&&sourceMode === mode}
            icon={<Icon icon={icon} size={15} />}
            data-testid={`novel-create-source-${mode}`}
        >
            {label}
        </Chip>
    )

    return (
        <><Modal
            open={open}
            onClose={close}
            title={t('novelGallery.create.title')}
            icon={<Icon icon={BookOpenText} size={20} />}
            size="lg"
            className={template?'sm:max-w-4xl':undefined}
            closeLabel={t('common.close')}
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close} disabled={creating||submitting}>
                        {t('novelGallery.create.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={()=>void submit()}
                        disabled={creating || submitting || blocked || !templateValid || !sources.canCreate || replacement!==null || (sourceMode === 'card' && !sourceCard)}
                        iconLeft={<Icon icon={Sparkles} size={15} />}
                        data-testid="novel-create-submit"
                    >
                        {creating||submitting ? t('novelGallery.create.creating') : t('novelGallery.create.create')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                {recovery}
                {submitError&&<Callout tone="warning" role="alert">{t('novelEditor.creationRecovery.failed')}</Callout>}
                <Field label={t('novelGallery.create.titleField')}>
                    <Input
                        value={title}
                        disabled={creating||submitting||blocked}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('novelGallery.create.titlePlaceholder')}
                        autoFocus
                        data-testid="novel-create-title"
                    />
                </Field>
                <Field label={t('novelGallery.create.descriptionField')} helper={t('novelGallery.create.descriptionHelper')}>
                    <Textarea
                        value={description}
                        disabled={creating||submitting||blocked}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder={t('novelGallery.create.descriptionPlaceholder')}
                    />
                </Field>
                <Field label={t('novelGallery.create.beginFrom')}>
                    {sourceOverride&&<p className="mb-2 text-body">{t('novelEditor.sources.savedAdventure')} · {sourceOverride.title}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                        {modeButton('blank', t('novelGallery.create.blank'), Feather)}
                        {modeButton('card', t('novelGallery.create.card'), BookOpenText)}
                        {sourceMode === 'card' && (
                            creating||submitting||blocked?<Chip disabled>{sourceCard?.name||t('novelGallery.create.card')}</Chip>:<CardPicker cardType="all" value={sourceCard} onChange={(card)=>{setSourceCard(card);if(card)sources.setCards((items)=>items.filter((item)=>item.kind!==card.type||item.cardId!==card.id))}} />
                        )}
                    </div>
                    {sourceMode === 'card' && (
                        <p className="m-0 mt-2 font-ui text-xs text-parchment-400">
                            {t('novelGallery.create.cardHint')}
                        </p>
                    )}
                </Field>
                <NovelCreationSources review={sources} disabled={creating||submitting||blocked} primaryKey={sourceCard&&sourceMode==='card'?sourceCard.type+':'+sourceCard.id:undefined}/>
                <Field label={templateCopy('label')} helper={templateCopy('help')}>
                    <Select value={preset} disabled={creating||submitting||blocked} onChange={(next)=>chooseTemplate(next as Preset)}
                        options={(['blank','short_story','three_acts','custom',...(initialRequest?.chapters?['recovered' as const]:[])] as const).map((value)=>({value,label:templateCopy(value)}))}/>
                </Field>
                {preset==='recovered'&&<Callout tone="info"><p>{templateCopy('recoveredHelp')}</p><ul>{legacyChapters.map((chapter,index)=><li key={index}>{chapter.title}{chapter.wordGoal?' · '+t('novelEditor.sources.retainedGoal',{goal:chapter.wordGoal}):''}</li>)}</ul></Callout>}
                {template&&<NovelTemplateEditor key={templateEpoch} value={template} onChange={setTemplate} disabled={creating||submitting||blocked}/>}
                {!templateValid&&<Callout tone="warning" role="alert">{templateCopy('invalid')}</Callout>}
            </div>
        </Modal><Modal open={open&&replacement!==null} title={templateCopy('replaceTitle')} onClose={()=>setReplacement(null)} size="sm" footer={<>
            <Button variant="ghost" onClick={()=>setReplacement(null)}>{t('common.cancel')}</Button>
            <Button disabled={creating||blocked} onClick={()=>{if(replacement!==null)loadTemplate(replacement)}}>{templateCopy('replace')}</Button>
        </>}><p className="text-body text-parchment-200">{templateCopy('replaceHelp')}</p></Modal></>
    )
}
