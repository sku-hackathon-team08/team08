import { Modal } from '../Modal'
import { buttonClasses } from '../buttonStyles'

/**
 * 02-1 신고 삭제 확인 — dc.html 실측: overlay 35%, 패널 646(=COMPONENTS.md warning 폭과 일치),
 * 경고 아이콘 76px 원(status-urgent 10% 배경) — 09/10과 달리 이 모달은 COMPONENTS.md의
 * warning 타입 스펙과 정확히 맞아떨어진다.
 * 정책: 삭제해도 이력에는 남고 목록·지도에서만 제거된다(취소와 다른 동작 — 문구 혼용 금지).
 */
type DeleteConfirmModalProps = {
  open: boolean
  onClose: () => void
  reportTitle: string
  onConfirm: () => void
}

export function DeleteConfirmModal({ open, onClose, reportTitle, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} overlayOpacity={0.35} width={646} gap={23}>
      <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-status-urgent/10 text-[34px] text-status-urgent">
        !
      </div>
      <span className="text-t-h2 font-extrabold text-ink-900">정말 삭제하시겠습니까?</span>
      <span className="text-t-body leading-[1.5] text-ink-600">
        &ldquo;{reportTitle}&rdquo;를 목록에서 삭제합니다. 삭제된 신고는 지도·목록에는 더 이상 표시되지
        않지만, 이력에는 남아 나중에 확인할 수 있습니다.
      </span>
      <div className="flex gap-[15px]">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true })}>
          돌아가기
        </button>
        <button type="button" onClick={onConfirm} className={buttonClasses({ variant: 'destructive', size: 'md', fullWidth: true })}>
          삭제하기
        </button>
      </div>
    </Modal>
  )
}
