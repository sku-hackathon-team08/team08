import { useEffect, useState, type FormEvent } from 'react'
import bubblePhoneBackground from '../../assets/bubble-phone.png'
import { BrandLogo } from '../../components/BrandLogo'
import { buttonClasses } from '../../components/buttonStyles'
import { getSession, setSession, clearSession } from '../../lib/session'
import { ApiError } from '../../api/client'
import { createStaffSession, getMySession } from '../../api/sessions'

/**
 * S-0(스플래시) → S-0-1(로딩) → S0(참가자코드 진입) — 관리자 화면 플로우(최종!).dc.html.
 * AdminLoginPage와 같은 방식: 셋을 별도 라우트로 안 쪼개고 phase로 처리한다(스플래시·로딩은
 * 앱 실행 직후 잠깐 보이는 자동 전환 연출이라 독립 라우트로 만들면 실제 흐름과 안 맞는다).
 *
 * dc.html 목업은 260×520(모바일 ×1.5)이라 태블릿(×1.9, 4px 그리드 스냅)과 달리 실측값에
 * 정확히 1.5를 곱한 값을 그대로 쓴다 — theme.css의 text-m-* 타이포 토큰도 이미 그렇게
 * 스냅된 값이라 최대한 그 토큰을 쓰고, 토큰 사다리에 없는 값만 개별 px로 둔다.
 *
 * - 세션은 eventCode+name+team+role:'STAFF' — docs/api/hackathon.md POST /sessions 바디
 *   {eventCode,role,name,team?}와 필드명을 맞췄다. 백엔드 SessionInput.validate_team이
 *   "스태프는 소속 팀이 필요합니다"를 강제하므로(2026-09-12 코드 감사 확인) 소속팀은
 *   화면상 선택처럼 보여도 실제로는 필수로 검증한다.
 * - dc.html은 S-0 스플래시에 oncue-logo-trimmed.png를 쓰라고 돼 있지만, 실제로 받아보니
 *   그 파일이 최신 브랜드(대문자 ONCUE·한글 태그라인)가 아니라 예전 버전(소문자 oncue,
 *   "On-Site, On Cue")이었다 — 그래서 AdminLoginPage의 00 스플래시와 똑같이 CSS
 *   BrandLogo(원 2개)를 쓴다. 화면 그려보고 나서 발견한 것이라 반드시 남겨둔다.
 * - AdminLayout과 동일하게 onAuthenticated 콜백으로만 알리고, 화면 전환은 StaffLayout이 한다.
 * - 로딩 단계에서 로컬 세션이 있어도 GET /sessions/me로 실제 유효성을 재확인한다(AdminLoginPage와 동일).
 */

type Phase = 'splash' | 'loading' | 'form'

export function StaffLoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [phase, setPhase] = useState<Phase>('splash')
  const [eventCode, setEventCode] = useState('')
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 1200)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== 'loading') return
    let cancelled = false
    const t2 = setTimeout(() => {
      void (async () => {
        if (getSession('staff')) {
          try {
            await getMySession('staff')
            if (!cancelled) onAuthenticated()
            return
          } catch {
            clearSession('staff')
          }
        }
        if (!cancelled) setPhase('form')
      })()
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(t2)
    }
  }, [phase, onAuthenticated])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eventCode.trim() || !name.trim() || !team.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const session = await createStaffSession({ eventCode: eventCode.trim(), name: name.trim(), team: team.trim() })
      setSession('staff', session)
      onAuthenticated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setSubmitting(false)
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bubblePhoneBackground})` }}
    >
      {phase === 'splash' && <BrandLogo size={48} />}

      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-[21px]">
          <BrandLogo size={33} />
          <div className="flex items-center gap-[8px]">
            <i className="inline-block h-[11px] w-[11px] rounded-full bg-primary" />
            <i className="inline-block h-[11px] w-[11px] rounded-full bg-primary/45" />
            <i className="inline-block h-[11px] w-[11px] rounded-full bg-primary/18" />
          </div>
          <span className="text-m-body font-semibold text-ink-600">앱을 준비하고 있습니다</span>
          <div className="h-[6px] w-[225px] overflow-hidden rounded-pill bg-primary/14">
            <div className="h-full w-[48%] rounded-pill bg-primary" />
          </div>
        </div>
      )}

      {phase === 'form' && (
        <form onSubmit={handleSubmit} className="flex w-full max-w-[330px] flex-col gap-[18px] px-[30px]">
          <div className="flex flex-col gap-[6px]">
            <BrandLogo size={20} orientation="horizontal" />
            <span className="text-m-title font-bold text-ink-900">현장에 참가하기</span>
          </div>

          <label className="flex flex-col gap-[6px]">
            <span className="text-m-caption font-semibold text-ink-600">행사 코드</span>
            <input
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
              placeholder="예) SKF2026"
              className="h-[51px] rounded-[15px] border border-line bg-white/75 px-[15px] text-m-body text-ink-900 placeholder:text-ink-300"
            />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-m-caption font-semibold text-ink-600">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 김민호"
              className="h-[51px] rounded-[15px] border border-line bg-white/75 px-[15px] text-m-body text-ink-900 placeholder:text-ink-300"
            />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-m-caption font-semibold text-ink-600">소속팀</span>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="예) 안전관리 B팀"
              className="h-[51px] rounded-[15px] border border-line bg-white/75 px-[15px] text-m-body text-ink-900 placeholder:text-ink-300"
            />
          </label>

          {error && <span className="text-m-caption font-semibold text-status-urgent">{error}</span>}

          <button
            type="submit"
            disabled={submitting}
            className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true, disabled: submitting })}
          >
            {submitting ? '입장하는 중…' : '현장 들어가기 →'}
          </button>
        </form>
      )}
    </main>
  )
}
