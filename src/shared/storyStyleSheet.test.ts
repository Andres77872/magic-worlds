import { expect,it } from 'vitest'
import { isStoryNovelDetails } from './storyNovelDetails'
import { isPacketStyle,isStoryStyleSheet,packetStyle } from './storyStyleSheet'
import type { StoryAssistantCard } from './types/storyAssistant.types'
import type { StoryStyleSheet } from './types/story.types'

const sheet=():StoryStyleSheet=>({conventions:[{term:'grey',rule:'Not gray.',kind:'spelling'},{term:'Aria',rule:'',kind:'name'}],
    examples:[{label:'',text:'The light moved on.'}],voices:[{refId:'ref-mara',traits:'Clipped.',lines:['Move.']},{refId:'ref-gone',traits:'',lines:['Lost.']}]})
const card=(referenceId:string,kind:StoryAssistantCard['kind'],title:string)=>({referenceId,kind,title} as StoryAssistantCard)

it('accepts the bounded style sheet the BFF accepts and refuses everything it refuses',()=>{
    expect(isStoryStyleSheet(sheet())).toBe(true)
    expect(isStoryStyleSheet({conventions:[],examples:[],voices:[]})).toBe(true)
    expect(isStoryNovelDetails({styleSheet:sheet(),styleGuide:'Spare.'})).toBe(true)
    expect(isStoryNovelDetails({styleSheet:null})).toBe(true)
    const invalid:unknown[]=[
        {...sheet(),extra:[]},{conventions:[],examples:[]},
        {...sheet(),conventions:[{term:'grey',rule:'',kind:'colour'}]},
        {...sheet(),conventions:[{term:' grey',rule:'',kind:'spelling'}]},
        {...sheet(),conventions:[{term:'',rule:'',kind:'spelling'}]},
        // The same term twice in one kind, whatever its case; another kind is fine.
        {...sheet(),conventions:[{term:'Straße',rule:'',kind:'spelling'},{term:'STRASSE',rule:'',kind:'spelling'}]},
        {...sheet(),conventions:Array.from({length:151},(_,n)=>({term:'t'+n,rule:'',kind:'other'}))},
        {...sheet(),conventions:[{term:'x'.repeat(121),rule:'',kind:'other'}]},
        {...sheet(),examples:[{label:'',text:'   '}]},
        {...sheet(),examples:Array(6).fill({label:'',text:'Six.'})},
        {...sheet(),voices:[{refId:'ref-mara',traits:'',lines:[]}]},
        {...sheet(),voices:[{refId:'ref-mara',traits:'A',lines:[]},{refId:'ref-mara',traits:'B',lines:[]}]},
        {...sheet(),voices:[{refId:'ref-mara',traits:'',lines:['1','2','3','4']}]},
        {...sheet(),voices:[{refId:'ref-mara',traits:'A',lines:['  ']}]},
    ]
    expect(isStoryStyleSheet({...sheet(),conventions:[{term:'grey',rule:'',kind:'spelling'},{term:'Grey',rule:'',kind:'usage'}]})).toBe(true)
    for(const value of invalid)expect(isStoryStyleSheet(value)).toBe(false)
    expect(isStoryNovelDetails({styleSheet:{conventions:[],examples:[]}})).toBe(false)
})

it('builds the packet style from the sheet and the character cards the packet cites',()=>{
    const cards=[card('ref-mara','character','Mara'),card('ref-place','world','Gull Point')]
    expect(packetStyle(sheet(),cards)).toEqual({conventions:sheet().conventions,examples:sheet().examples,voices:[{referenceId:'ref-mara',name:'Mara',traits:'Clipped.',lines:['Move.']}]})
    expect(packetStyle(sheet(),cards,false)?.examples).toEqual([])
    expect(packetStyle({conventions:[],examples:[],voices:sheet().voices},[card('ref-gone','world','Lost place')])).toBeNull()
    expect(packetStyle(undefined,cards)).toBeNull()
    const style=packetStyle(sheet(),cards)
    expect(isPacketStyle(style,cards)).toBe(true)
    // A voice must name a character card in the same packet, by its title.
    expect(isPacketStyle({...style,voices:[{...style!.voices[0],name:'Other'}]},cards)).toBe(false)
    expect(isPacketStyle({...style,voices:[{referenceId:'ref-place',name:'Gull Point',traits:'x',lines:[]}]},cards)).toBe(false)
    expect(isPacketStyle({conventions:[],examples:[],voices:[]},cards)).toBe(false)
})
