import type { Report } from '../types/report'

/**
 * 02 지도 대시보드 개발·시연용 목 데이터.
 * 관리자 화면 플로우(최종!).dc.html의 "02 지도 대시보드" 예시 카드 3장을 그대로 옮겼다.
 * 실제 API 연동(GET /admin/reports) 붙이면 이 파일은 지운다.
 */

const now = Date.now()

export const MOCK_REPORTS: Report[] = [
  {
    id: 'r1',
    type: 'CROWD',
    urgency: 'URGENT',
    status: 'RECEIVED',
    message: '사람이 너무 많아요, 앞으로 밀리는 것 같아요',
    place: '메인무대 앞',
    supportRequested: false,
    // 긴급 임계값(3분)은 넘겼지만 아래 r2보다는 먼저 접수됨 — 정렬 토글로
    // "긴급순"(위험도 우선)과 "최신순"(접수시각 우선) 결과가 실제로 갈리게 하려고
    // 일부러 r2보다 이전 시각으로 뒀다.
    createdAt: new Date(now - 20 * 60_000).toISOString(),
  },
  {
    id: 'r2',
    type: 'FACILITY',
    urgency: 'CAUTION',
    status: 'RECEIVED',
    message: '울타리가 넘어져 있어요, 교체가 필요합니다',
    place: '게이트 A 근처',
    supportRequested: true,
    createdAt: new Date(now - 15 * 60_000).toISOString(),
  },
  {
    id: 'r3',
    type: 'LOST',
    urgency: 'NORMAL',
    status: 'IN_PROGRESS',
    message: '아이가 혼자 있는 것 같아요',
    place: '키즈존',
    assigneeName: '이수린',
    supportRequested: false,
    createdAt: new Date(now - 22 * 60_000).toISOString(),
  },
  // r4·r5는 12(나의 리포트) 화면이 처음 열렸을 때도 빈 화면이 아니게 두는 시드 데이터다 —
  // 내(김민호)가 이미 완료 처리한 이력으로, dc.html 12 화면의 예시 카드 2장을 그대로 옮겼다.
  {
    id: 'r4',
    type: 'CROWD',
    urgency: 'URGENT',
    status: 'RESOLVED',
    message: '사람들이 한쪽으로 몰려서 위험해 보였어요',
    place: '메인무대 앞 광장',
    assigneeName: '김민호',
    supportRequested: false,
    createdAt: new Date(now - 2 * 60 * 60_000).toISOString(),
    closedAt: new Date(now - 2 * 60 * 60_000 + 42 * 60_000).toISOString(),
    resolveNote: '현장 확인 결과, 안내인원 추가 배치 완료',
  },
  {
    id: 'r5',
    type: 'FACILITY',
    urgency: 'CAUTION',
    status: 'RESOLVED',
    message: '게이트 근처 조명이 깨져 있어요',
    place: '게이트 A 근처',
    assigneeName: '김민호',
    supportRequested: true,
    createdAt: new Date(now - 3 * 60 * 60_000).toISOString(),
    closedAt: new Date(now - 3 * 60 * 60_000 + 42 * 60_000).toISOString(),
  },
]

export const MOCK_MAP_PINS = [
  { id: 'r1', top: 44, left: 34, colorClass: 'bg-status-urgent' },
  { id: 'r2', top: 58, left: 52, colorClass: 'bg-status-caution', shape: 'square' as const },
  { id: 'r3', top: 68, left: 26, colorClass: 'bg-status-progress' },
  { id: 'p1', top: 34, left: 60, colorClass: 'bg-status-normal' },
]

/** 관리자(나)의 현재 위치 — 03 신고 선택 상태의 점선 연결선 시작점 */
export const CURRENT_LOCATION = { top: 36, left: 18 }
