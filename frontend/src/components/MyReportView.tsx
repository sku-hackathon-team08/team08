import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { StatCard } from './StatCard'
import { REPORT_TYPE_DISPLAY, type ReportStatus, type ReportType } from '../types/report'
import { downloadAdminActivityReportPdf, getAdminActivityReport } from '../api/activity'
import { ApiError } from '../api/client'
import type { AdminActivityItem, AdminActivityReport, Change } from '../api/types'

/**
 * 12 나의 리포트 — design_handoff_oncue/COMPONENTS.md·관리자 화면 플로우(최종!).dc.html.
 * dc.html 실측: DistributionBar는 유형색이 아니라 블루 3단계(primary-ultra/primary/
 * primary-light)를 값이 큰 순서대로 쓴다(COMPONENTS.md #10 "나머지" 표에도 명시).
 *
 * 2026-09-12 실제 activity-report API 연동: 화면 통계·유형분포·상세 이력·PDF 내보내기 모두
 * GET/GET export `/admin/activity-report(export)`를 쓴다(로컬 reports 배열 근사 집계였던
 * 걸 대체 — docs/features/activity-report.md AC-R06 "PDF의 모든 이력은 페이지 조회 전체와
 * 일치"). "지원요청" 카드는 백엔드가 개인 실적에서 명시적으로 제외해서(지원 개설/종료·단순
 * 참여는 개인 처리 리포트 제외) "총 처리"(summary.totalActions)로 바꿨다.
 */

type Period = 'today' | 'week' | 'all'

const PERIOD_LABEL: Record<Period, string> = { today: '오늘', week: '이번 주', all: '전체' }
const PERIOD_TO_API: Record<Period, 'TODAY' | 'WEEK' | 'ALL'> = { today: 'TODAY', week: 'WEEK', all: 'ALL' }
const DISTRIBUTION_COLORS = ['bg-primary-ultra', 'bg-primary', 'bg-primary-light'] as const

const ACTION_LABEL: Record<AdminActivityItem['action'], string> = {
  REPORT_CLAIMED: '담당 시작',
  ASSIGNMENT_RELEASED: '담당 해제',
  CLASSIFICATION_CHANGED: '분류 변경',
  REPORT_RESOLVED: '완료',
  REPORT_CANCELLED: '취소',
}

