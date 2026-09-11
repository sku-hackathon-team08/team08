/**
 * 신고(Report) 도메인 타입 — 백엔드 기준으로 정렬.
 *
 * 값·필드명은 실제 백엔드 구현을 정본으로 한다(디자인 산출물이 아님):
 *   backend/app/schemas/reports.py — ReportStatus / ReportType / Urgency Literal 정의
 *   backend/app/services/reports.py — claim/resolve/cancel/release 전이
 *   docs/api/hackathon.md — 계약 설명
 *
 * Claude Design 핸드오프(design_handoff_oncue/tokens.ts)에도 같은 개념의 타입이 있었지만
 * 아래 지점에서 백엔드와 어긋나 그대로 가져오지 않았다:
 *   - ReportType의 다섯 번째 값이 'ETC'로 돼 있었음 → 백엔드는 'OTHER'
 *   - status 값에 'COMPLETED'를 썼음 → 백엔드는 `/resolve` 엔드포인트가 세팅하는 'RESOLVED'
 *   - AUTO_ESCALATE_MINUTES(10분 경과 시 무조건 긴급으로 자동 승격)가 있었음 → 백엔드는
 *     "자동 위험도 승격은 없습니다"를 명시적으로 확정(docs/api/hackathon.md:97,
 *     docs/features/command-dashboard.md). 위험도별 미확인 임계값만 있고, urgency 값 자체는 바뀌지 않는다.
 */

/** 신고 처리 상태 — backend/app/schemas/reports.py의 ReportStatus와 1:1 */
export type ReportStatus = 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

/** 위험도 — AI 1차 제안 후 관리자가 claim/classification에서 최종 확정. 필드명은 백엔드와 동일하게 `urgency` */
export type Urgency = 'NORMAL' | 'CAUTION' | 'URGENT';

/** 신고 유형 — 위험도(Urgency)와 독립된 축. 다섯 번째 값은 'OTHER'(디자인 문서의 'ETC' 아님) */
export type ReportType = 'EMERGENCY' | 'FACILITY' | 'CROWD' | 'LOST' | 'OTHER';

/** 목록 로딩 상태 — 화면(02-L/02-X/02-E/02-F/02) 대응. 백엔드 개념이 아니라 프론트 전용 UI 상태 */
export type ListState = 'loading' | 'error' | 'empty' | 'no-result' | 'ready';

// ─────────────────────────────────────────────────────────
// 표시용 매핑 — 라벨·디자인 토큰(theme.css의 @theme 색상 이름)
// ─────────────────────────────────────────────────────────

export const URGENCY_DISPLAY = {
  NORMAL: { label: '일반', token: 'status-normal', rank: 2 },
  CAUTION: { label: '주의', token: 'status-caution', rank: 1 },
  URGENT: { label: '긴급', token: 'status-urgent', rank: 0 },
} as const satisfies Record<Urgency, { label: string; token: string; rank: number }>;

export const REPORT_TYPE_DISPLAY = {
  EMERGENCY: { label: '응급', token: 'type-emergency' },
  FACILITY: { label: '시설', token: 'type-facility' },
  CROWD: { label: '혼잡', token: 'type-crowd' },
  LOST: { label: '미아·분실', token: 'type-lost' },
  OTHER: { label: '기타', token: 'type-etc' },
} as const satisfies Record<ReportType, { label: string; token: string }>;

export const REPORT_STATUS_DISPLAY = {
  RECEIVED: { label: '미확인', token: 'status-urgent' },
  IN_PROGRESS: { label: '처리중', token: 'status-progress' },
  RESOLVED: { label: '완료', token: 'status-done' },
  CANCELLED: { label: '취소', token: 'status-cancel' },
} as const satisfies Record<ReportStatus, { label: string; token: string }>;

// ─────────────────────────────────────────────────────────
// 미확인 임계값 — docs/features/command-dashboard.md 확정 정책
// ─────────────────────────────────────────────────────────

/**
 * RECEIVED 상태에서 최초 접수 시각부터 이 분(分)을 "초과"하면 미확인이다.
 * 담당 배정 취소(release) 후에도 최초 접수 시각을 유지하며 초기화하지 않는다.
 * 주의: 시간이 지났다는 이유만으로 urgency 값 자체를 바꾸는 자동 승격은 없다
 * (디자인 산출물의 "10분 자동 승격" 문구·AUTO_ESCALATE_MINUTES는 이 확정 정책과 달라 채택하지 않음).
 */
export const UNCONFIRMED_THRESHOLD_MINUTES = {
  URGENT: 3,
  CAUTION: 10,
  NORMAL: 30,
} as const satisfies Record<Urgency, number>;

/**
 * RECEIVED 상태에서 최초 접수 이후 임계값을 초과했는지. 담당 배정 취소로 RECEIVED에
 * 복귀해도 최초 접수 시각(createdAt) 기준을 유지하므로 별도 초기화 로직이 없다 — 이
 * 함수는 항상 createdAt만 본다.
 */
export function isUnconfirmed(
  report: Pick<Report, 'status' | 'urgency' | 'createdAt'>,
  nowMs: number,
): boolean {
  if (report.status !== 'RECEIVED') return false;
  const elapsedMinutes = (nowMs - new Date(report.createdAt).getTime()) / 60_000;
  return elapsedMinutes > UNCONFIRMED_THRESHOLD_MINUTES[report.urgency];
}

// ─────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────

