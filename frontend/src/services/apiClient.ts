const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function api<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  let response: Response;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: isFormData
        ? options.headers
        : {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
          },
      body: isFormData
        ? (options.body as FormData)
        : options.body
        ? JSON.stringify(options.body)
        : undefined,
    });
  } catch {
    throw new Error("Unable to reach the local backend. Start FastAPI and try again.");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "detail" in payload
      ? (payload as { detail: string }).detail
      : typeof payload === "string"
      ? payload
      : undefined;
    throw new Error(detail || `Request failed with status ${response.status}.`);
  }

  return payload as T;
}
