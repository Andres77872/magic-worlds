import type {RefObject} from 'react';
import {useEffect, useRef} from 'react';

type Event = MouseEvent | TouchEvent;

/**
 * Custom hook that triggers a callback when a click is detected outside of the specified element(s)
 * @param ref - Ref object or array of ref objects to check for outside clicks
 * @param handler - Callback function to execute when an outside click is detected
 * @param excludeRefs - Optional array of refs to exclude from the outside click check
 */
export function useClickOutside<
    T extends HTMLElement = HTMLElement,
    E extends HTMLElement = HTMLElement
>(
    ref: RefObject<T> | Array<RefObject<T>>,
    handler: (event: Event) => void,
    excludeRefs?: Array<RefObject<E>>
) {
    const handlerRef = useRef(handler);

    // Update handler ref if handler changes
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const listener = (event: Event) => {
            // Get the node that was clicked
            const target = event.target as Node;

            // Convert single ref to array for consistent handling
            const refs = Array.isArray(ref) ? ref : [ref];

            // Check if click was inside any of the refs or exclude refs
            const isInsideRef = refs.some(
                (r) => r.current && r.current.contains(target)
            );

            const isInsideExclude = excludeRefs?.some(
                (r) => r.current && r.current.contains(target)
            );

            // If click is outside all refs and not inside any exclude refs, call handler
            if (!isInsideRef && !isInsideExclude) {
                handlerRef.current(event);
            }
        };

        // Add event listeners for both mouse and touch events
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, excludeRefs]) // Fixed dependency array by removing the join operation
}

export default useClickOutside;
