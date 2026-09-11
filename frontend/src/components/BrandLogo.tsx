/**
 * ONCUE BrandLogo — design_handoff_oncue/COMPONENTS.md #10, BRAND.md 규칙.
 * 마크(원 2개, 비율 26:20) + 워드마크(ONCUE, w900, letter-spacing -2%) [+ 태그라인].
 *
 * COMPONENTS.md는 이 컴포넌트의 고정 px 표를 주지 않는다(다른 화면마다 다른 크기로 씀 —
 * 관리자 화면 플로우(최종!).dc.html의 L1 랜딩(마크 22px)과 헤더 로고락업(마크 ~11px)이
 * 서로 다른 크기지만 같은 비율이라, size 하나로 전체를 비례 확대/축소한다).
 * 비율은 L1 원본 인라인 스타일 실측값 그대로: 마크 박스 34:26, 큰 원:작은 원 22:17,
 * 워드마크:큰 원 30:22, 태그라인:큰 원 10:22.
 */

type BrandLogoProps = {
  /** 큰 원(주 마크)의 지름(px). 마크·태그라인은 전부 이 값에 비례한다 */
  size?: number
  orientation?: 'vertical' | 'horizontal'
  tagline?: boolean
  /**
   * 워드마크 폰트 크기 직접 지정(px). 생략하면 size 비례값(×30/22)을 쓴다.
   * 실제 dc.html에서도 헤더 로고락업처럼 좁은 자리에서는 워드마크가 마크 크기와
   * 무관하게 별도로 작은 고정값(mockup 14px)을 쓰므로, 그런 맥락에서는 이 prop으로 덮어쓴다.
   */
  wordmarkSize?: number
  className?: string
}

export function BrandLogo({
  size = 24,
  orientation = 'vertical',
  tagline = false,
  wordmarkSize: wordmarkSizeProp,
  className = '',
}: BrandLogoProps) {
  const big = size
  const small = size * (17 / 22)
  const markWidth = size * (34 / 22)
  const markHeight = size * (26 / 22)
  const bigLeftOffset = size * (1 / 22)
  const wordmarkSize = wordmarkSizeProp ?? size * (30 / 22)
  const taglineSize = size * (10 / 22)

  return (
    <div
      className={[
        'flex items-center',
        orientation === 'vertical' ? 'flex-col gap-0.5' : 'flex-row gap-2',
        className,
      ].join(' ')}
    >
      <div className="relative shrink-0" style={{ width: markWidth, height: markHeight }}>
        <i
          className="absolute right-0 top-0 rounded-full bg-primary-sub"
          style={{ width: small, height: small }}
        />
        <i
          className="absolute bottom-0 rounded-full bg-primary"
          style={{ width: big, height: big, left: bigLeftOffset }}
        />
      </div>
      <div className={orientation === 'vertical' ? 'flex flex-col items-center' : 'flex flex-col'}>
        <span
          className="font-black text-ink-900 leading-none tracking-[-0.02em]"
          style={{ fontSize: wordmarkSize }}
        >
          ONCUE
        </span>
        {tagline && (
          <span
            className="font-semibold text-ink-500"
            style={{ fontSize: taglineSize }}
          >
            현장의 신호를, 필요한 대상으로
          </span>
        )}
      </div>
    </div>
  )
}
