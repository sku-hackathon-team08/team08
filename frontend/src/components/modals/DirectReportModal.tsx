import { useState } from 'react'
import { Modal } from '../Modal'
import { buttonClasses } from '../buttonStyles'
import { SelectChip } from '../SelectChip'
import type { ReportType } from '../../types/report'

const TYPES: ReportType[] = ['EMERGENCY', 'LOST', 'FACILITY', 'CROWD', 'OTHER']

/**
 * 11 관리자 직접 신고 — dc.html 실측: overlay 35%, 패널 798×gap17×padding30.
 * 위치는 실제 지도 클릭 연동 전이라 고정 텍스트로 표시(지도 좌표 선택은 후속 작업).
 * 사진 첨부는 사용자 결정(2026-09-11): 버튼 UI는 그리되 업로드 기능은 구현하지 않는다 —
 * 그래서 예시 썸네일 2장을 정적으로만 보여주고 "+ 사진" 슬롯은 클릭해도 아무 일 없다.
 */
type DirectReportModalProps = {
  open: boolean
  onClose: () => void
  locationLabel: string
  onConfirm: (data: { type: ReportType; message: string }) => void
}

export function DirectReportModal({ open, onClose, locationLabel, onConfirm }: DirectReportModalProps) {
  const [type, setType] = useState<ReportType>('CROWD')
  const [message, setMessage] = useState('')

  return (
    <Modal open={open} onClose={onClose} overlayOpacity={0.35} width={798} gap={17} padding={30}>
      <span className="text-t-h2 font-extrabold text-ink-900">직접 신고 등록</span>

      <div className="flex flex-col gap-[8px]">
        <span className="text-t-title font-bold text-ink-900">위치</span>
        <div className="flex h-[61px] items-center rounded-[19px] border border-line px-[19px] text-t-body text-ink-600">
          📍 지도에서 선택됨 — {locationLabel}
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <span className="text-t-title font-bold text-ink-900">유형</span>
        <div className="flex flex-wrap gap-[9px]">
          {TYPES.map((t) => (
            <SelectChip key={t} type={t} selected={type === t} onSelect={() => setType(t)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <span className="text-t-title font-bold text-ink-900">신고 내용</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메인무대 뒤 트러스 옆에 인원이 몰리고 있습니다"
          className="h-[84px] resize-none rounded-[19px] border border-line p-[15px] text-t-body text-ink-900 placeholder:text-ink-300"
        />
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="flex items-baseline justify-between">
          <span className="text-t-title font-bold text-ink-900">
            사진 첨부 <span className="font-medium text-ink-400">(선택 · 최대 3장)</span>
          </span>
          <span className="text-[17px] font-medium text-ink-300">0/3</span>
        </div>
        <div className="flex gap-[11px]">
          <button
            type="button"
            title="사진 첨부는 아직 구현하지 않았습니다"
            className="flex h-[84px] w-[84px] shrink-0 flex-col items-center justify-center gap-[2px] rounded-[17px] border border-dashed border-line bg-surface-soft"
          >
            <span className="text-[25px] leading-none text-ink-400">+</span>
            <span className="text-t-caption font-semibold text-ink-400">사진</span>
          </button>
        </div>
        <span className="text-[15px] font-medium text-ink-400">현장 촬영 또는 사진앨범 · 장당 10MB 이하</span>
      </div>

      <div className="flex gap-[15px]">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true })}>
          취소
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm({ type, message: message.trim() })
            setMessage('')
          }}
          className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true })}
        >
          등록
        </button>
      </div>
    </Modal>
  )
}