const STATUS_PILL: Record<ReportStatus, string> = {
  RECEIVED: 'bg-status-urgent/12 text-status-urgent',
  IN_PROGRESS: 'bg-status-progress/12 text-status-progress',
  RESOLVED: 'bg-status-done/12 text-status-done',
  CANCELLED: 'bg-surface-chip text-ink-500',
}
const STATUS_LABEL: Record<ReportStatus, string> = {
  RECEIVED: '미확인',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
  CANCELLED: '취소',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatChange(c: Change): string {
  return `${c.field}: ${String(c.before)} → ${String(c.after)}`
}

function itemMeta(item: AdminActivityItem): string {
  const zone = item.zone?.name ?? '현재 위치'
  const time = formatTime(item.occurredAt)
  if (item.action === 'REPORT_RESOLVED' && item.processingSeconds !== null) {
    return `${zone} · ${time} · 배정~완료 ${Math.round(item.processingSeconds / 60)}분`
  }
  return `${zone} · ${time}`
}

type MyReportViewProps = {
  currentUserName: string
}

export function MyReportView({ currentUserName }: MyReportViewProps) {
  const [period, setPeriod] = useState<Period>('all')
  const [report, setReport] = useState<AdminActivityReport | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<'idle' | 'loading'>('idle')
  const [pdfError, setPdfError] = useState<string | null>(null)

  // loading 표시는 여기서 시작하지 않는다 — 원인이 된 이벤트(handlePeriodChange)에서 직접
  // setLoadState('loading')을 부르고, 이 effect는 결과(ready/error)만 반영한다(AdminHomePage.tsx
  // loadReports와 같은 관례 — oxlint react/set-state-in-effect 권고를 따름).
  useEffect(() => {
    let cancelled = false
    // pageSize 최댓값(100) — listAdminReports와 같은 관례, 그 이상은 다음 작업(activity.ts 참고).
    getAdminActivityReport(PERIOD_TO_API[period], undefined, 100)
      .then((data) => {
        if (cancelled) return
        setReport(data)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : '리포트를 불러오지 못했습니다.')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [period])

  // typeDistribution은 다섯 유형 모두(0건 포함) 내려온다 — 0건은 화면에서 뺀다.
  const distribution = useMemo(() => {
    if (!report) return []
    const total = report.typeDistribution.reduce((sum, t) => sum + t.count, 0)
    return report.typeDistribution
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((t, i) => ({
        type: t.type as ReportType,
        count: t.count,
        pct: total ? Math.round((t.count / total) * 100) : 0,
        colorClass: DISTRIBUTION_COLORS[Math.min(i, DISTRIBUTION_COLORS.length - 1)],
      }))
  }, [report])

  async function handleDownloadPdf() {
    setPdfState('loading')
    setPdfError(null)
    try {
      const blob = await downloadAdminActivityReportPdf(PERIOD_TO_API[period])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'admin-activity-report.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : 'PDF 생성에 실패했습니다.')
      setTimeout(() => setPdfError(null), 4000)
    } finally {
      setPdfState('idle')
    }
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    setLoadState((s) => (s === 'ready' ? s : 'loading'))
  }

  const summary = report?.summary
  const avgMinutes = summary?.averageProcessingSeconds != null ? Math.round(summary.averageProcessingSeconds / 60) : null

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
              onClick={() => handlePeriodChange(p)}
              className={[
                'flex h-[38px] items-center rounded-pill px-[17px] text-[15px] font-bold',
                period === p ? 'bg-primary-deep text-white' : 'bg-primary/8 text-primary',
              ].join(' ')}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {loadState === 'error' ? (
          <span className="text-[15px] font-medium text-status-urgent">{loadError}</span>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[11px]">
              <StatCard value={summary?.totalReports ?? '—'} label="내가 처리" accent="primary-ultra" />
              <StatCard value={summary?.resolved ?? '—'} label="완료" accent="primary" />
              <StatCard value={summary?.cancelled ?? '—'} label="취소" accent="muted" />
              <StatCard value={summary?.totalActions ?? '—'} label="총 처리" accent="primary-light" />
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
                <span className="text-[15px] font-medium text-ink-500">총 {summary?.totalReports ?? 0}건</span>
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
          </>
        )}

        <div className="flex-1" />

        {pdfError && <span className="text-[13px] font-semibold text-status-urgent">{pdfError}</span>}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfState === 'loading'}
          className="flex h-[76px] shrink-0 items-center justify-center gap-[13px] rounded-pill bg-primary-deep text-[22px] font-bold text-white shadow-cta disabled:opacity-60"
        >
          {pdfState === 'loading' ? '생성 중…' : '⬇ PDF로 내보내기'}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-[15px] overflow-hidden rounded-md bg-white p-[23px] shadow-panel">
        <span className="text-t-title font-bold text-ink-900">처리 내역 상세</span>
        <div className="flex flex-col gap-[11px] overflow-y-auto">
          {loadState === 'loading' && <span className="text-[17px] font-medium text-ink-400">불러오는 중…</span>}
          {loadState === 'error' && <span className="text-[17px] font-medium text-status-urgent">{loadError}</span>}
          {loadState === 'ready' && report?.items.length === 0 && (
            <span className="text-[17px] font-medium text-ink-400">이 기간에 처리한 신고가 없습니다</span>
          )}
          {report?.items.map((item) => (
            <div
              key={item.id}
              className={[
                'flex flex-col gap-[8px] rounded-[15px] border p-[15px]',
                item.currentStatus === 'CANCELLED' ? 'border-line opacity-60' : 'border-primary/18 bg-primary/3',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-[8px]">
                  <span className="flex h-[30px] items-center rounded-[8px] bg-white px-[11px] text-[15px] font-bold text-ink-700 outline outline-1 outline-line">
                    {REPORT_TYPE_DISPLAY[item.currentType].label}
                  </span>
                  <span className="flex h-[30px] items-center rounded-[8px] bg-primary/10 px-[11px] text-[15px] font-bold text-primary">
                    {ACTION_LABEL[item.action]}
                  </span>
                </div>
                <span
                  className={['flex h-[30px] items-center rounded-[8px] px-[11px] text-[15px] font-bold', STATUS_PILL[item.currentStatus]].join(' ')}
                >
                  {STATUS_LABEL[item.currentStatus]}
                </span>
              </div>
              <span className="text-[19px] font-bold text-ink-900">{item.contentFinal}</span>
              <span className="text-[15px] font-medium text-ink-600">{itemMeta(item)}</span>
              {item.note && <span className="text-[15px] font-medium text-ink-500">메모 · {item.note}</span>}
              {item.changes.length > 0 && (
                <span className="text-[13px] font-medium text-ink-400">{item.changes.map(formatChange).join(' · ')}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
