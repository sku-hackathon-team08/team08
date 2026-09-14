import { useEffect, useId, useRef } from 'react'
import { resolveDemoAssetUrl, type DemoMapResponse } from '../api/demoMap'

/**
 * 실제 VWorld 3D 지도(WebGL, Cesium 기반) — docs/api/demo-map.md·
 * docs/integrations/vworld-demo.md 기준. 2026-09-12: VWorld API 키를 받아서 처음 연동.
 *
 * SDK는 npm 패키지가 아니라 <script src="https://map.vworld.kr/js/webglMapInit.js.do?...">로
 * 런타임에 로드되는 외부 전역이다(공식 예제: github.com/V-world/V-world_API_sample). 정확한
 * 사용법은 그 저장소의 실제 예제 파일([WebGL3] GeoJson 지면 위로.html 등)에서 그대로 확인:
 *   const map = new vw.Map(); map.setOption({...}); map.start();
 *   vw.ws3dInitCallBack = () => { const viewer = ws3d.viewer; ... }  // 3D 준비 완료 콜백
 * `ws3d.viewer`가 진짜 Cesium.Viewer라 이후로는 표준 Cesium API(entities.add, GeoJsonDataSource,
 * screenSpaceEventHandler 등)를 그대로 쓴다.
 *
 * 스코프(1차 버전 — 계속 다듬을 부분 있음):
 * - 구역: zones의 GeoJSON을 simplestyle 속성(fill/stroke)으로 색까지 그대로 얹어서 로드.
 * - 모델(GLB): heading 회전만 적용하고 높이는 Cesium의 HeightReference.CLAMP_TO_GROUND로
 *   맡긴다 — vworld-demo.md에 있는 "지형 15개 표본 평균 + 0.44m 오프셋" 정밀 계산은 아직
 *   그대로 옮기지 않았다(다음 다듬을 거리로 남김).
 * - 신고 핀: 실제 lat/lng에 CLAMP_TO_GROUND 포인트로 표시, 클릭하면 onSelectPin 콜백.
 */

export type VWorldMapPin = {
  id: string
  lat: number
  lng: number
  colorHex: string
}

type VWorldMapProps = {
  mapData: DemoMapResponse
  pins: VWorldMapPin[]
  selectedId?: string | null
  onSelectPin?: (id: string) => void
  className?: string
  /** 있으면 전체 개요 대신 이 좌표를 가깝게 확대해서 보여준다(신고 상세 화면용) — 없어지면
   *  다시 전체 개요로 돌아간다. 이 컴포넌트 인스턴스는 화면(대시보드/상세)에 따라 위치만
   *  옮겨가며 재사용되므로(MapCard.tsx 주석 참고) 마운트를 새로 하지 않고 이 prop 변화로
   *  카메라만 전환한다. */
  focus?: { lat: number; lng: number } | null
  /** 처음 진입할 때 전체 개요를 보여줄 각도·거리(+선택적으로 중심점) — 없으면 대시보드
   *  기본값(고각 조망, mapData.center 기준)을 쓴다. 스태프 홈처럼 3D 모형의 입체감이 드러나는
   *  낮은 시점으로, 특정 지점(예: 데모 지점) 근처에서 진입시키고 싶을 때 넘긴다. */
  initialView?: {
    pitchDegrees: number
    range: number
    target?: { lat: number; lng: number; heightMeters: number }
    /** 없으면 mapData.model.headingDegrees(모형 실제 회전각)를 그대로 쓴다. */
    headingDegrees?: number
  }
}

// pitch -48°·range 140m — 관리자 대시보드용 기본 개요. 사용자가 보내준 참고 이미지는 훨씬
// 낮은 각도(수평선·능선이 많이 보임)였는데, 실제로 pitch를 -48°보다 낮추면(-25°·-35°·-42°
// 다 확인) VWorld SDK가 안정화되지 않고 엉뚱한 위치(서울 시내 광역 라벨)로 리셋되거나 구역
// 색이 끝내 안 뜨는 버그가 재현됐다(2026-09-12, 각각 새로고침 후 14~20초 기다려도 동일) —
// 타이밍 문제가 아니라 이 각도 자체가 SDK에서 불안정한 것으로 보인다. 그래서 각도는
// 안정적으로 확인된 -48°를 유지하고, 대신 거리(range)만 175→140으로 좁혀 좌석 디테일이
// 조금 더 보이게 했다.
const DEFAULT_INITIAL_VIEW = { pitchDegrees: -48, range: 140, headingDegrees: 80 }

