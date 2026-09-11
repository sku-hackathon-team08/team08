import { useState } from 'react'
import { buttonClasses } from './buttonStyles'
import { StatusBadge } from './StatusBadge'
import { REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type Report, type Urgency } from '../types/report'

const URGENCY_BG_CLASS: Record<Urgency, string> = {
  NORMAL: 'bg-status-normal',
  CAUTION: 'bg-status-caution',
  URGENT: 'bg-status-urgent',
}

/**
 * ONCUE 신고 상세 패널 — dc.html 04(신고 상세·미확인) / 05(처리중·소유) / 08-A(지원요청·소유자)
 * / 08-B(다른 관리자 화면·잠금).
 * 02 대시보드의 우측 리스트 자리를 카드 클릭 시 이 패널로 교체한다.
 *
 * variant는 report.status·assigneeName에서 그대로 파생된다(AdminHomePage에서 계산):
 *  - unclaimed(04): RECEIVED — 위험도뱃지(수정 가능 ▾) + AI추정 + 3줄메타 + "직접 처리하기" 1버튼
 *  - owned(05/08-A): IN_PROGRESS && 담당자===나 — 상태뱃지(처리중[+지원요청]) + 담당자 +
 *    완료:지원요청:취소 3버튼(1.3:1:1). supportRequested면 08-A(소유권 유지 안내 + "지원요청됨 ✓")로 바뀐다.
 *  - locked(08-B): IN_PROGRESS && 담당자!==나 — 상태뱃지 + 잠금 안내(필드 조회만) + "지원하기" 1버튼
 */

type ReportDetailPanelProps = {
  report: Report
  variant: 'unclaimed' | 'owned' | 'locked'
  onBack?: () => void
  onClaim?: () => void
  onComplete?: () => void
  onRequestSupport?: () => void
  onCancel?: () => void
  onEditClassification?: () => void
}

export function ReportDetailPanel({
  report,
  variant,
  onBack,
  onClaim,
  onComplete,
  onRequestSupport,
  onCancel,
  onEditClassification,
}: ReportDetailPanelProps) {
  // 렌더 중 Date.now()를 직접 호출하지 않도록 마운트 시점 한 번만 고정한다(mock 전용 계산).
  const [nowMs] = useState(() => Date.now())
  const minutesAgo = Math.max(0, Math.round((nowMs - new Date(report.createdAt).getTime()) / 60_000))
  const receivedTime = new Date(report.createdAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <div className="flex flex-1 flex-col gap-[15px] overflow-hidden">
      <button type="button" onClick={onBack} className="flex shrink-0 items-center gap-[15px] text-ink-900">
        <span className="text-[27px] leading-none">‹</span>
        <span className="text-[21px] font-bold">목록으로</span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-[15px] overflow-hidden rounded-md bg-white p-[23px] shadow-panel">
        {variant === 'unclaimed' ? (
          <div className="flex items-center gap-[9px]">
            <button
              type="button"
              onClick={onEditClassification}
              className={[
                'flex h-[38px] items-center gap-[6px] rounded-[11px] px-[15px] text-[17px] font-bold text-white',
                URGENCY_BG_CLASS[report.urgency],
              ].join(' ')}
            >
              {URGENCY_DISPLAY[report.urgency].label}
              <span className="opacity-80">▾</span>
            </button>
            <span className="text-t-caption font-semibold text-ink-600">AI 추정 · 관리자가 수정할 수 있어요</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-[9px]">
            <StatusBadge status="IN_PROGRESS" tone="solid" />
            {report.supportRequested ? (
              <StatusBadge status="SUPPORT" tone="solid" />
            ) : (
              <span
                className={[
                  'flex h-[34px] items-center rounded-[9px] px-[13px] text-[17px] font-bold text-white',
                  URGENCY_BG_CLASS[report.urgency],
                ].join(' ')}
              >
                {URGENCY_DISPLAY[report.urgency].label}
              </span>
            )}
          </div>
        )}

        <span className="text-t-h2 font-extrabold text-ink-900">{REPORT_TYPE_DISPLAY[report.type].label} 신고</span>

        {variant === 'unclaimed' && (
          <>
            <p className="text-t-body font-medium leading-[1.5] text-ink-900">&ldquo;{report.message}&rdquo;</p>
            <div className="flex flex-col gap-[8px] rounded-[17px] bg-surface-soft p-[19px] text-[17px] font-medium text-ink-600">
              <span>위치 · {report.place}</span>
              <span>
                접수 · {receivedTime} ({minutesAgo}분 전)
              </span>
              <span>유형(AI 추정) · {REPORT_TYPE_DISPLAY[report.type].label}</span>
            </div>
          </>
        )}

        {variant === 'owned' &&
          (report.supportRequested ? (
            <span className="rounded-[17px] bg-primary/7 p-[19px] text-t-body font-semibold text-primary">
              담당: {report.assigneeName} (나) — 소유권 유지
            </span>
          ) : (
            <span className="text-t-body font-semibold text-primary">담당: {report.assigneeName} (나)</span>
          ))}

        {variant === 'owned' && (
          <span className="rounded-[17px] bg-surface-soft p-[19px] text-[17px] font-medium text-ink-600">
            {report.place} · 접수 {minutesAgo}분 전
          </span>
        )}

        {variant === 'locked' && (
          <div className="flex flex-col gap-[6px] rounded-[17px] bg-surface-soft p-[19px]">
            <span className="text-t-body font-semibold text-ink-600">{report.assigneeName} 처리 중 — 소유권 이전 없음</span>
            <span className="text-[17px] font-medium text-ink-400">세부 필드는 조회만 가능 (잠금)</span>
          </div>
        )}

        <div className="flex-1" />

        {variant === 'unclaimed' && (
          <button type="button" onClick={onClaim} className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true })}>
            직접 처리하기
          </button>
        )}

        {variant === 'owned' && (
          <div className="flex gap-[11px]">
            <button
              type="button"
              onClick={onComplete}
              className="flex h-[56px] items-center justify-center rounded-pill bg-status-done text-[22px] font-bold text-white"
              style={{ flex: 1.3 }}
            >
              완료
            </button>
            <button
              type="button"
              onClick={onRequestSupport}
              disabled={report.supportRequested}
              className={
                report.supportRequested
                  ? 'flex h-[56px] flex-1 items-center justify-center rounded-pill border border-status-caution bg-status-caution/12 text-[19px] font-bold text-status-caution'
                  : 'flex h-[56px] flex-1 items-center justify-center rounded-pill border border-line bg-white text-[20px] font-bold text-ink-900'
              }
            >
              {report.supportRequested ? '지원요청됨 ✓' : '지원요청'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-[56px] flex-1 items-center justify-center text-[20px] font-semibold text-ink-500"
            >
              취소
            </button>
          </div>
        )}

        {variant === 'locked' && (
          <button
            type="button"
            onClick={onRequestSupport}
            className={buttonClasses({ variant: 'secondary', size: 'md', fullWidth: true })}
          >
            지원하기
          </button>
        )}
      </div>
    </div>
  )
}
