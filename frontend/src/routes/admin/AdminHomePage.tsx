import { useMemo, useState } from 'react'
import bubblesBackground from '../../assets/bubbles-admin.png'
import { AppHeader, type HeaderTab } from '../../components/AppHeader'
import { DevStatePanel } from '../../components/DevStatePanel'
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
import { CURRENT_USER_NAME } from '../../lib/uiConstants'
import { CURRENT_LOCATION, MOCK_MAP_PINS, MOCK_REPORTS } from '../../mocks/reports'
import { isUnconfirmed, REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type Report } from '../../types/report'

type ActiveModal = 'complete' | 'cancel' | 'directReport' | 'delete' | null

/**
 * 02 지도 대시보드 ★ 기준 화면 + 03(신고 선택 상태) + 04/05(신고 상세) —
 * design_handoff_oncue/COMPONENTS.md·관리자 화면 플로우(최종!).dc.html.
 * 다른 관리자 화면은 전부 이 화면의 헤더·필터바·레이아웃 규칙을 재사용한다.
 *
 * 03→04 전환: 카드를 처음 클릭하면 "선택"(03 — 리스트에 남아있고 지도에 점선 연결선),
 * 이미 선택된 카드를 다시 클릭하면 "상세 열기"(04/05 — 리스트가 상세 패널로 교체).
 * dc.html의 흐름 화살표(03 →"상세 열기"→ 04)가 정확히 어떤 조작으로 여는지까지는
 * 명시하지 않아서, 한 번 더 클릭해서 열도록 뒀다 — 지도 미리보기와 상세진입을 분리하는
 * 흔한 패턴이라 임의로 골랐다. 다르게 하고 싶으면 말씀해주세요.
 *
 * 완료/취소는 09/10 확인 모달을 거친다. 지원요청은 원래도 모달 없이 플래그만 바뀌는
 * 동작이라(디자인 문서 기준) 그대로 즉시 반영한다. "+ 관리자 직접 신고"는 11 모달을 연다.
 *
 * 실제 API 연동 전이라 mocks/reports.ts의 목 데이터를 로컬 state로 복사해 두고 여기서
 * 직접 mutate한다. 목록 상태(loading/error/empty/no-result/ready)는 실제로는 서버 응답에
 * 따라 정해지는데, 지금은 API가 없어서 화면 우하단에 테스트 전용 상태 전환 패널을 뒀다
 * (실제 디자인엔 없는 개발용 스캐폴딩. API 연동 시 제거).
 */

