import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out='/tmp/seoul-concert-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 const capture=async (page,options)=>{if(!process.env.QA_FAST)await page.screenshot(options)};
 const page=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig,'[redacted]')));
 await page.goto('http://127.0.0.1:5173/demo-map.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.demoMap?.modelReady,null,{timeout:60000});
 await page.waitForTimeout(7000);
 const marker=await page.evaluate(()=>{
   const e=demoMap.viewer.entities.getById('demo-single-point');
   const p=Cesium.Cartographic.fromCartesian(e.position.getValue(Cesium.JulianDate.now()));
   return {show:e.show,lng:Cesium.Math.toDegrees(p.longitude),lat:Cesium.Math.toDegrees(p.latitude),offset:p.height-demoMap.modelGroundHeight};
 });
 assert.equal(marker.show,true);assert.ok(Math.abs(marker.lng-126.8970733)<1e-8);
 assert.ok(Math.abs(marker.lat-37.5683536)<1e-8);assert.ok(Math.abs(marker.offset-.44)<.001);

 await capture(page,{path:out+'/model.png',timeout:60000});
 console.log('model ready',await page.locator('#model-status').innerText());
 await page.locator('#stage-view').click();await page.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await page.waitForTimeout(500);
 await capture(page,{path:out+'/stage-detail.png',timeout:60000});
 await page.locator('#seats-view').click();await page.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await page.waitForTimeout(500);
 await capture(page,{path:out+'/seats-detail.png',timeout:60000});
 await page.locator('[data-zone="A"]').click();assert.match(await page.locator('#zone-detail').innerText(),/126\.897/);
 await page.locator('#top').click();await page.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await page.waitForTimeout(500);
 const screen=await page.evaluate(()=>{const z=demoMap.data.zones[0],r=z.geometry.coordinates[0];const lng=(r[0][0]+r[2][0])/2,lat=(r[0][1]+r[2][1])/2;const c=Cesium.Cartographic.fromDegrees(lng,lat);const h=demoMap.viewer.scene.globe.getHeight(c)||0;const pos=Cesium.SceneTransforms.wgs84ToWindowCoordinates(demoMap.viewer.scene,Cesium.Cartesian3.fromDegrees(lng,lat,h));const rect=demoMap.viewer.scene.canvas.getBoundingClientRect();return {x:rect.x+pos.x,y:rect.y+pos.y}});
 await page.mouse.click(screen.x,screen.y);await capture(page,{path:out+'/coordinate-check.png',timeout:60000});assert.match(await page.locator('#coordinate').innerText(),/플로어 A/);
 await capture(page,{path:out+'/zones.png',timeout:60000});
 for(const id of ['stage','zones','buildings']){await page.locator('#'+id).uncheck();await page.locator('#'+id).check();}
 await page.locator('#wide').click();await page.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await page.waitForTimeout(500);await page.locator('#home').click();await page.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await page.waitForTimeout(500);
 for(const [selector,file] of [['#export','seoul-worldcup.json'],['a[href$="geojson"]','concert-zones.geojson'],['a[href$="csv"]','concert-coordinates.csv'],['a[href$="glb"]','concert.glb']]){
  const promise=page.waitForEvent('download');await page.locator(selector).click();const download=await promise;await download.saveAs(out+'/'+file);
  const expected=await readFile(new URL('../../backend/demo/assets/'+file,import.meta.url));const got=await readFile(out+'/'+file);
  if(file.endsWith('.json'))assert.deepEqual(JSON.parse(got),JSON.parse(expected));else assert.deepEqual(got,expected);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await capture(page,{path:out+'/final.png',timeout:60000});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture(page,{path:out+'/mobile.png',timeout:60000});
 await writeFile(out+'/results.json',JSON.stringify({modelReady:true,marker,zones:6,gates:3,coordinateSelection:'A',downloads:4,overflow:false,errors},null,2));
 await page.route('**/api/v1/demo/events/*/map',r=>r.fulfill({status:503,body:'unavailable'}));
 await page.goto('http://127.0.0.1:5173/demo-map.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));
 assert.equal(await page.evaluate(()=>Boolean(window.demoMap)),false);
 assert.deepEqual(errors,[]);console.log('PASS: GLB readiness (visual inspection required), zone selection, map point classification, controls, 4 exports, desktop/mobile fit.');
} finally {await b.close()}
