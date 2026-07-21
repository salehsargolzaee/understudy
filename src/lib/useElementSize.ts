import { useEffect, useRef, useState } from "react";

/**
 * Observed box size of an element. Used to letterbox the video into whatever
 * height its pane is dragged to, since CSS aspect-ratio plus a max-height either
 * distorts the frame or crops YouTube's controls.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}
