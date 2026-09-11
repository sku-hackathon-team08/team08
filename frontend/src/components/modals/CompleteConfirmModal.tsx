import { useState } from 'react'
import { Modal } from '../Modal'
import { buttonClasses } from '../buttonStyles'

/** 09 완료 확인 모달 — dc.html 실측: overlay 45%, 패널 760×gap23. */
type CompleteConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}

export function CompleteConfirmModal({ open, onClose, onConfirm }: CompleteConfirmModalProps) {
  const [note, setNote] = useState('')

  return (
    <Modal open={open} onClose={onClose} overlayOpacity={0.45} width={760} gap={23}>
      <span className="text-t-h2 font-extrabold text-ink-900">신고를 완료하시겠습니까?</span>
      <span className="text-t-body text-ink-600">이 신고의 처리가 완료되었으면 조용히 반영됩니다.</span>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="처리 메모 (선택) 예) 현장 확인 결과, 안내인원 추가 배치 완료"
        className="h-[106px] resize-none rounded-[19px] border border-line p-[15px] text-t-body text-ink-900 placeholder:text-ink-300"
      />
      <div className="flex gap-[15px]">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true })}>
          돌아가기
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(note.trim())
            setNote('')
          }}
          className={buttonClasses({ variant: 'success', size: 'md', fullWidth: true })}
        >
          완료
        </button>
      </div>
    </Modal>
  )
}
