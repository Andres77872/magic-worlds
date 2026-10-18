import { Fragment,type ReactNode } from 'react'
import type { StoryDocumentNode,StoryManuscriptDocument } from '@/shared'
import { Button,Icon,IconButton } from '@/ui/primitives'
import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isManuscriptLinkHref } from '../editor/manuscriptLinks'

interface Props {document:StoryManuscriptDocument;onReference?:(id:string,label:string)=>void}
/** Canonical semantic HTML, without TipTap instances, HTML injection or Markdown loss. */
export function ManuscriptProse({document,onReference}:Props){
    const {t}=useTranslation()
    function render(node:StoryDocumentNode,key:number):ReactNode {
        const attrs=node.attrs??{},children=node.content?.map(render)
        const linkedMention=node.type==='codexMention'&&node.marks?.some((mark)=>mark.type==='link'&&isManuscriptLinkHref(mark.attrs?.href))
        let value:ReactNode
        switch(node.type){
            case 'doc':return <Fragment key={key}>{children}</Fragment>
            case 'paragraph':return <p key={key} data-manuscript-node-id={String(attrs.nodeId)}>{children?.length?children:<br/>}</p>
            case 'heading':{const Tag=attrs.level===1?'h1':attrs.level===2?'h2':'h3';return <Tag key={key} data-manuscript-node-id={String(attrs.nodeId)}>{children}</Tag>}
            case 'blockquote':return <blockquote key={key}>{children}</blockquote>
            case 'bulletList':return <ul key={key}>{children}</ul>
            case 'orderedList':return <ol key={key} start={Number(attrs.start??1)}>{children}</ol>
            case 'listItem':return <li key={key}>{children}</li>
            case 'horizontalRule':return <hr key={key}/>
            case 'hardBreak':return <br key={key}/>
            case 'aiBeat':return null
            case 'codexMention':value=linkedMention||!onReference?'@'+String(attrs.label):<Button variant="ghost" size="sm" className="manuscript-reader-reference" onClick={()=>onReference(String(attrs.id),String(attrs.label))}>@{String(attrs.label)}</Button>;break
            case 'text':value=node.text;break
            default:return null
        }
        for(const mark of node.marks??[]){
            if(mark.type==='bold')value=<strong>{value}</strong>
            else if(mark.type==='italic')value=<em>{value}</em>
            else if(mark.type==='strike')value=<s>{value}</s>
            else if(mark.type==='highlight')value=<mark className="manuscript-highlight">{value}</mark>
            else if(mark.type==='link'&&isManuscriptLinkHref(mark.attrs?.href))value=<a href={String(mark.attrs?.href)} title={typeof mark.attrs?.title==='string'?mark.attrs.title:undefined} target="_blank" rel="noopener noreferrer">{value}</a>
        }
        return <Fragment key={key}>{value}{linkedMention&&onReference&&<IconButton size="sm" className="align-middle" label={t('novelEditor.reader.inspectReference',{label:String(attrs.label)})} onClick={()=>onReference(String(attrs.id),String(attrs.label))}><Icon icon={BookOpen} size={14}/></IconButton>}</Fragment>
    }
    return <div className="story-editor-prose manuscript-reader-prose">{render(document.content,0)}</div>
}
