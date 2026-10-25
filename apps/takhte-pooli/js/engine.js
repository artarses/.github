/**
 * تختهٔ پولی — هستهٔ قوانین تخته نرد (توابع خالص، بدون DOM)
 * -------------------------------------------------------------
 * ایندکس ۰ = «تی ۱» سفید (خانهٔ سفید) و هرچه ایندکس بیشتر، دورتر از خانهٔ سفید.
 * سفید (SIDE_WHITE) از ایندکس ۲۳ به ۰ حرکت می‌کند، سیاه برعکس.
 * شمارهٔ تی برای هر طرف جدا محاسبه می‌شود: pointNo(side, idx)
 */

export const SIDE_WHITE = 0; // بازیکن
export const SIDE_BLACK = 1; // حریف
export const POINTS = 24;
export const CHECKERS = 15;

/** چیدمان استاندارد آغازین */
export function newGame() {
  const pts = new Array(POINTS).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;        // سفید
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;   // سیاه
  return { pts, bar: [0, 0], off: [0, 0], noHit: 0 };
}

export function clone(st) {
  return { pts: st.pts.slice(), bar: [st.bar[0], st.bar[1]], off: [st.off[0], st.off[1]], noHit: st.noHit | 0 };
}

export const sign = (side) => (side === SIDE_WHITE ? 1 : -1);
export const dir = (side) => (side === SIDE_WHITE ? -1 : 1);
export const countAt = (st, idx, side) =>
  side === SIDE_WHITE ? Math.max(0, st.pts[idx]) : Math.max(0, -st.pts[idx]);
export const enemyAt = (st, idx, side) =>
  side === SIDE_WHITE ? Math.max(0, -st.pts[idx]) : Math.max(0, st.pts[idx]);
export const isHomeIdx = (side, idx) => (side === SIDE_WHITE ? idx <= 5 : idx >= 18);
/** فاصله تا بیرون رفتن: ۱ یعنی با تاس ۱ خارج می‌شود */
export const distOff = (side, idx) => (side === SIDE_WHITE ? idx + 1 : POINTS - idx);
/** محل ورود مهره از وسط (bar) با تاس d */
export const entryIndex = (side, d) => (side === SIDE_WHITE ? POINTS - d : d - 1);
/** شمارهٔ تی از نگاه آن طرف (۱..۲۴) */
export const pointNo = (side, idx) => (side === SIDE_WHITE ? idx + 1 : POINTS - idx);

export function isBlocked(st, idx, side) { return enemyAt(st, idx, side) >= 2; }

/** آیا همهٔ مهره‌های این طرف در خانه است و می‌تواند خارج کند */
export function canBearOff(st, side) {
  if (st.bar[side] !== 0) return false;
  let inHome = 0;
  for (let i = 0; i < POINTS; i++) {
    const c = countAt(st, i, side);
    if (c && isHomeIdx(side, i)) inHome += c;
    else if (c) return false;
  }
  return inHome + st.off[side] === CHECKERS;
}

/** دورترین تیِ پرِ این طرف (برای قاعدهٔ «تاس بزرگ‌تر از خانه») */
function isFarthestPoint(st, side, idx) {
  const d = distOff(side, idx);
  for (let i = 0; i < POINTS; i++) {
    if (!countAt(st, i, side)) continue;
    if (distOff(side, i) > d && distOff(side, i) <= 6) return false;
  }
  return true;
}

/**
 * همهٔ حرکت‌های مجاز برای تاس‌های داده‌شده.
 * @returns {Array<{die:number, dieIdx:number, from:number, to:(number|null), hit:boolean, entered:boolean}>}
 */
export function legalMoves(st, side, dice) {
  const out = [];
  const onBar = st.bar[side] > 0;
  const bearing = !onBar && canBearOff(st, side);
  const s = sign(side);

  for (let di = 0; di < dice.length; di++) {
    const d = dice[di];
    if (onBar) {
      const to = entryIndex(side, d);
      if (isBlocked(st, to, side)) continue;
      out.push({ die: d, dieIdx: di, from: -1, to, hit: enemyAt(st, to, side) === 1, entered: true });
      continue;
    }
    for (let i = 0; i < POINTS; i++) {
      if (countAt(st, i, side) <= 0) continue;
      const to = i + dir(side) * d;
      if (to < 0 || to >= POINTS) {            // حرکت به بیرون
        if (!bearing) continue;
        const dd = distOff(side, i);
        if (dd === d || (dd < d && isFarthestPoint(st, side, i))) {
          out.push({ die: d, dieIdx: di, from: i, to: null, hit: false, entered: false });
        }
        continue;
      }
      if (isBlocked(st, to, side)) continue;
      // در مرحلهٔ خروج، مهره نباید از خانه بیرون برود (خودکار رعایت می‌شود)
      if (bearing && !isHomeIdx(side, to)) continue;
      out.push({ die: d, dieIdx: di, from: i, to, hit: enemyAt(st, to, side) === 1, entered: false });
    }
  }
  void s;
  return out;
}