/**
 * VWorld SDK는 index.html에 정적 <script>로 이미 박혀 있다(동적 주입 금지 — 컴포넌트
 * 상단 설명 참고). 여기서는 그 스크립트의 실행이 끝나 window.vw가 생길 때까지만
 * 기다린다. 보통 즉시 있지만, 느린 네트워크에서 컴포넌트가 스크립트보다 먼저
 * 마운트될 수 있어 짧게 폴링한다.
 */
function waitForVWorldSdk(timeoutMs = 15000): Promise<void> {
  if (window.vw) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (window.vw) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer)
        reject(new Error('VWorld SDK 로드 대기 시간 초과 — index.html의 script 태그와 API 키를 확인하세요.'))
      }
    }, 100)
  })
}

function zonesToGeoJson(mapData: DemoMapResponse) {
  return {
    type: 'FeatureCollection' as const,
    features: mapData.zones.map((zone) => ({
      type: 'Feature' as const,
      id: zone.id,
      properties: {
        name: zone.name,
        fill: zone.color,
        'fill-opacity': 0.38,
        stroke: zone.color,
        'stroke-width': 2,
        'stroke-opacity': 0.9,
      },
      geometry: zone.geometry,
    })),
  }
}

function polygonCentroid(coordinates: number[][][]): [number, number] {
  const ring = coordinates[0]
  const sum = ring.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
  return [sum[0] / ring.length, sum[1] / ring.length]
}

