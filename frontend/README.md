# 프론트엔드

ONCUE의 시연·관리자·스태프 화면을 구현한 프론트엔드입니다. 해커톤 종료 시점의 실행 안내를 보존합니다.
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
npm ci
cp .env.example .env
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

`frontend/.env`에 다음 값을 설정하고 개발 서버를 시작합니다.

| 변수 | 용도 | 설정 |
|---|---|---|
| `VITE_API_BASE_URL` | 백엔드 API 주소 | 기본값 `http://127.0.0.1:8000/api/v1` |
| `VITE_VWORLD_API_KEY` | VWorld 3D 지도 SDK | 지도 사용 시 발급받은 키 설정 |

지도 키는 `index.html`에서 사용합니다. 환경 변수를 바꾸면 개발 서버를 다시 시작하세요.
백엔드 실행·DB 준비는 [백엔드 안내](../backend/README.md)를 참고하세요. 데모 행사 코드는 `DEMO26`이며, 백엔드 CORS 설정에 프론트 주소가 포함되어야 합니다.

## 화면 구성

| 경로 | 화면 |
|---|---|
| `/` | 관리자·스태프 화면을 함께 보여주는 시연 화면 |
| `/admin` | 관리자 로그인·관제·신고 처리·개인 리포트 |
| `/staff` | 스태프 로그인·음성/텍스트 신고·내 신고 조회 |
| 그 외 | Not Found |

역할별 레이아웃에서 세션 유무에 따라 로그인 화면과 업무 화면을 표시합니다.
API 호출 모듈은 `src/api/`, 라우팅은 `src/app/router.tsx`, 화면은 `src/routes/`에 있습니다.

## 종료 시점의 검증 기록

[PR #75](https://github.com/sku-hackathon-team08/team08/pull/75)에서 빌드, 실제 백엔드 로그인, 관리자 신고 목록·지도와 스태프 신고 화면 진입을 확인했습니다.
신고 제출부터 분석·접수·관리자 처리까지의 전체 브라우저 흐름, 실제 기기와 통신 복구는 미검증으로 남겼으며 추가 개발 계획은 없습니다.

전체 구현 범위와 기록은 [문서 지도](../docs/index.md), 수상 결과와 발표 자료는 [프로젝트 README](../README.md)에 있습니다.
