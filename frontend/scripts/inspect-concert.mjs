import {chromium} from 'playwright';
const b=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{const p=await b.newPage({viewport:{width:1200,height:900}});await p.goto('http://127.0.0.1:5173/demo-map.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.demoMap?.modelReady,null,{timeout:60000});await p.waitForTimeout(8000);
console.log(await p.evaluate(()=>({ground:demoMap.modelGroundHeight,parts:demoMap.data.model.componentCount,meshes:demoMap.data.model.nodeCount})));await p.locator('#seats-view').click();await p.waitForFunction(()=>!demoMap.viewer.camera._currentFlight);await p.waitForTimeout(1500);await p.screenshot({path:'/tmp/seoul-concert-qa/seats-final.png',timeout:60000});
}finally{await b.close()}
