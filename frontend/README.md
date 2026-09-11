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
포트가 사용 중이면 Vite가 다음 포트를 자동으로 선택합니다.

## 검사

```bash
npm run build          # 타입 검사(tsc -b) 후 프로덕션 빌드
npx tsc -b --noEmit    # 타입 검사만 수행
npm run lint           # oxlint
```

루트 `tsconfig.json`은 참조만 두는 솔루션 구성이므로 `-b` 없이 `tsc --noEmit`을 실행하면
검사 대상이 없어 항상 통과합니다. 타입 검사는 `-b`를 붙여 실행합니다.

## 환경 변수

현재 사용하는 환경 변수는 없습니다. 백엔드 연결 주소가 정해지면
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
## 콘서트 지도 미리보기

백엔드를 `127.0.0.1:8001`에서 실행한 뒤 `npm run dev -- --host 127.0.0.1`로
프론트를 실행하고 `/map-preview`를 엽니다. Vite가 `/api`를 백엔드로 프록시합니다.
Cesium과 OpenStreetMap 배경을 사용하는 평면 지형 미리보기이며 브이월드 지형·영상 통합은 아닙니다.
구역 선택·카메라 전환·경계 표시·모델 다시 불러오기를 지원합니다. `무대 하부`는 가림막을 숨기고 낮은 시점으로 이동하며, `무대 가림막 표시`로 외관을 복원합니다.
개발 서버는 `backend/demo/assets` 변경을 감지해 화면을 자동 갱신합니다.
모델 제작·좌표 기준은 [데모 지도 문서](../docs/integrations/vworld-demo.md)를 참고합니다.

## 브이월드 3D 미리보기

`frontend/.env.local`에 `VITE_VWORLD_API_KEY`를 설정하면 `/map-preview`에서 브이월드 공식 3D SDK를 사용합니다. 브라우저용 키는 발급 시 허용 도메인 설정이 필요하며 `.env.local`은 Git에서 제외합니다. 항공영상은 브이월드 Satellite WMTS, 지형은 SDK의 DEM 공급자, 건물은 브이월드 3D Tiles를 사용합니다. SDK 전용 문서 `/vworld.html`을 iframe으로 분리해 다른 Cesium 런타임과 충돌을 피합니다. 키 변경 후 Vite를 재시작합니다.
