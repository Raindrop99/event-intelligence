// Thin client for the FastAPI backend. The base URL is configured per-environment
// via NEXT_PUBLIC_API_BASE (see .env.local.example).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  return (await res.json()) as T;
}
