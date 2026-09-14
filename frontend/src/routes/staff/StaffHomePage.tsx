import { useCallback, useEffect, useState } from 'react'
import bubblePhoneBackground from '../../assets/bubble-phone.png'
import { BrandLogo } from '../../components/BrandLogo'
import { AnalysisConfirmScreen, type AnalysisDraft } from '../../components/staff/AnalysisConfirmScreen'
import { ReportHistoryScreen } from '../../components/staff/ReportHistoryScreen'
import { TextReportScreen } from '../../components/staff/TextReportScreen'
import { VoiceRecordScreen } from '../../components/staff/VoiceRecordScreen'
import { fromApiStaffReport } from '../../api/adapters'
import { ApiError } from '../../api/client'
import { createTextAnalysis, createVoiceAnalysis, pollAnalysis } from '../../api/analyses'
import { createStaffReport, listStaffReports } from '../../api/reports'
import { getDemoMap, type DemoMapResponse } from '../../api/demoMap'
import { VWorldMap } from '../../components/VWorldMap'
import { getActor } from '../../lib/session'
import { TOAST_DURATION_MS } from '../../lib/uiConstants'
import { useEnterTransition } from '../../lib/useEnterTransition'
import type { StaffReportSummary } from '../../types/staffReport'
import { REPORT_STATUS_DISPLAY, type ReportStatus } from '../../types/report'

const VWORLD_API_KEY = import.meta.env.VITE_VWORLD_API_KEY as string | undefined
const REPORTS_POLL_MS = 5000

// ReportHistoryScreen의 STATUS_BG(배지 배경)와 같은 상태→색 매핑을 텍스트 색으로 쓴다.
const STATUS_TEXT: Record<ReportStatus, string> = {
  RECEIVED: 'text-status-urgent',
  IN_PROGRESS: 'text-status-progress',
  RESOLVED: 'text-status-done',
  CANCELLED: 'text-status-cancel',
}

