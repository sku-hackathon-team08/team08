// Claude 에이전트용 화면 검사 도구.
// 시스템에 이미 설치된 Microsoft Edge를 재사용해(channel: 'msedge') Playwright 자체
// Chromium 다운로드 없이 스크린샷 + 콘솔 에러를 캡처한다.
// 사용법: node shot.js <url> <output.png> [selector-to-wait-for]
const { chromium } = require('playwright');

async function main() {
  const [, , url, outPath, waitSelector] = process.argv;
  if (!url || !outPath) {
    console.error('usage: node shot.js <url> <output.png> [waitSelector]');
    process.exit(1);
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(url, { waitUntil: 'networkidle' });
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 10000 }).catch((e) => {
      errors.push(`waitForSelector(${waitSelector}) failed: ${e.message}`);
    });
  }
  await page.screenshot({ path: outPath, fullPage: false });

  console.log('SCREENSHOT_SAVED:', outPath);
  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));

  await browser.close();
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
