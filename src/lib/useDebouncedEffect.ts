import { useEffect, useRef } from "react";

export function useDebouncedEffect(fn: () => void, deps: unknown[], delay = 400) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = setTimeout(() => ref.current(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
