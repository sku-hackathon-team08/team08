import { useState } from 'react'
import { BrandLogo } from '../BrandLogo'
import { buttonClasses } from '../buttonStyles'
import { REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type ReportType, type Urgency } from '../../types/report'
import { EditTypeUrgencySheet } from './EditTypeUrgencySheet'

export type AnalysisDraft = {
  /** POST /report-analyses가 만든 분석 id — POST /staff/reports 전송 때 그대로 필요하다 */
  analysisId: string
  message: string
  type: ReportType
  /** 관리자가 확정하기 전까지는 이게 곧 "AI 1차 추정"이자 화면에 보이는 현재값이다 */
  urgency: Urgency
}

/**
 * S3(AI 분석 결과 확인 · 수정) — 관리자 화면 플로우(최종!).dc.html.
 * ✎ 를 누르면 S3-1 바텀시트가 이 화면 위에 뜬다(같은 컴포넌트 안에서 오버레이로 처리 —
 * dc.html에도 별도 라우트가 아니라 겹쳐 뜨는 시트로 그려져 있다).
 */
export function AnalysisConfirmScreen({
  draft,
  aiUrgency,
  submitting = false,
  onChangeDraft,
  onBack,
  onRerecord,
  onSubmit,
}: {
  draft: AnalysisDraft
  aiUrgency: Urgency
  submitting?: boolean
  onChangeDraft: (draft: AnalysisDraft) => void
  onBack: () => void
  onRerecord: () => void
  onSubmit: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="h-[30px] shrink-0" />
      <div className="flex h-[42px] shrink-0 items-center gap-[9px] px-[18px]">
        <button type="button" onClick={onBack} className="text-[18px] text-ink-900">
          ‹
        </button>
        <BrandLogo size={15} orientation="horizontal" />
      </div>

      <div className="flex flex-1 flex-col gap-[12px] overflow-hidden px-[21px] pb-[21px]">
        <span className="text-m-h1 font-extrabold text-ink-900">신고 확인</span>

        <div className="flex justify-between">
          <span className="text-m-caption font-semibold text-ink-600">말한 내용 그대로</span>
          <span className="text-m-micro text-ink-300">{draft.message.length}/500</span>
        </div>
        <div className="min-h-[96px] rounded-[17px] border border-line bg-white p-[14px] text-m-body leading-relaxed text-ink-900 shadow-card">
          {draft.message}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-[6px] flex items-center gap-[6px] text-m-caption font-bold text-ink-900"
        >
          AI 분석 결과 (수정 가능) <span className="text-ink-400">✎</span>
        </button>
        <div className="flex flex-col gap-[8px] rounded-[17px] border border-line bg-white p-[14px] text-m-caption font-semibold text-ink-900 shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-600">유형</span>
            <span>{REPORT_TYPE_DISPLAY[draft.type].label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-600">AI 추정 위험도</span>
            <span className="text-status-caution">{URGENCY_DISPLAY[draft.urgency].label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-600">위치</span>
            <span>현재 위치</span>
          </div>
        </div>
        <div className="rounded-[14px] bg-white/70 px-[14px] py-[11px] text-m-micro leading-relaxed text-ink-600">
          ⓘ 내용이 다르면 항목을 눌러 직접 고칠 수 있어요.
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onRerecord}
          disabled={submitting}
          className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true, disabled: submitting })}
        >
          ↻ 다시 말하기
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true, disabled: submitting })}
        >
          {submitting ? '전송하는 중…' : '➤ 전송하기'}
        </button>
      </div>

      {sheetOpen && (
        <EditTypeUrgencySheet
          type={draft.type}
          urgency={draft.urgency}
          aiUrgency={aiUrgency}
          onChangeType={(type) => onChangeDraft({ ...draft, type })}
          onChangeUrgency={(urgency) => onChangeDraft({ ...draft, urgency })}
          onApply={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}
