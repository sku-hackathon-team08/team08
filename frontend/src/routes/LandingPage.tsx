import { Link } from 'react-router-dom'
import bubblesBackground from '../assets/bubbles-admin.png'
import { BrandLogo } from '../components/BrandLogo'
import { buttonClasses } from '../components/buttonStyles'
import { DevNavPanel } from '../components/DevNavPanel'

/**
 * L1 랜딩 — 관리자 화면 플로우(최종!).dc.html 정본.
 * 목업(620×434, 태블릿 계열 ×1.9 스케일) 실측값을 그대로 환산해 옮겼다.
 * 배경은 dc.html과 동일하게 uploads/Bubbles.png를 background-size:cover로 사용한다.
 *
 * 미해결 사항(임의로 결정하지 않고 남겨둠):
 * - "로그인"은 /login(AdminLoginPage)으로 연결했지만 지금은 관리자(01) 화면만 있다.
 *   이 문구 자체는 "관리자·스태프 로그인"이라 스태프 몫도 같은 버튼에서 갈라져야 하는데,
 *   스태프 진입(S0)은 아직 안 만들어서 당장은 관리자로만 보낸다 — 스태프 앱 만들 때
 *   역할을 어떻게 나눌지(같은 화면에서 선택 vs 별도 경로) 다시 정한다.
 * - "행사 신청"은 /events/new 자리표시 그대로 둔다 — docs/features/event-entry.md 확정:
 *   "행사 신청·즉시 발급은 이번 범위에 넣지 않습니다"라 이번 해커톤에서 안 만든다.
 */
export function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col justify-between bg-cover bg-center pb-[42px] pt-[34px]"
      style={{ backgroundImage: `url(${bubblesBackground})` }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <BrandLogo size={42} tagline />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-[19px] px-[46px]">
        <p className="text-t-body text-center font-medium text-ink-500">
          관리자·스태프 로그인, 새 행사를 열려면 행사 신청을 선택하세요
        </p>
        <Link to="/login" className={buttonClasses({ size: 'lg', fullWidth: true })}>
          로그인
        </Link>
        <Link
          to="/events/new"
          className={buttonClasses({ variant: 'secondary', size: 'lg', fullWidth: true })}
        >
          행사 신청
        </Link>
      </div>

      <DevNavPanel />
    </main>
  )
}
