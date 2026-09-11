/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 백엔드 API base URL. 없으면 api/client.ts가 로컬 기본값(127.0.0.1:8000)을 쓴다. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
