import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out = "/tmp/seoul-map-qa";
await mkdir(out, { recursive: true });
const b = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const p = await b.newPage({ viewport: { width: 1200, height: 850 } });
const requests = [],
  errors = [];
const safeUrl = (u) => {
  const v = new URL(u);
  return v.origin + v.pathname;
};
p.on("response", (r) => {
  if (/vworld/.test(r.url()))
    requests.push({ url: safeUrl(r.url()), status: r.status() });
});
p.on("requestfailed", (r) =>
  errors.push({ url: safeUrl(r.url()), reason: r.failure()?.errorText }),
);
p.on("pageerror", (e) =>
  errors.push({
    error: e.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[redacted]"),
  }),
);
await p.goto("http://127.0.0.1:5173/demo-map.html", {
  waitUntil: "domcontentloaded",
});
await p.waitForFunction(() => window.demoMap?.stage, null, {timeout:60000});
await p.waitForTimeout(20000);
const state = await p.evaluate(() => {
  const d = window.demoMap;
  if (!d) return { status: document.querySelector("#status").textContent };
  const l = d.buildings;
  return {
    status: document.querySelector("#status").textContent,
    buildingVisible: l.show,
    buildingReady: l.ready,
    primitiveCount: d.viewer.scene.primitives.length,
    imageryCount: d.viewer.imageryLayers.length,
    tiles: d.viewer.scene.globe.tilesLoaded,
    renderError: d.viewer.cesiumWidget._renderLoopRunning === false,
  };
});
console.log(
  JSON.stringify(
    { state, requests: requests.slice(0, 12), counts: requests.length, errors },
    null,
    2,
  ),
);
await writeFile(
  out + "/network.json",
  JSON.stringify({ state, requests, errors }, null, 2),
);
await p.screenshot({ path: out + "/initial.png", timeout: 60000 });
await b.close();
