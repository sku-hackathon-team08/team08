import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const out = "/tmp/seoul-worldcup-map-qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const logs = [];
const safe = (s) =>
  s
    .replace(/[A-Fa-f0-9]{8}-[A-Fa-f0-9-]{27,}/g, "[REDACTED]")
    .replace(/apiKey=[^&\s]*/gi, "apiKey=[REDACTED]");
page.on("pageerror", (e) => logs.push(safe(e.message)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()))
    logs.push(safe(m.text()).slice(0, 400));
});
page.on("dialog", async (d) => {
  logs.push(safe(d.message()));
  await d.dismiss();
});
await page.goto("http://127.0.0.1:5173/demo-map.html", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(() => window.demoMap?.stage, null, {timeout:60000});
await page.waitForTimeout(15000);
console.log("initial loaded");
await page.screenshot({ path: out + "/initial.png", timeout: 60000 });
await page.locator("#top").click();
await page.waitForTimeout(2500);
await page.screenshot({ path: out + "/top.png", timeout: 60000 });
await page.locator("#zones").uncheck();
await page.locator("#stage").uncheck();
const hidden = await page.evaluate(
  () => demoMap.overlays.every((e) => !e.show) && !demoMap.stage.show,
);
await page.screenshot({ path: out + "/hidden.png", timeout: 60000 });
console.log("toggles hidden", hidden);
await page.locator("#zones").check();
await page.locator("#stage").check();
await page.locator("#home").click();
await page.waitForTimeout(2500);
await page.mouse.click(875, 530);
await page.waitForTimeout(500);
const coordinate = await page.locator("#coordinate").innerText();
console.log("before download", coordinate);
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.locator("#export").click();
const download = await downloadPromise;
await download.saveAs(out + "/export.json");
assert.deepEqual(
  JSON.parse(await readFile(out + "/export.json", "utf8")),
  JSON.parse(
    await readFile(
      new URL("../../backend/demo/assets/seoul-worldcup.json", import.meta.url),
      "utf8",
    ),
  ),
);
assert.equal(hidden, true);
assert.match(coordinate, /경도 126\./);

const result = {
  status: await page.locator("#status").innerText(),
  hidden,
  coordinate,
  logs,
  details: await page.evaluate(() => ({
    canvas: document.querySelectorAll("canvas").length,
    shown: demoMap.overlays.every((e) => e.show) && demoMap.stage.show,
    camera: demoMap.viewer.camera.positionCartographic.height,
    overflow: document.documentElement.scrollWidth > innerWidth,
  })),
};
assert.equal(result.details.shown, true);
assert.equal(result.details.overflow, false);
assert.match(result.status, /생성 완료/);
console.log(JSON.stringify(result, null, 2));
await writeFile(out + "/results.json", JSON.stringify(result, null, 2));
await page.screenshot({ path: out + "/final.png", timeout: 60000 });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(2000);
await page.screenshot({ path: out + "/mobile.png", timeout: 60000 });
console.log(
  "mobile overflow",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
await page.route("**/js/webglMapInit.js.do**", (r) => r.abort());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
console.log("SDK failure:", await page.locator("#status").innerText());
await page.route("**/api/v1/demo/events/*/map", (r) =>
  r.fulfill({ status: 503, body: "unavailable" }),
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
console.log("Data failure:", await page.locator("#status").innerText());
await browser.close();
