import './routes/map-preview.css'

const C = window.Cesium
const vw = window.vw
const status = document.querySelector('#status')
const error = document.querySelector('#error')
let viewer, model, data, ground = 0, buildings
function fail(message) { error.textContent = message; status.textContent = '연결 확인 필요' }
function frame(height = ground) {
  return C.Transforms.headingPitchRollToFixedFrame(C.Cartesian3.fromDegrees(data.model.position.lng, data.model.position.lat, height), new C.HeadingPitchRoll(C.Math.toRadians(data.model.headingDegrees), 0, 0))
}
function view(mode) {
  if (!model || !viewer) return
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = mode !== 'under'
  const local = mode === 'under' ? new C.Cartesian3(9,39,1) : mode === 'stage' ? new C.Cartesian3(0,35,5) : new C.Cartesian3()
  const target = C.Matrix4.multiplyByPoint(frame(), local, new C.Cartesian3())
  const offset = new C.HeadingPitchRange(C.Math.toRadians(data.model.headingDegrees), C.Math.toRadians(mode === 'under' ? -4 : mode === 'top' ? -89.9 : -35), mode === 'world' ? 1300 : mode === 'under' ? 6 : mode === 'stage' ? 100 : 320)
  const apply = () => { viewer.camera.cancelFlight(); viewer.camera.lookAt(target, offset); viewer.camera.lookAtTransform(C.Matrix4.IDENTITY); viewer.scene.requestRender() }
  apply(); if (mode === 'under') requestAnimationFrame(apply)
}
async function setup() {
  try {
    viewer = window.ws3d.viewer
    viewer.scene.globe.show = true
    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:`https://api.vworld.kr/req/wmts/1.0.0/${import.meta.env.VITE_VWORLD_API_KEY}/Satellite/{z}/{y}/{x}.jpeg`,maximumLevel:19,credit:'브이월드'}))
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = .35
    status.textContent = '행사 데이터 불러오는 중'
    const response = await fetch('/api/v1/demo/events/69cbb93b-d6cb-5785-a7c8-e606c7279d3d/map', {cache:'no-store'})
    if (!response.ok) throw new Error(`지도 API 응답 ${response.status}`)
    data = await response.json()
    // Sample the 78 x 117 m footprint in the model's rotated ENU frame.
    const samples = []
    for (const x of [-39,0,39]) for (const y of [-58.5,-29.25,0,29.25,58.5]) {
      const world = C.Matrix4.multiplyByPoint(frame(0),new C.Cartesian3(x,y,0),new C.Cartesian3())
      samples.push(C.Cartographic.fromCartesian(world))
    }
    status.textContent = '브이월드 지형 높이 계산 중'
    await C.sampleTerrain(viewer.terrainProvider, 15, samples)
    const heights = samples.map(p=>p.height).filter(Number.isFinite)
    if (heights.length !== samples.length) throw new Error('브이월드 지형 높이를 받지 못했습니다. 새로고침해 주세요.')
    ground = Math.max(...heights) + .5
    const modelOptions = { url: `${data.model.uri}?v=${Date.now()}`, modelMatrix: frame(), scale: data.model.metersPerUnit, upAxis:C.Axis.Y,forwardAxis:C.Axis.X }
    model = C.Model.fromGltfAsync ? await C.Model.fromGltfAsync(modelOptions) : C.Model.fromGltf(modelOptions)
    viewer.scene.primitives.add(model)
    const ready = () => {status.textContent='브이월드 3D 연결됨'}
    if(model.readyEvent) model.readyEvent.addEventListener(ready)
    else model.readyPromise.then(ready).catch(()=>fail('GLB 모델을 불러오지 못했습니다.'))
    model.errorEvent?.addEventListener(()=>fail('GLB 모델 렌더링에 실패했습니다.'))
    document.querySelector('#details').textContent = `가상 행사 배치 · ${data.dataVersion}\n지형 보정 높이 ${ground.toFixed(2)}m · 1단위 = 1m`
    for (const zone of data.zones) {
      const ring=zone.geometry.coordinates[0]
      viewer.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArrayHeights(ring.flatMap(p=>[p[0],p[1],ground+.15])),width:2,material:C.Color.fromCssColorString(zone.color)}})
      const button=document.createElement('button')
      const dot=document.createElement('i');dot.style.background=zone.color
      const label=document.createElement('span');label.textContent=zone.name
      button.append(dot,label)
      button.onclick=()=>{
        const points=ring.slice(0,-1)
        const lng=points.reduce((s,p)=>s+p[0],0)/points.length,lat=points.reduce((s,p)=>s+p[1],0)/points.length
        viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lng,lat,ground),22),{offset:new C.HeadingPitchRange(C.Math.toRadians(data.model.headingDegrees),-.8,90),duration:.7})
      }
      document.querySelector('#zones').append(button)
    }
    for (const gate of data.gates) viewer.entities.add({position:C.Cartesian3.fromDegrees(gate.position.lng,gate.position.lat,ground+5),label:{text:gate.name.replace('데모 ',''),font:'13px sans-serif',showBackground:true,disableDepthTestDistance:Number.POSITIVE_INFINITY}})
    viewer.entities.add({position:C.Cartesian3.fromDegrees(data.demoPoint.lng,data.demoPoint.lat,ground+data.demoPoint.surfaceOffsetMeters),point:{pixelSize:11,color:C.Color.RED,outlineColor:C.Color.WHITE,outlineWidth:2}})
    viewer.resize(); view('overview')
    try {
      const url='https://cdn.vworld.kr/TDServer/services/map4/TG9ENA.json'
      buildings = C.Cesium3DTileset.fromUrl ? await C.Cesium3DTileset.fromUrl(url, {maximumScreenSpaceError:12}) : new C.Cesium3DTileset({url,maximumScreenSpaceError:12})
      viewer.scene.primitives.add(buildings)
      if (buildings.readyPromise) await buildings.readyPromise
      buildings.show = document.querySelector('#buildings').checked
    } catch { error.textContent='항공영상·지형은 연결됐지만 주변 건물 데이터를 불러오지 못했습니다.' }
  } catch (e) { fail(e.message) }
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>view(button.dataset.view))
document.querySelector('#buildings').onchange=e=>{if(buildings) buildings.show=e.target.checked;viewer?.scene.requestRender()}
document.querySelector('#reload').onclick=()=>location.reload()
if (!vw || !C) fail('브이월드 SDK를 불러오지 못했습니다. 키와 허용 도메인을 확인해 주세요.')
else {
  // Use HTTPS data endpoints even on the localhost preview.
  window.v_protocol='https://';window.vworldUrl='https://map.vworld.kr';window.vworldBaseMapUrl='https://cdn.vworld.kr/2d';window.vworld2DCache='https://2d.vworld.kr/2DCache'
  vw.ws3dInitCallBack = setup
  const map = new vw.Map()
  map.setOption({mapId:'vworld-map',initPosition:new vw.CameraPosition(new vw.CoordZ(126.89721,37.56817,700),new vw.Direction(0,-70,0)),logo:true,navigation:false})
  map.start()
}
