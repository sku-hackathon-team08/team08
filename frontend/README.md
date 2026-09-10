# 프론트엔드

프론트엔드 코드가 위치할 폴더입니다.
Vite · React 19 · TypeScript · Tailwind CSS v4로 구성하며, 라우팅은 react-router-dom,
서버 상태는 @tanstack/react-query를 사용합니다.
선택 근거는 [결정 기록](../docs/decisions.md)의 D-026~D-029, 스택 현황은 [아키텍처](../docs/architecture.md#프론트-환경)에 있습니다.

## 실행 환경

| 항목 | 검증 버전 |
|---|---|
| Node.js | 24.14.1 |
| npm | 11.11.0 |

정확한 의존성 버전은 [`package.json`](package.json)과 [`package-lock.json`](package-lock.json)에서 관리합니다.

## 설치

```bash
cd frontend
npm install
```

## 실행

```bash
npm run dev
```

개발 서버는 기본적으로 <http://localhost:5173> 에서 열립니다.
포트는 5173으로 고정하며, 사용 중이면 개발 서버가 실패합니다.

## 검사

```bash
npm run build          # 타입 검사(tsc -b) 후 프로덕션 빌드
npx tsc -b --noEmit    # 타입 검사만 수행
npm run lint           # oxlint
```

루트 `tsconfig.json`은 참조만 두는 솔루션 구성이므로 `-b` 없이 `tsc --noEmit`을 실행하면
검사 대상이 없어 항상 통과합니다. 타입 검사는 `-b`를 붙여 실행합니다.

## 환경 변수

일반 앱은 아직 환경 변수를 사용하지 않습니다. 로컬 지도 검증 화면은 루트 `.env`의 `VWORLD_API_KEY`를 사용합니다. 백엔드 연결 주소가 정해지면
`.env.example`에 키 이름과 공개 가능한 예시 값을 추가합니다.
연결 주소·CORS는 [프론트·백엔드 계약 검토](../docs/api/integration-contracts.md)에서 관리합니다.

## 현재 구성

`src/`는 다음과 같이 나뉩니다.

- `app/router.tsx` — `createBrowserRouter` 라우트 정의
- `app/providers.tsx` — 전역 Provider 조립(`AppProviders`, 현재 `QueryClientProvider`)
- `routes/` — 화면 컴포넌트. 공통 진입(`LandingPage`), 역할별 레이아웃·임시 페이지(`admin/`, `staff/`), `NotFoundPage`
- `App.tsx` — `RouterProvider`만 렌더 · `main.tsx` — `AppProviders`로 감싼 진입점

라우트:

| 경로 | 화면 |
|---|---|
| `/` | 공통 진입 화면(관리자·스태프 링크) |
| `/admin` | 관리자 임시 화면 |
| `/staff` | 스태프 임시 화면 |
| 그 외 | Not Found |

관리자·스태프는 경로(역할) 기준으로만 나뉘며 기기 감지나 인증은 아직 없습니다.
실제 화면·인증·API 연동과 파일명·타입·오류 처리 세부 컨벤션은 후속 작업입니다.

작업 전 [문서 지도](../docs/index.md)에서 관련 기능·기술 명세를 확인합니다.
프로젝트 소개는 [루트 README](../README.md)에 있습니다.

## 서울 콘서트 데모 작업 기준

백엔드를 `uv run --directory backend uvicorn app.main:app --host 127.0.0.1 --port 8001`로 실행한 뒤
프론트 서버의 `/demo-map.html`에서 확인합니다. `/api`는 8001 포트로 프록시합니다. 프로젝트 루트 `.env`의 `VWORLD_API_KEY`를 사용합니다.
실행 범위·데이터·검증 기준은 [브이월드 로컬 검증](../docs/integrations/vworld-demo.md)을 참고합니다.

콘서트 모델과 구역 좌표는 백엔드 소유입니다. `backend/demo/concert-layout.json`을 수정한 뒤
저장소 루트에서 `uv run --directory backend python scripts/build-concert.py`를 실행합니다. 로컬 `/demo-map.html`에서
구역 선택, 좌표 확인 및 JSON·GeoJSON·CSV·GLB 다운로드를 제공합니다.
배치와 검증 범위는 [브이월드 데모 문서](../docs/integrations/vworld-demo.md)를 참고하세요.

현재 배치와 첫 시연 지점(경도 126.8970733, 위도 37.5683536)을 후속 데모 작업 기준으로 채택했습니다.
높이는 렌더러에서 계산하며 [기준 문서](../docs/integrations/vworld-demo.md#높이-적용)를 따릅니다.
