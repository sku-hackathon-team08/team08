(async function () {
  const status = document.getElementById("status");
  const fail = (message) => {
    status.textContent = message;
    status.classList.add("error");
  };
  let data;
  try {
    const r = await fetch("/demo/seoul-worldcup.json");
    if (!r.ok) throw Error();
    data = await r.json();
  } catch {
    fail("데모 데이터를 불러오지 못했습니다. 새로고침해 주세요.");
    return;
  }
  const inRing = (lng, lat, ring) => {
    let inside = false;
    for (let i=0,j=ring.length-1; i<ring.length; j=i++) {
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if ((yi>lat)!==(yj>lat) && lng<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  };
  for (const zone of data.zones) {
    const el = document.createElement("button");
    el.type = "button";
    el.dataset.zone = zone.key;
    const dot = document.createElement("i");
    dot.style.background = zone.color;
    el.append(dot, document.createTextNode(`${zone.name} · ${zone.areaSquareMeters}㎡`));
    document.getElementById("legend").append(el);
    el.onclick = () => {
      document.querySelectorAll('#legend button').forEach(button=>button.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('zone-detail').textContent = zone.geometry.coordinates[0]
        .slice(0,-1).map(([lng,lat],i)=>`${i+1}. ${lng.toFixed(7)}, ${lat.toFixed(7)}`).join('\n');
      if (window.demoMap?.overlays) {
        for (const entity of demoMap.overlays) if (entity.polygon) {
          const z = data.zones.find(item=>item.id===entity.id);
          entity.polygon.material = Cesium.Color.fromCssColorString(z.color).withAlpha(z.id===zone.id ? .36 : .04);
        }
      }
    };
  }
  document.getElementById("export").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "seoul-worldcup-demo-map.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!window.vw || !window.ws3d) {
    fail(
      "브이월드 SDK를 불러오지 못했습니다. 키 설정·네트워크를 확인해 주세요.",
    );
    return;
  }
  try {
    const map = new vw.Map();
    map.setOption({
      mapId: "vmap",
      initPosition: new vw.CameraPosition(
        new vw.CoordZ(data.center.lng, data.center.lat, 480),
        new vw.Direction(0, -65, 0),
      ),
      logo: true,
      isZoomControl: true,
      isNavigationControl: true,
    });
    const ready = new Promise((resolve) => {
      vw.ws3dInitCallBack = resolve;
    });
    map.start();
    let timer;
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Provider initialization timeout")),
            25000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    const viewer = ws3d.viewer,
      C = window.Cesium || ws3d.common;
    viewer.targetFrameRate = 20;
    // The SDK wrapper stalled after one tile in this environment. Load the same
    // provider tileset through the bundled Cesium renderer; keep the wrapper hidden.
    const providerBuildings = viewer.map.getElementById("facility_build");
    providerBuildings?.hide();
    const buildings = viewer.scene.primitives.add(
      new C.Cesium3DTileset({
        url: "https://cdn.vworld.kr/TDServer/services/map4/TG9ENA.json",
        maximumScreenSpaceError: 8,
        maximumMemoryUsage: 128,
      }),
    );
    let buildingTiles = 0;
    const buildingStatus = document.getElementById("building-status");
    buildings.tileLoad.addEventListener(() => {
      buildingTiles += 1;
      buildingStatus.textContent = `건물 3D 타일 ${buildingTiles}개 수신 · 개별 건물 제공 여부는 화면에서 확인`;
    });
    buildings.tileFailed.addEventListener(() => {
      buildingStatus.textContent =
        "일부 건물 타일을 받지 못했습니다. 네트워크·제공자 상태를 확인해 주세요.";
    });
    buildings.readyPromise.catch(() => {
      buildingStatus.textContent = "건물 데이터 초기화 실패";
    });
    document.getElementById("buildings").onchange = (e) => {
      buildings.show = e.target.checked;
      buildingStatus.hidden = !e.target.checked;
    };
    window.demoMap = { map, viewer, data, buildings };
    const go = (pitch) => {
      const cartographic = C.Cartographic.fromDegrees(
        data.center.lng,
        data.center.lat,
      );
      const height = window.demoMap.modelGroundHeight ?? viewer.scene.globe.getHeight(cartographic) ?? 0;
      viewer.camera.flyToBoundingSphere(
        new C.BoundingSphere(
          C.Cartesian3.fromDegrees(data.center.lng, data.center.lat, height),
          100,
        ),
        {
          duration: 0.8,
          offset: new C.HeadingPitchRange(
            C.Math.toRadians(data.model.headingDegrees),
            C.Math.toRadians(pitch),
            245,
          ),
        },
      );
    };
    document.getElementById("home").onclick = () => go(-40);
    document.getElementById("top").onclick = () => go(-90);
    const focusZone = (key, range, pitch) => {
      const ring = data.zones.find(z=>z.key===key).geometry.coordinates[0];
      const lng=(ring[0][0]+ring[2][0])/2,lat=(ring[0][1]+ring[2][1])/2;
      const h=window.demoMap.modelGroundHeight??viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(data.center.lng,data.center.lat))??0;
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lng,lat,h+4),1),{
        duration:.8,offset:new C.HeadingPitchRange(C.Math.toRadians(data.model.headingDegrees),C.Math.toRadians(pitch),range)});
    };
    document.getElementById('stage-view').onclick=()=>focusZone('STAGE',78,-22);
    document.getElementById('seats-view').onclick=()=>focusZone('A',82,-48);
    document.getElementById("wide").onclick = () => {
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(data.center.lng,data.center.lat,20),100),
        {duration:.8,offset:new C.HeadingPitchRange(C.Math.toRadians(data.model.headingDegrees),-.85,600)});
    };
    const entities = viewer.entities || viewer._viewer?.entities;
    if (!entities) throw Error("entities unavailable");
    const demoPoint = entities.add({
      id: 'demo-single-point',
      show: false,
      position: C.Cartesian3.fromDegrees(126.8970733,37.5683536,20),
      point: {pixelSize:16,color:C.Color.fromCssColorString('#ff574f'),outlineColor:C.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Infinity},
      label: {text:'데모 지점',font:'15px sans-serif',showBackground:true,pixelOffset:new C.Cartesian2(0,-30),disableDepthTestDistance:Infinity},
    });
    const overlays = [];
    for (const z of data.zones)
      overlays.push(
        entities.add({
          id: z.id,
          name: z.name,
          polygon: {
            hierarchy: C.Cartesian3.fromDegreesArray(
              z.geometry.coordinates[0].flat(),
            ),
            material: C.Color.fromCssColorString(z.color).withAlpha(0.04),
            // Omitting height uses a ground polygon; explicit zero sits below this terrain.
          },
        }),
      );
    for (const g of data.gates)
      overlays.push(
        entities.add({
          id: g.id,
          name: g.name,
          position: C.Cartesian3.fromDegrees(g.position.lng, g.position.lat),
          point: {
            pixelSize: 12,
            color: C.Color.WHITE,
            outlineColor: C.Color.BLACK,
            outlineWidth: 2,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Infinity,
          },
          label: {
            text: g.name,
            font: "14px sans-serif",
            showBackground: true,
            backgroundColor:
              C.Color.fromCssColorString("#14232e").withAlpha(0.9),
            pixelOffset: new C.Cartesian2(
              g.position.lng < data.center.lng ? -45 : 45,
              -24,
            ),
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Infinity,
          },
        }),
      );
    const modelStatus = document.getElementById("model-status");
    const modelCartographic = C.Cartographic.fromDegrees(data.model.position.lng, data.model.position.lat);
    let baseHeight = viewer.scene.globe.getHeight(modelCartographic);
    try {
      const samples = await C.sampleTerrainMostDetailed(viewer.terrainProvider, [modelCartographic]);
      if (Number.isFinite(samples[0].height)) baseHeight = samples[0].height;
    } catch { /* Surface sampling below will refine the anchor if provider availability is absent. */ }
    const matrixAt = height => C.Transforms.headingPitchRollToFixedFrame(
      C.Cartesian3.fromDegrees(data.model.position.lng, data.model.position.lat, height + 0.3),
      new C.HeadingPitchRoll(C.Math.toRadians(data.model.headingDegrees),0,0));
    const stage = viewer.scene.primitives.add(C.Model.fromGltf({
      url: data.model.uri, modelMatrix: matrixAt(baseHeight ?? 0), scale:1,
      allowPicking:false, upAxis:C.Axis.Y, forwardAxis:C.Axis.X,
    }));
    const footprintFrame = matrixAt(-.3);
    const footprintSamples = [];
    for (const x of [-36.5,0,36.5]) for (const y of [-51.5,-24,4,32,59.5]) {
      footprintSamples.push(C.Cartographic.fromCartesian(C.Matrix4.multiplyByPoint(
        footprintFrame,new C.Cartesian3(x,y,0),new C.Cartesian3())));
    }
    const alignSurface = h => {
      // The provider terrain is not a flat pitch. Keep low seats above its full footprint.
      const sampled = footprintSamples.map(p=>viewer.scene.globe.getHeight(p)).filter(Number.isFinite);
      h = Math.max(h,...sampled);
      window.demoMap.modelGroundHeight = h;
      // Match the zone surface just above the concert floor.
      demoPoint.position=C.Cartesian3.fromDegrees(126.8970733,37.5683536,h+.44);
      demoPoint.show=true;

      stage.modelMatrix = matrixAt(h);
      for (const entity of overlays) {
        if (!entity.polygon) {
          const gate=data.gates.find(g=>g.id===entity.id);
          entity.position=C.Cartesian3.fromDegrees(gate.position.lng,gate.position.lat,h+4.6);
          entity.point.heightReference=C.HeightReference.NONE;
          entity.label.heightReference=C.HeightReference.NONE;
          continue;
        }
        const zone = data.zones.find(z => z.id === entity.id);
        entity.polygon.perPositionHeight = true;
        entity.polygon.hierarchy = C.Cartesian3.fromDegreesArrayHeights(
          zone.geometry.coordinates[0].flatMap(([lng,lat]) => [lng,lat,h+.44]));
      }
    };
    alignSurface(baseHeight ?? 0);
    // Keep model and selection surfaces on the same plane as rendered terrain refines.
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
      const h = viewer.scene.globe.getHeight(modelCartographic);
      if (Number.isFinite(h)) alignSurface(h);
    });
    stage.readyPromise.then(() => {
      modelStatus.textContent = `콘서트 모델 표시 · ${data.model.componentCount ?? data.model.nodeCount}개 구성 요소`;
      window.demoMap.modelReady = true;
    }).catch(() => {
      modelStatus.textContent = '콘서트 모델 파일을 불러오지 못했습니다.';
      modelStatus.classList.add('error');
    });
    document.getElementById("zones").onchange = (e) =>
      overlays.forEach((item) => {
        item.show = e.target.checked;
      });
    document.getElementById("stage").onchange = (e) => {
      stage.show = e.target.checked;
    };
    const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const ray = viewer.camera.getPickRay(click.position),
        p = viewer.scene.globe.pick(ray, viewer.scene);
      if (!p) {
        document.getElementById("coordinate").textContent =
          "지표면을 선택해 주세요.";
        return;
      }
      const c = C.Cartographic.fromCartesian(p),
        m = C.Math || C.CesiumMath;
      const lng=m.toDegrees(c.longitude),lat=m.toDegrees(c.latitude);
      const zone=data.zones.find(z=>inRing(lng,lat,z.geometry.coordinates[0]));
      document.getElementById("coordinate").textContent =
        `경도 ${lng.toFixed(7)}\n위도 ${lat.toFixed(7)}\n구역: ${zone?.name ?? '구역 밖 / 통로'}`;
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    for (const id of ["home", "top", "wide", "stage-view", "seats-view", "zones", "stage", "buildings"])
      document.getElementById(id).disabled = false;
    go(-40);
    status.textContent = "3D 엔진 연결 · 데모 객체 생성 완료";
    window.demoMap.overlays = overlays;
    window.demoMap.stage = stage;
  } catch (e) {
    console.error("Map initialization failed:", e.message);
    fail(
      "지도 초기화에 실패했습니다. WebGL 지원과 브이월드 연결을 확인해 주세요.",
    );
  }
})();
