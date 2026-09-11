import { getSession, type SessionRole } from '../lib/session'
import type { ApiErrorBody } from './types'

/**
 * fetch 래퍼 — docs/api/hackathon.md·backend/app/schemas/base.py(ApiModel) 기준.
 *
 * - Base URL: VITE_API_BASE_URL 환경변수, 없으면 로컬 백엔드 기본값(127.0.0.1:8000).
 * - 인증: role을 넘기면 해당 role 세션(lib/session.ts)의 token으로 `Authorization: Bearer`
 *   헤더를 붙인다. POST /sessions처럼 세션이 아직 없는 호출은 role을 안 넘긴다.
 * - Idempotency-Key: POST 중 분석 생성·신고 생성·지원요청 개설/참여만 요구한다(백엔드 감사
 *   확인 — PATCH와 POST /sessions는 안 붙인다). 호출부에서 idempotent:true로 명시한다.
 * - 오류 응답({status,code,detail,errors})을 ApiError로 던진다 — 컴포넌트는 이 클래스만 보고
 *   백엔드가 실제로 어떤 필드 별칭을 쓰는지는 몰라도 된다.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  errors: ApiErrorBody['errors']

  constructor(body: ApiErrorBody) {
    super(body.detail)
    this.name = 'ApiError'
    this.status = body.status
    this.code = body.code
    this.errors = body.errors
  }
}

function authToken(role: SessionRole): string | undefined {
  const session = getSession(role)
  const token = session?.token
  return typeof token === 'string' ? token : undefined
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** 이 role의 세션 토큰으로 Authorization 헤더를 붙인다. 생략하면 인증 없이 호출. */
  role?: SessionRole
  /** JSON 바디. formData와 동시에 쓰지 않는다. */
  json?: unknown
  /** multipart 바디(음성 업로드 등). Content-Type은 브라우저가 boundary 포함해서 자동 설정. */
  formData?: FormData
  /** POST 중 분석·신고·지원요청 생성처럼 Idempotency-Key가 필요한 호출만 true. */
  idempotent?: boolean
  query?: Record<string, string | number | undefined>
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}

  if (options.role) {
    const token = authToken(options.role)
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (options.idempotent) {
    headers['Idempotency-Key'] = crypto.randomUUID()
  }

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  }

  let url = `${API_BASE_URL}${path}`
  if (options.query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, { method: options.method ?? 'GET', headers, body })

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''

  if (!res.ok) {
    if (contentType.includes('application/json')) {
      throw new ApiError((await res.json()) as ApiErrorBody)
    }
    throw new ApiError({ status: res.status, code: 'UNKNOWN_ERROR', detail: res.statusText, errors: [] })
  }

  if (contentType.includes('application/pdf')) {
    return (await res.blob()) as T
  }
  if (!contentType.includes('application/json')) {
    return undefined as T
  }
  return (await res.json()) as T
}

/** POST/PATCH 응답의 Location 헤더에서 새로 생긴 리소스 id를 뽑는다(분석·신고 생성 등). */
export async function apiRequestWithLocation<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; locationId: string | null }> {
  const headers: Record<string, string> = {}
  if (options.role) {
    const token = authToken(options.role)
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (options.idempotent) headers['Idempotency-Key'] = crypto.randomUUID()

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method: options.method ?? 'POST', headers, body })
  const contentType = res.headers.get('content-type') ?? ''

  if (!res.ok) {
    if (contentType.includes('application/json')) throw new ApiError((await res.json()) as ApiErrorBody)
    throw new ApiError({ status: res.status, code: 'UNKNOWN_ERROR', detail: res.statusText, errors: [] })
  }

  const location = res.headers.get('location')
  const locationId = location ? (location.split('/').pop() ?? null) : null
  const data = contentType.includes('application/json') ? ((await res.json()) as T) : (undefined as T)
  return { data, locationId }
}
