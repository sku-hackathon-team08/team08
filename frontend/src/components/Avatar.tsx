/**
 * ONCUE Avatar — design_handoff_oncue/COMPONENTS.md #10.
 * 42px(헤더) / 57px(나의 리포트), 원형, 이니셜 1글자, bg primary.
 *
 * 이니셜은 이름 첫 글자가 아니라 "성 1자 + 이름"에서 이름의 첫 글자를 쓴다 — dc.html
 * 전체에서 "김민호"의 이니셜이 예외 없이 "민"으로 나온다(헤더·나의 리포트 등 7곳 이상
 * 확인). "김"(성)을 쓰면 동성 사용자끼리 구분이 안 돼서 이렇게 정한 것으로 보인다.
 */

type AvatarProps = {
  name: string
  /** @default 'sm' — sm=42(헤더), lg=57(나의 리포트) */
  size?: 'sm' | 'lg'
  className?: string
}

const SIZE_PX: Record<NonNullable<AvatarProps['size']>, number> = { sm: 42, lg: 57 }

export function Avatar({ name, size = 'sm', className = '' }: AvatarProps) {
  const px = SIZE_PX[size]
  const trimmed = name.trim()
  const initial = (trimmed.length >= 2 ? trimmed.charAt(1) : trimmed.charAt(0)) || '?'
  return (
    <span
      className={['inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white', className].join(' ')}
      style={{ width: px, height: px, fontSize: px * 0.4 }}
    >
      {initial}
    </span>
  )
}
