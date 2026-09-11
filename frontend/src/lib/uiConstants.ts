/**
 * 화면 UI 상수 — Claude Design 핸드오프(design_handoff_oncue/tokens.ts)에서 이식.
 * 백엔드 계약과 무관한 순수 프론트 표시값이라 별도 확인 없이 그대로 가져왔다.
 * (도메인 enum·미확인 임계값처럼 백엔드와 맞춰야 하는 값은 types/report.ts에 있다.)
 */

/** 목업 → 실기기 환산 배율. 새 화면을 dc.html 플로우에서 옮길 때 px 값 환산에 사용 */
export const SCALE = {
  /** 태블릿(관리자): 목업 620×434 → 실제 1180×820 */
  tablet: 1.9,
  /** 모바일(스태프): 목업 260×520 → 실제 390×780 */
  mobile: 1.5,
} as const;

export const VIEWPORT = {
  tablet: { w: 1180, h: 820 },
  mobile: { w: 390, h: 780 },
} as const;

/** Toast 노출 시간(ms) — 표시 후 이 시간 뒤 자동 소멸 */
export const TOAST_DURATION_MS = 2400;

/**
 * 데모/mock 전용 로그인 사용자 이름 — 실제 로그인(AdminLoginPage)에서 입력받은 이름을
 * 세션에 저장하기 전까지, "나"를 가리키는 화면(헤더 아바타·담당자 표시 등)에서 공통으로 쓴다.
 * 실제 세션 연동 후에는 lib/session.ts에서 읽어오는 값으로 교체한다.
 */
export const CURRENT_USER_NAME = '김민호';
