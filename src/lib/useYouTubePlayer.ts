import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The YouTube IFrame API, wrapped.
 *
 * We only *read* from the player (currentTime / duration) and seek it. Nothing
 * is ever rendered on top of it: the follow-along UI lives in the page below
 * the player, which is what YouTube's terms require.
 *
 * The player is created into a throwaway child node, because YT.Player replaces
 * the element it is given — React must not be managing that node.
 *
 * If the API script is blocked (extensions, offline, strict CSP), `failed` flips
 * and the caller falls back to a plain iframe: no live following, everything
 * else still works.
 */

type YT = any; // the API has no types and we use four methods of it

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YT> | null = null;

function loadApi(): Promise<YT> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YT>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const timer = setTimeout(() => reject(new Error("YouTube API timed out")), 10000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("YouTube API blocked"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerHandle {
  hostRef: React.RefObject<HTMLDivElement>;
  currentTime: number;
  duration: number;
  playing: boolean;
  ready: boolean;
  failed: boolean;
  seekTo: (seconds: number) => void;
}

export function useYouTubePlayer(videoId: string, start: number): PlayerHandle {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT | null>(null);
  const [currentTime, setCurrentTime] = useState(Math.max(0, start));
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    setCurrentTime(Math.max(0, start));
    setDuration(0);
    setReady(false);
    setPlaying(false);

    if (!videoId) return;

    loadApi()
      .then((YT) => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.innerHTML = "";
        const mount = document.createElement("div");
        mount.style.width = "100%";
        mount.style.height = "100%";
        host.appendChild(mount);

        playerRef.current = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            start: Math.max(0, Math.floor(start)),
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: location.origin,
          },
          events: {
            onReady: (e: { target: YT }) => {
              if (cancelled) return;
              setReady(true);
              setDuration(e.target.getDuration?.() || 0);
            },
            onStateChange: (e: { data: number; target: YT }) => {
              if (cancelled) return;
              setPlaying(e.data === 1);
              const d = e.target.getDuration?.() || 0;
              if (d) setDuration((prev) => prev || d);
            },
          },
        });

        poll = setInterval(() => {
          const p = playerRef.current;
          if (!p?.getCurrentTime) return;
          const t = p.getCurrentTime();
          if (typeof t === "number" && !Number.isNaN(t)) setCurrentTime(t);
          const d = p.getDuration?.() || 0;
          if (d) setDuration((prev) => prev || d);
        }, 500);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [videoId, start]);

  const seekTo = useCallback((seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const p = playerRef.current;
    setCurrentTime(s);
    if (p?.seekTo) {
      p.seekTo(s, true);
      p.playVideo?.();
    }
  }, []);

  return { hostRef, currentTime, duration, playing, ready, failed, seekTo };
}
