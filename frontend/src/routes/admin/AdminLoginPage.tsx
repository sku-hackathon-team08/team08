import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import bubblesBackground from '../../assets/bubbles-admin.png'
import { BrandLogo } from '../../components/BrandLogo'
import { buttonClasses } from '../../components/buttonStyles'
import { getSession, setSession } from '../../lib/session'

/**
 * 00(스플래시) → 00-1(로딩) → 01(로그인) — 관리자 화면 플로우(최종!).dc.html.
 * 셋을 별도 라우트로 안 쪼개고 이 페이지 안에서 단계(phase)로 처리한다 — 스플래시·로딩은
 * 사용자가 일부러 찾아오는 화면이 아니라 앱 실행 직후 잠깐 보이고 자동으로 다음 단계로
 * 넘어가는 전환 연출이라(dc.html 주석: "1~1.5초 노출 후 자동 전환"), 독립 라우트로 만들면
 * 오히려 실제 흐름과 안 맞는다.
 *
 * design-login 스킬 확인 사항:
 * - 실제 도메인 모델은 eventCode+role+name(+STAFF만 team) 단일 진입이지만, 이 화면은
 *   /admin 전용 로그인이라 role은 화면에 안 보이는 채로 "ADMIN" 고정값을 쓴다(스태프는
 *   S0에서 따로 진입). 비밀번호·회원가입·소셜 로그인 등은 SOT에 없어 넣지 않았다.
 * - 아직 백엔드 진입 API를 안 붙였다(다른 관리자 화면도 전부 목데이터라 이것만 먼저 붙이면
 *   일관성이 깨진다) — 그래서 지금은 필드 비어있지 않은지만 검증하고 lib/session.ts에
 *   role별 세션을 저장한 뒤 /admin으로 보낸다. 실제 Bearer 토큰 발급은 API 연동 때 교체.
 * - /admin 대시보드 자체에는 로그인 여부를 강제하는 가드를 걸지 않았다 — DevNavPanel로
 *   바로 /admin에 들어가서 화면을 확인하는 지금의 개발 흐름을 막고 싶지 않아서다.
 */

type Phase = 'splash' | 'loading' | 'form'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('splash')
  const [eventCode, setEventCode] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 1200)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== 'loading') return
    const t2 = setTimeout(() => {
      const existing = getSession('admin')
      if (existing) {
        navigate('/admin', { replace: true })
        return
      }
      setPhase('form')
    }, 700)
    return () => clearTimeout(t2)
  }, [phase, navigate])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eventCode.trim() || !name.trim()) return
    setSubmitting(true)
    setSession('admin', { eventCode: eventCode.trim(), name: name.trim(), role: 'ADMIN' })
    navigate('/admin', { replace: true })
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bubblesBackground})` }}
    >
      {phase === 'splash' && <BrandLogo size={64} />}

      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-[30px]">
          <BrandLogo size={55} />
          <div className="flex items-center gap-[11px]">
            <i className="inline-block h-[15px] w-[15px] rounded-full bg-primary" />
            <i className="inline-block h-[15px] w-[15px] rounded-full bg-primary/45" />
            <i className="inline-block h-[15px] w-[15px] rounded-full bg-primary/18" />
          </div>
          <span className="text-[21px] font-semibold text-ink-600">앱을 준비하고 있습니다</span>
          <div className="h-[8px] w-[380px] overflow-hidden rounded-pill bg-primary/14">
            <div className="h-full w-[62%] rounded-pill bg-primary" />
          </div>
        </div>
      )}

      {phase === 'form' && (
        <form onSubmit={handleSubmit} className="flex w-[532px] flex-col items-center gap-[27px]">
          <div className="flex flex-col items-center gap-[4px]">
            <BrandLogo size={49} wordmarkSize={46} tagline />
          </div>

          <div className="flex w-full flex-col gap-[19px]">
            <label className="flex flex-col gap-[9px]">
              <span className="text-t-title font-semibold text-ink-900">행사 코드</span>
              <input
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="예) SKF2026"
                className="h-[68px] rounded-[23px] border border-line bg-white/75 px-[23px] text-t-body text-ink-900 placeholder:text-ink-300"
              />
            </label>
            <label className="flex flex-col gap-[9px]">
              <span className="text-t-title font-semibold text-ink-900">관리자 이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 김민호"
                className="h-[68px] rounded-[23px] border border-line bg-white/75 px-[23px] text-t-body text-ink-900 placeholder:text-ink-300"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={buttonClasses({ variant: 'primary', size: 'lg', fullWidth: true, disabled: submitting })}
          >
            입장하기
          </button>
          <span className="text-[17px] font-medium text-ink-300">모든 관리자는 동일 권한을 갖는 간편 로그인입니다</span>
        </form>
      )}
    </main>
  )
}
