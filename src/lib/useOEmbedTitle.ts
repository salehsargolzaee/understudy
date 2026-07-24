import { useEffect, useState } from "react";

/**
 * Live title for a video that has no name on file (a pasted link to something
 * nobody has catalogued). YouTube's oEmbed endpoint returns the title with no
 * API key; silent on any failure, so the page just falls back to the id. Only
 * used for display — named content still requires video_title in the repo.
 */
export function useOEmbedTitle(videoId: string, skip: boolean): string {
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle("");
    if (skip || !videoId) return;
    let cancelled = false;
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && typeof j.title === "string") setTitle(j.title);
      })
      .catch(() => {
        /* offline or unknown video — the id remains the fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, skip]);
  return title;
}
