export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const baseMessage = typeof record.error === "string" ? record.error : `Request failed with status ${response.status}.`;
    const details = typeof record.details === "object" && record.details !== null ? record.details as Record<string, unknown> : {};
    const infeasibleActions = Array.isArray(details.infeasibleActions)
      ? details.infeasibleActions.filter((item): item is string => typeof item === "string")
      : [];
    throw new ApiError([baseMessage, ...infeasibleActions].join(" "), response.status);
  }
  return payload as T;
}

export async function getApiHealth(): Promise<{ status: string; simulationEngine: string; aiConfigured: boolean }> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new ApiError(`API health check failed with status ${response.status}.`, response.status);
  return await response.json() as { status: string; simulationEngine: string; aiConfigured: boolean };
}
