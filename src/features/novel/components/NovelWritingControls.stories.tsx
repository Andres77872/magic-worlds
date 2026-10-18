import { useInvisibleCharacters } from '../hooks/useInvisibleCharacters'
import { useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin,workspaceStorageKey } from '@/shared/workspaceStorage'
import { Button,Field,Select,SwitchRow } from '@/ui/primitives'
import { manuscript } from '@/test/fixtures/story'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'
import { useTypingPreferences } from '../hooks/useTypingPreferences'
import { NovelTypingPreferences } from './NovelTypingPreferences'

const initial=manuscript('Mira kept the source notes beside the window.','controls-first')
initial.content.content![0].content=[{type:'text',text:'Mira kept the '},{type:'text',text:'source notes',marks:[{type:'link',attrs:{href:'https://example.com/notes?chapter=1',title:'Field notes'}}]},{type:'text',text:' beside the window.'}]
initial.content.content!.push({type:'paragraph',attrs:{nodeId:'controls-highlight'},content:[{type:'text',text:'A highlighted passage  with\tspaces and an emoji 🙂.',marks:[{type:'highlight'}]}]})
initial.content.content!.push({type:'paragraph',attrs:{nodeId:'controls-second'},content:[{type:'text',text:'Type here to compare quotes, --, ... and (c). Changing preferences keeps this text intact.'}]})
const key=workspaceStorageKey('magic-worlds:novel-view:v1:controlled-writing-controls',{apiOrigin:apiStorageOrigin(API_BASE_URL),userHash:'controlled-writing-author',workspaceId:'controlled-writing-workspace'})
function Room(){
    const editor=useRef<NovelEditorHandle|null>(null),typing=useTypingPreferences(key),invisibles=useInvisibleCharacters(key)
    const [open,setOpen]=useState(false),[readOnly,setReadOnly]=useState(false),[language,setLanguage]=useState('English')
    const [draft,setDraft]=useState(initial)
    return <div className="novel-reading-room flex h-screen flex-col">
        <div className="space-y-3 p-4">
            <h1 className="font-display text-h3">Writing controls</h1>
            <p className="text-caption text-parchment-300">Controlled fixture: writing stays in this preview; typing choices use a synthetic device scope. No project or provider requests run. Place the cursor in “source notes” and use Ctrl/Cmd+K to inspect its destination.</p>
            <div className="flex flex-wrap gap-2"><Button onClick={()=>editor.current?.openLink()}>{readOnly?'Inspect link':'Add or edit link'}</Button><Button variant="secondary" onClick={()=>setOpen(true)}>Typing preferences</Button></div>
            <Field label="Manuscript language"><Select value={language} onChange={setLanguage} options={[{value:'English',label:'English'},{value:'Español',label:'Español'}]}/></Field>
            <SwitchRow label="Read-only preview" checked={readOnly} onChange={setReadOnly}/>
        </div>
        <section className="novel-reading-surface flex min-h-0 flex-1 flex-col"><NovelEditor ref={editor} initialDocument={draft} codexEntries={[]} readOnly={readOnly}
            showInvisibles={invisibles.preferences.visible} typingPreferences={typing.preferences} manuscriptLanguage={language} onDocumentChange={setDraft} onRequestSaveFlush={async()=>true}
            onGenerate={async()=>{throw new Error('No provider in this preview')}} onAcceptGeneration={async()=>{}} onDiscardGeneration={async()=>{}} onCritiqueResult={()=>{}}/></section>
        <NovelTypingPreferences open={open} onClose={()=>setOpen(false)} value={typing.preferences} onChange={typing.setPreferences} storageUnavailable={typing.storageUnavailable} showInvisibles={invisibles.preferences.visible} onShowInvisibles={visible=>invisibles.setPreferences({visible})} invisiblesUnavailable={invisibles.storageUnavailable}/>
    </div>
}
function Preview(){return <FloatingWindowsProvider><Room/></FloatingWindowsProvider>}
const meta={title:'Novel/Writing controls',component:Preview,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Actual link inspector and dynamic typography preferences around the real editor. Edit/inspect links, switch the manuscript language, choose literal typing, and use manual undo. The preview saves no manuscript to a server; device preferences have an isolated synthetic scope.'}}}} satisfies Meta<typeof Preview>
export default meta
type Story=StoryObj<typeof meta>
export const LinksAndTyping:Story={}

export const HighlightsAndInvisibles:Story={}
