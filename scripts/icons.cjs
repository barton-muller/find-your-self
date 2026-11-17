// Renders public/icon.svg to the PNG icons the app needs. Needs Playwright.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');
(async () => {
  const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(pub, file) });
  }
  await browser.close();
})();
