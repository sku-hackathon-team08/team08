import { useEffect, useState } from 'react'

/**
 * S2(신고 작성, 터치 시작·음성 1순위) — 관리자 화면 플로우(최종!).dc.html.
 * 목업 260×520 값에 ×1.5(SCALE.mobile) 그대로 적용.
 *
 * 실제 마이크 캡처(getUserMedia/MediaRecorder)는 아직 안 붙였다 — 화면이 먼저다(관리자와
 * 같은 순서). 탭하면 타이머만 올라가다가 "종료" 탭 시 onFinish로 넘어간다. 실제 연동 때
 * 이 타이머 로직을 MediaRecorder 이벤트로 교체한다.
 *
 * dc.html에도 취소/뒤로가기 버튼이 없다 — "터치로 종료"만 있고 결과 확인(S3)에서 뒤로
 * 가거나 다시 말하기로 되돌리는 구조라 여기 임의로 back 버튼을 추가하지 않았다.
 */
export function VoiceRecordScreen({
  onFinish,
  onSwitchToText,
}: {
  onFinish: () => void
  onSwitchToText: () => void
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div
      className="flex h-full flex-col"
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
        onClick={onFinish}
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
          <span className="text-m-h1 font-bold text-white">듣고 있습니다</span>
          <span className="text-m-label font-bold tracking-[.06em] text-[rgb(138,166,255)] tabular-nums">
            {mm}:{ss}
          </span>
        </div>
        <span className="text-m-micro text-center text-white/38">
          "이 구역에 사람 다쳤어요" 정도면 충분해요
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
