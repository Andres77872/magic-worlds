import { fireEvent,render,screen } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ManuscriptProse } from './ManuscriptProse'
import type { StoryManuscriptDocument } from '@/shared'

const rich:StoryManuscriptDocument={schemaVersion:1,content:{type:'doc',content:[
    {type:'paragraph',attrs:{nodeId:'p1'},content:[{type:'text',text:'Café 🙂',marks:[{type:'bold'},{type:'italic'},{type:'strike'}]},{type:'hardBreak'},
        {type:'codexMention',attrs:{id:'exact-pin',label:'Mira'}},{type:'text',text:' a link',marks:[{type:'link',attrs:{href:'https://example.com/reading',title:'The road'}}]}]},
    {type:'orderedList',attrs:{nodeId:'l1',start:7},content:[{type:'listItem',attrs:{nodeId:'i1'},content:[{type:'paragraph',attrs:{nodeId:'p2'},content:[{type:'text',text:'The seventh gate.'}]}]}]},
    {type:'horizontalRule',attrs:{nodeId:'r1'}},{type:'aiBeat',attrs:{nodeId:'b1',prompt:'Private planning instruction'}}]}}
it('renders exact semantic rich prose/list starts/links and inspects the saved mention identity without an editor',()=>{
    const inspect=vi.fn(),view=render(<ManuscriptProse document={rich} onReference={inspect}/>),before=JSON.stringify(rich)
    expect(view.container.querySelector('s em strong')).toHaveTextContent('Café 🙂')
    expect(view.container.querySelector('ol')).toHaveAttribute('start','7');expect(view.container.querySelector('hr')).toBeInTheDocument()
    expect(screen.getByRole('link',{name:'a link'})).toHaveAttribute('rel','noopener noreferrer')
    expect(screen.queryByText('Private planning instruction')).not.toBeInTheDocument()
    expect(view.container.querySelector('[contenteditable]')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'@Mira'}));expect(inspect).toHaveBeenCalledWith('exact-pin','Mira')
    expect(JSON.stringify(rich)).toBe(before)
})
it('keeps a linked mention destination and a separate accessible inspector without nested controls',()=>{
    const document=structuredClone(rich),mention=document.content.content![0].content![2]
    mention.marks=[{type:'link',attrs:{href:'https://example.com/mention'}}]
    render(<ManuscriptProse document={document} onReference={()=>{}}/>)
    expect(screen.getByRole('link',{name:'@Mira'})).toHaveAttribute('href','https://example.com/mention')
    expect(screen.getByRole('button',{name:'Inspect saved reference: Mira'}).closest('a')).toBeNull()
})

it('renders author highlights with semantic markup around exact prose and owned reference controls',()=>{
    const document=structuredClone(rich)
    document.content.content![0].content![0].marks!.push({type:'highlight'})
    document.content.content![0].content![2].marks=[{type:'highlight'}]
    const before=JSON.stringify(document),view=render(<ManuscriptProse document={document} onReference={()=>{}}/>)
    expect(view.container.querySelector('mark.manuscript-highlight s em strong')).toHaveTextContent('Café 🙂')
    expect(screen.getByRole('button',{name:'@Mira'}).closest('mark')).toHaveClass('manuscript-highlight')
    expect(JSON.stringify(document)).toBe(before)
})

const value: StoryManuscriptDocument = { schemaVersion: 1, content: { type: 'doc', content: [{ type: 'paragraph', attrs: { nodeId: 'block' }, content: [{ type: 'codexMention', attrs: { id: 'pin', label: 'Mara' }, marks: [{ type: 'highlight' }] }] }] } }

it('renders a passive canonical mention without an inoperative reference button', () => {
    const { container } = render(<ManuscriptProse document={value} />)
    expect(screen.getByText('@Mara')).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('mark')).toHaveTextContent('@Mara')
})
it('keeps existing exact-pin reference inspection when a source callback is available', () => {
    const inspect = vi.fn()
    render(<ManuscriptProse document={value} onReference={inspect} />)
    fireEvent.click(screen.getByRole('button', { name: '@Mara' }))
    expect(inspect).toHaveBeenCalledWith('pin', 'Mara')
})
