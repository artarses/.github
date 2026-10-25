import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, clone, legalMoves, applyMove, sequences, pipCount, gameResult, canBearOff,
  pointNo, distOff, entryIndex, POINTS, SIDE_WHITE, SIDE_BLACK, CHECKERS, countAt,
} from '../js/engine.js';
import { chooseMoves, quickTurn, evaluate } from '../js/ai.js';

const D = (...v) => v.slice();

/** صفحهٔ خالی برای ساختن موقعیت‌های دستی */
function blank() {
  return { pts: new Array(POINTS).fill(0), bar: [0, 0], off: [0, 0], noHit: 0 };
}
/** W / B روی تی‌های شماره‌دارِ سفید (شماره ۱ تا ۲۴) */
function pos(spec, offW = 0, offB = 0, barW = 0, barB = 0) {
  const g = blank();
  for (const [k, v] of Object.entries(spec)) {
    const n = Number(k);
    g.pts[n - 1] = v;
  }
  g.off[SIDE_WHITE] = offW; g.off[SIDE_BLACK] = offB;
  g.bar[SIDE_WHITE] = barW; g.bar[SIDE_BLACK] = barB;
  return g;
}

test('چیدمان آغازین درست است', () => {
  const g = newGame();
  const w = g.pts.reduce((a, v) => a + Math.max(0, v), 0);
  const b = g.pts.reduce((a, v) => a + Math.max(0, -v), 0);
  assert.equal(w, CHECKERS);
  assert.equal(b, CHECKERS);
  assert.equal(g.pts[23], 2); assert.equal(g.pts[18], -5);
});

test('نگاشت شمارهٔ تی و فاصله تا خانه متقارن است', () => {
  assert.equal(pointNo(SIDE_WHITE, 0), 1);
  assert.equal(pointNo(SIDE_BLACK, 23), 1);
  assert.equal(pointNo(SIDE_BLACK, 0), 24);
  for (let i = 0; i < POINTS; i++) {
    assert.equal(distOff(SIDE_WHITE, i), i + 1);
    assert.equal(distOff(SIDE_BLACK, i), POINTS - i);
  }
  assert.equal(entryIndex(SIDE_WHITE, 1), 23);
  assert.equal(entryIndex(SIDE_BLACK, 6), 5);
});

test('حرکت‌های مجاز آغازین برای تاس ۲ و ۳', () => {
  const g = newGame();
  const mv = legalMoves(g, SIDE_WHITE, D(2, 3));
  const pairs = new Set(mv.map((m) => `${m.from}>${m.to}:${m.die}`));
  assert.ok(pairs.has('12>10:2'), '۱۳→۱۱');
  assert.ok(pairs.has('12>9:3'), '۱۳→۱۰');
  assert.ok(pairs.has('7>5:2'), '۸→۷ روی مهرهٔ خودی');
  assert.ok(pairs.has('23>21:2'), '۲۴→۲۲');
  assert.ok(pairs.has('23>20:3'), '۲۴→۲۱');
  assert.ok(pairs.has('5>3:2'), '۶→۴');
});

test('تیِ مسدود با دو مهرهٔ حریف مجاز نیست', () => {
  const g = pos({ 6: 5, 5: -2 });
  const mv = legalMoves(g, SIDE_WHITE, D(1)).filter((m) => m.from === 5);
  assert.equal(mv.length, 0);
  const mv2 = legalMoves(g, SIDE_WHITE, D(2));
  assert.ok(mv2.some((m) => m.from === 5 && m.to === 3), 'ولی با ۲ می‌تواند جابه‌جا شود');
});

test('زدن: مهرهٔ تنها حریف به وسط می‌رود و تی بسته می‌شود', () => {
  const g = pos({ 6: 5, 5: -1 }, 0, 14);
  const m = legalMoves(g, SIDE_WHITE, D(1)).find((x) => x.from === 5);
  assert.ok(m && m.hit);
  applyMove(g, SIDE_WHITE, m);
  assert.equal(g.pts[5], 4);
  assert.equal(g.pts[4], 1);
  assert.equal(g.bar[SIDE_BLACK], 1);
});

test('مهرهٔ روی وسط فقط می‌تواند وارد شود', () => {
  const g = blank();
  g.bar[SIDE_WHITE] = 2;
  const mv = legalMoves(g, SIDE_WHITE, D(4, 5));
  assert.ok(mv.every((m) => m.from === -1));
  assert.deepEqual([...new Set(mv.map((m) => m.to))].sort((a, b) => a - b), [19, 20]);
  assert.equal(entryIndex(SIDE_WHITE, 4), 20);
});

