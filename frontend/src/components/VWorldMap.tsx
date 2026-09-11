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
}

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

export function VWorldMap({ mapData, pins, selectedId, onSelectPin, className = '' }: VWorldMapProps) {
  const rawId = useId()
  const containerId = `vworld-map-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
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
        if (destroyed || !window.ws3d || !window.Cesium) return
        const Cesium = window.Cesium
        const viewer = window.ws3d.viewer
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

        // 신고 핀.
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
        const targetSphere = new Cesium.BoundingSphere(
          Cesium.Cartesian3.fromDegrees(mapData.center.lng, mapData.center.lat),
          260,
        )
        const cameraOffset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(mapData.model.headingDegrees),
          Cesium.Math.toRadians(-40),
          1000,
        )
        // setView 계열을 바로 불러도 SDK 자체의 초기 2D→3D 전환 시퀀스가 몇 초 뒤에 카메라를
        // 다시 한반도 전체 뷰로 되돌리는 것으로 보인다(2026-09-12 직접 확인 — 콜백 시점에
        // 한 번, 조금 뒤 한 번 더 지정해도 여전히 지연). SDK가 자체 전환을 끝낼 시간을 준
        // 다음 다시 강제로 맞춘다 — 근본 원인(SDK 내부 타이머)을 정확히 잡아내지 못해
        // 임시방편이다. 다음에 SDK 쪽 콜백/옵션을 더 찾아 다듬을 것.
        const setCamera = () => viewer.camera.viewBoundingSphere(targetSphere, cameraOffset)
        setCamera()
        setTimeout(setCamera, 500)
        setTimeout(setCamera, 2000)
        setTimeout(setCamera, 5000)
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
        },
      })
      pinEntitiesRef.current.set(pin.id, entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, selectedId])

  return <div id={containerId} ref={containerRef} className={className} />
}
