import { apiRequestWithLocation, apiRequest } from './client'
import type { AnalysisCreated, AnalysisView } from './types'

/** POST /report-analyses (TEXT) — 관리자·스태프 둘 다 쓸 수 있다(음성은 스태프 전용). */
export async function createTextAnalysis(role: 'admin' | 'staff', text: string): Promise<string> {
  const { locationId } = await apiRequestWithLocation<AnalysisCreated>('/report-analyses', {
    method: 'POST',
    role,
    idempotent: true,
    json: { inputMethod: 'TEXT', text },
  })
  if (!locationId) throw new Error('분석 생성 응답에 Location 헤더가 없습니다.')
  return locationId
}

/** POST /report-analyses (VOICE, multipart) — 스태프 전용. audio는 webm 등 허용 MIME 중 하나. */
export async function createVoiceAnalysis(audio: Blob): Promise<string> {
  const form = new FormData()
  form.append('inputMethod', 'VOICE')
  form.append('audio', audio, 'recording.webm')
  const { locationId } = await apiRequestWithLocation<AnalysisCreated>('/report-analyses', {
    method: 'POST',
    role: 'staff',
    idempotent: true,
    formData: form,
  })
  if (!locationId) throw new Error('분석 생성 응답에 Location 헤더가 없습니다.')
  return locationId
}

export function getAnalysis(role: 'admin' | 'staff', analysisId: string): Promise<AnalysisView> {
  return apiRequest(`/report-analyses/${analysisId}`, { role })
}

/**
 * PENDING/PROCESSING 동안 짧은 간격으로 폴링해서 READY/FAILED가 될 때까지 기다린다.
 * dc.html에 이 대기 화면 자체의 디자인은 없어서(구간 자체는 실존, 표현만 미정) 간격·
 * 타임아웃 값은 후속 조정 여지를 남긴다.
 */
export async function pollAnalysis(
  role: 'admin' | 'staff',
  analysisId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AnalysisView> {
  const intervalMs = options.intervalMs ?? 800
  const timeoutMs = options.timeoutMs ?? 30_000
  const startedAt = Date.now()
  for (;;) {
    const view = await getAnalysis(role, analysisId)
    if (view.status === 'READY' || view.status === 'FAILED') return view
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('분석이 시간 내에 끝나지 않았습니다.')
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
