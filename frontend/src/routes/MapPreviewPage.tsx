import { useEffect, useRef, useState } from 'react'
import * as C from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './map-preview.css'

type Zone = { id: string; key: string; name: string; color: string; areaSquareMeters: number; geometry: { coordinates: number[][][] } }
type MapData = { name: string; dataVersion: string; center: { lng: number; lat: number }; zones: Zone[]; gates: { name: string; position: { lng: number; lat: number } }[]; model: { uri: string; position: { lng: number; lat: number }; headingDegrees: number; metersPerUnit: number; seatMarkers: number }; demoPoint: { lng: number; lat: number; surfaceOffsetMeters: number } }
const endpoint = '/api/v1/demo/events/69cbb93b-d6cb-5785-a7c8-e606c7279d3d/map'

export function MapPreviewPage() {
  const container = useRef<HTMLDivElement>(null)
  const modelRef = useRef<C.Model | null>(null)
  const viewerRef = useRef<C.Viewer | null>(null)
  const [data, setData] = useState<MapData | null>(null)
  const [status, setStatus] = useState('지도 준비 중')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState('')
  const [overlays, setOverlays] = useState(true)
  const overlayRef = useRef<C.Entity[]>([])

  function camera(mode: 'overview' | 'stage' | 'top' | 'under', current = data) {
    const viewer = viewerRef.current
    if (!viewer || !current) return
    const heading = C.Math.toRadians(current.model.headingDegrees)
    const frame = C.Transforms.headingPitchRollToFixedFrame(
      C.Cartesian3.fromDegrees(current.model.position.lng, current.model.position.lat, .3),
      new C.HeadingPitchRoll(heading, 0, 0),
    )
    const local = mode === 'under' ? new C.Cartesian3(9, 39, 1.0)
      : mode === 'stage' ? new C.Cartesian3(0, 43, 5) : new C.Cartesian3(0, 0, 0)
    const point = C.Matrix4.multiplyByPoint(frame, local, new C.Cartesian3())
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = mode !== 'under'
    const pitch = mode === 'top' ? -89.9 : mode === 'under' ? -4 : -35
    const range = mode === 'under' ? 6 : mode === 'stage' ? 60 : 250
    const applyView = () => {
      if (viewer.isDestroyed()) return
      viewer.camera.cancelFlight()
      viewer.camera.lookAt(point, new C.HeadingPitchRange(heading, C.Math.toRadians(pitch), range))
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
      viewer.scene.requestRender()
    }
    applyView()
    // Settle the previous frame's collision correction before entering the open substage.
    if (mode === 'under') requestAnimationFrame(applyView)
  }

  useEffect(() => {
    if (!container.current) return
    let disposed = false
    const controller = new AbortController()
    const viewer = new C.Viewer(container.current, {
      baseLayer: new C.ImageryLayer(new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })),
      baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
      navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
      selectionIndicator: false, infoBox: false, requestRenderMode: true,
      terrainProvider: new C.EllipsoidTerrainProvider(),
    })
    viewerRef.current = viewer
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.scene.globe.enableLighting = false
    viewer.scene.backgroundColor = C.Color.fromCssColorString('#101c27')
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = .35
    setError('')
    setStatus('행사 데이터 불러오는 중')
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(`지도 API 오류 (${response.status})`)
        const map: MapData = await response.json()
        if (disposed) return
        setData(map)
        camera('overview', map)
        setStatus('GLB 모델 불러오는 중')
        const model = await C.Model.fromGltfAsync({
          url: `${map.model.uri}?revision=${Date.now()}`,
          modelMatrix: C.Transforms.headingPitchRollToFixedFrame(C.Cartesian3.fromDegrees(map.model.position.lng, map.model.position.lat, .3), new C.HeadingPitchRoll(C.Math.toRadians(map.model.headingDegrees), 0, 0)),
          scale: map.model.metersPerUnit, upAxis: C.Axis.Y, forwardAxis: C.Axis.X,
        })
        if (disposed) { model.destroy(); return }
        viewer.scene.primitives.add(model)
        modelRef.current = model
        model.readyEvent.addEventListener(() => {
          setStatus('모델 연결됨')
          viewer.scene.requestRender()
        })
        model.errorEvent.addEventListener((e: Error) => setError(e.message))
        overlayRef.current = []
        for (const zone of map.zones) {
          const ring = zone.geometry.coordinates[0]
          const entity = viewer.entities.add({ id: zone.id, name: zone.name,
            polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(ring.flatMap(p => [p[0], p[1], .52])), width: 3, material: C.Color.fromCssColorString(zone.color) },
          })
          overlayRef.current.push(entity)
        }
        for (const gate of map.gates) viewer.entities.add({ position: C.Cartesian3.fromDegrees(gate.position.lng, gate.position.lat, 5), label: { text: gate.name.replace('데모 ', ''), font: '13px sans-serif', fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString('#172d3c'), pixelOffset: new C.Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY } })
        viewer.entities.add({ position: C.Cartesian3.fromDegrees(map.demoPoint.lng, map.demoPoint.lat, .3 + map.demoPoint.surfaceOffsetMeters), point: { pixelSize: 11, color: C.Color.fromCssColorString('#ff6278'), outlineColor: C.Color.WHITE, outlineWidth: 2 }, label: { text: '데모 지점', font: '12px sans-serif', pixelOffset: new C.Cartesian2(0, -22), showBackground: true } })
        viewer.screenSpaceEventHandler.setInputAction((event: { position: C.Cartesian2 }) => {
          const pick = viewer.scene.pick(event.position)
          if (pick?.id instanceof C.Entity) setSelected(pick.id.id)
        }, C.ScreenSpaceEventType.LEFT_CLICK)
        viewer.resize()
        camera('overview', map)
        setStatus('화면 렌더링 중')
        viewer.scene.requestRender()
      } catch (e) {
        if (!disposed) { setError(e instanceof Error ? e.message : String(e)); setStatus('연결 실패') }
      }
    }
    void load()
    return () => { modelRef.current = null; disposed = true; controller.abort(); viewerRef.current = null; viewer.destroy() }
    // A revision explicitly reloads the current backend asset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

  useEffect(() => {
    overlayRef.current.forEach(entity => { entity.show = overlays })
    viewerRef.current?.scene.requestRender()
  }, [overlays, status])

  return <main className="map-preview">
    <div ref={container} className="map-canvas" />
    <header className="map-header"><a href="/">현장의 지금<span>FIELD OPERATIONS</span></a><div className="live-status"><i />{status}</div></header>
    <aside className="map-panel">
      <p className="eyebrow">VENUE PREVIEW / 01</p><h1>서울월드컵경기장</h1><p className="map-subtitle">콘서트 현장을 한눈에.</p>
      <div className="map-stats"><div><strong>6</strong><span>운영 구역</span></div><div><strong>{data?.model.seatMarkers.toLocaleString() ?? '—'}</strong><span>좌석 표현</span></div><div><strong>3</strong><span>진입 게이트</span></div></div>
      <h2>구역 둘러보기</h2><div className="zone-list">{data?.zones.map(zone => <button key={zone.id} className={selected === zone.id ? 'selected' : ''} onClick={() => { setSelected(zone.id); const ring = zone.geometry.coordinates[0].slice(0, -1); const lng = ring.reduce((s,p) => s+p[0],0)/ring.length; const lat = ring.reduce((s,p) => s+p[1],0)/ring.length; viewerRef.current?.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lng, lat), 22), { offset: new C.HeadingPitchRange(C.Math.toRadians(data.model.headingDegrees), -.8, 65), duration: .7 }) }}><i style={{ background: zone.color }} /><span>{zone.name}</span><small>{zone.areaSquareMeters.toLocaleString()} m²</small></button>)}</div>
      <label className="overlay-toggle"><input type="checkbox" checked={overlays} onChange={e => setOverlays(e.target.checked)} /> 구역 경계 표시</label>
      <button className="reload-model" onClick={() => setRevision(n => n+1)}>↻ 최신 모델 불러오기</button>
      <p className="model-note">공식 잔디 규격 78 × 117m<br />무대 32 × 12 × 2m · 추정 배치<br />1 단위 = 1m · 정북 기준 13.5°<br />{data?.dataVersion}</p>
      {error && <p role="alert" className="map-error">{error}</p>}
    </aside>
    <nav className="camera-controls"><button onClick={() => camera('overview')}>전체 보기</button><button onClick={() => camera('stage')}>무대 보기</button><button onClick={() => camera('under')}>무대 하부</button><button onClick={() => camera('top')}>평면 보기</button></nav>
    <div className="map-help">드래그 이동 · 휠 확대 · Ctrl + 드래그 회전<span>Cesium · OpenStreetMap / 평면 지형 미리보기</span></div>
  </main>
}
