import { profileHash } from "../lib/github";
import Avatar from "./Avatar";
/**
 * Author identity. The whole chip now links to the internal contributor
 * profile (#/u/<handle>) — the profile page is where the GitHub link lives.
 */
interface Props {
  handle: string;
  role?: string;
  tone?: "light" | "dark";
}
export default function AuthorChip({ handle, role = "Author", tone = "light" }: Props) {
  const dark = tone === "dark";
  if (!handle || handle === "unknown") return null;
  return (
    <a
      href={profileHash(handle)}
      title={`View @${handle}'s contributor profile`}
      className={`flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors ${
        dark ? "hover:bg-white/[0.08]" : "hover:bg-ink-900/[0.05]"
      }`}
    >
      <Avatar handle={handle} px={32} dark={dark} />
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-mono text-[11px] font-medium ${dark ? "text-zinc-200" : "text-ink-950"}`}>
          @{handle}
        </span>
        <span className={`label block truncate text-[9px] ${dark ? "text-ink-600" : "text-ink-500"}`}>{role}</span>
      </span>
    </a>
  );
}
