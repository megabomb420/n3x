import { useEffect, useRef, useState, type RefObject } from "react";

/** Does this node sit inside something the user can pan sideways? */
function insideHorizontalScroller(node: EventTarget | null, boundary: HTMLElement): boolean {
  let element = node instanceof Element ? node : null;
  while (element && element !== boundary) {
    if (element.scrollWidth > element.clientWidth + 4) {
      const { overflowX } = getComputedStyle(element);
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    element = element.parentElement;
  }
  return false;
}

/**
 * Horizontal swipe on the content column, to step through the tabs.
 *
 * The installed app has no back gesture of its own — an edge swipe is the
 * browser's, and it is blocked by keeping in-app navigation out of the history —
 * so horizontal drags belong to the tabs. The axis is decided once per gesture
 * and only then is the default prevented, which is what keeps vertical scrolling
 * and pull-to-refresh native. Drags that start on a horizontally scrollable
 * board (the Meta tier chips) are left alone.
 */
export function useTabSwipe(
  ref: RefObject<HTMLElement | null>,
  {
    next,
    previous,
    threshold = 64,
    max = 96,
  }: { next?: () => void; previous?: () => void; threshold?: number; max?: number } = {},
) {
  const [dx, setDx] = useState(0);
  const [target, setTarget] = useState<"next" | "previous" | null>(null);
  const gesture = useRef({ x: 0, y: 0, axis: null as null | "x" | "y", distance: 0 });
  const handlers = useRef({ next, previous });
  handlers.current = { next, previous };

  useEffect(() => {
    const column = ref.current;
    if (!column) return;

    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      gesture.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        axis: null,
        distance: 0,
      };
      if (insideHorizontalScroller(event.target, column)) gesture.current.axis = "y";
    };

    const move = (event: TouchEvent) => {
      const state = gesture.current;
      if (event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - state.x;
      const dy = event.touches[0].clientY - state.y;
      if (state.axis === null) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        state.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? "x" : "y";
      }
      if (state.axis !== "x") return;
      state.distance = dx;
      event.preventDefault();
      setDx(Math.max(-max, Math.min(max, dx * 0.4)));
      setTarget(Math.abs(dx) >= threshold ? (dx < 0 ? "next" : "previous") : null);
    };

    const end = () => {
      const state = gesture.current;
      const far = state.axis === "x" && Math.abs(state.distance) >= threshold;
      const direction = state.distance < 0 ? "next" : "previous";
      gesture.current = { x: 0, y: 0, axis: null, distance: 0 };
      setDx(0);
      setTarget(null);
      if (far) handlers.current[direction]?.();
    };

    column.addEventListener("touchstart", start, { passive: true });
    column.addEventListener("touchmove", move, { passive: false });
    column.addEventListener("touchend", end);
    column.addEventListener("touchcancel", end);
    return () => {
      column.removeEventListener("touchstart", start);
      column.removeEventListener("touchmove", move);
      column.removeEventListener("touchend", end);
      column.removeEventListener("touchcancel", end);
    };
  }, [ref, threshold, max]);

  return { dx, target };
}
