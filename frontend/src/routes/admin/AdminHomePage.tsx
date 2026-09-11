import { useCallback, useEffect, useMemo, useState } from 'react'
import bubblesBackground from '../../assets/bubbles-admin.png'
import { AppHeader, type HeaderTab } from '../../components/AppHeader'
import { FilterBar, type FilterCounts } from '../../components/FilterBar'
import type { FilterKey } from '../../components/DotFilterChip'
import { MapCard, type MapCardState, type MapPinData } from '../../components/MapCard'
import { MyReportView } from '../../components/MyReportView'
import { CancelConfirmModal } from '../../components/modals/CancelConfirmModal'
import { CompleteConfirmModal } from '../../components/modals/CompleteConfirmModal'
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal'
import { DirectReportModal } from '../../components/modals/DirectReportModal'
import { ReportDetailPanel } from '../../components/ReportDetailPanel'
import { ReportList, type ListState } from '../../components/ReportList'
import type { SortValue } from '../../components/SortToggle'
import { fromApiMapPin, fromApiReport } from '../../api/adapters'
import { ApiError } from '../../api/client'
import { createTextAnalysis, pollAnalysis } from '../../api/analyses'
import { createAdminReport, claimReport, resolveReport, cancelReport, listAdminReports, listMapPins } from '../../api/reports'
import { getDemoMap, type DemoMapResponse } from '../../api/demoMap'
import type { VWorldMapPin } from '../../components/VWorldMap'
import { getActor } from '../../lib/session'
import { isUnconfirmed, REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type Report, type ReportStatus, type Urgency } from '../../types/report'

const VWORLD_API_KEY = import.meta.env.VITE_VWORLD_API_KEY as string | undefined

/** theme.css @theme 색상값 그대로 — Cesium은 CSS 변수를 못 읽어서 hex로 한 번 더 둔다. */
const PIN_COLOR_HEX: Record<Urgency, string> = { URGENT: '#FF4242', CAUTION: '#FF9200', NORMAL: '#AEB0B6' }
const STATUS_COLOR_HEX: Partial<Record<ReportStatus, string>> = { IN_PROGRESS: '#3366FF', RESOLVED: '#00BF40' }

function pinColorHex(status: ReportStatus, urgency: Urgency): string {
  return STATUS_COLOR_HEX[status] ?? PIN_COLOR_HEX[urgency]
}

type ActiveModal = 'complete' | 'cancel' | 'directReport' | 'delete' | null

/**
 * 02 지도 대시보드 ★ 기준 화면 + 03(신고 선택 상태) + 04/05(신고 상세) —
 * design_handoff_oncue/COMPONENTS.md·관리자 화면 플로우(최종!).dc.html.
 * 다른 관리자 화면은 전부 이 화면의 헤더·필터바·레이아웃 규칙을 재사용한다.
 *
 * 03→04 전환: 카드를 처음 클릭하면 "선택"(03 — 리스트에 남아있고 지도에 점선 연결선),
 * 이미 선택된 카드를 다시 클릭하면 "상세 열기"(04/05 — 리스트가 상세 패널로 교체).
 *
 * 2026-09-12 실제 API 연동(GET/PATCH /admin/reports, /admin/map-reports):
 * - "삭제"(02-1)는 백엔드에 별도 액션이 없어서(claim/classification/resolve/release/cancel
 *   5개뿐, 2026-09-12 코드 감사 확인) cancel을 고정 사유("관리자 삭제")로 호출한다.
 *   CANCELLED 상태는 목록·지도에서 제외하면 "삭제"와 똑같이 동작한다(deletedFromBoard
 *   같은 프론트 전용 플래그는 더 필요 없어져서 없앴다).
 * - "전체" 카운트는 취소도 포함하되(docs/features/command-dashboard.md 확정) 목록·지도·
 *   나머지 카운트는 취소를 제외한다.
 * - 담당자 판정(owned/locked)은 이름이 아니라 claimedBy.id vs 내 actor.id로 한다.
 * - 미확인 여부는 서버가 계산해서 주는 isUnacknowledged를 우선 쓴다(클라이언트 isUnconfirmed는
 *   그 값이 없을 때만 쓰는 폴백).
 * - 관리자 직접 신고(11)도 실제로는 2단계다: 먼저 POST /report-analyses(TEXT)로 분석을
 *   만들고 READY가 될 때까지 기다린 다음 그 analysisId로 POST /admin/reports를 부른다 —
 *   모달 자체는 안 건드리고(로딩 표시 없음, 등록 클릭 즉시 닫힘) 뒤에서 비동기로 처리한다.
 * - 페이지네이션은 이번엔 pageSize를 최댓값(100, app/api/pagination.py)으로 받는다 — 그
 *   이상 쌓이면 다음 페이지는 아직 안 가져온다(커서 UI는 다음 작업).
 * - 지원요청은 실제 POST .../support-requests로 붙였다. 다른 관리자가 참여/취소하는
 *   08-A/08-B 상호작용은 아직 이 화면에 안 이어서(support 목록 조회·참여 UI는 다음 작업).
 */

