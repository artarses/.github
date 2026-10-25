/**
 * تختهٔ پولی — موتور هوش مصنوعی حریف (ارزیابی موقعیت + انتخاب بهترین دست)
 * سطح‌ها: آسان (تصادفی) / متوسط (حریص + نویز) / سخت (ارزیابی کامل) / استاد
 */
import {
  POINTS, SIDE_WHITE, CHECKERS, countAt, enemyAt, distOff, isHomeIdx, clone, applyMove,
  sequences, pipCount, canBearOff, legalMoves,
} from './engine.js';

const HOME_OWN = 6;

/** احتمال تقریبی زده‌شدن یک مهرهٔ تنها (blot) در تی idx توسط حریف */
function blotRisk(st, side, idx) {
  const opp = 1 - side;
  const toward = (opp === SIDE_WHITE) ? -1 : 1; // جهت حرکت حریف
  let ways = 0;
  for (let d = 1; d <= 6; d++) {
    // مهرهٔ حریف در فاصلهٔ d در جهت حرکتش می‌تواند به اینجا برسد
    let from = idx;
    for (let k = 0; k < d; k++) from -= toward;
    if (from < 0 || from >= POINTS) {
      if (d === 6 && st.bar[opp] > 0) ways += 1;   // ورود از وسط
      continue;
    }
    if (countAt(st, from, opp) > 0) ways += 1;
  }
  // تاس جفت شانس را بالا می‌برد؛ تخمین ساده از ۳۶ حالت
  const prob = 1 - Math.pow(1 - Math.min(ways, 6) / 6, 2);
  const inEnemyHome = isHomeIdx(opp, idx) ? 1.45 : 1;
  return prob * 34 * inEnemyHome;
}

/** امتیاز موقعیت از نگاه `side` (هرچه بالاتر، بهتر) */
export function evaluate(st, side) {
  const opp = 1 - side;
  let sc = 0;

  const myPips = pipCount(st, side);
  const opPips = pipCount(st, opp);
  const pipDiff = opPips - myPips;

  // امتیاز مسابقه (race) — هرچه جلوتر، ارزش پیپ بیشتر
  const raceW = st.off[side] > 0 || st.off[opp] > 0 ? 2.3 : 1.5;
  sc += pipDiff * raceW;

  // خانه‌ها و تی‌های بسته
  let myHome = 0, oppHomeBlocked = 0, consecutive = 0, bestPrime = 0, run = 0;
  for (let i = 0; i < POINTS; i++) {
    const mine = countAt(st, i, side);
    if (mine >= 2) {
      run++;
      bestPrime = Math.max(bestPrime, run);
      const w = isHomeIdx(side, i) ? 9 : (isHomeIdx(opp, i) ? 11 : 6.5);
      sc += w + Math.min(mine, 5) * 0.7;
      if (isHomeIdx(side, i)) myHome++;
    } else run = 0;

    if (mine === 1) sc -= 9 + blotRisk(st, side, i);
    const en = enemyAt(st, i, side);
    if (en === 1 && !isHomeIdx(side, i)) sc += 7 + 6 * 0;   // blot حریف = شکار
    if (en === 1 && isHomeIdx(side, i)) sc += 12;
    if (en >= 2 && isHomeIdx(opp, i) === false) oppHomeBlocked += 0;
  }
  sc += bestPrime * bestPrime * 1.15;
  sc += myHome * 1.5;
  void HOME_OWN; void oppHomeBlocked;

  // مهره‌های عقب‌ماندهٔ حریف در خانهٔ من = محاصره
  for (let i = 0; i < 6; i++) {
    const en = enemyAt(st, i, side);
    if (en > 0 && distOff(opp, i) >= 19) sc += 9 * en;
  }
  // مهره‌های عقب‌ماندهٔ خودم = بد
  for (let i = POINTS - 6; i < POINTS; i++) {
    const mine = countAt(st, i, side);
    if (mine > 0 && distOff(side, i) >= 19) sc -= 8 * mine;
  }

  // وسط & خارج‌شده‌ها
  sc += st.bar[opp] * 13;
  sc -= st.bar[side] * 15;
  sc += st.off[side] * 22;
  sc -= st.off[opp] * 22;

  // اگر حریف می‌تواند دبل کند و من عقبم، کمی محافظه‌کارتر
  return sc;
}

const NOISE = { easy: 900, fast: 55, medium: 120, hard: 12, master: 0 };
const CAP = { easy: 12, fast: 26, medium: 120, hard: 420, master: 700 };

/**
 * انتخاب بهترین ترتیب حرکت برای تاس‌های ریخته‌شده.
 * @returns {{seq: Array, score: number}}
 */
export function chooseMoves(st, side, dice, level = 'hard') {
  const seqs = sequences(st, side, dice, { capLeaves: CAP[level] ?? 200 });
  if (!seqs.length) return { seq: [], score: -Infinity };
  if (level === 'easy') {
    const s = seqs[Math.floor(Math.random() * seqs.length)];
    return { seq: s, score: 0 };
  }
  let best = null;
  for (const seq of seqs) {
    const ns = clone(st);
    for (const m of seq) applyMove(ns, side, m);
    let sc = evaluate(ns, side);
    const noise = NOISE[level] ?? 0;
    if (noise) sc += (Math.random() - 0.5) * noise;
    if (!best || sc > best.score) best = { seq, score: sc, state: ns };
  }
  return best;
}

/** آیا حرکتی وجود دارد؟ (برای «رد تاس») */
export function canPlay(st, side, dice) { return legalMoves(st, side, dice).length > 0; }

/** تصمیم منطقی برای دبل کردن: بر پایهٔ اختلاف تقریبی برد */
export function equity(st, side) {
  const pipDiff = pipCount(st, 1 - side) - pipCount(st, side);
  const offDiff = st.off[side] - st.off[1 - side];
  let e = pipDiff / 55 + offDiff * 0.3;
  if (canBearOff(st, side)) e += 0.35;
  if (canBearOff(st, 1 - side)) e -= 0.35;
  return Math.max(-1, Math.min(1, e));
}

export function shouldDouble(st, side, cubeValue, level = 'hard') {
  if (level === 'easy') return false;
  const e = equity(st, side);
  const th = level === 'master' ? 0.30 : level === 'hard' ? 0.36 : 0.45;
  return e > th && cubeValue < 32 && st.off[1 - side] < CHECKERS * 0.6;
}

export function shouldAccept(st, side, level = 'hard') {
  const e = equity(st, side);
  const th = level === 'master' ? -0.42 : level === 'hard' ? -0.34 : -0.2;
  return e > th;
}

/** یک نوبت کامل برای شبیه‌سازی سریع ربات‌ها */
export function quickTurn(st, side, dice, level = 'fast') {
  const { seq } = chooseMoves(st, side, dice, level);
  const evs = [];
  for (const m of seq) evs.push(...applyMove(st, side, m));
  return { seq, evs };
}
