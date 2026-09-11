import { useState } from 'react'
import { buttonClasses } from '../buttonStyles'

/**
 * B(텍스트 전용 신고, 항상 노출) — 관리자 화면 플로우(최종!).dc.html.
 * "음성이 1순위, 텍스트가 2순위 대체 경로 · 텍스트 입력 경로 상시 노출" 원칙 그대로
 * S1의 ⌨ 아이콘과 S2의 "직접 입력하기"에서 둘 다 이 화면으로 들어온다.
 */
export function TextReportScreen({ onBack, onSubmit }: { onBack: () => void; onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState('')

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="h-[30px] shrink-0" />
      <div className="flex h-[42px] shrink-0 items-center gap-[9px] px-[18px]">
        <button type="button" onClick={onBack} className="text-[18px] text-ink-900">
          ‹
        </button>
        <span className="text-m-body font-bold text-ink-900">텍스트로 신고하기</span>
      </div>

      <div className="flex flex-1 flex-col gap-[12px] px-[18px] pb-[24px]">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="예) 메인무대 뒤쪽 통로로 사람이 너무 몰려 있습니다"
          className="min-h-[120px] resize-none rounded-[17px] border border-line bg-white p-[14px] text-m-body leading-relaxed text-ink-900 shadow-card placeholder:text-ink-300"
        />
        <span className="self-end text-m-micro text-ink-300">{message.length}/500</span>

        <button
          type="button"
          disabled={!message.trim()}
          onClick={() => onSubmit(message.trim())}
          className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true, disabled: !message.trim() })}
        >
          ➤ 텍스트로 전송
        </button>
      </div>
    </div>
  )
}
