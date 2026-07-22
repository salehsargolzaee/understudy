/** GitHub identity helpers + the internal profile route, shared by the chip
 *  and the profile page so they can never drift apart. */
export const avatarUrl = (handle: string, px: number) =>
  `https://github.com/${encodeURIComponent(handle)}.png?size=${px}`;
export const githubUrl = (handle: string) => `https://github.com/${encodeURIComponent(handle)}`;
export const profileHash = (handle: string) => `#/u/${encodeURIComponent(handle)}`;
export const initials = (handle: string) =>
  handle
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