const FILTER_LABEL: Record<FilterKey, string> = {
  all: '전체',
  urgent: '긴급',
  caution: '주의',
  done: '완료',
  unconfirmed: '미확인',
}

export function AdminHomePage() {
  const [tab, setTab] = useState<HeaderTab>('map')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortValue>('urgency')
  const [reports, setReports] = useState<Report[]>([])
  const [pins, setPins] = useState<MapPinData[]>([])
  const [rawPins, setRawPins] = useState<{ id: string; lat: number; lng: number; status: ReportStatus; urgency: Urgency }[]>([])
  const [mapData, setMapData] = useState<DemoMapResponse | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  // 렌더 중 Date.now()를 직접 호출하지 않도록 마운트 시점 한 번만 고정한다.
  const [nowMs] = useState(() => Date.now())

  const myActor = useMemo(() => getActor('admin'), [])
  const userName = myActor?.name ?? '관리자'

  // 목록·지도를 다시 받는다. loading 표시는 여기서 시작하지 않는다 — 이벤트(정렬 변경 등)
  // 쪽에서 직접 setLoadState('loading')을 부르고, 이 함수는 결과(ready/error)만 반영한다
  // (oxlint react/set-state-in-effect: effect 안에서 곧장 setState하는 대신 원인이 된
  // 이벤트에서 상태를 바꾸라는 권고를 따름).
  const loadReports = useCallback(async () => {
    try {
      const [reportsPage, pinsPage] = await Promise.all([
        // pageSize 최댓값은 100(app/api/pagination.py) — 100건 넘으면 다음 페이지는 아직
        // 안 받아온다(커서 UI는 다음 작업, 지금은 첫 페이지만 본다).
        listAdminReports({ sort, pageSize: 100 }),
        listMapPins(),
      ])
      setReports(reportsPage.items.map(fromApiReport))
      setPins(pinsPage.items.map((pin, i) => fromApiMapPin(pin, i)))
      setRawPins(pinsPage.items.map((pin) => ({ id: pin.id, lat: pin.position.lat, lng: pin.position.lng, status: pin.status, urgency: pin.urgency.value })))
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [sort])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  // 지도 배치(구역·게이트·3D 모델)는 신고와 달리 안 바뀌니 한 번만 받는다.
  useEffect(() => {
    if (!VWORLD_API_KEY) return
    getDemoMap()
      .then(setMapData)
      .catch(() => setMapData(null))
  }, [])

  function handleSortChange(next: SortValue) {
    setSort(next)
    setLoadState((s) => (s === 'ready' ? s : 'loading'))
  }

  function showActionError(err: unknown) {
    setActionError(err instanceof ApiError ? err.message : '요청을 처리하지 못했습니다.')
    setTimeout(() => setActionError(null), 4000)
    // 버전 충돌 등으로 로컬 상태가 서버와 어긋났을 수 있으니 목록을 다시 받는다.
    void loadReports()
  }

  function mergeReport(id: string, patch: Partial<Report>) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  // 취소(=삭제 포함)는 목록·지도에서 제외한다(docs 확정). "전체" 카운트만 취소도 포함해서 센다.
  const activeReports = useMemo(() => reports.filter((r) => r.status !== 'CANCELLED'), [reports])
  const unacknowledged = useCallback((r: Report) => r.isUnacknowledged ?? isUnconfirmed(r, nowMs), [nowMs])

  const counts: FilterCounts = useMemo(
    () => ({
      all: reports.length,
      urgent: activeReports.filter((r) => r.urgency === 'URGENT').length,
      caution: activeReports.filter((r) => r.urgency === 'CAUTION').length,
      done: activeReports.filter((r) => r.status === 'RESOLVED').length,
      unconfirmed: activeReports.filter(unacknowledged).length,
    }),
    [reports, activeReports, unacknowledged],
  )

  const filteredReports = useMemo(() => {
    const base = (() => {
      switch (filter) {
        case 'urgent':
          return activeReports.filter((r) => r.urgency === 'URGENT')
        case 'caution':
          return activeReports.filter((r) => r.urgency === 'CAUTION')
        case 'done':
          return activeReports.filter((r) => r.status === 'RESOLVED')
        case 'unconfirmed':
          return activeReports.filter(unacknowledged)
        default:
          return activeReports
      }
    })()

    // docs/features/command-dashboard.md 확정: 선택된 정렬과 무관하게 미확인이 항상 상단.
    const byRecent = (a: Report, b: Report) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    const comparator: (a: Report, b: Report) => number =
      sort === 'urgency'
        ? (a, b) => URGENCY_DISPLAY[a.urgency].rank - URGENCY_DISPLAY[b.urgency].rank || byRecent(a, b)
        : byRecent

    const unconfirmedFirst = base.filter(unacknowledged).sort(comparator)
    const rest = base.filter((r) => !unacknowledged(r)).sort(comparator)
    return [...unconfirmedFirst, ...rest]
  }, [activeReports, filter, sort, unacknowledged])

  const listState: ListState = loadState === 'ready' && filteredReports.length === 0 ? 'no-result' : loadState
  const mapState: MapCardState = loadState

  const visiblePins = useMemo(() => {
    const visibleIds = new Set(activeReports.map((r) => r.id))
    return pins.filter((p) => visibleIds.has(p.id))
  }, [pins, activeReports])

  const realMapPins: VWorldMapPin[] = useMemo(() => {
    const visibleIds = new Set(activeReports.map((r) => r.id))
    return rawPins
      .filter((p) => visibleIds.has(p.id))
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, colorHex: pinColorHex(p.status, p.urgency) }))
  }, [rawPins, activeReports])

  const detailReport = detailId ? reports.find((r) => r.id === detailId) : undefined
  const deleteTarget = deleteTargetId ? reports.find((r) => r.id === deleteTargetId) : undefined
  const selectedPin = selectedId ? pins.find((p) => p.id === selectedId) : undefined
  const detailPin = detailId ? pins.find((p) => p.id === detailId) : undefined

  function handleCardOpen(report: Report) {
    if (selectedId === report.id) {
      setDetailId(report.id)
    } else {
      setSelectedId(report.id)
    }
  }

  function closeDetail() {
    setDetailId(null)
    setSelectedId(null)
  }

  async function handleClaim(report: Report) {
    if (report.version === undefined) return
    try {
      const detail = await claimReport(report.id, { expectedVersion: report.version, type: report.type, urgency: report.urgency })
      mergeReport(report.id, fromApiReport(detail))
    } catch (err) {
      showActionError(err)
    }
  }

  async function handleComplete(report: Report, note: string) {
    if (report.version === undefined) return
    try {
      const detail = await resolveReport(report.id, { expectedVersion: report.version, resolveNote: note || undefined })
      mergeReport(report.id, fromApiReport(detail))
    } catch (err) {
      showActionError(err)
    } finally {
      setActiveModal(null)
      closeDetail()
    }
  }

  async function handleCancel(report: Report, reason: string) {
    if (report.version === undefined) return
    try {
      const detail = await cancelReport(report.id, { expectedVersion: report.version, cancelReason: reason })
      mergeReport(report.id, fromApiReport(detail))
    } catch (err) {
      showActionError(err)
    } finally {
      setActiveModal(null)
      closeDetail()
    }
  }

  async function handleDelete(report: Report) {
    if (report.version === undefined) return
    try {
      const detail = await cancelReport(report.id, { expectedVersion: report.version, cancelReason: '관리자 삭제' })
      mergeReport(report.id, fromApiReport(detail))
      if (selectedId === report.id) setSelectedId(null)
      if (detailId === report.id) setDetailId(null)
    } catch (err) {
      showActionError(err)
    } finally {
      setDeleteTargetId(null)
    }
  }

  async function handleDirectReport({ type, message }: { type: Report['type']; message: string }) {
    setActiveModal(null)
    try {
      const analysisId = await createTextAnalysis('admin', message || '관리자 직접 등록')
      const analysis = await pollAnalysis('admin', analysisId)
      if (analysis.status !== 'READY') throw new Error('분석이 실패했습니다.')
      const detail = await createAdminReport({ analysisId, contentFinal: message || '관리자 직접 등록', type })
      setReports((prev) => [fromApiReport(detail), ...prev])
      void loadReports() // map-pins는 목록 응답에 안 실려 있어 지도 반영을 위해 다시 받는다.
    } catch (err) {
      showActionError(err)
    }
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${bubblesBackground})` }}
    >
      {actionError && (
        <div className="absolute left-1/2 top-[19px] z-50 -translate-x-1/2 rounded-[15px] bg-status-urgent px-[23px] py-[11px] text-t-body font-semibold text-white shadow-modal">
          {actionError}
        </div>
      )}

      {detailReport ? (
        <div className="flex min-h-0 flex-1 flex-col gap-[15px] px-[27px] pb-[23px] pt-[23px]">
          <div className="flex min-h-0 flex-1 gap-[23px]">
            <MapCard
              state="ready"
              compact
              locationLabel={detailReport.place}
              singlePin={detailPin ? { top: detailPin.top, left: detailPin.left, colorClass: detailPin.colorClass } : undefined}
              className="w-[46%]"
            />
            <ReportDetailPanel
              report={detailReport}
              variant={
                detailReport.status !== 'IN_PROGRESS' ? 'unclaimed' : detailReport.assigneeId === myActor?.id ? 'owned' : 'locked'
              }
              onBack={() => setDetailId(null)}
              onClaim={() => handleClaim(detailReport)}
              onComplete={() => setActiveModal('complete')}
              onCancel={() => setActiveModal('cancel')}
              onRequestSupport={() => {
                // TODO(다음 작업): POST /support-requests 연동 — 지금은 버튼 눌러도 반영 안 됨.
                // (2026-09-12: 실제 참여자 조회·다른 관리자 참여 UI가 아직 없어 지금 붙이면
                // reportVersion만 바뀌고 화면엔 아무 표시도 못 해서 우선 보류)
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <AppHeader eventName="2026 서경대 축제" activeTab={tab} onTabChange={setTab} userName={userName} />

          {tab === 'my-report' ? (
            <MyReportView currentUserName={userName} />
          ) : (
            <>
              <FilterBar
                counts={counts}
                activeFilter={filter}
                onFilterChange={setFilter}
                sort={sort}
                onSortChange={handleSortChange}
                disabled={loadState === 'error'}
              />

              <div className="flex min-h-0 flex-1 gap-[23px] px-[27px] pb-[23px]">
                <MapCard
                  state={mapState}
                  pins={visiblePins}
                  lastSyncLabel={new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  className="w-[58%]"
                  onDirectReport={() => setActiveModal('directReport')}
                  real={
                    VWORLD_API_KEY && mapData
                      ? {
                          mapData,
                          pins: realMapPins,
                          selectedId,
                          onSelectPin: (id) => {
                            const r = reports.find((x) => x.id === id)
                            if (r) handleCardOpen(r)
                          },
                        }
                      : undefined
                  }
                  connector={
                    selectedPin
                      ? {
                          from: { top: 36, left: 18 },
                          to: {
                            top: selectedPin.top,
                            left: selectedPin.left,
                            colorClass: selectedPin.colorClass,
                            label: (() => {
                              const r = reports.find((x) => x.id === selectedId)
                              return r ? `${URGENCY_DISPLAY[r.urgency].label} 신고` : ''
                            })(),
                          },
                        }
                      : undefined
                  }
                />
                <ReportList
                  state={listState}
                  reports={filteredReports}
                  selectedId={selectedId}
                  activeFilterLabel={filter !== 'all' ? FILTER_LABEL[filter] : undefined}
                  lastSyncLabel={new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  onOpen={handleCardOpen}
                  onDelete={(report) => setDeleteTargetId(report.id)}
                  onClearFilter={() => setFilter('all')}
                />
              </div>
            </>
          )}
        </>
      )}

      {detailReport && (
        <>
          <CompleteConfirmModal
            open={activeModal === 'complete'}
            onClose={() => setActiveModal(null)}
            onConfirm={(note) => void handleComplete(detailReport, note)}
          />
          <CancelConfirmModal
            open={activeModal === 'cancel'}
            onClose={() => setActiveModal(null)}
            onConfirm={(reason) => void handleCancel(detailReport, reason)}
          />
        </>
      )}

      <DirectReportModal
        open={activeModal === 'directReport'}
        onClose={() => setActiveModal(null)}
        locationLabel="현재 위치"
        onConfirm={(data) => void handleDirectReport(data)}
      />

      {deleteTarget && (
        <DeleteConfirmModal
          open={deleteTargetId !== null}
          onClose={() => setDeleteTargetId(null)}
          reportTitle={`${REPORT_TYPE_DISPLAY[deleteTarget.type].label} 신고`}
          onConfirm={() => void handleDelete(deleteTarget)}
        />
      )}
    </div>
  )
}
