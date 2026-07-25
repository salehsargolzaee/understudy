import { REPO } from "./contribute";

/**
 * The browser's side of the PR mechanics, straight against api.github.com
 * (which sends CORS headers). Every function here is idempotent or safely
 * repeatable, so a failed submission can always be retried from the top.
 */
const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message: string, readonly status: number, readonly hint = "") {
    super(message);
  }
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new GitHubError(`Network error: ${String((err as Error)?.message ?? err)}`, 0, "Check your connection and retry.");
  }
  if (!res.ok) {
    let message = `HTTP ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
      if (Array.isArray(body?.errors) && body.errors.length) {
        message += " — " + body.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join("; ");
      }
    } catch { /* non-JSON error body */ }
    throw new GitHubError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const getAuthedUser = (token: string) => gh<{ login: string }>(token, "/user");

export const createFork = (token: string) =>
  gh<{ full_name: string; default_branch: string }>(token, `/repos/${REPO}/forks`, {
    method: "POST",
    body: JSON.stringify({}),
  });

/** The repository owner cannot fork their own repo; their branch goes here. */
export const repoOwner = () => REPO.split("/")[0].toLowerCase();

/** Best-effort: bring an existing fork's default branch up to date with
 *  upstream before branching from it. A failure here is never fatal — a stale
 *  fork still produces a valid PR for a brand-new folder. */
export async function syncForkWithUpstream(token: string, fork: string, branch: string): Promise<void> {
  try {
    await gh(token, `/repos/${fork}/merge-upstream`, {
      method: "POST",
      body: JSON.stringify({ branch }),
    });
  } catch {
    /* merge conflicts or an unrelated fork state — the PR path still works */
  }
}

export async function getRefSha(token: string, repo: string, branch: string): Promise<string> {
  const r = await gh<{ object: { sha: string } }>(token, `/repos/${repo}/git/ref/heads/${branch}`);
  return r.object.sha;
}

/** Forking is asynchronous on GitHub's side; poll until the git data exists. */
export async function forkHeadSha(token: string, fork: string, branch: string, tries = 20): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      return await getRefSha(token, fork, branch);
    } catch (err) {
      if (!(err instanceof GitHubError) || (err.status !== 404 && err.status !== 409)) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new GitHubError("The fork exists but GitHub has not finished preparing it.", 0, "Wait a few seconds and press Retry.");
}

export const createRef = (token: string, repo: string, branch: string, sha: string) =>
  gh(token, `/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });

export interface FileOut {
  path: string;
  contents: string;
}

/** One tree, one commit, one ref update — not a commit per file. */
export async function commitFiles(
  token: string,
  fork: string,
  branch: string,
  parentSha: string,
  files: FileOut[],
  message: string,
): Promise<string> {
  const tree = await gh<{ sha: string }>(token, `/repos/${fork}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parentSha,
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.contents })),
    }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${fork}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });
  await gh(token, `/repos/${fork}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
  return commit.sha;
}

export const openPr = (token: string, head: string, title: string, body: string) =>
  gh<{ html_url: string; number: number }>(token, `/repos/${REPO}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, body, head, base: "main", maintainer_can_modify: true }),
  });

export async function findOpenPr(token: string, login: string, branch: string) {
  const list = await gh<{ html_url: string; number: number }[]>(
    token,
    `/repos/${REPO}/pulls?head=${encodeURIComponent(`${login}:${branch}`)}&state=open`,
  );
  return list[0] ?? null;
}

export function hintFor(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.hint) return err.hint;
    if (err.status === 401) return "Your GitHub session expired. Sign in again.";
    if (err.status === 403) return "GitHub refused — usually a rate limit or a missing `public_repo` scope. Wait a minute, or sign out and back in.";
    if (err.status === 404) return "Not found — the repository may have moved, or the token cannot see it.";
    if (err.status === 422) return "GitHub rejected the request as invalid; the message above says exactly why.";
  }
  return "Every step here is safe to repeat — press Retry.";
}
