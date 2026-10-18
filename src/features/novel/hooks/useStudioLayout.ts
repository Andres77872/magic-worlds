import { useLayoutEffect, useRef, useState } from 'react'

/** Measure the writing room after the app sidebar has taken its share. */
export function useStudioLayout(readingWidth = 'standard') {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [docked, setDocked] = useState({ outline: true, inspector: true })
    useLayoutEffect(() => {
        const element = containerRef.current
        if (!element) return
        const measure = () => {
            const width = element.getBoundingClientRect().width
            if (width <= 0) return
            const manuscript = parseFloat(getComputedStyle(element).getPropertyValue('--width-manuscript')) || 640
            const outline = width >= manuscript + 224
            const inspector = width >= manuscript + 224 + 300
            setDocked((current) => current.outline === outline && current.inspector === inspector ? current : { outline, inspector })
        }
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [readingWidth])
    return { containerRef, outlineDocked: docked.outline, inspectorDocked: docked.inspector }
}