export function VWorldMap({
  mapData,
  pins,
  selectedId,
  onSelectPin,
  className = '',
  focus,
  initialView = DEFAULT_INITIAL_VIEW,
}: VWorldMapProps) {
  const rawId = useId()
  const containerId = `vworld-map-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const mapInstanceRef = useRef<vw.Map | null>(null)
  const pinEntitiesRef = useRef(new globalThis.Map<string, Cesium.Entity>())
  const onSelectPinRef = useRef(onSelectPin)
  onSelectPinRef.current = onSelectPin

  useEffect(() => {
    let destroyed = false
    const pinEntities = pinEntitiesRef.current

    async function init() {
      await waitForVWorldSdk()
      if (destroyed || !window.vw) return
      const vw = window.vw

      const map = new vw.Map()
      mapInstanceRef.current = map
      map.setOption({
        mapId: containerId,
        initPosition: new vw.CameraPosition(
          new vw.CoordZ(mapData.center.lng, mapData.center.lat, 850),
          new vw.Direction(mapData.model.headingDegrees, -55, 0),
        ),
        logo: false,
        navigation: false,
      })
      map.start()

      vw.ws3dInitCallBack = () => {
        if (!window.ws3d || !window.Cesium) return
        const viewer = window.ws3d.viewer
        if (destroyed) {
          // 콜백이 뜨기 전에 화면을 벗어난 경우 — SDK가 이미 만들어 둔 WebGL 컨텍스트를
          // 여기서 바로 정리하지 않으면 컨텍스트가 새서, 몇 번 오가면 브라우저의 WebGL
          // 컨텍스트 개수 제한에 걸려 "Error constructing CesiumWidget"가 뜬다.
          viewer.destroy()
          return
        }
        const Cesium = window.Cesium
        viewerRef.current = viewer

        // 구역 — simplestyle(fill/stroke) 속성을 얹어 GeoJSON 그대로 로드, 지면에 고정.
        Cesium.GeoJsonDataSource.load(zonesToGeoJson(mapData), { clampToGround: true }).then((ds) => {
          if (destroyed) return
          viewer.dataSources.add(ds)
        })

        // 구역 이름 라벨 — 각 폴리곤 중심에 표시.
        for (const zone of mapData.zones) {
          const [lng, lat] = polygonCentroid(zone.geometry.coordinates)
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            label: {
              text: zone.name,
              font: '600 13px Pretendard, sans-serif',
              fillColor: Cesium.Color.fromCssColorString('#171717'),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 3,
              style: 2, // Cesium.LabelStyle.FILL_AND_OUTLINE
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
          })
        }

        // 중앙 통로 — 플로어 A/B/C/D 네 구역 사이 십자형 통행로(구역 폴리곤 경계 실측 기준,
        // mapData.center와 거의 일치). 구역 이름만으로는 구역 사이 이동 동선이 안 보인다는
        // 사용자 피드백(2026-09-12)으로 추가 — 통로 자체는 별도 구역 데이터가 없어(폴리곤이
        // 아니라 GLB에 이미 포장된 통행로) 라벨만 얹는다.
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(mapData.center.lng, mapData.center.lat),
          label: {
            text: '중앙 통로',
            font: '500 11px Pretendard, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#5b6570'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            style: 2, // Cesium.LabelStyle.FILL_AND_OUTLINE
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          },
        })

        // 게이트 — 검정 사각 점 + 이름.
        for (const gate of mapData.gates) {
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(gate.position.lng, gate.position.lat),
            point: { pixelSize: 12, color: Cesium.Color.fromCssColorString('#1c1c1e'), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
            label: {
              text: gate.name,
              font: '500 11px Pretendard, sans-serif',
              pixelOffset: { x: 0, y: -16 } as unknown as never,
              fillColor: Cesium.Color.fromCssColorString('#373c3c'),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              style: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          })
        }

        // 콘서트 3D 모델(GLB) — heading만 회전 적용, 높이는 지면에 고정.
        const modelPosition = Cesium.Cartesian3.fromDegrees(mapData.model.position.lng, mapData.model.position.lat)
        const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(mapData.model.headingDegrees), 0, 0)
        viewer.entities.add({
          position: modelPosition,
          orientation: Cesium.Transforms.headingPitchRollQuaternion(modelPosition, hpr),
          model: {
            uri: resolveDemoAssetUrl(mapData.model.uri),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        })

        // 신고 핀. disableDepthTestDistance: Infinity — 안 주면 좌석·구조물 같은 3D 모델
        // 지오메트리가 카메라와 핀 사이에 있을 때 깊이 테스트에 걸려 핀이 그 뒤로 숨는다
        // (로우앵글 시점일수록 자주 겹친다 — 2026-09-12 사용자 확인).
        for (const pin of pins) {
          const entity = viewer.entities.add({
            id: `pin-${pin.id}`,
            position: Cesium.Cartesian3.fromDegrees(pin.lng, pin.lat),
            point: {
              pixelSize: pin.id === selectedId ? 16 : 12,
              color: Cesium.Color.fromCssColorString(pin.colorHex),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          pinEntitiesRef.current.set(pin.id, entity)
        }

        // 클릭 선택.
        viewer.screenSpaceEventHandler.setInputAction((movement) => {
          const picked = viewer.scene.pick(movement.position)
          const id = picked?.id?.id
          if (typeof id === 'string' && id.startsWith('pin-')) {
            onSelectPinRef.current?.(id.slice(4))
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        // 경계구 기준 프레이밍 — 공식 예제([WebGL3] 지형 Clipping.html)와 같은 방식으로
        // viewBoundingSphere를 쓰면 setView처럼 카메라 좌표를 직접 계산할 필요 없이
        // "이 지점을 이 각도·거리로 보라"만 지정해도 항상 화면 중앙에 온다(setView는 카메라
        // 자체 좌표를 지정하는 거라 pitch를 준 상태에서 지면 지점이 화면 아래쪽으로 치우쳤다
        // — 2026-09-12 직접 확인).
        // initialView.target이 있으면(로우앵글 진입용) 그 지점을 중심으로, 없으면 기존처럼
        // mapData.center 전체 개요로 — 2026-09-12 Playwright로 후보 값 여럿을 실제로
        // 렌더링해서 비교 확정(사용자 요청 참고 이미지와 대조).
        const targetSphere = initialView.target
          ? new Cesium.BoundingSphere(
              Cesium.Cartesian3.fromDegrees(initialView.target.lng, initialView.target.lat, initialView.target.heightMeters),
              20,
            )
          : new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(mapData.center.lng, mapData.center.lat), 260)
        const cameraOffset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(initialView.headingDegrees ?? mapData.model.headingDegrees),
          Cesium.Math.toRadians(initialView.pitchDegrees),
          initialView.range,
        )
        // setView 계열을 바로 불러도 SDK 자체의 초기 2D→3D 전환 시퀀스가 몇 초 뒤에 카메라를
        // 다시 한반도 전체 뷰로 되돌리는 것으로 보인다(2026-09-12 직접 확인 — 콜백 시점에
        // 한 번, 조금 뒤 한 번 더 지정해도 여전히 지연). SDK가 자체 전환을 끝낼 시간을 준
        // 다음 다시 강제로 맞춘다 — 근본 원인(SDK 내부 타이머)을 정확히 잡아내지 못해
        // 임시방편이다. 다음에 SDK 쪽 콜백/옵션을 더 찾아 다듬을 것.
        //
        // 실측(2026-09-12, Playwright로 카메라 높이 프레임별 샘플링): 콜백 직후 이 보정을
        // 걸어도 약 150ms 뒤 SDK가 카메라를 수백만 m 높이(거의 우주)로 튕겨냈다가 자기
        // 나름대로 다시 줌인하며 약 1.8초 만에야 잠잠해진다 — 그 사이 "우주로 튕겼다가
        // 돌아오는" 장면이 그대로 사용자에게 보였다. 그래서 이 잠잠해지는 시점 전(0.5s·2s)의
        // 보정은 SDK 리셋을 상쇄하기 위한 것일 뿐 순간 이동으로 처리해 애니메이션을 숨기고,
        // SDK 전환이 끝났다고 볼 수 있는 2.6초 시점에 한 번만 — 목표보다 살짝 먼 높이에서
        // flyToBoundingSphere로 부드럽게 확대해 들어오는 연출을 준다(사용자가 보는 "한 번에
        // 확대되며 나타나는" 진입 연출은 이 한 번뿐). 6초 시점의 마지막 보정은 그 이후에도
        // 혹시 있을 늦은 SDK 리셋에 대비한 안전망이라 마찬가지로 순간 이동으로 처리한다.
        const setCamera = () => viewer.camera.viewBoundingSphere(targetSphere, cameraOffset)
        const zoomInOffset = new Cesium.HeadingPitchRange(cameraOffset.heading, cameraOffset.pitch, cameraOffset.range * 3)
        setCamera()
        setTimeout(setCamera, 500)
        setTimeout(setCamera, 2000)
        setTimeout(() => {
          viewer.camera.viewBoundingSphere(targetSphere, zoomInOffset)
          viewer.camera.flyToBoundingSphere(targetSphere, { offset: cameraOffset, duration: 1.8 })
        }, 2600)
        setTimeout(setCamera, 6000)
      }
    }

    init().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('VWorld 지도 초기화 실패', err)
    })

    return () => {
      destroyed = true
      viewerRef.current?.destroy()
      viewerRef.current = null
      mapInstanceRef.current?.destroy?.()
      mapInstanceRef.current = null
      pinEntities.clear()
    }
    // mapData/apiKey는 세션 동안 안 바뀐다고 보고 마운트 시 1회만 초기화한다 — 매번 Cesium
    // 뷰어를 새로 만드는 건 비용이 크다. 핀 목록 변화는 별도 effect(아래)로 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId])

  // 핀 목록이 바뀌면(신고 갱신 등) 기존 핀 엔티티를 지우고 다시 그린다.
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = window.Cesium
    if (!viewer || !Cesium) return
    for (const entity of pinEntitiesRef.current.values()) viewer.entities.remove(entity)
    pinEntitiesRef.current.clear()
    for (const pin of pins) {
      const entity = viewer.entities.add({
        id: `pin-${pin.id}`,
        position: Cesium.Cartesian3.fromDegrees(pin.lng, pin.lat),
        point: {
          pixelSize: pin.id === selectedId ? 16 : 12,
          color: Cesium.Color.fromCssColorString(pin.colorHex),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      pinEntitiesRef.current.set(pin.id, entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, selectedId])

  // focus가 바뀌면(신고 상세를 열거나 닫을 때) 그 지점을 가깝게 확대하거나 전체 개요로
  // 되돌아간다. 이 인스턴스는 대시보드↔상세 화면을 오갈 때도 마운트를 새로 하지 않고
  // 재사용되므로(MapCard.tsx 주석 참고) 여기서도 처음 진입 연출과 같은 방식
  // (BoundingSphere+flyToBoundingSphere)으로, 순간 이동 대신 한 번의 부드러운 확대·축소로
  // 전환한다. 마운트 직후(뷰어가 아직 없을 때)는 그냥 지나가서 초기 진입 연출과 겹치지
  // 않는다 — 뷰어가 생긴 뒤 focus가 실제로 바뀔 때만 동작한다.
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = window.Cesium
    if (!viewer || !Cesium) return
    const sphere = focus
      ? new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(focus.lng, focus.lat), 20)
      : new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(mapData.center.lng, mapData.center.lat), 260)
    const offset = focus
      ? new Cesium.HeadingPitchRange(Cesium.Math.toRadians(mapData.model.headingDegrees), Cesium.Math.toRadians(-55), 45)
      : new Cesium.HeadingPitchRange(Cesium.Math.toRadians(mapData.model.headingDegrees), Cesium.Math.toRadians(-68), 125)
    viewer.camera.flyToBoundingSphere(sphere, { offset, duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lng])

  return <div id={containerId} ref={containerRef} className={className} />
}