/** 리스트 카드 좌측 상단에 표기하는 "위험도 · 유형" 문자열 */
export function urgencyTypeLabel(urgency: Urgency, type: ReportType): string {
  return `${URGENCY_DISPLAY[urgency].label} · ${REPORT_TYPE_DISPLAY[type].label}`;
}

/**
 * 카드/핀에 쓰는 대표 색 토큰 — 종결·처리중 상태면 상태색이 위험도색을 덮어씀.
 * dc.html 02 화면의 "처리중·분실" 카드로 실측 확인: 위험도가 NORMAL이어도 IN_PROGRESS면
 * 테두리·라벨색이 회색이 아니라 status-progress(파랑)로 나온다.
 */
export function primaryDisplayToken(status: ReportStatus, urgency: Urgency): string {
  if (status === 'IN_PROGRESS') return REPORT_STATUS_DISPLAY.IN_PROGRESS.token;
  if (status === 'RESOLVED') return REPORT_STATUS_DISPLAY.RESOLVED.token;
  if (status === 'CANCELLED') return REPORT_STATUS_DISPLAY.CANCELLED.token;
  return URGENCY_DISPLAY[urgency].token;
}

/** primaryDisplayToken과 같은 규칙으로 라벨을 고른다 — "위험도 · 유형" 대신 "처리중 · 유형" 등 */
export function primaryDisplayLabel(status: ReportStatus, urgency: Urgency): string {
  if (status === 'IN_PROGRESS') return REPORT_STATUS_DISPLAY.IN_PROGRESS.label;
  if (status === 'RESOLVED') return REPORT_STATUS_DISPLAY.RESOLVED.label;
  if (status === 'CANCELLED') return REPORT_STATUS_DISPLAY.CANCELLED.label;
  return URGENCY_DISPLAY[urgency].label;
}

// ─────────────────────────────────────────────────────────
// Report — 화면(ReportCard 등)에 필요한 최소 형태.
// 아직 API 연동 전이라 백엔드 ReportDetail/ReportCard DTO 전체(docs/api/hackathon.md)를
// 그대로 옮긴 게 아니라, 지금 화면이 실제로 쓰는 필드만 담은 잠정 shape이다.
// API 연동 시 실제 응답 스키마에 맞춰 다시 확인·조정한다.
// ─────────────────────────────────────────────────────────

export type Report = {
  id: string;
  /**
   * 낙관적 동시성 버전 — claim/classification/resolve/release/cancel 호출 시
   * expectedVersion으로 그대로 보낸다. 백엔드 StaffReport에는 이 필드가 없어서
   * (관리자 전용 액션이라 스태프 쪽엔 필요 없음) 스태프 조회 결과를 어댑터로 옮길 때는
   * undefined로 둔다 — 스태프 화면은 애초에 이 필드를 쓸 일이 없다.
   */
  version?: number;
  type: ReportType;
  urgency: Urgency;
  status: ReportStatus;
  /** 스태프 발화 원문 — 가공 금지. 백엔드 contentFinal과 매핑(api/adapters.ts) */
  message: string;
  /**
   * 위치 표시 라벨. 백엔드엔 place가 없고 zone(구역, 이번 범위에선 항상 null)과
   * lat/lng만 있다 — 2026-09-12 확정: zone 이름이 있으면 그걸, 없으면 "현재 위치"로
   * 통일 표기한다(좌표를 그대로 노출하지 않음). api/adapters.ts에서 계산해서 채운다.
   */
  place: string;
  /** 담당자 배정 시(IN_PROGRESS)에만 있음 */
  assigneeName?: string;
  /**
   * 담당자 actor id. "내가 담당인가"는 항상 이 값을 세션의 actor.id와 비교해서 판정한다 —
   * assigneeName(이름) 문자열 비교는 이름이 같은 관리자가 둘 이상이면 틀릴 수 있다.
   */
  assigneeId?: string;
  supportRequested: boolean;
  createdAt: string;
  /**
   * 서버가 계산한 미확인 여부(위험도별 3/10/30분 임계값, docs/features/command-dashboard.md).
   * 실제 API 연동 후에는 이 값을 우선 쓰고, 없을 때만 isUnconfirmed()로 클라이언트 계산한다
   * (서버 시계가 기준이라 클라이언트 시계 오차·다중 사용자 상황에서 더 정확함).
   */
  isUnacknowledged?: boolean;
  /** RESOLVED 시 선택 입력한 처리 메모 */
  resolveNote?: string;
  /**
   * CANCELLED 시 취소 사유. 02-1 "삭제"도 결과적으로 이 필드가 채워진다 — 2026-09-12 API
   * 감사에서 백엔드엔 별도 delete 액션이 없고 claim/classification/resolve/release/cancel
   * 5개뿐인 걸 확인했다. cancel은 cancelReason이 필수라 "삭제"는 고정 문구("관리자 삭제")로
   * 같은 cancel API를 호출한다(가벼운 원클릭 UX는 유지, 화면엔 사유 입력을 안 보여줌).
   * 옛 deletedFromBoard 플래그는 그래서 없앴다 — CANCELLED 상태를 목록·지도에서 제외하는
   * 것만으로 "삭제"가 똑같이 동작한다(docs/features/command-dashboard.md AC-C04).
   */
  cancelReason?: string;
  /** RESOLVED·CANCELLED로 종결된 시각 — 12(나의 리포트)의 소요시간 계산에 쓴다 */
  closedAt?: string;
};
