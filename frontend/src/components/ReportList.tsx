import { buttonClasses } from './buttonStyles'
import { ReportCard, type ReportCardState } from './ReportCard'
import type { Report } from '../types/report'

/**
 * 02 지도 대시보드 우측 리스트 — design_handoff_oncue/COMPONENTS.md #7 "ReportList — 상태 분기 ★".
 * loading(02-L) / error(02-X) / empty(02-E) / no-result(02-F) / ready(02) 5개 상태.
 * empty와 no-result는 다른 화면이다: 전자는 데이터 자체가 없고, 후자는 있는데 필터 조건이 안 맞는 것.
 */

export type ListState = 'loading' | 'error' | 'empty' | 'no-result' | 'ready'

type ReportListProps = {
  state: ListState
  reports: Report[]
  /** no-result일 때 "{필터명} 상태의 신고가 지금은 없습니다" 안내에 쓰는 라벨 */
  activeFilterLabel?: string
  lastSyncLabel?: string
  selectedId?: string | null
  onOpen?: (report: Report) => void
  onDelete?: (report: Report) => void
  onRetry?: () => void
  onClearFilter?: () => void
}

function SkeletonCard({ opacity }: { opacity: number }) {
  return (
    <div className="flex flex-col gap-[11px] rounded-lg border border-line-soft bg-white px-[19px] py-[17px] shadow-card" style={{ opacity }}>
      <div className="flex justify-between">
        <span className="h-[17px] w-[125px] rounded-pill bg-primary/11" />
        <span className="h-[15px] w-[49px] rounded-pill bg-primary/7" />
      </div>
      <span className="h-[17px] w-full rounded-pill bg-primary/8" />
      <span className="h-[17px] w-3/4 rounded-pill bg-primary/8" />
      <div className="mt-[2px] flex justify-between">
        <span className="h-[15px] w-[95px] rounded-pill bg-primary/7" />
        <span className="h-[28px] w-[76px] rounded-[9px] bg-primary/7" />
      </div>
    </div>
  )
}

export function ReportList({
  state,
  reports,
  activeFilterLabel,
  lastSyncLabel,
  selectedId,
  onOpen,
  onDelete,
  onRetry,
  onClearFilter,
}: ReportListProps) {
  if (state === 'loading') {
    return (
      <div className="flex flex-1 flex-col gap-[15px] overflow-hidden">
        <SkeletonCard opacity={1} />
        <SkeletonCard opacity={0.7} />
        <SkeletonCard opacity={0.42} />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[17px] px-[23px]">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-status-caution/10 text-[38px] font-extrabold text-status-caution">
          !
        </div>
        <span className="text-[21px] font-extrabold text-ink-900">신고를 불러오지 못했습니다</span>
        <p className="text-center text-[17px] font-medium leading-[1.6] text-ink-500">
          네트워크 연결을 확인해 주세요.
          <br />
          연결이 복구되면 자동으로 다시 불러옵니다.
        </p>
        <div className="mt-[4px] flex gap-[11px]">
          <button type="button" onClick={onRetry} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
            ↻ 다시 시도
          </button>
          <button type="button" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            마지막 목록 보기
          </button>
        </div>
        {lastSyncLabel && (
          <div className="mt-[8px] w-full rounded-[17px] bg-status-caution/8 px-[19px] py-[13px]">
            <p className="text-t-caption font-bold text-status-caution">마지막 동기화 {lastSyncLabel}</p>
            <p className="text-[15px] font-medium text-ink-600">그 이후 들어온 신고는 표시되지 않습니다</p>
          </div>
        )}
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[17px] px-[27px]">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary/8">
          <i className="inline-block h-[36px] w-[27px] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-primary-sub" />
        </div>
        <span className="text-[21px] font-extrabold text-ink-900">아직 들어온 신고가 없습니다</span>
        <p className="text-center text-[17px] font-medium leading-[1.6] text-ink-500">
          스태프가 신고를 보내면
          <br />
          이곳과 지도에 실시간으로 표시됩니다
        </p>
        <div className="mt-[4px] flex items-center gap-[8px]">
          <i className="inline-block h-[9px] w-[9px] rounded-full bg-status-done" />
          <span className="text-t-caption font-semibold text-ink-500">실시간 수신 대기 중</span>
        </div>
      </div>
    )
  }

  if (state === 'no-result') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[17px] px-[27px]">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary/8">
          <span className="relative inline-block h-[36px] w-[36px]">
            <i className="absolute left-0 top-0 h-[27px] w-[27px] rounded-full border-[5px] border-primary-light" />
            <i className="absolute bottom-[2px] right-[4px] h-[5px] w-[15px] rounded-[4px] bg-primary-light rotate-45" />
          </span>
        </div>
        <span className="text-[21px] font-extrabold text-ink-900">조건에 맞는 신고가 없습니다</span>
        <p className="text-center text-[17px] font-medium leading-[1.6] text-ink-500">
          <b className="font-bold text-primary">{activeFilterLabel ?? '선택한'}</b> 상태의 신고가 지금은 없습니다.
          <br />
          다른 조건으로 확인해 보세요.
        </p>
        <button type="button" onClick={onClearFilter} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          필터 해제 · 전체 보기
        </button>
        <span className="text-[15px] font-medium text-ink-400">지도에는 전체 신고가 그대로 표시됩니다</span>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto">
      {reports.map((report) => {
        const cardState: ReportCardState = selectedId
          ? report.id === selectedId
            ? 'selected'
            : 'dimmed'
          : report.status === 'RESOLVED' || report.status === 'CANCELLED'
            ? 'dimmed'
            : 'default'
        return (
          <ReportCard
            key={report.id}
            report={report}
            state={cardState}
            onOpen={() => onOpen?.(report)}
            onDelete={() => onDelete?.(report)}
          />
        )
      })}
    </div>
  )
}
