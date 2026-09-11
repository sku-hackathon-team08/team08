import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { StatCard } from './StatCard'
import { REPORT_TYPE_DISPLAY, type Report, type ReportType } from '../types/report'

/**
 * 12 나의 리포트 — design_handoff_oncue/COMPONENTS.md·관리자 화면 플로우(최종!).dc.html.
 * dc.html 실측: DistributionBar는 유형색이 아니라 블루 3단계(primary-ultra/primary/
 * primary-light)를 값이 큰 순서대로 쓴다(COMPONENTS.md #10 "나머지" 표에도 명시).
 *
 * PDF 내보내기는 사용자 결정(사진 첨부와 동일한 방침): 버튼 UI만 두고 실제 생성은 구현하지 않는다.
 */

type Period = 'today' | 'week' | 'all'

const PERIOD_LABEL: Record<Period, string> = { today: '오늘', week: '이번 주', all: '전체' }
const DISTRIBUTION_COLORS = ['bg-primary-ultra', 'bg-primary', 'bg-primary-light'] as const

function withinPeriod(createdAt: string, period: Period, nowMs: number): boolean {
  const ageMs = nowMs - new Date(createdAt).getTime()
  if (period === 'today') return ageMs <= 24 * 60 * 60_000
  if (period === 'week') return ageMs <= 7 * 24 * 60 * 60_000
  return true
}

