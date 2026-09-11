/**
 * DeviceFrame 크기 상수 — components/DeviceFrame.tsx와 분리해서 별도 파일에 둔다.
 * (컴포넌트 파일이 컴포넌트 외 값도 export하면 Fast Refresh가 깨져서 oxlint가 경고한다.
 * buttonStyles.ts와 같은 이유.)
 */

/** iPad 프레임 외곽 크기(베젤 포함) — /demo에서 두 프레임 배율을 맞출 때 쓴다. */
export const IPAD_OUTER = { width: 1180 + 18 * 2, height: 820 + 18 * 2 }
/** iPhone 프레임 외곽 크기(베젤 포함) — /demo에서 두 프레임 배율을 맞출 때 쓴다. */
export const IPHONE_OUTER = { width: 390 + 10 * 2, height: 780 + 10 * 2 }
