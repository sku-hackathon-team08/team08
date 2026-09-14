import { useEffect, useRef, useState } from 'react'

/**
 * S2(신고 작성, 터치 시작·음성 1순위) — 관리자 화면 플로우(최종!).dc.html.
 * 목업 260×520 값에 ×1.5(SCALE.mobile) 그대로 적용.
 *
 * 마운트 시 getUserMedia로 마이크 권한을 받고 MediaRecorder로 바로 녹음을 시작한다. 탭하면
 * 녹음을 멈추고 onFinish(audio)로 Blob을 넘긴다. 백엔드 AUDIO_MIMES
 * (backend/app/api/routes/analyses.py)는 코덱 파라미터 없는 MIME만 허용해서, 실제로 잡힌
 * MediaRecorder.mimeType에서 세미콜론 뒷부분(;codecs=...)을 떼고 그 타입으로 Blob을 만든다.
 * 권한 거부 등으로 녹음을 못 시작하면 안내 문구만 바꾸고, 항상 떠 있는 "직접 입력하기"로
 * 전환하게 한다.
 *
 * dc.html에도 취소/뒤로가기 버튼이 없다 — "터치로 종료"만 있고 결과 확인(S3)에서 뒤로
 * 가거나 다시 말하기로 되돌리는 구조라 여기 임의로 back 버튼을 추가하지 않았다.
 */
const PREFERRED_MIME_TYPES = ['audio/webm', 'audio/mp4']

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function VoiceRecordScreen({
  onFinish,
  onSwitchToText,
  className = '',
}: {
  onFinish: (audio: Blob) => void
  onSwitchToText: () => void
  className?: string
}) {
  const [seconds, setSeconds] = useState(0)
  const [micError, setMicError] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | undefined

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        const chunks: Blob[] = []
        const recorder = new MediaRecorder(mediaStream, {
          mimeType: pickSupportedMimeType(),
        })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onstop = () => {
          const type = recorder.mimeType.split(';', 1)[0].trim().toLowerCase()
          mediaStream.getTracks().forEach((track) => track.stop())
          onFinishRef.current(new Blob(chunks, { type }))
        }
        recorder.start()
        recorderRef.current = recorder
        timer = setInterval(() => setSeconds((s) => s + 1), 1000)
      })
      .catch(() => {
        if (!cancelled) setMicError(true)
      })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      } else {
        stream?.getTracks().forEach((track) => track.stop())
      }
      recorderRef.current = null
    }
  }, [])

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div
      className={`flex h-full flex-col ${className}`}
      style={{
        background:
          'radial-gradient(120% 85% at 50% 38%, rgb(30,44,96) 0%, rgb(17,22,48) 48%, rgb(11,13,28) 100%)',
      }}
    >
      <div className="h-[30px] shrink-0" />
      <div className="flex h-[39px] shrink-0 items-center justify-between px-[24px]">
        <span className="text-m-micro font-bold text-white/55">듣는 중 · 터치로 종료</span>
        <span className="flex items-center gap-[6px] text-m-micro font-bold text-[rgb(138,166,255)]">
          <i
            className="inline-block h-[8px] w-[8px] rounded-full bg-[rgb(138,166,255)]"
            style={{ animation: 'pulseDot 1.4s ease-in-out infinite' }}
          />
          REC
        </span>
      </div>

      <button
        type="button"
        onClick={stopRecording}
        className="flex flex-1 flex-col items-center justify-center gap-[27px]"
      >
        <div className="relative flex h-[156px] w-[156px] shrink-0 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-primary/16"
            style={{ animation: 'ripple 2.4s ease-out infinite' }}
          />
          <span
            className="absolute inset-[18px] rounded-full bg-primary/22"
            style={{ animation: 'ripple 2.4s ease-out .8s infinite' }}
          />
          <span
            className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full shadow-[0_15px_39px_rgba(35,71,224,0.55)]"
            style={{ background: 'linear-gradient(155deg, rgb(72,120,255) 0%, rgb(29,58,196) 100%)' }}
          >
            <span className="relative inline-block h-[36px] w-[21px]">
              <i className="absolute left-[3px] top-0 block h-[24px] w-[15px] rounded-[8px] bg-white" />
              <i className="absolute bottom-0 left-0 block h-[12px] w-[21px] rounded-b-[12px] border-b-2 border-l-2 border-r-2 border-white" />
              <i className="absolute bottom-0 left-[9px] block h-[6px] w-[3px] bg-white" />
            </span>
          </span>
        </div>

        <div className="flex h-[51px] items-end gap-[5px]">
          {[10, 20, 30, 34, 26, 16, 22, 12, 24].map((h, i) => (
            <i
              key={i}
              className="block w-[5px] rounded-[3px] bg-[rgb(118,152,255)]"
              style={{ height: h * 1.5, animation: `eq 1.1s ease-in-out ${i * 0.12}s infinite` }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-[8px]">
          <span className="text-m-h1 font-bold text-white">
            {micError ? '마이크를 사용할 수 없습니다' : '듣고 있습니다'}
          </span>
          <span className="text-m-label font-bold tracking-[.06em] text-[rgb(138,166,255)] tabular-nums">
            {mm}:{ss}
          </span>
        </div>
        <span className="text-m-micro text-center text-white/38">
          {micError ? '아래 직접 입력하기로 전환해주세요' : '"이 구역에 사람 다쳤어요" 정도면 충분해요'}
        </span>
      </button>

      <div className="flex shrink-0 flex-col gap-[12px] px-[30px] pb-[24px]">
        <button
          type="button"
          onClick={onSwitchToText}
          className="flex h-[51px] items-center justify-center gap-[8px] rounded-pill border border-white/18 bg-white/10 text-m-caption font-semibold text-white"
        >
          ⌨ 직접 입력하기
        </button>
        <span className="text-center text-m-micro font-semibold text-white/40">
          ① 음성 우선 · 인식이 어려우면 텍스트로 전환하세요
        </span>
      </div>
    </div>
  )
}