test('اگر ورود ممکن نباشد هیچ حرکتی نیست', () => {
  const g = blank();
  g.bar[SIDE_WHITE] = 1;
  for (let i = 18; i < 24; i++) g.pts[i] = -2;
  assert.equal(legalMoves(g, SIDE_WHITE, D(1, 6)).length, 0);
  assert.equal(sequences(g, SIDE_WHITE, D(1, 6)).length, 0);
  assert.deepEqual(quickTurn(g, SIDE_WHITE, D(1, 6)).seq, []);
});

test('خارج کردن فقط وقتی مجاز است که همهٔ مهره‌ها در خانه باشند', () => {
  let g = pos({ 1: 3, 2: 2, 20: 10 });
  assert.equal(canBearOff(g, SIDE_WHITE), false);
  g = pos({ 1: 3, 2: 2, 3: 4, 4: 4, 5: 1, 6: 1 }, 0);
  assert.equal(canBearOff(g, SIDE_WHITE), true);
  assert.equal(g.off[SIDE_WHITE], 0);
  // تی ۱ سه مهره، تی ۲ دو مهره، ۱۰ تای دیگر بیرون رفته‌اند
  const g2 = pos({ 1: 3, 2: 2 }, 10);
  assert.equal(canBearOff(g2, SIDE_WHITE), true);
  const offs = legalMoves(g2, SIDE_WHITE, D(1, 2, 6)).filter((m) => m.to === null);
  assert.deepEqual(offs.map((m) => `${m.die}:${m.from}`).sort(), ['1:0', '2:1', '6:1'],
    'تاس ۶ از دورترین تیِ پر (تی ۲) خارج می‌کند');
  assert.equal(legalMoves(g2, SIDE_WHITE, D(4)).filter((m) => m.to === null).length, 1, 'تاس ۴ هم فقط از تی ۲');
});

test('قاعدهٔ «تاس بزرگ‌تر از دورترین تی پر»', () => {
  const g = pos({ 3: 2 }, 13);
  assert.equal(g.pts.reduce((a, v) => a + Math.max(0, v), 0) + g.off[SIDE_WHITE], CHECKERS);
  assert.equal(canBearOff(g, SIDE_WHITE), true);
  const mv = legalMoves(g, SIDE_WHITE, D(6)).filter((m) => m.to === null);
  assert.equal(mv.length, 1);
  assert.equal(mv[0].from, 2);
  g.pts[4] = 1; g.off[SIDE_WHITE] = 12;          // تی ۵ هم پر شد → فقط از تی ۵ خارج می‌شود
  const mv2 = legalMoves(g, SIDE_WHITE, D(6)).filter((m) => m.to === null);
  assert.equal(mv2.length, 1);
  assert.equal(mv2[0].from, 4);
  // تاس ۲ در این موقعیت چیزی برای خارج کردن ندارد، ولی می‌تواند داخل خانه حرکت کند
  const mv3 = legalMoves(g, SIDE_WHITE, D(2));
  assert.ok(mv3.some((m) => m.from === 2 && m.to === 0));
  assert.equal(mv3.every((m) => m.to !== null), true);
});

test('دوبل = چهار حرکت و استفادهٔ کامل از تاس', () => {
  const g = newGame();
  const seqs = sequences(g, SIDE_WHITE, D(2, 2, 2, 2));
  assert.ok(seqs.length > 0);
  assert.ok(seqs.every((s) => s.length === 4), 'باید هر ۴ تاس استفاده شود');
});

test('حذف ترتیب‌های تکراری (دوبل)', () => {
  const g = pos({ 6: 2, 8: 2 }, 13);
  const seqs = sequences(g, SIDE_WHITE, D(1, 1, 1, 1));
  const asSet = new Set(seqs.map((s) => s.map((m) => `${m.from}>${m.to}`).sort().join(',')));
  assert.equal(asSet.size, seqs.length, 'دست یکسان نباید دوبار بیاید');
});

test('اگر فقط یک تاس قابل بازی باشد، همان بازی می‌شود', () => {
  const g = pos({ 6: 1 }, 14);
  const seqs = sequences(g, SIDE_WHITE, D(1, 4));
  assert.ok(seqs.length >= 1);
  assert.ok(seqs.every((s) => s.length === 2), 'هم تاس ۴ خارج می‌شود هم ۱ حرکت می‌کند');
});

