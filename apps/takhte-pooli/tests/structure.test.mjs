/**
 * هر فایلِ js/ باید به‌عنوان ES ماژول هم پاس شود ( مرورگر ماژول می‌خواهد،
 * و `node --check file.js` فایل .js را CJS می‌خواند و بعضی خطاها را نمی‌بیند).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('همهٔ ماژول‌ها پارس می‌شوند و گراف import می‌بندد', async () => {
  const files = readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 8, `فایل‌ها پیدا شدند: ${files.join(',')}`);
  for (const f of files) {
    // import کردن، هم سینتکس ES را می‌سنجد و هم مسیرهای import را
    await import(join(root, 'js', f));
  }
  // app.js بدون DOM نباید بترکد
  const mod = await import(`${root}/js/app.js?probe=${Date.now()}`);
  assert.equal(typeof mod.app, 'object');
});

test('index.html به فایل‌های موجود اشاره می‌کند', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js|woff2|png|svg))"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2);
  for (const r of refs) {
    if (r.startsWith('http') || r.startsWith('data:')) continue;
    assert.ok(exists(join(root, r)), `مسیر گم‌شده: ${r}`);
  }
  // همهٔ importهای داخل js/ هم باید وجود داشته باشند
  for (const f of readdirSync(join(root, 'js'))) {
    const src = readFileSync(join(root, 'js', f), 'utf8');
    for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
      assert.ok(exists(join(root, 'js', m[1])), `${f} → ${m[1]} وجود ندارد`);
    }
  }
  // @font-face هم باید فونت را پیدا کند
  const css = readFileSync(join(root, 'css', 'app.css'), 'utf8');
  for (const m of css.matchAll(/url\("([^")]+\.(?:woff2|ttf))"\)/g)) {
    assert.ok(exists(join(root, 'css', m[1])), `فونت گم‌شده: ${m[1]}`);
  }
});

test('هر ۸ تخته، پالت کامل دارد و تم‌ها یکتا هستند', async () => {
  const { THEMES } = await import(`${root}/js/themes.js`);
  assert.equal(THEMES.length, 8);
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
  const keys = ['wood', 'felt', 'rail', 'point', 'checker', 'dice', 'cube', 'ui'];
  for (const t of THEMES) {
    for (const k of keys) assert.ok(t[k], `${t.id} → ${k} کم دارد`);
    assert.ok(t.checker.w.face && t.checker.b.face, `${t.id}: رنگ مهره‌ها`);
    assert.ok(t.ui.accent && t.ui.ink && t.ui.bg0, `${t.id}: متغیرهای CSS`);
    assert.match(t.note || '', /\S/, `${t.id} توضیح ندارد`);
  }
});

test('هیچ رشتهٔ غیرفارسیِ تصادفی در متن‌های کاربر نمانده', async () => {
  const { THEMES } = await import(`${root}/js/themes.js`);
  const txt = THEMES.map((t) => `${t.name}${t.sub}${t.note}`).join(' ');
  assert.doesNotMatch(txt, /[A-Za-z]{4}/, 'نام‌های تخته باید فارسی باشند');
});

const exists = (p) => existsSync(p);
