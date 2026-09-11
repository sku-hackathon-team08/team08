import { useCallback, useEffect, useState } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { AnalysisConfirmScreen, type AnalysisDraft } from '../../components/staff/AnalysisConfirmScreen'
import { ReportHistoryScreen } from '../../components/staff/ReportHistoryScreen'
import { TextReportScreen } from '../../components/staff/TextReportScreen'
import { VoiceRecordScreen } from '../../components/staff/VoiceRecordScreen'
import { fromApiStaffReport } from '../../api/adapters'
import { ApiError } from '../../api/client'
import { createTextAnalysis, pollAnalysis } from '../../api/analyses'
import { createStaffReport, listStaffReports } from '../../api/reports'
import { getDemoMap, type DemoMapResponse } from '../../api/demoMap'
import { VWorldMap } from '../../components/VWorldMap'
import { getActor } from '../../lib/session'
import { TOAST_DURATION_MS } from '../../lib/uiConstants'
import type { StaffReportSummary } from '../../types/staffReport'
import { REPORT_STATUS_DISPLAY } from '../../types/report'

const VWORLD_API_KEY = import.meta.env.VITE_VWORLD_API_KEY as string | undefined

/**
 * 스태프 화면 전체 — S1(홈)을 기본으로 두고 S1-1(토스트)·S2(녹음)·S3/S3-1(AI 확인·수정)·
 * B(텍스트)·S4(내역)를 전부 이 컴포넌트 안의 phase로 처리한다. AdminHomePage가 02~12를
 * 한 컴포넌트 안에서 phase로 다루는 것과 같은 방식.
 *
 * 2026-09-12 실제 API 연동:
 * - 텍스트 신고: POST /report-analyses(TEXT) → READY까지 폴링 → 화면에서 확인/수정 →
 *   POST /staff/reports. 성공기준 문서("텍스트도 같은 확인 흐름을 시연") 그대로 B에서
 *   바로 전송하지 않고 S3를 거친다.
 * - "최근 내 신고"/"신고 내역"은 GET /staff/reports로 실제 목록을 받는다.
 * - 음성 녹음(S2)은 아직 실제 마이크(getUserMedia)를 안 쓴다 — 종료를 누르면 마치 그
 *   내용을 말한 것처럼 같은 텍스트 분석 파이프라인(POST /report-analyses TEXT)을 탄다.
 *   실제 오디오 캡처+VOICE 업로드로 교체하는 건 다음 작업.
 * - 분석 실패(FAILED, 예: OPENAI_API_KEY 미설정)는 에러를 보여주고 홈으로 돌려보낸다.
 */

type Phase = 'home' | 'recording' | 'analyzing' | 'confirm' | 'text' | 'history'

