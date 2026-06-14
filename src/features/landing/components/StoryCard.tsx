/**
 * StoryCard — text-forward tile for a novel draft. Stories carry no artwork,
 * so chapters/word-count/context-tags do the talking (absorbed from the old
 * LandingPage StoryRail helpers).
 */

import { useTranslation } from 'react-i18next'
import type { Story } from '@/shared'
import { Card } from '@/ui/components/lists/Card'

function storyChapters(story: Story) {
    return story.chapters ?? story.scenes ?? []
}

function storyWordCount(story: Story): number {
    return storyChapters(story)
        .map((chapter) => chapter.body)
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length
}

function storyContextTags(story: Story): string[] {
    return (story.activeCardRefs ?? [])
        .map((ref) => {
            const snapshot = ref.snapshot ?? {}
            return String(snapshot.name ?? snapshot.title ?? snapshot.alias ?? '').trim()
        })
        .filter(Boolean)
        .slice(0, 3)
}

export interface StoryCardProps {
    story: Story
    onOpen: (story: Story) => void
}

export function StoryCard({ story, onOpen }: StoryCardProps) {
    const { t } = useTranslation()
    const chapters = storyChapters(story)
    const tags = storyContextTags(story)
    const words = storyWordCount(story)

    return (
        <Card
            title={story.title}
            subtitle={t('landing.story.chapters', { count: chapters.length || 1, words })}
            onClick={() => onOpen(story)}
        >
            <div className="flex flex-1 flex-col gap-3">
                <p className="m-0 line-clamp-3 font-narrative text-sm leading-normal text-parchment-400">
                    {story.description?.trim() ||
                        chapters[0]?.body?.trim() ||
                        t('landing.story.fallback')}
                </p>
                {tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-parchment-50/[.06] px-2 py-1 font-ui text-[11px] font-semibold text-parchment-300"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}
