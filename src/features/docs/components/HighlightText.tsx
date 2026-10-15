/** Marks the active docs query inside `text` with `<mark>` (exposed to assistive tech). */
import { splitMatches, useDocsQuery } from './docsQuery'

export function HighlightText({ text }: { text: string }) {
    const query = useDocsQuery()
    const parts = splitMatches(text, query)
    if (parts.length === 1 && !parts[0].match) return <>{text}</>
    return (
        <>
            {parts.map((part, index) =>
                part.match ? (
                    <mark key={index} className="rounded-xs bg-ember-500/25 px-px text-fg">
                        {part.text}
                    </mark>
                ) : (
                    part.text
                ),
            )}
        </>
    )
}
