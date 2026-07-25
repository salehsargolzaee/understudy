import { useSyncExternalStore } from "react";

/**
 * GitHub OAuth, client side. The token lives in sessionStorage (cleared when
 * the tab closes) and is only ever sent to api.github.com. The exchange of
 * code→token goes through /api/github-oauth, the one serverless function.
 */
export const GITHUB_CLIENT_ID: string | undefined = import.meta.env.VITE_GITHUB_CLIENT_ID;
export const authConfigured = Boolean(GITHUB_CLIENT_ID);

const TOKEN_KEY = "understudy.gh.token.v1";
const STATE_KEY = "understudy.gh.oauth.state";
const RETURN_KEY = "understudy.gh.oauth.return";

export interface AuthState {
  token: string | null;
  exchanging: boolean;
  error: string | null;
}

const ss = {
  get(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

let state: AuthState = { token: ss.get(TOKEN_KEY), exchanging: false, error: null };
const listeners = new Set<() => void>();
function set(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const useAuth = (): AuthState => useSyncExternalStore(subscribe, () => state);
export const getToken = () => state.token;

export function signOut() {
  ss.del(TOKEN_KEY);
  set({ token: null, error: null });
}

export function beginLogin(returnHash: string) {
  if (!GITHUB_CLIENT_ID) return;
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  ss.set(STATE_KEY, nonce);
  ss.set(RETURN_KEY, returnHash);
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", GITHUB_CLIENT_ID);
  u.searchParams.set("redirect_uri", `${location.origin}/`);
  u.searchParams.set("scope", "public_repo");
  u.searchParams.set("state", nonce);
  location.assign(u.toString());
}

/** Called once at boot. Detects ?code=… from the GitHub redirect, restores the
 *  hash we left from, and finishes the exchange. Fails in the open. */
export async function completeOAuth(): Promise<void> {
  const qs = new URLSearchParams(location.search);
  const code = qs.get("code");
  const got = qs.get("state");
  const ghError = qs.get("error_description") || qs.get("error");
  if (!code && !ghError) return;

  const expected = ss.get(STATE_KEY);
  const returnHash = ss.get(RETURN_KEY) || "#/new";
  ss.del(STATE_KEY);
  ss.del(RETURN_KEY);

  history.replaceState(null, "", location.pathname); // drop ?code from the URL
  location.hash = returnHash;                        // fires hashchange → router

  if (ghError) { set({ error: `GitHub did not complete sign-in: ${ghError}` }); return; }
  if (!expected || expected !== got) {
    set({ error: "Sign-in state mismatch — this redirect did not come from a sign-in this tab started. Try signing in again." });
    return;
  }
  set({ exchanging: true, error: null });
  try {
    const res = await fetch("/api/github-oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      set({ exchanging: false, error: data.error || `Token exchange failed (HTTP ${res.status}).` });
      return;
    }
    ss.set(TOKEN_KEY, data.access_token);
    set({ token: data.access_token, exchanging: false, error: null });
  } catch (err) {
    set({ exchanging: false, error: `Could not reach the sign-in endpoint: ${String((err as Error)?.message ?? err)}` });
  }
}