export function StaffHomePage() {
  const [phase, setPhase] = useState<Phase>('home')
  const [reports, setReports] = useState<StaffReportSummary[]>([])
  const [draft, setDraft] = useState<AnalysisDraft | null>(null)
  const [aiUrgency, setAiUrgency] = useState<AnalysisDraft['urgency']>('NORMAL')
  const [toastVisible, setToastVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [mapData, setMapData] = useState<DemoMapResponse | null>(null)

  const actor = getActor('staff')
  const name = actor?.name ?? '스태프'
  const team = actor?.team ?? ''

  const loadReports = useCallback(async () => {
    try {
      const page = await listStaffReports()
      setReports(page.items.map(fromApiStaffReport))
    } catch {
      // 목록을 못 받아도 홈 화면 자체는 그려야 한다 — 신고 시도는 여전히 가능해야 함.
    }
  }, [])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  // 지도 배치는 안 바뀌니 한 번만 받는다 — AdminHomePage와 같은 방식.
  useEffect(() => {
    if (!VWORLD_API_KEY) return
    getDemoMap()
      .then(setMapData)
      .catch(() => setMapData(null))
  }, [])

  function showToast() {
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), TOAST_DURATION_MS)
  }

  function showAnalysisError(err: unknown) {
    setAnalysisError(err instanceof ApiError ? err.message : '요청에 실패했습니다. 다시 시도해주세요.')
    setTimeout(() => setAnalysisError(null), 4000)
  }

  async function analyzeThenConfirm(message: string) {
    setPhase('analyzing')
    setAnalysisError(null)
    try {
      const analysisId = await createTextAnalysis('staff', message)
      const analysis = await pollAnalysis('staff', analysisId)
      if (analysis.status !== 'READY' || !analysis.typeSuggested || !analysis.urgencySuggested) {
        throw new Error('AI 분석에 실패했습니다. 다시 시도해주세요.')
      }
      setAiUrgency(analysis.urgencySuggested)
      setDraft({
        analysisId,
        message: analysis.contentSuggested ?? message,
        type: analysis.typeSuggested,
        urgency: analysis.urgencySuggested,
      })
      setPhase('confirm')
    } catch (err) {
      showAnalysisError(err)
      setPhase('home')
    }
  }

  async function submitDraft() {
    if (!draft) return
    setSubmitting(true)
    try {
      const created = await createStaffReport({
        analysisId: draft.analysisId,
        contentFinal: draft.message,
        type: draft.type,
        urgency: draft.urgency,
      })
      setReports((rs) => [fromApiStaffReport(created), ...rs])
      setDraft(null)
      setPhase('home')
      showToast()
    } catch (err) {
      showAnalysisError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'recording') {
    return (
      <VoiceRecordScreen
        onFinish={() =>
          void analyzeThenConfirm('메인무대 뒤 트러스 옆에 팬스가 흔들리고 있어요. 사람이 몰리면 위험할 것 같습니다.')
        }
        onSwitchToText={() => setPhase('text')}
      />
    )
  }

  if (phase === 'analyzing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[15px] bg-white">
        <div className="flex items-center gap-[6px]">
          <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary" />
          <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary/45" />
          <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary/18" />
        </div>
        <span className="text-m-caption font-semibold text-ink-600">AI가 분석하고 있습니다</span>
      </div>
    )
  }

  if (phase === 'confirm' && draft) {
    return (
      <AnalysisConfirmScreen
        draft={draft}
        aiUrgency={aiUrgency}
        submitting={submitting}
        onChangeDraft={setDraft}
        onBack={() => {
          setDraft(null)
          setPhase('home')
        }}
        onRerecord={() => {
          setDraft(null)
          setPhase('recording')
        }}
        onSubmit={() => void submitDraft()}
      />
    )
  }

  if (phase === 'text') {
    return <TextReportScreen onBack={() => setPhase('home')} onSubmit={(message) => void analyzeThenConfirm(message)} />
  }

  if (phase === 'history') {
    return <ReportHistoryScreen reports={reports} onBack={() => setPhase('home')} />
  }

  const recent = reports[0]

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="h-[30px] shrink-0" />

      <div className="flex h-[45px] shrink-0 items-center justify-between px-[21px]">
        <BrandLogo size={17} orientation="horizontal" />
        <span className="flex items-center gap-[3px] text-m-micro font-bold text-status-done">● 연결됨</span>
      </div>
      <div className="flex items-center justify-between px-[21px] pb-[9px]">
        <span className="text-m-label font-extrabold text-ink-900">2026 서경대 축제</span>
        <span className="flex h-[24px] items-center rounded-[8px] bg-primary px-[11px] text-m-micro font-bold text-white">
          {team || '소속 미입력'}
        </span>
      </div>
      <span className="px-[21px] text-m-micro text-ink-600">
        {name} · {team || '소속 미입력'}
      </span>

      <div
        className="relative m-[9px] mb-[12px] flex-1 overflow-hidden rounded-[21px] shadow-map"
        style={
          VWORLD_API_KEY && mapData
            ? undefined
            : {
                background:
                  'linear-gradient(160deg, rgb(214,224,214) 0%, rgb(197,213,199) 35%, rgb(180,202,190) 65%, rgb(162,190,183) 100%)',
              }
        }
      >
        {VWORLD_API_KEY && mapData ? (
          <VWorldMap
            mapData={mapData}
            pins={[{ id: 'me', lat: mapData.demoPoint.lat, lng: mapData.demoPoint.lng, colorHex: '#3366FF' }]}
            className="absolute inset-0 z-0"
          />
        ) : (
          <i className="absolute left-[68%] top-[26%] h-[14px] w-[14px] rounded-full border-2 border-white bg-primary shadow-[0_0_0_6px_rgba(51,102,255,0.25)]" />
        )}

        <span className="absolute left-[12px] top-[12px] rounded-[9px] bg-white/88 px-[11px] py-[5px] text-m-micro font-bold text-ink-900 shadow-card">
          내 위치 · {team || '현재 위치'}
        </span>

        <div className="absolute right-[12px] top-[12px] flex flex-col gap-[9px]">
          <button
            type="button"
            onClick={() => setPhase('text')}
            className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-white/92 text-[18px] shadow-card"
            title="텍스트로 신고하기"
          >
            ⌨
          </button>
          <button
            type="button"
            onClick={() => setPhase('history')}
            className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-white/92 text-[18px] shadow-card"
            title="신고 내역"
          >
            ▤
          </button>
        </div>

        <div className="absolute bottom-[24px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-[12px]">
          <span className="whitespace-nowrap rounded-pill bg-white/88 px-[14px] py-[5px] text-m-micro font-semibold text-ink-900 shadow-card">
            음성 우선 · 안되면 ⌨ 직접 입력
          </span>
          <button
            type="button"
            onClick={() => setPhase('recording')}
            className="flex h-[156px] w-[156px] flex-col items-center justify-center gap-[6px] rounded-full bg-primary shadow-[0_15px_36px_rgba(51,102,255,.45),0_0_0_9px_rgba(255,255,255,0.7)]"
          >
            <span className="text-[36px] text-white">🎙</span>
            <span className="text-m-body font-bold text-white">눌러서 신고하기</span>
          </button>
        </div>
      </div>

      {recent && (
        <div className="flex shrink-0 flex-col gap-[9px] px-[21px] pb-[21px]">
          <span className="text-m-caption font-bold text-ink-600">최근 내 신고</span>
          <div className="flex flex-col gap-[3px] rounded-[17px] border border-line bg-white p-[14px] shadow-card">
            <div className="flex justify-between">
              <span className="text-m-caption font-bold text-ink-900">{recent.title}</span>
              <span className="text-m-micro text-ink-300">
                {new Date(recent.createdAt).getHours().toString().padStart(2, '0')}:
                {new Date(recent.createdAt).getMinutes().toString().padStart(2, '0')}
              </span>
            </div>
            <span className="text-m-micro font-semibold text-ink-600">
              ● {REPORT_STATUS_DISPLAY[recent.status].label}
            </span>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className="absolute left-1/2 top-[210px] z-50 -translate-x-1/2 whitespace-nowrap rounded-pill bg-ink-900 px-[18px] py-[11px] text-m-caption font-semibold text-white shadow-modal">
          ✓ 신고가 접수되었습니다
        </div>
      )}

      {analysisError && (
        <div className="absolute left-1/2 top-[160px] z-50 -translate-x-1/2 whitespace-nowrap rounded-pill bg-status-urgent px-[18px] py-[11px] text-m-caption font-semibold text-white shadow-modal">
          {analysisError}
        </div>
      )}
    </div>
  )
}