/**
 * 스태프 화면 전체 — S1(홈)을 기본으로 두고 S1-1(토스트)·S2(녹음)·S3/S3-1(AI 확인·수정)·
 * B(텍스트)·S4(내역)를 전부 이 컴포넌트 안의 phase로 처리한다. AdminHomePage가 02~12를
 * 한 컴포넌트 안에서 phase로 다루는 것과 같은 방식.
 *
 * 2026-09-12 실제 API 연동:
 * - 텍스트 신고: POST /report-analyses(TEXT) → READY까지 폴링 → 화면에서 확인/수정 →
 *   POST /staff/reports. 성공기준 문서("텍스트도 같은 확인 흐름을 시연") 그대로 B에서
 *   바로 전송하지 않고 S3를 거친다.
 * - "최근 내 신고"/"신고 내역"은 GET /staff/reports로 실제 목록을 받는다. 웹소켓 미구현
 *   (docs/api/hackathon.md 확정 제외 범위)이라 activity-report.md "조용히 갱신" 요구대로
 *   REPORTS_POLL_MS 주기 폴링으로 담당·완료 등 상태 변화를 반영한다.
 * - 음성 녹음(S2)은 VoiceRecordScreen이 실제 마이크(getUserMedia/MediaRecorder)로 잡은
 *   오디오 Blob을 넘기면 POST /report-analyses(VOICE)로 보낸다 — 텍스트와 같은 폴링→확인
 *   흐름을 그대로 탄다.
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
  // AdminHomePage의 화면(리스트↔상세) 전환과 같은 목적 — phase가 바뀔 때마다 지금 보이는
  // 화면이 페이드+슬라이드로 등장한다. phase를 key로 줘서, home이 항상 마운트돼 있고 다른
  // phase는 그 위에 겹쳐 그리는 지금 구조에서도(아래 141번째 줄 주석) phase가 바뀔 때마다
  // 다시 재생된다.
  const entered = useEnterTransition(phase)
  const enterClass = `transition-all duration-300 ease-out ${entered ? 'translate-x-0 opacity-100' : 'translate-x-[16px] opacity-0'}`

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
    const id = setInterval(() => void loadReports(), REPORTS_POLL_MS)
    return () => clearInterval(id)
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

  async function finishAnalysis(analysisId: string, fallbackMessage: string) {
    const analysis = await pollAnalysis('staff', analysisId)
    if (analysis.status !== 'READY' || !analysis.typeSuggested || !analysis.urgencySuggested) {
      throw new Error('AI 분석에 실패했습니다. 다시 시도해주세요.')
    }
    setAiUrgency(analysis.urgencySuggested)
    setDraft({
      analysisId,
      message: analysis.contentSuggested ?? fallbackMessage,
      type: analysis.typeSuggested,
      urgency: analysis.urgencySuggested,
    })
    setPhase('confirm')
  }

  async function analyzeThenConfirm(message: string) {
    setPhase('analyzing')
    setAnalysisError(null)
    try {
      const analysisId = await createTextAnalysis('staff', message)
      await finishAnalysis(analysisId, message)
    } catch (err) {
      showAnalysisError(err)
      setPhase('home')
    }
  }

  async function analyzeVoiceThenConfirm(audio: Blob) {
    setPhase('analyzing')
    setAnalysisError(null)
    try {
      const analysisId = await createVoiceAnalysis(audio)
      await finishAnalysis(analysisId, '')
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

  const recent = reports[0]

  // phase마다 완전히 다른 화면을 return(=마운트/언마운트)하던 구조를 걷어냈다 — home 안의
  // VWorldMap이 phase 전환마다 unmount/remount되면서 브이월드 SDK의 map.start()가 두 번
  // 불려 내부 싱글턴이 깨지는 문제(2026-09-12 Playwright로 재현: "Error constructing
  // CesiumWidget" — TypeError: Cannot read properties of undefined (reading 'camera'/'scene'))
  // 때문이다. home을 항상 마운트해 두고 다른 phase는 그 위에 절대위치로 겹쳐 그린다
  // (useEnterTransition은 마운트 여부와 무관하게 key 변경만으로도 재생되도록 이미 설계돼
  // 있어 애니메이션은 그대로 유지된다 — lib/useEnterTransition.ts 참고).
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className={`absolute inset-0 ${phase === 'home' ? '' : 'invisible pointer-events-none'}`}>
        <div
          className={`relative flex h-full flex-col bg-cover bg-center ${enterClass}`}
          style={{ backgroundImage: `url(${bubblePhoneBackground})` }}
        >
          <div className="h-[30px] shrink-0" />

      <div className="flex h-[45px] shrink-0 items-center justify-between px-[21px]">
        <BrandLogo size={17} orientation="horizontal" />
        <span className="flex items-center gap-[3px] text-m-micro font-bold text-status-done">● 연결됨</span>
      </div>
      <div className="flex items-center justify-between px-[21px] pb-[9px]">
        <span className="text-m-label font-extrabold text-ink-900">상암월드컵경기장</span>
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
            // 내 위치(데모 지점) 근처 낮은 시점으로 진입 — 좌석 사이로 3D 모형의 입체감이
            // 드러나는 구도(2026-09-12 Playwright로 후보 값 비교해 확정 — 사용자 요청 참고
            // 이미지와 대조). 관리자 대시보드의 전체 조망과 달리 스태프는 "내 위치" 중심.
            initialView={{
              pitchDegrees: -15,
              range: 60,
              target: { lat: mapData.demoPoint.lat, lng: mapData.demoPoint.lng, heightMeters: 12 },
            }}
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

      <div className="flex shrink-0 flex-col gap-[9px] px-[21px] pb-[21px]">
        <span className="text-m-caption font-bold text-ink-600">최근 내 신고</span>
        {recent ? (
          <div className="flex flex-col gap-[3px] rounded-[17px] border border-line bg-white p-[14px] shadow-card">
            <div className="flex justify-between">
              <span className="text-m-caption font-bold text-ink-900">{recent.title}</span>
              <span className="text-m-micro text-ink-300">
                {new Date(recent.createdAt).getHours().toString().padStart(2, '0')}:
                {new Date(recent.createdAt).getMinutes().toString().padStart(2, '0')}
              </span>
            </div>
            <span className={`text-m-micro font-semibold ${STATUS_TEXT[recent.status]}`}>
              ● {REPORT_STATUS_DISPLAY[recent.status].label}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-[17px] border border-line bg-white p-[14px] text-m-micro font-semibold text-ink-300">
            아직 신고한 내역이 없습니다
          </div>
        )}
      </div>

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
      </div>

      {phase === 'recording' && (
        <VoiceRecordScreen
          onFinish={(audio) => void analyzeVoiceThenConfirm(audio)}
          onSwitchToText={() => setPhase('text')}
          className={`absolute inset-0 ${enterClass}`}
        />
      )}

      {phase === 'analyzing' && (
        <div className={`absolute inset-0 flex h-full flex-col items-center justify-center gap-[15px] bg-white ${enterClass}`}>
          <div className="flex items-center gap-[6px]">
            <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary" style={{ animation: 'loadingDot 1.2s ease-in-out infinite' }} />
            <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary" style={{ animation: 'loadingDot 1.2s ease-in-out .2s infinite' }} />
            <i className="inline-block h-[8px] w-[8px] rounded-full bg-primary" style={{ animation: 'loadingDot 1.2s ease-in-out .4s infinite' }} />
          </div>
          <span className="text-m-caption font-semibold text-ink-600">AI가 분석하고 있습니다</span>
        </div>
      )}

      {phase === 'confirm' && draft && (
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
          className={`absolute inset-0 ${enterClass}`}
        />
      )}

      {phase === 'text' && (
        <TextReportScreen
          onBack={() => setPhase('home')}
          onSubmit={(message) => void analyzeThenConfirm(message)}
          className={`absolute inset-0 ${enterClass}`}
        />
      )}

      {phase === 'history' && (
        <ReportHistoryScreen
          reports={reports}
          onBack={() => setPhase('home')}
          className={`absolute inset-0 ${enterClass}`}
        />
      )}
    </div>
  )
}
