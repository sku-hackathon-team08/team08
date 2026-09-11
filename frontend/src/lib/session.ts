// localStorage 접근 헬퍼. 프라이빗 모드·저장소 비활성 등에서 접근 자체가 예외를
// 던질 수 있어 모든 경로를 try/catch로 감싼다.
// 저장 shape(Session)는 의도적으로 느슨하게 둔다 — 세션에 담을 필드가 늘어도 이 파일은
// 그대로 두고, 값을 읽는 쪽에서 필요한 형태로 좁힌다.
//
// 키를 role별로 분리한다(team08.session.admin / team08.session.staff).
// 백엔드 세션은 Bearer 토큰이라(docs/api/hackathon.md:38-39) 브라우저가 강제하는 쿠키
// 공유 문제는 없지만, localStorage는 origin 하나에 하나만 있어 관리자·스태프 화면을
// 같은 origin의 iframe 두 개로 동시에 띄우면(/demo) 단일 키로는 서로 세션을 덮어써버린다.
// role별로 키를 나눠서 두 화면이 각자 독립된 세션(=독립된 Bearer 토큰)을 유지하게 한다.

export type SessionRole = 'admin' | 'staff'

export type Session = Record<string, unknown>

function sessionKey(role: SessionRole): string {
  return `team08.session.${role}`
}

/** 저장된 세션을 읽는다. 값이 없거나 JSON이 깨졌거나 저장소 접근이 막히면 null. */
export function getSession(role: SessionRole): Session | null {
  try {
    const raw = localStorage.getItem(sessionKey(role))
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
export function setSession(role: SessionRole, value: Session): void {
  try {
    localStorage.setItem(sessionKey(role), JSON.stringify(value))
  } catch {
    // 세션은 서버 상태의 로컬 캐시일 뿐이라 저장 실패를 오류로 전파하지 않는다.
  }
}

/** 저장된 세션을 지운다. */
export function clearSession(role: SessionRole): void {
  try {
    localStorage.removeItem(sessionKey(role))
  } catch {
    // 무시
  }
}

/**
 * 세션에 저장된 실제 로그인 사용자(actor) 정보. api/sessions.ts의 SessionCreated 응답을
 * 그대로 setSession()에 넣어 저장하므로 그 안의 actor{id,name,team}를 꺼내 쓴다.
 * "내가 담당인가" 같은 판정은 항상 이 id로 해야 한다(이름 문자열 비교는 동명이인에서 틀림).
 */
export function getActor(role: SessionRole): { id: string; name: string; team: string | null } | null {
  const session = getSession(role)
  const actor = session?.actor
  if (
    typeof actor !== 'object' ||
    actor === null ||
    typeof (actor as Record<string, unknown>).id !== 'string' ||
    typeof (actor as Record<string, unknown>).name !== 'string'
  ) {
    return null
  }
  const a = actor as { id: string; name: string; team: string | null }
  return { id: a.id, name: a.name, team: a.team ?? null }
}
