/**
 * آمایِ دود (smoke test) از کل رابط کاربری در jsdom — اگر jsdom نصب نبود، بی‌خطر رد می‌شود.
 *   npm i --no-save jsdom && npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const skip = !process.env.JSDOM_ENTRY && !existsSync(join(root, 'node_modules/jsdom'));

let JSDOM = null;
if (!skip) {
  // jsdom می‌تواند در node_modulesِ خود پروژه یا یک مسیر بیرونی (JSDOM_ENTRY) باشد
  const entry = process.env.JSDOM_ENTRY;
  try {
    ({ JSDOM } = entry
      ? await import(pathToFileURL(entry).href)
      : await import('jsdom'));
  } catch { /* نصب نیست */ }
}

function makeCtx() {
  const grad = { addColorStop() {} };
  const t = {
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createConicGradient: () => grad,
    createPattern: () => null,
    measureText: () => ({ width: 12 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    isPointInPath: () => false,
  };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      o[k] = () => undefined;
      return o[k];
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}

test('برنامه در مرورگر شبیه‌سازی‌شده بالا می‌آید، بازی می‌کند و فصل را می‌بندد', { skip: !JSDOM }, async () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/', pretendToBeVisual: true, resources: undefined,
  });
  const { window } = dom;
  const doc = window.document;
  window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
  window.Element.prototype.getBoundingClientRect = function () { return { width: 1080, height: 620, top: 0, left: 0, right: 1080, bottom: 620 }; };
  window.scrollTo = () => {};
  const put = (k, v) => {
    try { globalThis[k] = v; } catch {
      Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    }
  };
  for (const k of ['window', 'document', 'localStorage', 'HTMLElement', 'Element', 'Node',
    'HTMLCanvasElement', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'devicePixelRatio']) {
    put(k, window[k]);
  }
  globalThis.CSS = window.CSS || { supports: () => true };

  const app = (await import(`${root}/js/app.js`)).app;
  assert.ok(app, 'App باید ساخته شده باشد');
  assert.equal(typeof app.table.roll, 'function');
  app.autoNext = false;
  app.cfg.tempo = 0.02;           // انیمیشن‌ها در آزمون تقریباً آنی‌اند
  app.view.tempo = 0.02;

  // یک دست کامل، فقط با «کلیک روی تیِ منبع» و «کلیک روی مقصد»
  const cash0 = app.s.season.players.find((p) => p.id === 'you').cash;
  app.table.newRound(app.opponentChoice());
  let guard = 0;
  let clicked = 0;
  while (app.table.phase !== 'over' && guard++ < 4000) {
    const ph = app.table.phase;
    if (ph === 'ready') app.table.roll();
    else if (ph === 'you') {
      const firsts = [...app.table.firsts().values()];
      if (firsts.length) {
        app.table.onPoint(firsts[0].from);
        app.table.onPoint(firsts[0].to);
        clicked++;
      }
    } else if (ph === 'double') {
      app.table.answerDouble(true);
    }
    await wait(4);
  }
  assert.equal(app.table.phase, 'over', 'دست باید تمام شود');
  assert.ok(clicked > 0, 'حداقل یک حرکت با کلیک انجام شود');
  const cash1 = app.s.season.players.find((p) => p.id === 'you').cash;
  assert.notEqual(cash1, cash0, 'پول میز باید جابه‌جا شده باشد');
  assert.equal(Math.abs(cash1 - cash0) % app.cfg.stake, 0, 'جابه‌جایی مضربی از شرط هر بازی است');
  assert.ok(app.s.stats.games >= 1);
  assert.ok(app.logs.length > 0, 'دفترچهٔ میز باید پر شده باشد');
  assert.ok(doc.getElementById('log').children.length > 0);

  // صحنه‌ها را یکی‌یکی باز کن تا خطای رندر ندهند
  for (const tab of ['board', 'stats', 'wallet', 'guide', 'table']) {
    app.show(tab);
    await wait(20);
  }
  assert.ok(doc.getElementById('lb').children.length >= 10, 'جدول زنده باید پر باشد');
  assert.ok(doc.getElementById('podium').children.length === 3, 'سکوی سه‌نفره');

  // پایان مهلت: جوایز باید پرداخته شود
  const walletBefore = app.s.wallet;
  app.jumpToEnd();
  await wait(80);
  assert.ok(app.s.season.closed, 'فصل باید بسته شود');
  assert.ok(doc.getElementById('modalSheet').textContent.includes('پایان مهلت'), 'مراسم جایزه باید باز شود');
  const pay = app.s.season.payouts;
  assert.equal(pay.top.length, 3);
  assert.deepEqual(pay.top.map((t) => t.prize), [10_000_000, 5_000_000, 1_000_000]);
  if (pay.top[0].id === 'you') assert.ok(app.s.wallet > walletBefore);

  // فصل تازه
  app.newSeasonModal('live');
  await wait(60);
  assert.equal(app.s.season.closed, false);
  assert.ok(app.s.season.players.length === 16);
  window.close();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
