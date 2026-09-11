/**
 * Button 클래스 빌더 — components/Button.tsx와 분리해서 별도 파일에 둔다.
 * (컴포넌트 파일이 컴포넌트 외 값도 export하면 Fast Refresh가 깨져서 oxlint가 경고한다.)
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'destructive' | 'utility'
export type ButtonSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-[44px] px-5 text-[16px]',
  md: 'h-[56px] px-[34px] text-t-title',
  lg: 'h-[64px] px-[38px] text-[22px]',
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-cta hover:brightness-95 active:bg-primary-press',
  secondary:
    'bg-transparent text-primary border-2 border-primary hover:bg-primary/5 active:bg-primary/10',
  ghost: 'bg-surface-chip text-ink-900 hover:brightness-95 active:brightness-90',
  success: 'bg-status-done text-white hover:brightness-95 active:brightness-90',
  destructive: 'bg-status-urgent text-white hover:brightness-95 active:brightness-90',
  utility: 'bg-primary-deep text-white shadow-cta hover:brightness-95 active:brightness-90',
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  disabled?: boolean
  className?: string
}) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-pill font-bold transition-[filter]',
    disabled ? 'pointer-events-none cursor-not-allowed opacity-35' : '',
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    fullWidth ? 'w-full' : 'w-fit',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