export function hasAnyMove(st, side, dice) { return legalMoves(st, side, dice).length > 0; }

/**
 * اجرای یک حرکت روی state (تغییر مستقیم) و برگرداندن رویدادها برای انیمیشن.
 */
export function applyMove(st, side, mv) {
  const s = sign(side);
  const ev = {
    type: 'move', from: mv.from, to: mv.to, die: mv.die, side,
    hit: false, hitSide: -1, madePoint: false, borne: mv.to === null, entered: mv.from === -1,
  };
  if (mv.from === -1) st.bar[side] = Math.max(0, st.bar[side] - 1);
  else st.pts[mv.from] -= s;

  if (mv.to === null) { st.off[side]++; return [ev]; }

  if (enemyAt(st, mv.to, side) === 1) {       // زدن (زدن مهرهٔ تنها)
    st.bar[1 - side]++;
    st.pts[mv.to] = 0;
    ev.hit = true;
    ev.hitSide = 1 - side;
    if (st.noHit > 0) ev.noBreak = true;
    st.noHit = 0;
  }
  st.pts[mv.to] += s;
  if (countAt(st, mv.to, side) === 2 && ev.hit) ev.madePoint = true;
  return [ev];
}

/**
 * تولید همهٔ «دست‌های کامل» (ترکیب ترتیبی از حرکت‌ها) با بیشترین استفاده از تاس.
 * @returns {Array<Array<object>>} هر عضو یک ترتیب حرکت است
 */
export function sequences(st, side, dice, opts = {}) {
  const capLeaves = opts.capLeaves || 900;
  const all = [];
  const seen = new Set();
  let nodes = 0;
  let bestLen = 0;

  const rec = (state, left, acc, keys) => {
    if (++nodes > 40000 || all.length > capLeaves * 4) return;
    const moves = legalMoves(state, side, left);
    let extended = false;
    for (const m of moves) {
      extended = true;
      const ns = clone(state);
      applyMove(ns, side, m);
      const nl = left.slice();
      nl.splice(m.dieIdx, 1);
      rec(ns, nl, acc.concat([m]), keys.concat([`${m.from}>${m.to}:${m.die}`]));
    }
    if (!extended) {
      if (acc.length < bestLen) all.length = all.length; // نگه‌داشتن همه، بعداً فیلتر می‌شود
      const key = keys.slice().sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      if (acc.length > bestLen) bestLen = acc.length;
      all.push({ seq: acc, key, len: acc.length });
    }
  };
  rec(clone(st), dice.slice(), [], []);
  if (bestLen === 0) return [];              // هیچ حرکتی ممکن نیست (رد شدن تاس)
  return all.filter((x) => x.len === bestLen).map((x) => x.seq);
}

/** اجرای یک ترتیب حرکت و برگرداندن رویدادها */
export function playSequence(st, side, seq) {
  const evs = [];
  for (const m of seq) evs.push(...applyMove(st, side, m));
  return evs;
}

export function pipCount(st, side) {
  let p = st.bar[side] * 25 - st.off[side] * 1;
  for (let i = 0; i < POINTS; i++) {
    const c = countAt(st, i, side);
    if (c) p += c * distOff(side, i);
  }
  return p;
}

/** وضعیت پایان: null یعنی ادامه دارد */
export function gameResult(st) {
  const res = [];
  for (const side of [SIDE_WHITE, SIDE_BLACK]) {
    if (st.off[side] === CHECKERS) {
      const other = 1 - side;
      const loserOff = st.off[other];
      let mult = 1, kind = 'normal';
      if (loserOff === 0) {
        const loserInWinnerHome =
          st.bar[other] > 0 ||
          st.pts.some((v, i) => {
            const c = other === SIDE_WHITE ? Math.max(0, v) : Math.max(0, -v);
            return c > 0 && isHomeIdx(side, i);
          });
        if (loserInWinnerHome) { kind = 'backgammon'; mult = 3; }
        else { kind = 'gammon'; mult = 2; }
      }
      return { winner: side, kind, mult };
    }
    void res;
  }
  return null;
}

export function rollDie() { return 1 + Math.floor(Math.random() * 6); }
export function rollDice() {
  const a = rollDie(), b = rollDie();
  return { dice: a === b ? [a, a, a, a] : [a, b], pair: a === b, raw: [a, b] };
}

/** توضیح فارسی یک حرکت، برای لاگ */
export function describeMove(mv, side) {
  if (mv.from === -1) return mv.to === null ? 'خروج از وسط' : `ورود از وسط به تی ${pointNo(side, mv.to)}`;
  const a = `تی ${pointNo(side, mv.from)}`;
  return mv.to === null ? `${a} → خارج از بازی (تاس ${mv.die})` : `${a} → ${pointNo(side, mv.to)}`;
}
