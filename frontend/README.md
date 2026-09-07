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

라우터·QueryClientProvider·Tailwind 배선과 최소 화면 두 개(`/`, `/example`)만 있습니다.
`src/` 하위 폴더 구조와 파일명 컨벤션은 후속 작업입니다.

작업 전 [문서 지도](../docs/index.md)에서 관련 기능·기술 명세를 확인합니다.
프로젝트 소개는 [루트 README](../README.md)에 있습니다.