const LIST_STATE_LABEL: Record<ListState, string> = {
  ready: '정상',
  loading: '로딩',
  error: '오류',
  empty: '빈 목록',
  'no-result': '필터 결과 없음',
}

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
  const [devListState, setDevListState] = useState<ListState>('ready')
  const [reports, setReports] = useState<Report[]>(MOCK_REPORTS)
  const [pins, setPins] = useState<MapPinData[]>(MOCK_MAP_PINS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  // 렌더 중 Date.now()를 직접 호출하지 않도록 마운트 시점 한 번만 고정한다(mock 전용 계산).
  const [nowMs] = useState(() => Date.now())

  // 삭제(deletedFromBoard)는 목록·지도에서만 빼고 이력(reports 전체)에는 남긴다 — 취소와
  // 다른 동작이라 별도 필드로 구분한다. 화면에 실제로 보여줄 신고는 이 파생 배열만 쓴다.
  const visibleReports = useMemo(() => reports.filter((r) => !r.deletedFromBoard), [reports])

  const counts: FilterCounts = useMemo(
    () => ({
      all: visibleReports.length,
      urgent: visibleReports.filter((r) => r.urgency === 'URGENT').length,
      caution: visibleReports.filter((r) => r.urgency === 'CAUTION').length,
      done: visibleReports.filter((r) => r.status === 'RESOLVED').length,
      unconfirmed: visibleReports.filter((r) => isUnconfirmed(r, nowMs)).length,
    }),
    [visibleReports, nowMs],
  )

  const filteredReports = useMemo(() => {
    const base = (() => {
      switch (filter) {
        case 'urgent':
          return visibleReports.filter((r) => r.urgency === 'URGENT')
        case 'caution':
          return visibleReports.filter((r) => r.urgency === 'CAUTION')
        case 'done':
          return visibleReports.filter((r) => r.status === 'RESOLVED')
        case 'unconfirmed':
          return visibleReports.filter((r) => isUnconfirmed(r, nowMs))
        default:
          return visibleReports
      }
    })()

    // docs/features/command-dashboard.md 확정: 선택된 정렬과 무관하게 미확인이 항상 상단.
    // 그 안에서만 정렬 토글(긴급순=위험도순 · 최신순=접수시각 내림차순)을 적용한다.
    const byRecent = (a: Report, b: Report) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    const comparator: (a: Report, b: Report) => number =
      sort === 'urgency'
        ? (a, b) => URGENCY_DISPLAY[a.urgency].rank - URGENCY_DISPLAY[b.urgency].rank || byRecent(a, b)
        : byRecent

    const unconfirmed = base.filter((r) => isUnconfirmed(r, nowMs)).sort(comparator)
    const rest = base.filter((r) => !isUnconfirmed(r, nowMs)).sort(comparator)
    return [...unconfirmed, ...rest]
  }, [visibleReports, filter, sort, nowMs])

  const listState: ListState = devListState === 'ready' && filteredReports.length === 0 ? 'no-result' : devListState
  const mapState: MapCardState =
    devListState === 'loading' ? 'loading' : devListState === 'error' ? 'error' : devListState === 'empty' ? 'empty' : 'ready'

  const visiblePins = useMemo(() => {
    const visibleIds = new Set(visibleReports.map((r) => r.id))
    return pins.filter((p) => visibleIds.has(p.id))
  }, [pins, visibleReports])

  const detailReport = detailId ? reports.find((r) => r.id === detailId) : undefined
  const deleteTarget = deleteTargetId ? reports.find((r) => r.id === deleteTargetId) : undefined
  const selectedPin = selectedId ? pins.find((p) => p.id === selectedId) : undefined
  const detailPin = detailId ? pins.find((p) => p.id === detailId) : undefined

  function updateReport(id: string, patch: Partial<Report>) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

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

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${bubblesBackground})` }}
    >
      <DevStatePanel
        label="목록 상태"
        value={devListState}
        options={Object.keys(LIST_STATE_LABEL) as ListState[]}
        optionLabel={LIST_STATE_LABEL}
        onChange={setDevListState}
      />

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
                detailReport.status !== 'IN_PROGRESS'
                  ? 'unclaimed'
                  : detailReport.assigneeName === CURRENT_USER_NAME
                    ? 'owned'
                    : 'locked'
              }
              onBack={() => setDetailId(null)}
              onClaim={() => updateReport(detailReport.id, { status: 'IN_PROGRESS', assigneeName: CURRENT_USER_NAME })}
              onComplete={() => setActiveModal('complete')}
              onCancel={() => setActiveModal('cancel')}
              onRequestSupport={() => updateReport(detailReport.id, { supportRequested: true })}
            />
          </div>
        </div>
      ) : (
        <>
          <AppHeader eventName="2026 서경대 축제" activeTab={tab} onTabChange={setTab} userName={CURRENT_USER_NAME} />

          {tab === 'my-report' ? (
            <MyReportView reports={reports} currentUserName={CURRENT_USER_NAME} />
          ) : (
            <>
              <FilterBar
                counts={counts}
                activeFilter={filter}
                onFilterChange={setFilter}
                sort={sort}
                onSortChange={setSort}
                disabled={devListState === 'error'}
              />

              <div className="flex min-h-0 flex-1 gap-[23px] px-[27px] pb-[23px]">
                <MapCard
                  state={mapState}
                  pins={visiblePins}
                  lastSyncLabel="14:26"
                  className="w-[58%]"
                  onDirectReport={() => setActiveModal('directReport')}
                  connector={
                    selectedPin
                      ? {
                          from: CURRENT_LOCATION,
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
                  lastSyncLabel="14:26"
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
            onConfirm={(note) => {
              updateReport(detailReport.id, { status: 'RESOLVED', resolveNote: note || undefined, closedAt: new Date().toISOString() })
              setActiveModal(null)
              closeDetail()
            }}
          />
          <CancelConfirmModal
            open={activeModal === 'cancel'}
            onClose={() => setActiveModal(null)}
            onConfirm={(reason) => {
              updateReport(detailReport.id, { status: 'CANCELLED', cancelReason: reason, closedAt: new Date().toISOString() })
              setActiveModal(null)
              closeDetail()
            }}
          />
        </>
      )}

      <DirectReportModal
        open={activeModal === 'directReport'}
        onClose={() => setActiveModal(null)}
        locationLabel="메인무대 앞"
        onConfirm={({ type, message }) => {
          const id = `manual-${Date.now()}`
          setReports((prev) => [
            ...prev,
            {
              id,
              type,
              urgency: 'NORMAL',
              status: 'RECEIVED',
              message: message || '(관리자 직접 등록 — 내용 없음)',
              place: '메인무대 앞',
              supportRequested: false,
              createdAt: new Date().toISOString(),
            },
          ])
          setPins((prev) => [...prev, { id, top: 50, left: 45, colorClass: 'bg-status-normal' }])
          setActiveModal(null)
        }}
      />

      {deleteTarget && (
        <DeleteConfirmModal
          open={deleteTargetId !== null}
          onClose={() => setDeleteTargetId(null)}
          reportTitle={`${REPORT_TYPE_DISPLAY[deleteTarget.type].label} 신고`}
          onConfirm={() => {
            updateReport(deleteTarget.id, { deletedFromBoard: true })
            if (selectedId === deleteTarget.id) setSelectedId(null)
            if (detailId === deleteTarget.id) setDetailId(null)
            setDeleteTargetId(null)
          }}
        />
      )}
    </div>
  )
}
