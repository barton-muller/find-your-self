// Regenerates the app-store style images in docs/img/.
// Needs Playwright (`npm i -D playwright`, or any global install) and a built app (`npm run build`).
// Weather and map tiles are mocked so the output is the same on every run. The weather in the images is sample data.
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'docs', 'img');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gofindyourself-shots-'));
const BASE = 'http://127.0.0.1:4173/';
const DAY = 864e5;
const T0 = new Date('2026-11-20T10:00:00');

const days = (a, b) => { const r = []; for (let t = Date.parse(a); t <= Date.parse(b); t += DAY) r.push(new Date(t).toISOString().slice(0, 10)); return r; };
const CODES = [1, 2, 61, 0, 3, 80, 2, 0, 95, 3, 1, 0];
const MM = { 61: 2.4, 80: 6, 95: 14 };

async function mockApis(ctx) {
  await ctx.route('**/api.open-meteo.com/**', (r) => {
    const u = new URL(r.request().url());
    const t = days(u.searchParams.get('start_date'), u.searchParams.get('end_date'));
    const lat = Math.round(Number(u.searchParams.get('latitude')) * 10);
    const code = (d) => CODES[(Math.floor(Date.parse(d) / DAY) + lat) % CODES.length];
    r.fulfill({ json: { daily: {
      time: t,
      weather_code: t.map(code),
      precipitation_sum: t.map((d) => MM[code(d)] ?? 0),
      temperature_2m_max: t.map((d) => 30 + (Date.parse(d) / DAY) % 3),
      temperature_2m_min: t.map((d) => 22 + (Date.parse(d) / DAY) % 2),
      precipitation_probability_max: t.map((d) => (MM[code(d)] ? 70 : 10)),
      wind_speed_10m_max: t.map((d) => 8 + (Date.parse(d) / DAY) % 9),
    } } });
  });
  await ctx.route(/tile\.openstreetmap\.org|geocoding-api/, (r) => r.abort());
}

async function raw(browser, name, opts, steps) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await mockApis(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(T0);
  await page.goto(`${BASE}#/settings`);
  await page.waitForTimeout(800);
  // move the example trip so that it is already underway on the screenshot date
  const dates = page.locator('input[type=date]');
  await dates.nth(0).fill('2026-11-17');
  await dates.nth(1).fill('2026-12-02');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForTimeout(800);
  const files = {};
  for (const [key, fn] of Object.entries(steps)) {
    await fn(page);
    await page.waitForTimeout(1200);
    files[key] = path.join(TMP, `${name}-${key}.png`);
    await page.screenshot({ path: files[key] });
  }
  await ctx.close();
  return files;
}

const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const phone = (f, w, extra = '') => `<div class="phone" style="width:${w}px;${extra}"><img src="${b64(f)}"></div>`;
const CSS = `
*{box-sizing:border-box;margin:0}
body{font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#100F0F}
.panel{width:1080px;height:1500px;position:relative;overflow:hidden;padding:90px 80px 0}
.panel h1{font-size:76px;line-height:1.05;font-weight:800;letter-spacing:-1.5px;max-width:900px}
.panel p{font-size:34px;line-height:1.35;margin-top:26px;max-width:820px;color:#3a3935}
.phone{position:absolute;border:12px solid #100F0F;border-radius:64px;overflow:hidden;background:#100F0F;box-shadow:0 30px 80px #0004}
.phone img{display:block;width:100%}
`;
const panel = (tint, title, sub, f) => `<html><style>${CSS}</style><body><div class="panel" style="background:${tint}"><h1>${title}</h1><p>${sub}</p>${phone(f, 700, 'left:190px;top:470px')}</div></body></html>`;

async function shot(browser, html, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, file) });
  await p.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', cwd: path.join(__dirname, '..') });
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  try {
    const phoneOpts = { ...devices['Pixel 7'], deviceScaleFactor: 2 };
    const light = await raw(browser, 'light', phoneOpts, {
      plan: async (p) => { await p.goto(`${BASE}#/plan`); },
      fork: async (p) => { await p.goto(`${BASE}#/plan`); await p.evaluate(() => document.getElementById('stop-lpb')?.scrollIntoView({ block: 'start' })); },
      timeline: async (p) => { await p.goto(`${BASE}#/timeline`); },
      place: async (p) => { await p.goto(`${BASE}#/place/cnx`); await p.waitForTimeout(600); await p.evaluate(() => window.scrollTo(0, 420)); },
      todo: async (p) => { await p.goto(`${BASE}#/todo`); },
      settings: async (p) => { await p.goto(`${BASE}#/settings`); await p.waitForTimeout(600); await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => /github sync/i.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 70); }); },
    });
    const dark = await raw(browser, 'dark', { ...phoneOpts, colorScheme: 'dark' }, {
      timeline: async (p) => { await p.goto(`${BASE}#/timeline`); },
    });
    const panels = [
      ['plan', '#D5E9E5', 'Plan the route,<br>not just the list', 'Stops, nights and transport in one place. Dates update as you change anything.', light.plan],
      ['fork', '#E3DCF0', 'Branch when you<br>cannot decide', 'Keep two routes side by side. Pick one and see how it moves the dates.', light.fork],
      ['timeline', '#D6E4F2', 'See the whole<br>trip at a glance', 'One dot per night. Travel days and overnight rides are easy to spot.', light.timeline],
      ['weather', '#F6E3B4', 'Weather for<br>every day', 'Forecast for each stop on the days you are there.', light.place],
      ['todo', '#F2DCE6', 'Know what is<br>still unbooked', 'Stays and transport turn into a checklist, soonest first.', light.todo],
      ['private', '#D5E9E5', 'Your trip stays<br>with you', 'Saved on your device. Optional sync to a GitHub repo you own, which an AI agent can edit for you.', light.settings],
    ];
    for (const [k, tint, t, s, f] of panels) await shot(browser, panel(tint, t, s, f), 1080, 1500, `panel-${k}.png`);

    const logo = fs.readFileSync(path.join(__dirname, '..', 'public', 'icon.svg'), 'utf8').replace('<svg ', '<svg width="150" height="150" style="border-radius:34px" ');
    const hero = `<html><style>${CSS}
      .hero{width:1600px;height:800px;position:relative;overflow:hidden;background:#FFFCF0;padding:100px 110px}
      .hero h1{font-size:96px;line-height:1;letter-spacing:-3px;margin-top:34px;font-weight:800}
      .hero p{font-size:42px;margin-top:20px;max-width:640px;line-height:1.3;color:#3a3935}
      .blob{position:absolute;right:-120px;top:-200px;width:1000px;height:1200px;background:#D5E9E5;border-radius:50% 0 0 50%}
    </style><body><div class="hero"><div class="blob"></div>${logo}<h1>Go Find<br>Yourself</h1><p>A trip planner for routes that branch.</p>
      ${phone(dark.timeline, 360, 'left:790px;top:110px;transform:rotate(-4deg)')}
      ${phone(light.plan, 360, 'left:1020px;top:170px;transform:rotate(3deg)')}
      ${phone(light.place, 360, 'left:1250px;top:90px;transform:rotate(-2deg)')}
    </div></body></html>`;
    await shot(browser, hero, 1600, 800, 'hero.png');

  } finally {
    await browser.close();
    srv.kill();
  }
  console.log('wrote', OUT);
})();