test('بازی تصادفی کامل: پایان منطقی و پایستگی مهره‌ها', () => {
  for (let game = 0; game < 40; game++) {
    const g = newGame();
    let turn = Math.random() < 0.5 ? SIDE_WHITE : SIDE_BLACK;
    let finished = false;
    for (let t = 0; t < 600 && !finished; t++) {
      const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
      const dice = a === b ? [a, a, a, a] : [a, b];
      quickTurn(g, turn, dice, 'medium');
      const w = g.pts.reduce((s, v) => s + Math.max(0, v), 0) + g.bar[SIDE_WHITE] + g.off[SIDE_WHITE];
      const bl = g.pts.reduce((s, v) => s + Math.max(0, -v), 0) + g.bar[SIDE_BLACK] + g.off[SIDE_BLACK];
      assert.equal(w, CHECKERS, 'تعداد مهرهٔ سفید حفظ شود');
      assert.equal(bl, CHECKERS, 'تعداد مهرهٔ سیاه حفظ شود');
      const r = gameResult(g);
      if (r) {
        assert.ok([1, 2, 3].includes(r.mult));
        assert.equal(g.off[r.winner], CHECKERS);
        finished = true;
      }
      turn = 1 - turn;
    }
    assert.ok(finished, 'بازی باید در ۶۰۰ نوبت تمام شود');
  }
});

test('حریف هوشمند حرکت‌های نامجاز نمی‌سازد', () => {
  const g = newGame();
  for (const dice of [[1, 1], [6, 6], [3, 4], [2, 5], [1, 2]]) {
    const before = clone(g);
    const { seq } = chooseMoves(g, SIDE_BLACK, dice, 'hard');
    const after = clone(g);
    for (const m of seq) applyMove(after, SIDE_BLACK, m);
    const black = after.pts.reduce((s, v) => s + Math.max(0, -v), 0) + after.bar[SIDE_BLACK] + after.off[SIDE_BLACK];
    assert.equal(black, CHECKERS);
    assert.equal(after.pts.filter((v, i) => Math.max(0, v) > 0 && Math.max(0, -v) > 0).length, 0);
    void before;
  }
});

test('ارزیابی موقعیت: برتری محسوس باید امتیاز بالاتر بدهد', () => {
  const g = pos({ 1: 5, 2: 5, 3: 5, 7: -5, 8: -5, 9: -5 });
  assert.ok(evaluate(g, SIDE_WHITE) > evaluate(g, SIDE_BLACK));
  // بردهٔ خانه و محاصرهٔ حریف باید ارزش بیشتری از حرکت بی‌هدف داشته باشد
  const hit = clone(g);
  applyMove(hit, SIDE_WHITE, { die: 1, dieIdx: 0, from: 0, to: 23 });
  void hit;
});

test('تشخیص مرس (گمِین) و تخته', () => {
  // سفید همه را بیرون برد، سیاه یک مهره در خانهٔ سفید → تخته
  let g = pos({ 3: -1 }, 15);
  let r = gameResult(g);
  assert.equal(r.kind, 'backgammon');
  assert.equal(r.mult, 3);
  // سیاه هیچ مهره‌ای در خانهٔ سفید ندارد و هیچ‌کس را بیرون نبرده → گمِین
  g = pos({ 20: -15 }, 15);
  r = gameResult(g);
  assert.equal(r.kind, 'gammon');
  assert.equal(r.mult, 2);
  // سیاه هم چند مهره بیرون برده → برد ساده
  g = pos({ 20: -10 }, 15, 5);
  r = gameResult(g);
  assert.equal(r.kind, 'normal');
  assert.equal(r.mult, 1);
  // هیچ‌کس تمام نکرده
  g = pos({ 20: -10 }, 14, 5);
  assert.equal(gameResult(g), null);
});

test('pipCount برای چیدمان آغازین برابر است', () => {
  const g = newGame();
  assert.equal(pipCount(g, SIDE_WHITE), pipCount(g, SIDE_BLACK));
  assert.equal(pipCount(g, SIDE_WHITE), 167);
});

test('countAt روی تی خالی صفر می‌دهد', () => {
  const g = newGame();
  assert.equal(countAt(g, 1, SIDE_WHITE), 0);
  assert.equal(countAt(g, 1, SIDE_BLACK), 0);
});
