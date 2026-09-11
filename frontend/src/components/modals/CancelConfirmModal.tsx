import { useState } from 'react'
import { Modal } from '../Modal'
import { buttonClasses } from '../buttonStyles'

/**
 * 10 접수 취소 모달 — dc.html 실측: overlay 45%, 패널 760×gap23.
 * 취소 사유는 필수 — 사용자 결정: 프리셋 칩 없이 직접 입력만 둔다(2026-09-11 확정).
 * COMPONENTS.md Modal props의 reasonRequired: 사유 없으면 확정 버튼을 비활성화한다.
 */
type CancelConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function CancelConfirmModal({ open, onClose, onConfirm }: CancelConfirmModalProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    <Modal open={open} onClose={onClose} overlayOpacity={0.45} width={760} gap={23}>
      <span className="text-t-h2 font-extrabold text-ink-900">접수를 취소하시겠습니까?</span>
      <span className="text-t-body text-ink-600">관리자 누구나 취소할 수 있습니다. 취소된 신고는 이력에 남습니다.</span>
      <div className="flex flex-col gap-[8px]">
        <span className="text-t-title font-bold text-ink-900">취소 사유 (필수)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="취소 사유를 입력해주세요"
          className="h-[106px] resize-none rounded-[15px] border-[3px] border-status-urgent p-[15px] text-t-body text-ink-900 placeholder:text-ink-300"
        />
      </div>
      <div className="flex gap-[15px]">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true })}>
          돌아가기
        </button>
        <button
          type="button"
          disabled={!trimmed}
          onClick={() => {
            onConfirm(trimmed)
            setReason('')
          }}
          className={buttonClasses({ variant: 'destructive', size: 'md', fullWidth: true, disabled: !trimmed })}
        >
          취소하기
        </button>
      </div>
    </Modal>
  )
}