function historyMeta(report: Report): string {
  const created = new Date(report.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (report.status === 'RESOLVED' && report.closedAt) {
    const closed = new Date(report.closedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const minutes = Math.round((new Date(report.closedAt).getTime() - new Date(report.createdAt).getTime()) / 60_000)
    return `${report.place} · ${created} 접수 → ${closed} 완료 (${minutes}분)`
  }
  if (report.status === 'CANCELLED') {
    const closed = report.closedAt
      ? new Date(report.closedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '—'
    return `${report.cancelReason ?? '취소'} · ${created} 접수 → ${closed} 취소`
  }
  const minutesAgo = Math.round((Date.now() - new Date(report.createdAt).getTime()) / 60_000)
  return `${report.place} · ${created} 접수 · 진행 ${minutesAgo}분째`
}

const STATUS_PILL: Record<Report['status'], string> = {
  RECEIVED: 'bg-status-urgent/12 text-status-urgent',
  IN_PROGRESS: 'bg-status-progress/12 text-status-progress',
  RESOLVED: 'bg-status-done/12 text-status-done',
  CANCELLED: 'bg-surface-chip text-ink-500',
}
const STATUS_LABEL: Record<Report['status'], string> = {
  RECEIVED: '미확인',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
  CANCELLED: '취소',
}

type MyReportViewProps = {
  reports: Report[]
  currentUserName: string
}

export function MyReportView({ reports, currentUserName }: MyReportViewProps) {
  const [period, setPeriod] = useState<Period>('all')
  const [nowMs] = useState(() => Date.now())

  const myReports = useMemo(
    () => reports.filter((r) => r.assigneeName === currentUserName && withinPeriod(r.createdAt, period, nowMs)),
    [reports, currentUserName, period, nowMs],
  )
  // 취소는 담당자 제한 없이 관리자 누구나 할 수 있어서(docs/api/hackathon.md) "내가 담당"
  // 기준에 안 잡힌다 — 이 카드만 전체 취소 건수를 별도로 센다.
  const cancelledCount = useMemo(
    () => reports.filter((r) => r.status === 'CANCELLED' && withinPeriod(r.createdAt, period, nowMs)).length,
    [reports, period, nowMs],
  )

  const resolved = myReports.filter((r) => r.status === 'RESOLVED')
  const avgMinutes = useMemo(() => {
    const withDuration = resolved.filter((r) => r.closedAt)
    if (withDuration.length === 0) return null
    const total = withDuration.reduce((sum, r) => sum + (new Date(r.closedAt!).getTime() - new Date(r.createdAt).getTime()), 0)
    return Math.round(total / withDuration.length / 60_000)
  }, [resolved])

  const distribution = useMemo(() => {
    const counts = new Map<ReportType, number>()
    for (const r of myReports) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({
        type,
        count,
        pct: myReports.length ? Math.round((count / myReports.length) * 100) : 0,
        colorClass: DISTRIBUTION_COLORS[Math.min(i, DISTRIBUTION_COLORS.length - 1)],
      }))
  }, [myReports])

  const historyList = [...myReports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="flex min-h-0 flex-1 gap-[23px] px-[27px] pb-[23px]">
      <div className="flex w-[42%] flex-col gap-[13px] overflow-y-auto rounded-md bg-white p-[23px] shadow-panel">
        <div className="flex items-center gap-[15px]">
          <Avatar name={currentUserName} size="lg" />
          <div className="flex flex-col">
            <span className="text-t-title font-extrabold text-ink-900">{currentUserName}</span>
            <span className="text-[15px] font-medium text-ink-500">관리자 · B구역 담당</span>
          </div>
        </div>

        <div className="flex gap-[9px]">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={[
                'flex h-[38px] items-center rounded-pill px-[17px] text-[15px] font-bold',
                period === p ? 'bg-primary-deep text-white' : 'bg-primary/8 text-primary',
              ].join(' ')}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-[11px]">
          <StatCard value={myReports.length} label="내가 처리" accent="primary-ultra" />
          <StatCard value={resolved.length} label="완료" accent="primary" />
          <StatCard value={cancelledCount} label="취소" accent="muted" />
          <StatCard value={myReports.filter((r) => r.supportRequested).length} label="지원요청" accent="primary-light" />
        </div>

        <div className="flex flex-col gap-[4px] rounded-[15px] bg-primary/6 p-[15px]">
          <span className="text-[15px] font-semibold text-ink-600">평균 처리 시간</span>
          <div className="flex items-baseline gap-[9px]">
            <span className="text-[30px] font-extrabold text-primary-ultra">{avgMinutes !== null ? `${avgMinutes}분` : '—'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[9px]">
          <div className="flex items-baseline justify-between">
            <span className="text-t-title font-bold text-ink-900">유형 분포</span>
            <span className="text-[15px] font-medium text-ink-500">총 {myReports.length}건</span>
          </div>
          {distribution.length === 0 ? (
            <span className="text-[15px] font-medium text-ink-400">아직 처리한 신고가 없습니다</span>
          ) : (
            <div className="flex flex-col gap-[9px]">
              {distribution.map((d) => (
                <div key={d.type} className="flex items-center gap-[13px]">
                  <span className="w-[80px] shrink-0 text-[15px] font-semibold text-ink-600">
                    {REPORT_TYPE_DISPLAY[d.type].label}
                  </span>
                  <div className="h-[21px] flex-1 overflow-hidden rounded-pill bg-primary/8">
                    <div className={['h-full rounded-pill', d.colorClass].join(' ')} style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-[76px] shrink-0 text-right text-[15px] font-bold text-ink-900">
                    {d.count}건 {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          title="PDF 내보내기는 아직 구현하지 않았습니다"
          className="flex h-[76px] shrink-0 items-center justify-center gap-[13px] rounded-pill bg-primary-deep text-[22px] font-bold text-white shadow-cta"
        >
          ⬇ PDF로 내보내기
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-[15px] overflow-hidden rounded-md bg-white p-[23px] shadow-panel">
        <span className="text-t-title font-bold text-ink-900">처리 내역 상세</span>
        <div className="flex flex-col gap-[11px] overflow-y-auto">
          {historyList.length === 0 && <span className="text-[17px] font-medium text-ink-400">이 기간에 처리한 신고가 없습니다</span>}
          {historyList.map((r) => (
            <div
              key={r.id}
              className={[
                'flex flex-col gap-[8px] rounded-[15px] border p-[15px]',
                r.status === 'CANCELLED' ? 'border-line opacity-60' : 'border-primary/18 bg-primary/3',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-[8px]">
                  <span className="flex h-[30px] items-center rounded-[8px] bg-white px-[11px] text-[15px] font-bold text-ink-700 outline outline-1 outline-line">
                    {REPORT_TYPE_DISPLAY[r.type].label}
                  </span>
                  {r.supportRequested && (
                    <span className="flex h-[30px] items-center rounded-[8px] bg-status-support px-[11px] text-[15px] font-bold text-white">
                      지원요청
                    </span>
                  )}
                </div>
                <span className={['flex h-[30px] items-center rounded-[8px] px-[11px] text-[15px] font-bold', STATUS_PILL[r.status]].join(' ')}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <span className="text-[19px] font-bold text-ink-900">{REPORT_TYPE_DISPLAY[r.type].label} 신고</span>
              <span className="text-[15px] font-medium text-ink-600">{historyMeta(r)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
