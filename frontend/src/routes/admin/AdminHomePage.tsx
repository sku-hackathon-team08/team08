import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { openSupportRequest, joinSupportRequest } from '../../api/support'
import { getDemoMap, type DemoMapResponse } from '../../api/demoMap'
import { VWorldMap, type VWorldMapPin } from '../../components/VWorldMap'
import { getActor } from '../../lib/session'
import { useEnterTransition } from '../../lib/useEnterTransition'
import { isUnconfirmed, REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type Report, type ReportStatus, type Urgency } from '../../types/report'

const VWORLD_API_KEY = import.meta.env.VITE_VWORLD_API_KEY as string | undefined
const REPORTS_POLL_MS = 3000

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
 * - 지원요청(08-A)·지원하기(08-B)는 실제 POST .../support-requests, POST .../participants로
 *   붙였다. 종료(close)는 UI에 버튼이 없다 — report-lifecycle.md 확정대로 완료·취소·담당해제
 *   시 백엔드가 활성 지원요청·참여를 자동으로 같이 끝내서 수동 종료 버튼이 필요 없다.
 *   참여 취소(본인) 화면은 이 dc.html에 없어 만들지 않았다(참여자 목록 조회 UI도 마찬가지).
 * - 웹소켓은 이번 범위에서 제외(docs/api/hackathon.md 확정)라 관제 목록·지도 핀은
 *   REPORTS_POLL_MS 주기 폴링으로 갱신한다(주기는 command-dashboard.md에 따라 클라이언트
 *   후속 작업, 5초는 prd-v1.1.txt 5.4의 "MVP 폴링 3~5초" 시작안을 따름).
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

  // 실지도(VWorldMap) 인스턴스 하나를 대시보드 카드(58%)·상세 카드(46%) 사이에서 화면
  // 위치만 옮겨가며 재사용한다(MapCard.tsx 주석 참고 — SDK가 map.start() 두 번째 호출을
  // 지원하지 않는다). rootRef 기준 상대좌표로 뜬 지도의 위치를 잡아, 두 MapCard 중 지금
  // 보이는 쪽의 슬롯 좌표를 읽어 그 위에 겹쳐 그린다.
  const rootRef = useRef<HTMLDivElement>(null)
  const dashboardMapSlotRef = useRef<HTMLDivElement>(null)
  const detailMapSlotRef = useRef<HTMLDivElement>(null)
  const [mapSlotRect, setMapSlotRect] = useState<DOMRect | null>(null)
  // 대시보드·상세 둘 다 안 보이는 화면(나의 리포트 탭)도 있다 — 그때는 mapSlotRect를
  // null로 지우지 않는다(그러면 아래 렌더링에서 VWorldMap 자체가 트리에서 빠져
  // unmount됐다가 돌아올 때 map.start()가 두 번째로 불려 다시 그 버그가 난다 — 2026-09-12
  // 직접 재현). 마지막으로 잰 좌표는 남겨 두고 이 플래그로만 visibility를 숨긴다.
  const [mapVisible, setMapVisible] = useState(false)

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
      // 폴링 중 일시적 오류로 이미 보여주던 목록을 에러 화면으로 덮지 않는다(최초 로딩 실패만 error).
      setLoadState((s) => (s === 'ready' ? s : 'error'))
    }
  }, [sort])

  useEffect(() => {
    void loadReports()
    const id = setInterval(() => void loadReports(), REPORTS_POLL_MS)
    return () => clearInterval(id)
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
  // 완료는 완료 필터에서만 보인다 — 전체·긴급·주의·미확인에는 안 섞인다(2026-09-12 사용자 확정).
  const nonResolvedReports = useMemo(() => activeReports.filter((r) => r.status !== 'RESOLVED'), [activeReports])
  const unacknowledged = useCallback((r: Report) => r.isUnacknowledged ?? isUnconfirmed(r, nowMs), [nowMs])

  const counts: FilterCounts = useMemo(
    () => ({
      all: reports.filter((r) => r.status !== 'RESOLVED').length,
      urgent: nonResolvedReports.filter((r) => r.urgency === 'URGENT').length,
      caution: nonResolvedReports.filter((r) => r.urgency === 'CAUTION').length,
      done: activeReports.filter((r) => r.status === 'RESOLVED').length,
      unconfirmed: nonResolvedReports.filter(unacknowledged).length,
    }),
    [reports, activeReports, nonResolvedReports, unacknowledged],
  )

  const filteredReports = useMemo(() => {
    const base = (() => {
      switch (filter) {
        case 'urgent':
          return nonResolvedReports.filter((r) => r.urgency === 'URGENT')
        case 'caution':
          return nonResolvedReports.filter((r) => r.urgency === 'CAUTION')
        case 'done':
          return activeReports.filter((r) => r.status === 'RESOLVED')
        case 'unconfirmed':
          return nonResolvedReports.filter(unacknowledged)
        default:
          return nonResolvedReports
      }
    })()

    const byRecent = (a: Report, b: Report) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

    // 긴급순: 위험도가 최우선이라 긴급이 항상 맨 위. 같은 위험도 안에서만 미확인을 먼저 보여준다
    // (2026-09-12 사용자 확정 변경 — 전에는 미확인이 위험도보다 앞서서, 담당자가 배정된 긴급
    // 신고가 방치된 일반 신고보다 아래로 밀리는 문제가 있었다).
    if (sort === 'urgency') {
      return [...base].sort((a, b) => {
        const rankDiff = URGENCY_DISPLAY[a.urgency].rank - URGENCY_DISPLAY[b.urgency].rank
        if (rankDiff !== 0) return rankDiff
        const unackDiff = Number(unacknowledged(b)) - Number(unacknowledged(a))
        return unackDiff !== 0 ? unackDiff : byRecent(a, b)
      })
    }

    // 최신순: docs/features/command-dashboard.md 확정대로 미확인이 항상 상단.
    const unconfirmedFirst = base.filter(unacknowledged).sort(byRecent)
    const rest = base.filter((r) => !unacknowledged(r)).sort(byRecent)
    return [...unconfirmedFirst, ...rest]
  }, [activeReports, nonResolvedReports, filter, sort, unacknowledged])

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
  const detailRawPin = detailId ? rawPins.find((p) => p.id === detailId) : undefined
  // 리스트(02)↔상세(04/05) 전환 — StaffHomePage와 같은 목적. detailId가 바뀔 때마다(상세로
  // 들어가거나 목록으로 돌아올 때) 지금 보이는 쪽이 페이드+슬라이드로 등장한다.
  const entered = useEnterTransition(detailId ?? 'list')
  const enterClass = `transition-all duration-300 ease-out ${entered ? 'translate-x-0 opacity-100' : 'translate-x-[16px] opacity-0'}`

  // 두 MapCard 슬롯 중 지금 보이는 쪽(상세가 열려 있으면 상세, 아니면 대시보드)의 화면
  // 좌표를 읽어 뜬 지도의 위치를 맞춘다. 레이아웃이 그려진 다음(paint 전) 동기적으로
  // 측정해야 깜빡임 없이 자리를 잡는다. '나의 리포트' 탭처럼 두 슬롯 다 안 보이는 상태도
  // 있다 — 대시보드 슬롯은 invisible로만 숨겨서 DOM에 계속 남아있고 크기도 그대로라
  // (visibility:hidden은 레이아웃은 유지한다) 슬롯 존재 여부만으로는 못 가리므로 tab도 함께
  // 본다. mapSlotRect 자체는 이때도 null로 지우지 않는다 — VWorldMap을 계속 마운트해 둔
  // 채로 mapVisible만 꺼서 시각적으로 숨긴다(위 mapVisible 선언부 주석 참고).
  useLayoutEffect(() => {
    const slotVisible = detailReport ? true : tab === 'map'
    const slotEl = detailReport ? detailMapSlotRef.current : dashboardMapSlotRef.current
    function measure() {
      setMapVisible(Boolean(slotVisible && slotEl && rootRef.current))
      if (!slotVisible || !slotEl || !rootRef.current) return
      const slotBox = slotEl.getBoundingClientRect()
      const rootBox = rootRef.current.getBoundingClientRect()
      setMapSlotRect(new DOMRect(slotBox.left - rootBox.left, slotBox.top - rootBox.top, slotBox.width, slotBox.height))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // mapData가 비동기로 늦게 도착하면 그제서야 MapCard가 슬롯 div를 그리므로(showRealMap이
    // 그 전까진 false) mapData도 의존성에 넣어야 도착 시점에 다시 측정한다.
  }, [detailReport, tab, mapData])

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

  // 08-A(담당자가 지원요청) / 08-B(다른 관리자가 지원하기) 공용 핸들러 — variant는 호출부와
  // 동일한 규칙(assigneeId === 나)으로 다시 판정한다.
  async function handleRequestSupport(report: Report) {
    if (report.version === undefined) return
    try {
      if (report.assigneeId === myActor?.id) {
        const { supportRequest, reportVersion } = await openSupportRequest(report.id, { expectedVersion: report.version })
        mergeReport(report.id, { supportRequested: true, supportRequestId: supportRequest.id, version: reportVersion })
      } else {
        if (!report.supportRequestId) return
        const { reportVersion } = await joinSupportRequest(report.id, report.supportRequestId, { expectedVersion: report.version })
        mergeReport(report.id, { version: reportVersion })
      }
    } catch (err) {
      showActionError(err)
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
      ref={rootRef}
      className="relative flex h-full w-full flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${bubblesBackground})` }}
    >
      {/* 실지도(VWorldMap) 인스턴스는 여기 하나만 둔다 — 대시보드·상세 두 MapCard는 각자
          자리(슬롯)만 내주고, 이 지도를 그 슬롯 좌표 위에 겹쳐 그린다(위 mapSlotRect
          useLayoutEffect·MapCard.tsx 주석 참고). 상세를 열면 focus로 그 신고 위치를 가깝게
          확대해서 보여준다. */}
      {VWORLD_API_KEY && mapData && mapSlotRect && (
        <div
          className={`absolute z-0 ${mapVisible ? '' : 'invisible pointer-events-none'}`}
          style={{ top: mapSlotRect.top, left: mapSlotRect.left, width: mapSlotRect.width, height: mapSlotRect.height }}
        >
          <VWorldMap
            mapData={mapData}
            pins={
              detailReport
                ? detailRawPin
                  ? [{ id: detailRawPin.id, lat: detailRawPin.lat, lng: detailRawPin.lng, colorHex: pinColorHex(detailRawPin.status, detailRawPin.urgency) }]
                  : []
                : realMapPins
            }
            selectedId={detailReport ? undefined : selectedId}
            onSelectPin={
              detailReport
                ? undefined
                : (id) => {
                    const r = reports.find((x) => x.id === id)
                    if (r) handleCardOpen(r)
                  }
            }
            focus={detailReport && detailRawPin ? { lat: detailRawPin.lat, lng: detailRawPin.lng } : undefined}
            className="h-full w-full"
          />
        </div>
      )}

      {actionError && (
        <div className="absolute left-1/2 top-[19px] z-50 -translate-x-1/2 rounded-[15px] bg-status-urgent px-[23px] py-[11px] text-t-body font-semibold text-white shadow-modal">
          {actionError}
        </div>
      )}

      {/* 목록(02/03) 레이어 — 상세(04/05)로 전환해도 항상 마운트해 둔다. 예전엔 detailReport가
          있으면 이 블록 자체가 언마운트돼서, 그 안의 real VWorldMap이 상세→목록 왕복마다
          다시 마운트됐다 — 브이월드 SDK가 map.start()를 두 번째 부르면 내부 싱글턴이 깨져
          "Error constructing CesiumWidget"로 이어진다(2026-09-12 Playwright로 재현:
          TypeError: Cannot read properties of undefined (reading 'camera'/'scene')). 이제는
          숨김도 visibility로만 해서 VWorldMap의 캔버스 크기가 0이 되는 것도 피한다. */}
      <div
        className={`pointer-events-none absolute inset-0 flex min-h-0 flex-1 flex-col ${enterClass} ${detailReport ? 'invisible' : ''}`}
      >
        {/* 이 레이어(및 아래 두 겹)는 순수 레이아웃용 래퍼라 pointer-events-none으로 뚫어야
            떠 있는 실지도까지 클릭·드래그가 전달된다(위 MapCard.tsx 주석과 같은 이유 —
            2026-09-12 직접 드래그로 확인: 구조 래퍼 div들이 계속 elementFromPoint의
            타깃으로 잡혔다). 그 안의 실제 인터랙션 요소(헤더·나의 리포트·필터바·리스트)에만
            pointer-events-auto를 되살린다. */}
        <AppHeader
          eventName="상암월드컵경기장"
          activeTab={tab}
          onTabChange={setTab}
          userName={userName}
          className="pointer-events-auto"
        />

        {/* 지도 대시보드(02)·나의 리포트 레이어도 같은 이유로 항상 마운트해 두고 visibility로만
            전환한다 — real VWorldMap은 지도 대시보드 쪽에만 있다. */}
        <div className="relative min-h-0 flex-1 pointer-events-none">
          <div className={`absolute inset-0 ${tab === 'my-report' ? 'pointer-events-auto' : 'invisible pointer-events-none'}`}>
            <MyReportView currentUserName={userName} />
          </div>
          <div
            className={`pointer-events-none absolute inset-0 flex min-h-0 flex-1 flex-col ${tab === 'my-report' ? 'invisible' : ''}`}
          >
            <FilterBar
              counts={counts}
              activeFilter={filter}
              onFilterChange={setFilter}
              sort={sort}
              onSortChange={handleSortChange}
              disabled={loadState === 'error'}
              className="pointer-events-auto"
            />

            <div className="flex min-h-0 flex-1 gap-[23px] px-[27px] pb-[23px] pointer-events-none">
              <MapCard
                state={mapState}
                pins={visiblePins}
                lastSyncLabel={new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                className="w-[58%]"
                onDirectReport={() => setActiveModal('directReport')}
                showRealMap={Boolean(VWORLD_API_KEY && mapData)}
                mapSlotRef={dashboardMapSlotRef}
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
              <div className="flex flex-1 pointer-events-auto">
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
            </div>
          </div>
        </div>
      </div>

      {detailReport && (
        <div
          className={`pointer-events-none absolute inset-0 flex min-h-0 flex-1 flex-col gap-[15px] px-[27px] pb-[23px] pt-[23px] ${enterClass}`}
        >
          <div className="flex min-h-0 flex-1 gap-[23px] pointer-events-none">
            <MapCard
              state="ready"
              compact
              locationLabel={detailReport.place}
              singlePin={detailPin ? { top: detailPin.top, left: detailPin.left, colorClass: detailPin.colorClass } : undefined}
              className="w-[46%]"
              showRealMap={Boolean(VWORLD_API_KEY && mapData)}
              mapSlotRef={detailMapSlotRef}
            />
            <div className="flex flex-1 pointer-events-auto">
              <ReportDetailPanel
                report={detailReport}
                variant={
                  detailReport.status !== 'IN_PROGRESS' ? 'unclaimed' : detailReport.assigneeId === myActor?.id ? 'owned' : 'locked'
                }
                onBack={() => setDetailId(null)}
                onClaim={() => handleClaim(detailReport)}
                onComplete={() => setActiveModal('complete')}
                onCancel={() => setActiveModal('cancel')}
                onRequestSupport={() => void handleRequestSupport(detailReport)}
              />
            </div>
          </div>
        </div>
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
