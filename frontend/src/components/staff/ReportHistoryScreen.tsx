import { REPORT_STATUS_DISPLAY, type ReportStatus } from '../../types/report'
import type { StaffReportSummary } from '../../types/staffReport'

/**
 * S4(신고 내역 · 상태 회신) — 관리자 화면 플로우(최종!).dc.html.
 * dc.html 예시는 카드 1장만 보여주지만 실제로는 내가 보낸 신고 전부를 목록으로 보여주고,
 * 각 카드 안에 접수→처리중→완료/취소 타임라인을 그대로 펼쳐 둔다(별도 상세 화면 없음).
 */

const STATUS_BG: Record<ReportStatus, string> = {
  RECEIVED: 'bg-status-urgent',
  IN_PROGRESS: 'bg-status-progress',
  RESOLVED: 'bg-status-done',
  CANCELLED: 'bg-status-cancel',
}

const TIMELINE_ICON: Record<ReportStatus, { glyph: string; className: string }> = {
  RECEIVED: { glyph: '○', className: 'text-primary' },
  IN_PROGRESS: { glyph: '●', className: 'text-primary' },
  RESOLVED: { glyph: '✓', className: 'text-status-done' },
  CANCELLED: { glyph: '×', className: 'text-ink-400' },
}

const NOTE_TONE: Partial<Record<ReportStatus, string>> = {
  IN_PROGRESS: 'bg-primary/8 text-primary',
  RESOLVED: 'bg-status-done/8 text-status-done',
  CANCELLED: 'bg-surface-chip text-ink-500',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  return `${date} ${formatTime(iso)}`
}

export function ReportHistoryScreen({ reports, onBack }: { reports: StaffReportSummary[]; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="h-[30px] shrink-0" />
      <div className="flex h-[42px] shrink-0 items-center gap-[9px] px-[18px]">
        <button type="button" onClick={onBack} className="text-[18px] text-ink-900">
          ‹
        </button>
        <span className="text-m-body font-bold text-ink-900">신고 내역</span>
      </div>

      <div className="flex flex-1 flex-col gap-[12px] overflow-y-auto px-[21px] pb-[21px]">
        {reports.map((r) => (
          <div key={r.id} className="flex flex-col gap-[8px] rounded-[17px] border border-line bg-white p-[14px] shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-m-title font-extrabold text-ink-900">{r.title}</span>
              <span
                className={['flex h-[23px] items-center rounded-[6px] px-[9px] text-m-micro font-bold text-white', STATUS_BG[r.status]].join(
                  ' ',
                )}
              >
                {REPORT_STATUS_DISPLAY[r.status].label}
              </span>
            </div>
            <span className="text-m-micro text-ink-600">
              {formatDateTime(r.createdAt)} · {r.message}
            </span>

            <div className="mt-[3px] flex flex-col gap-[6px]">
              {r.timeline.map((entry, i) => (
                <div key={i} className="flex flex-col gap-[6px]">
                  <div className="flex items-baseline gap-[9px]">
                    <span className={TIMELINE_ICON[entry.status].className}>{TIMELINE_ICON[entry.status].glyph}</span>
                    <span className="text-m-caption font-bold text-ink-900">{REPORT_STATUS_DISPLAY[entry.status].label}</span>
                    <span className="text-m-micro text-ink-300">{formatTime(entry.at)}</span>
                  </div>
                  {entry.note && (
                    <div className={['rounded-[9px] px-[11px] py-[8px] text-m-micro', NOTE_TONE[entry.status]].join(' ')}>
                      {entry.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
