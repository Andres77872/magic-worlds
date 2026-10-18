/** Exact plain-projection traces from actual ProseMirror steps, never a text diff. */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import type { StoryAnchorEdit } from '@/shared/types/storyAnnotation.types'
import { documentText,nodeText } from '@/shared/storyDocument'
import { applyStoryAnchorEdits,MAX_ANCHOR_EDITS } from '@/shared/storyAnchorEdits'

const plain=(node:ProseMirrorNode)=>documentText({schemaVersion:1,content:node.toJSON()})
function projectedOffsets(doc:ProseMirrorNode,position:number):number[]{
    const blocks:Array<{node:ProseMirrorNode;pm:number;plain:number}>=[]
    const visit=(node:ProseMirrorNode,pm:number,at:number):number=>{
        if(node.isTextblock){blocks.push({node,pm,plain:at});return nodeText(node.toJSON()).length}
        if(!node.childCount)return nodeText(node.toJSON()).length
        const separator=['paragraph','heading'].includes(node.type.name)?0:['bulletList','orderedList'].includes(node.type.name)?1:2
        let next=at
        node.forEach((child,offset,index)=>{if(index)next+=separator;next+=visit(child,pm+1+offset,next)})
        return next-at
    }
    visit(doc,-1,0)
    for(const block of blocks){
        if(position<block.pm+1||position>block.pm+block.node.nodeSize-1)continue
        let at=block.plain,found:number|null=null
        block.node.forEach((child,offset)=>{
            const start=block.pm+1+offset,end=start+child.nodeSize,length=nodeText(child.toJSON()).length
            if(position>=start&&position<=end&&found===null)found=at+(child.isText?position-start:position===end?length:0)
            at+=length
        })
        return [found??block.plain]
    }
    const preceding=blocks.filter((block)=>block.pm+block.node.nodeSize-1<=position),before=preceding[preceding.length-1]
    const after=blocks.find((block)=>block.pm+1>=position)
    return [...new Set([...(before?[before.plain+nodeText(before.node.toJSON()).length]:[]),...(after?[after.plain]:[])])]
}

export function transactionAnchorEdits(transactions:readonly Transaction[]):StoryAnchorEdit[]|null {
    if(!transactions.length)return []
    const edits:StoryAnchorEdit[]=[],first=plain(transactions[0].before)
    for(const transaction of transactions){
        for(let index=0;index<transaction.steps.length;index++){
            const before=transaction.docs[index],after=transaction.docs[index+1]??transaction.doc
            const source=plain(before),target=plain(after)
            if(source===target)continue
            const ranges:Array<{oldStart:number;oldEnd:number;newStart:number;newEnd:number}>=[]
            transaction.steps[index].getMap().forEach((oldStart,oldEnd,newStart,newEnd)=>ranges.push({oldStart,oldEnd,newStart,newEnd}))
            if(!ranges.length)return null
            const start=ranges[0],end=ranges[ranges.length-1],candidates=new Map<string,StoryAnchorEdit>()
            for(const from of projectedOffsets(before,start.oldStart))for(const to of projectedOffsets(before,end.oldEnd)){
                for(const nextFrom of projectedOffsets(after,start.newStart))for(const nextTo of projectedOffsets(after,end.newEnd)){
                    if(from>to||nextFrom>nextTo||source.slice(0,from)!==target.slice(0,nextFrom)||source.slice(to)!==target.slice(nextTo))continue
                    const edit={from,to,text:target.slice(nextFrom,nextTo)}
                    if(applyStoryAnchorEdits(source,[edit])===target)candidates.set(JSON.stringify(edit),edit)
                }
            }
            // Multiple possible boundary mappings are deliberately unproven.
            if(candidates.size!==1)return null
            edits.push([...candidates.values()][0])
            if(edits.length>MAX_ANCHOR_EDITS)return null
        }
    }
    return applyStoryAnchorEdits(first,edits)===plain(transactions[transactions.length-1].doc)?edits:null
}
