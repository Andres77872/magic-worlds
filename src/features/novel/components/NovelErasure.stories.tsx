import { useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button,Callout } from '@/ui/primitives'
import { eraseAck,erasePreview,eraseWrite } from '@/test/fixtures/storyErase'
import type { StoryEraseAcknowledgement } from '@/shared'
import type { EraseError,NovelErases,PendingNovelErase } from '../hooks/useNovelErases'
import { NovelEraseModal } from './NovelEraseModal'
import { NovelPendingErases } from './NovelPendingErases'

function ErasureDemo({lostResponse=false,missingResult=false,readOnly=false,initialPending=false}:{lostResponse?:boolean;missingResult?:boolean;readOnly?:boolean;initialPending?:boolean}){
    const source=erasePreview(),initial=eraseWrite()
    const [open,setOpen]=useState(false),[done,setDone]=useState(false),[error,setError]=useState<EraseError|null>(null)
    const [items,setItems]=useState<PendingNovelErase[]>(()=>initialPending?[{schema:1,write:{storyId:source.storyId,write:initial}}]:[])
    const saved=useRef<StoryEraseAcknowledgement|null>(initialPending&&!missingResult?eraseAck(initial):null)
    const complete=(record:PendingNovelErase)=>{
        const ack=eraseAck(record.write.write);saved.current=ack;setItems([]);setError(null);setDone(true);return ack
    }
    const erases:NovelErases={scopeKey:'controlled-erasure',items,error,readOnly,preview:async()=>source,hasPending:()=>items.length>0,busy:()=>false,isErased:()=>done,
        start:async(_preview,write)=>{
            const record:PendingNovelErase={schema:1,write:{storyId:source.storyId,write}}
            if(lostResponse){saved.current=eraseAck(write);setItems([record]);setError('failed');throw new Error('Controlled lost response')}
            return complete(record)
        },
        check:async(record)=>{
            if(saved.current){setItems([]);setError(null);setDone(true);return saved.current}
            setItems([{...record,checkedMissing:true}]);setError('notFound');return null
        },
        retry:async(record)=>readOnly?null:complete(record),
    }
    return <div className="mx-auto max-w-3xl space-y-5">
        <p className="text-caption text-parchment-300">Controlled Trash fixture. All results stay in this preview; no backend requests or browser journals are written.</p>
        {done?<Callout tone="success">Erasure confirmed for “The closed door”. Source cards and independent novels remain.</Callout>:<Button variant="secondary" disabled={readOnly||items.length>0} onClick={()=>setOpen(true)}>Review erasure from Trash</Button>}
        <NovelPendingErases erases={erases}/>
        {open&&<NovelEraseModal source={{id:source.storyId,title:source.title}} erases={erases} onClose={()=>setOpen(false)} onErased={()=>setDone(true)}/>}
    </div>
}
const meta={title:'Novel/Erasure and recovery',component:ErasureDemo,tags:['autodocs'],
    parameters:{layout:'padded',docs:{description:{component:'Explicit one-novel erasure with source review, exact-title confirmation and reachable result recovery. Synthetic results preserve all other content.'}}},
    args:{lostResponse:false,missingResult:false,readOnly:false,initialPending:false},
} satisfies Meta<typeof ErasureDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Confirmation:Story={}
export const LostResponse:Story={args:{lostResponse:true}}
export const MissingResult:Story={args:{initialPending:true,missingResult:true}}
export const ArchivedResult:Story={args:{initialPending:true,readOnly:true}}
