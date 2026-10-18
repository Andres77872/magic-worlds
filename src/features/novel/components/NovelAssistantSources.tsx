import { useTranslation } from 'react-i18next'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import type { StoryAssistantContext } from '@/shared/types/storyAssistant.types'
import { Badge, Callout, Card } from '@/ui/primitives'
import { assistantActionLabel } from '../utils/assistantActions'

/** The same frozen source inspector is used before a turn and beside its historical evidence. */
export function NovelAssistantSources({value,story,current}:{value:StoryAssistantContext;story:StoryOutline;current:boolean}) {
    const {t}=useTranslation(),text=(key:string,options?:Record<string,unknown>)=>t('novelEditor.assistantContext.'+key,options)
    const scenes=story.chapters.flatMap(chapter=>chapter.scenes.map(scene=>({id:scene.id,label:chapter.title+' · '+scene.title})))
    const label=(id:string)=>scenes.find(scene=>scene.id===id)?.label??id
    const chapterLabel=(id:string)=>story.chapters.find(chapter=>chapter.id===id)?.title??id
    const partLabel=(id:string)=>story.parts.find(part=>part.id===id)?.title??id
    // Since part summaries, a Summary request records how much of each unit it covers.
    const held=(unit?:{scenes:number;covered:string[]})=>unit?' · '+(unit.covered.length===unit.scenes?text('coverageAll'):text('coverageSome',{covered:unit.covered.length,count:unit.scenes})):''
    const coverage=value.trace.summaryCoverage
    return <>
                <Callout role="status" tone={current?'success':'warning'}>{text(current?'current':'stale')}</Callout>
                <Card className="space-y-2 p-4">{value.packet.readOnly&&<Badge tone="neutral">{text('readOnly')}</Badge>}<p className="text-label text-parchment-300">{text('preparedQuestion')}</p><p className="whitespace-pre-wrap break-words text-body">{value.packet.message}</p><p className="text-caption text-parchment-300">{text('preparedScope')}: {text(value.packet.scope)} · {text('preparedIntent')}: {text(value.packet.task)}</p>{value.packet.action&&<p className="text-caption text-parchment-300">{t('novelEditor.assistantActions.prepared')}: {assistantActionLabel(t,value.packet.action)}</p>}<p className="text-caption text-parchment-300">{text('preparedBoundary')}: {text(value.packet.revealPolicy)}</p></Card>
                <section aria-label={text('sources')} className="space-y-3">
                    <h3 className="font-display text-h3 text-parchment-50">{text('sources')}</h3>
                    <p className="text-label">{text('sourceCount',{count:value.packet.sources.length})}</p>
                    <p className="text-label text-parchment-200">{text('inputEstimate',{count:value.trace.inputEstimate})}</p>
                    <p className="text-caption text-parchment-300">{text('outputReserve',{count:value.trace.outputReserve,window:value.trace.contextWindow})}</p>
                    {value.packet.sources.map(source=><Card key={source.sceneId} className="space-y-3 p-4">
                        <h4 className="text-label text-parchment-50">{source.chapterTitle} · {source.title}</h4>
                        <p className="text-caption text-parchment-300">{text('revision',{revision:source.revision,metadataRevision:source.metadataRevision})}</p>
                        <div className="flex flex-wrap gap-2"><Badge tone="neutral">{text(source.complete?'whole':'excerpt')}</Badge>{source.readOnly&&<Badge tone="neutral">{text('readOnly')}</Badge>}</div>
                        {source.passages.length?source.passages.map(passage=><figure key={passage.id} className="space-y-2"><figcaption className="break-all font-mono text-caption text-parchment-300">{text('passage',{id:passage.id})}</figcaption><blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{passage.quote}</blockquote></figure>):<p>{text('noProse')}</p>}
                    </Card>)}
                </section>
                {value.packet.cards.length>0&&<section aria-label={text('cards')} className="space-y-3"><h3 className="font-display text-h3">{text('cards')}</h3>{value.packet.cards.map(card=><Card key={card.referenceId} className="space-y-2 p-4"><h4 className="text-label">{card.title}</h4><p className="text-caption text-parchment-300">{text('appliesTo',{scenes:card.appliesTo.map(label).join('; ')})}</p><p className="text-caption text-parchment-300">{card.sourceVersionId?text('pinVersion',{version:card.sourceVersionId}):text('privatePin')}</p><p className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{card.text}</p></Card>)}</section>}
                {value.packet.facts&&<section aria-label={text('facts')} className="space-y-2"><h3 className="font-display text-h3">{text('facts')}</h3><p className="text-caption text-parchment-300">{text('factsHelp')}</p><ul className="space-y-1">{value.packet.facts.map(fact=><li key={fact.id} className="text-body"><Badge tone="neutral">{t('novelEditor.planningViews.facts.kinds.'+fact.kind)}</Badge> <span className="text-label">{fact.subject}</span>{fact.object&&<span className="text-caption text-parchment-300"> → {fact.object}</span>}: {fact.statement} <span className="text-caption text-parchment-300">({fact.fromSceneId?label(fact.fromSceneId):text('factBeginning')} → {fact.untilSceneId?label(fact.untilSceneId):text('factEnd')})</span></li>)}</ul></section>}
                {value.packet.preferences&&<section aria-label={t('novelEditor.assistantPreferences.title')} className="space-y-2"><h3 className="font-display text-h3">{t('novelEditor.assistantPreferences.title')}</h3><p className="text-caption text-parchment-300">{text('preferencesHelp')}</p>
                    <p className="text-body text-parchment-200">{(['length','format','tone','replyLanguage'] as const).map(key=>t('novelEditor.assistantPreferences.'+key)+': '+t('novelEditor.assistantPreferences.choices.'+key+'.'+value.packet.preferences![key])).join(' · ')}</p>
                    {value.packet.preferences.note&&<p className="whitespace-pre-wrap break-words text-body text-parchment-200">{value.packet.preferences.note}</p>}</section>}
                {value.packet.style&&<section aria-label={text('style')} className="space-y-2"><h3 className="font-display text-h3">{text('style')}</h3><p className="text-caption text-parchment-300">{text('styleHelp')}</p>
                    {value.packet.style.conventions.length>0&&<ul className="space-y-1">{value.packet.style.conventions.map(entry=><li key={entry.kind+':'+entry.term} className="text-body"><Badge tone="neutral">{t('novelEditor.styleSheet.kinds.'+entry.kind)}</Badge> <span className="text-label">{entry.term}</span>{entry.rule.trim()&&<span className="text-parchment-200">: {entry.rule}</span>}</li>)}</ul>}
                    {value.packet.style.examples.map((entry,index)=><figure key={index} className="space-y-1"><figcaption className="text-caption text-parchment-300">{entry.label.trim()||t('novelEditor.styleSheet.example',{number:index+1})}</figcaption><blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{entry.text}</blockquote></figure>)}
                    {value.packet.style.voices.map(voice=><div key={voice.referenceId} className="space-y-1"><h4 className="text-label">{text('voice',{name:voice.name})}</h4>{voice.traits.trim()&&<p className="whitespace-pre-wrap text-body text-parchment-200">{voice.traits}</p>}{voice.lines.map((line,index)=><blockquote key={index} className="font-narrative text-body text-parchment-200">{line}</blockquote>)}</div>)}
                </section>}
                {value.packet.chapters&&<section aria-label={text('coverage')} className="space-y-2"><h3 className="font-display text-h3">{text('coverage')}</h3><p className="text-caption text-parchment-300">{text('coverageHelp')}</p>
                    <ul className="space-y-1">{value.packet.chapters.map((row,n)=><li key={row.chapterId} className="text-body text-parchment-200">{text('coverageChapter',{chapter:row.title,count:row.sceneIds.length})}{held(coverage?.chapters[n])}</li>)}
                        {value.packet.parts?.map((row,n)=><li key={row.partId} className="text-body text-parchment-200">{text('coveragePart',{part:row.title,count:coverage?.parts?.[n]?.scenes??0})}{held(coverage?.parts?.[n])}</li>)}
                        <li className="text-body text-parchment-200">{text('coverageBook',{count:value.packet.bookScenes??0})}{held(coverage?.book)}</li></ul></section>}
                {(value.packet.bookSummary||value.trace.bookSummaryOmitted)&&<section aria-label={text('bookSummary')} className="space-y-2"><h3 className="font-display text-h3">{text('bookSummary')}</h3><p className="text-caption text-parchment-300">{text('bookSummaryHelp')}</p>
                    {value.packet.bookSummary&&<p className="whitespace-pre-wrap break-words text-body text-parchment-200">{value.packet.bookSummary.text}</p>}
                    {value.trace.bookSummaryOmitted&&<p className="text-caption text-parchment-300">{text('bookSummaryReasons.'+value.trace.bookSummaryOmitted)}</p>}
                </section>}
                {(value.packet.partSummaries||value.trace.partSummaryExclusions)&&<section aria-label={text('partSummaries')} className="space-y-2"><h3 className="font-display text-h3">{text('partSummaries')}</h3><p className="text-caption text-parchment-300">{text('partSummariesHelp')}</p>
                    {value.packet.partSummaries?.map(row=><figure key={row.partId} className="space-y-1"><figcaption className="text-label">{row.title}</figcaption><p className="whitespace-pre-wrap break-words text-body text-parchment-200">{row.text}</p></figure>)}
                    {value.trace.partSummaryExclusions?.map(row=><p key={row.partId} className="text-caption text-parchment-300">{partLabel(row.partId)} · {text('partSummaryReasons.'+row.reason)}</p>)}
                </section>}
                {(value.packet.chapterSummaries||value.trace.chapterSummaryExclusions)&&<section aria-label={text('chapterSummaries')} className="space-y-2"><h3 className="font-display text-h3">{text('chapterSummaries')}</h3><p className="text-caption text-parchment-300">{text('chapterSummariesHelp')}</p>
                    {value.packet.chapterSummaries?.map(row=><figure key={row.chapterId} className="space-y-1"><figcaption className="text-label">{row.title}</figcaption><p className="whitespace-pre-wrap break-words text-body text-parchment-200">{row.text}</p></figure>)}
                    {value.trace.chapterSummaryExclusions?.map(row=><p key={row.chapterId} className="text-caption text-parchment-300">{chapterLabel(row.chapterId)} · {text('chapterSummaryReasons.'+row.reason)}</p>)}
                </section>}
                {(value.packet.summaries||value.trace.summaryExclusions)&&<section aria-label={text('summaries')} className="space-y-2"><h3 className="font-display text-h3">{text('summaries')}</h3><p className="text-caption text-parchment-300">{text('summariesHelp')}</p>
                    {value.packet.summaries?.map(row=><figure key={row.sceneId} className="space-y-1"><figcaption className="text-label">{label(row.sceneId)} · {text('summaryRevision',{revision:row.revision})}</figcaption><p className="whitespace-pre-wrap break-words text-body text-parchment-200">{row.text}</p></figure>)}
                    {value.trace.summaryExclusions?.map(row=><p key={row.sceneId} className="text-caption text-parchment-300">{label(row.sceneId)} · {text('summaryReasons.'+row.reason)}</p>)}
                </section>}
                {value.packet.conflicts.length>0&&<section aria-label={text('conflicts')} className="space-y-2"><h3 className="font-display text-h3">{text('conflicts')}</h3>{value.packet.conflicts.map(conflict=><Callout tone="warning" key={conflict.kind+':'+conflict.cardId}>{text('conflict',{cardId:conflict.cardId})}<p className="break-all font-mono text-caption">{conflict.referenceIds.join(', ')}</p></Callout>)}</section>}
                <section aria-label={text('exclusions')} className="space-y-2"><h3 className="font-display text-h3">{text('exclusions')}</h3>{value.trace.excluded.map(row=><p className="text-label text-parchment-200" key={row.sceneId}>{label(row.sceneId)} · {text('reasons.'+row.reason)}</p>)}{value.trace.cardExclusions.map((row,n)=><p className="text-label text-parchment-200" key={n}>{row.referenceId} · {label(row.sceneId)} · {text('reasons.'+row.reason)}</p>)}{value.trace.factExclusions&&<p className="text-label text-parchment-200">{text('factsLeftOut',{count:value.trace.factExclusions.length})}</p>}{value.trace.styleOmitted&&<p className="text-label text-parchment-200">{text('styleLeftOut.'+value.trace.styleOmitted)}</p>}{!value.trace.excluded.length&&!value.trace.cardExclusions.length&&!value.trace.factExclusions&&!value.trace.styleOmitted&&<p>{text('noneExcluded')}</p>}</section>
                <details className="space-y-2"><summary className="cursor-pointer text-label text-parchment-200">{text('packet')}</summary><p className="break-all font-mono text-caption text-parchment-300">{text('sourceVersion',{hash:value.sourceVersion})}</p><p className="break-all font-mono text-caption text-parchment-300">{text('packetHash',{hash:value.packetHash})}</p><pre className="whitespace-pre-wrap break-words rounded-md bg-ink-900 p-3 font-mono text-caption text-parchment-200">{JSON.stringify(value.messages,null,2)}</pre></details>
            
    </>
}
