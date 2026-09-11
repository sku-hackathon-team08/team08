import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles'

/**
 * ONCUE Button — design_handoff_oncue/COMPONENTS.md #1 스펙.
 * 정본: 관리자 화면 플로우(최종!).dc.html. 실제 px는 COMPONENTS.md의 변환값(스크린별
 * 목업 수치의 개별 변환이 아니라 버튼 컴포넌트 하나로 통일한 표)을 그대로 쓴다.
 *
 * 규칙 — 텍스트 항상 weight 700, radius는 언제나 pill. primary·utility만 shadow-cta.
 *
 * `<button>`으로만 렌더링한다. 네비게이션 CTA처럼 `<a>`/`<Link>`로 그려야 하면
 * `buttonStyles.ts`의 `buttonClasses()`를 그 엘리먼트의 className으로 직접 쓴다
 * (버튼 안에 링크를 중첩하는 잘못된 마크업을 피하기 위함).
 */

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  iconLeading?: ReactNode
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  iconLeading,
  disabled = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, disabled, className })}
      {...rest}
    >
      {loading ? (
        <span aria-hidden className="tracking-widest">
          ···
        </span>
      ) : (
        <>
          {iconLeading}
          {children}
        </>
      )}
    </button>
  )
}
