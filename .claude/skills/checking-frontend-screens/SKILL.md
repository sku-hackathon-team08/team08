---
name: checking-frontend-screens
description: Use when you need to visually verify team08's frontend (Vite/React, frontend/) actually renders — after editing frontend/src, before claiming a UI change works, or when asked to run/start/check/screenshot/review the app's screens.
---

# Frontend 화면 검사

## 핵심
헤드리스 브라우저를 새로 받지 않고 **시스템에 이미 설치된 Microsoft Edge**를 Playwright(`channel: 'msedge'`)로 재사용해 `frontend/`(Vite) 개발 서버 화면을 스크린샷 + 콘솔 에러로 검사한다. Playwright 자체 Chromium 다운로드(수백MB)는 건너뛴다. 도구는 `.claude/tools/screencheck/`에 고정돼 있어 세션이 새로 열려도 그대로 재사용한다.

## 사전 조건
Windows에 Microsoft Edge가 설치돼 있어야 한다(`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` 등). 없다면 `shot.js`의 `channel: 'msedge'`를 `channel: 'chrome'`으로 바꾸거나 Playwright 브라우저를 직접 설치해야 한다(`npx playwright install chromium`, 수백MB 다운로드).

## 절차

1. **dev 서버 기동** (`frontend/`, 포트 5173). 이미 떠 있으면 건너뛴다.
   ```bash
   cd frontend
   npm install   # node_modules 없을 때만
   npm run dev > /path/to/log 2>&1
   ```
   `run_in_background: true`로 실행할 때 명령 끝에 **`&`를 추가로 붙이지 않는다** — 이중 백그라운드 처리되면 harness가 즉시 "완료"로 표시하지만 실제 프로세스는 고아로 계속 떠 있어 추적이 안 된다.
   기동 확인: `curl -sf http://localhost:5173/`. 종료할 땐 `netstat -ano | grep :5173`으로 PID를 찾아 kill.

2. **검사 도구 의존성 설치** (node_modules 없을 때만, ~5초):
   ```bash
   cd .claude/tools/screencheck
   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
   ```

3. **스크린샷 + 콘솔 에러 캡처**:
   ```bash
   node .claude/tools/screencheck/shot.js <URL> <저장할.png경로> [대기할 CSS 셀렉터]
   ```
   예: `node .claude/tools/screencheck/shot.js http://localhost:5173/admin out.png "#root"`
   출력의 `CONSOLE_ERRORS`가 빈 배열(`[]`)인지 확인한다.

4. **Read 도구로 PNG를 실제로 열어 눈으로 확인한다.** 파일이 생성됐다는 사실만으로 성공을 판단하지 않는다 — 빈 화면·에러 화면도 파일 자체는 만들어진다.

## 알려진 함정
- 절차 1의 이중 백그라운드 문제(위 참고).
- SPA 라우팅 화면은 `waitUntil: 'networkidle'`만으로 부족할 수 있어, 실제 콘텐츠가 뜬 뒤 나타나는 셀렉터(`#root` 등)를 `waitSelector`로 지정한다.
- 콘솔 에러 0건이 곧 정상 렌더링을 보장하지 않는다 — 반드시 스크린샷을 눈으로 본다.
- `channel: 'msedge'`는 Windows/Edge 전제다. macOS/Linux 실행 환경이면 `channel: 'chrome'` 등 그 환경에 이미 있는 브라우저로 바꾼다.

## 파일
- `.claude/tools/screencheck/shot.js` — 캡처 스크립트 본체
- `.claude/tools/screencheck/package.json` — playwright 의존성만 선언(앱 코드 아님)
- `node_modules/`, 캡처한 `*.png`는 `.gitignore` 처리됨 — 세션마다 절차 2로 재설치
