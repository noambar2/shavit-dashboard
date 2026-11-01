const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

/** Builds `?a=1&b=2`, skipping empty values. */
export function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function request(path: string, query?: Query, signal?: AbortSignal, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}${toQueryString(query)}`, {
    signal,
    credentials: 'include',
    ...init,
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res
}

export async function getJson<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  const res = await request(path, query, signal)
  return (await res.json()) as T
}

/** POST / PUT a JSON body and read the JSON response. */
export async function sendJson<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  const res = await request(path, undefined, undefined, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as T
}

export async function deleteRequest(path: string): Promise<void> {
  await request(path, undefined, undefined, { method: 'DELETE' })
}
