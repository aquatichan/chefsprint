// Client for the Chefsprint engine API (SSE live progress).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** Max recipes per cookbook. Mirrors the engine's MAX_REQUESTS (JobRequest cap). */
export const MAX_REQUESTS = 30;

export type JobEvent = {
  type: "start" | "progress" | "done" | "error" | string;
  stage?: string;
  ok?: boolean;
  request?: string;
  title?: string;
  host?: string;
  servings?: number;
  count?: number;
  message?: string;
  job_id?: string;
  recipe_count?: number;
  pdf_url?: string;
  html_url?: string;
  ai_credits_left?: number;
  /** Whether the engine recorded the cookbook in Firestore (dashboard/profile). */
  saved?: boolean;
};

/** Job submission failure carrying the HTTP status (402 = out of AI credits). */
export class JobError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JobError";
  }
}

/**
 * Turn any caught error into copy that's safe to show a user.
 *
 * The engine already sends user-ready messages for its deliberate failures
 * (paywall, rate limit, bad request), so those pass through; validation (422)
 * and raw network/unexpected errors get friendly copy instead of "Failed to
 * fetch" or a stringified exception. The original error is logged for debugging.
 */
export function friendlyError(err: unknown): string {
  if (err instanceof JobError) {
    // 422 = our own size caps rejected the payload; its detail is a raw
    // validation array, not user copy.
    if (err.status === 422) return "Please check your recipe list and try again.";
    return err.message;
  }
  // fetch() rejects with a TypeError on connection failure ("Failed to fetch",
  // "Load failed", "NetworkError…") across browsers.
  const raw = err instanceof Error ? err.message : String(err);
  if (err instanceof TypeError || /failed to fetch|load failed|network/i.test(raw)) {
    return "Couldn't reach the kitchen — check your connection and try again.";
  }
  console.error("Unexpected error:", err);
  return "Something went wrong on our end. Please try again in a moment.";
}

export interface JobInput {
  requests: string[];
  title?: string;
  subtitle?: string;
  theme?: string;
  use_ai?: boolean;
  cookbook_id?: string;
  mode?: "new" | "replace";
  public?: boolean;
}

/** Resolve an API-relative path (e.g. "/jobs/x/cookbook.pdf") to an absolute URL. */
export function apiUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

export interface GrantCreditsResult {
  uid: string;
  email: string;
  aiCredits: number;
}

/** Admin-only: credit a user's AI generation balance (Cash App pack purchases). */
export async function grantCredits(
  email: string,
  amount: number,
  token: string,
): Promise<GrantCreditsResult> {
  const res = await fetch(`${API_BASE}/admin/grant-credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, amount }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      /* non-JSON body */
    }
    throw new JobError(detail || `Grant failed (${res.status})`, res.status);
  }
  return res.json();
}

/**
 * POST a job and stream Server-Sent progress events, invoking `onEvent` for each.
 * Resolves when the stream ends.
 */
export async function streamJob(
  input: JobInput,
  onEvent: (event: JobEvent) => void,
  token?: string | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok || !res.body) {
    // Surface the engine's message (e.g. the AI-allowance paywall) when present.
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      /* non-JSON body */
    }
    throw new JobError(detail || `Job request failed (${res.status})`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(5).trim()) as JobEvent);
      } catch {
        /* ignore malformed keep-alives */
      }
    }
  }
}
