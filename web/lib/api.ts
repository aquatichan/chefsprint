// Client for the Chefsprint engine API (SSE live progress).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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
