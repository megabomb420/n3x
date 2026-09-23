import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Pull-to-refresh for a scrolling column, for the installed app where no browser
 * chrome offers one. Native touch listeners, because only a non-passive
 * `touchmove` can stop iOS's rubber band from fighting the gesture.
 *
 * The gesture only starts at the top of the column and only for a downward
 * drag; anything else is left to normal scrolling. Past `threshold` of pull the
 * release refreshes, otherwise the column springs back.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown>,
  { threshold = 64, max = 96, resistance = 0.5 } = {},
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef({ startY: 0, engaged: false, distance: 0 });
  const busy = useRef(false);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await refresh.current();
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const column = ref.current;
    if (!column) return;

    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1 || busy.current) return;
      gesture.current = {
        startY: event.touches[0].clientY,
        engaged: column.scrollTop <= 0,
        distance: 0,
      };
    };

    const move = (event: TouchEvent) => {
      const state = gesture.current;
      if (!state.engaged || event.touches.length !== 1) return;
      const dy = event.touches[0].clientY - state.startY;
      if (dy <= 0 || column.scrollTop > 0) {
        state.engaged = false;
        state.distance = 0;
        setPull(0);
        return;
      }
      state.distance = dy;
      setPull(Math.min(max, dy * resistance));
      // Only once the drag is clearly a pull, so taps and scrolls stay native.
      if (dy > 8) event.preventDefault();
    };

    const end = () => {
      const state = gesture.current;
      const pulled = Math.min(max, state.distance * resistance);
      state.engaged = false;
      state.distance = 0;
      setPull(0);
      if (pulled >= threshold) void run();
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
  }, [ref, run, threshold, max, resistance]);

  return { pull, refreshing, threshold };
}
