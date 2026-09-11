// localStorage 접근 헬퍼. 프라이빗 모드·저장소 비활성 등에서 접근 자체가 예외를
// 던질 수 있어 모든 경로를 try/catch로 감싼다.
// 저장 shape(Session)는 의도적으로 느슨하게 둔다 — 세션에 담을 필드가 늘어도 이 파일은
// 그대로 두고, 값을 읽는 쪽에서 필요한 형태로 좁힌다.

const SESSION_KEY = 'team08.session'

export type Session = Record<string, unknown>

/** 저장된 세션을 읽는다. 값이 없거나 JSON이 깨졌거나 저장소 접근이 막히면 null. */
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }
    return parsed as Session
  } catch {
    return null
  }
}

/** 세션 전체를 교체 저장한다. 저장 실패(용량 초과·비활성)는 조용히 무시한다. */
export function setSession(value: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value))
  } catch {
    // 세션은 서버 상태의 로컬 캐시일 뿐이라 저장 실패를 오류로 전파하지 않는다.
  }
}

/** 저장된 세션을 지운다. */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // 무시
  }
}
