/**
 * تختهٔ پولی — اقتصاد مسابقه
 * ------------------------------------------------------------------
 * • ورودی ۵۰٬۰۰۰ تومان، از یک هفته پیش باز است و تا لحظهٔ شروع مسابقه گرفته می‌شود
 * • هر بازی ۲۰٬۰۰۰ تومان؛ بردِ حریف = گرفتن پولش (مرس ×۲، تخته ×۳، دبل ×۲^k)
 * • ۱۵ بازیکن دیگر هم سراسر روز با هم بازی می‌کنند و پول‌ها جابه‌جا می‌شود
 * • مهلت یک‌روزه؛ در پایان، سه نفر با بیشترین پول می‌مانند: ۱۰م / ۵م / ۱م تومان
 */
import { newGame, gameResult, rollDice, SIDE_WHITE, SIDE_BLACK } from './engine.js';
import { quickTurn, shouldAccept } from './ai.js';

export const KEY = 'takhte-pooli:v1';

export const RULES = {
  entry: 50_000,             // ورودی فصل (یک هفته قبل گرفته می‌شود)
  stake: 20_000,            // هر بازی
  dayMs: 24 * 60 * 60 * 1000,
  regWindow: 7 * 24 * 60 * 60 * 1000,
  prizes: [10_000_000, 5_000_000, 1_000_000],
  moveClock: 20_000,        // ثانیه برای هر حرکت (به وقت واقعی)
  streakBonuses: [[3, 50_000], [5, 150_000], [8, 400_000]],
  gammonBonus: 30_000,
  backgammonBonus: 100_000,
  botCash: [120_000, 1_450_000],
  yourCash: 500_000,
  walletStart: 3_500_000,
  tempo: 1,                     // ضریب ریتم انیمیشن (کمتر = تندتر)
  simEveryMs: 100_000,       // هر ~۱٫۷ دقیقهٔ مجازی، میزهای ربات‌ها یک دست بازی می‌کنند
  maxGamesPerTick: 6,
  sponsor: 15_200_000,       // حمایت بازار روی صندوق جوایز
};

const BOTS = [
  ['استاد رجبی', 'master', '🎩'], ['قاسم تاس‌انداز', 'hard', '🎲'], ['مراد ۶-۵', 'hard', '🐎'],
  ['شیرین بیگم', 'master', '🪻'], ['حمید لنگر', 'medium', '⚓'], ['نرگس فیروزه', 'hard', '💎'],
  ['بابک مهره‌چین', 'medium', '🪵'], ['یاسر دبل', 'hard', '⚡'], ['پرویز بازار', 'medium', '🏺'],
  ['میترا کاشی', 'master', '🧿'], ['رضا زرافشان', 'medium', '🌾'], ['سمانه یلدا', 'hard', '🍉'],
  ['کامران تبریزی', 'medium', '🌲'], ['هستی همایون', 'hard', '🦁'], ['بهرام سفرهٔ هفت', 'easy', '🕯'],
];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ------------------------------------------------------------------ state */
export function freshSeason(cfg = RULES, mode = 'live') {
  const wall = Date.now();
  const startAt = mode === 'reg' ? wall + 3 * 864e5 : wall;
  const endAt = startAt + cfg.dayMs;
  const players = [{
    id: 'you', name: 'شما', bot: false, skill: 'hard', avatar: '🎯',
    cash: cfg.yourCash, wins: 0, losses: 0, gammons: 0, backgammons: 0,
    streak: 0, best: 0, played: 0, color: '#e2ae41',
  }];
  for (const [name, skill, avatar] of BOTS) {
    players.push({
      id: name, name, bot: true, skill, avatar,
      cash: Math.round(rnd(...cfg.botCash) / 1000) * 1000,
      wins: 0, losses: 0, gammons: 0, backgammons: 0, streak: 0, best: 0, played: 0,
      color: `hsl(${Math.round(Math.random() * 360)} 62% 58%)`,
    });
  }
  return {
    id: `S${new Date(startAt).getFullYear()}-${Math.floor(startAt / 864e5)}`,
    startAt, endAt, regOpenAt: startAt - cfg.regWindow,
    vNow: mode === 'reg' ? startAt - 3 * 864e5 : startAt, wallRef: wall,
    vRef: mode === 'reg' ? startAt - 3 * 864e5 : startAt,
    players, history: [], closed: false, payouts: null,
    speed: mode === 'live' ? 20 : mode === 'reg' ? 60 : 600,
    registered: mode !== 'reg', cancelled: 0,
    ledger: mode === 'reg' ? [] : [{
      t: startAt - cfg.regWindow, label: 'پرداخت ورودی فصل — میز ۱۶ نفره', amt: -cfg.entry,
    }],
  };
}

export function defaultState(mode = 'live') {
  const season = freshSeason(RULES, mode);
  return {
    v: 1,
    config: {
      ...RULES, sound: true, ai: 'hard', theme: 'auto', practice: false,
      streakBonuses: RULES.streakBonuses.map(([a, b]) => [a, b]),
      prizes: RULES.prizes.slice(),
    },
    wallet: RULES.walletStart - (mode === 'reg' ? 0 : RULES.entry),
    nick: 'شما',
    season,
    archive: [],
    stats: {
      games: 0, wins: 0, losses: 0, gammons: 0, backgammons: 0, maxStreak: 0,
      net: 0, bonus: 0, hands: 0, hits: 0, forced: 0,
    },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const raw0 = JSON.parse(raw);
    const s = raw0;
    if (!s || s.v !== 1 || !s.season) return defaultState();
    // جلو بردن ساعت مجازی به اندازهٔ زمانی که نبودیم (با سقف، تا فصلِ بعدی نجنگیم)
    const dt = Math.max(0, Date.now() - (s.season.wallRef || Date.now()));
    const caught = s.season.vNow + dt * (s.season.speed || 1);
    s.season.vNow = Math.min(caught, s.season.endAt + 3 * 3600e3);
    s.season.wallRef = Date.now();
    s.season.vRef = s.season.vNow;
    // مهاجرت نسخه‌های ناقص
    s.season.ledger ||= [{ t: s.season.startAt - RULES.regWindow, label: 'پرداخت ورودی فصل — میز ۱۶ نفره', amt: -RULES.entry }];
    s.season.cancelled ||= 0;
    s.stats = { games: 0, wins: 0, losses: 0, gammons: 0, backgammons: 0, maxStreak: 0, net: 0, bonus: 0, hands: 0, hits: 0, forced: 0, ...s.stats };
    s.config = { ...RULES, sound: true, ai: 'hard', theme: 'auto', practice: false, ...s.config };
    return s;
  } catch { return defaultState(); }
}

export function saveState(s) {
  try {
    s.season.wallRef = Date.now();
    s.season.vRef = s.season.vNow;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* حافظی پُر باشد، بازی ادامه دارد */ }
}

/* ------------------------------------------------------------------ clock */
/** ساعت مسابقه با ضریب سرعت جلو می‌رود (برای دمو و شبیه‌سازی روز) */
export function tickClock(s, realMs) {
  const sp = s.season.speed || 1;
  s.season.vNow = (s.season.vNow || Date.now()) + realMs * sp;
  return s.season.vNow;
}

export function phaseOf(s) {
  const { vNow, regOpenAt, startAt, endAt, closed } = s.season;
  if (closed || vNow >= endAt) return 'closed';
  if (vNow >= startAt) return 'play';
  if (vNow >= regOpenAt) return 'reg';
  return 'soon';
}

export const remainingMs = (s) => Math.max(0, s.season.endAt - s.season.vNow);
export const regRemainingMs = (s) => Math.max(0, s.season.startAt - s.season.vNow);
export const dayProgress = (s) =>
  Math.max(0, Math.min(1, (s.season.vNow - s.season.startAt) / (s.season.endAt - s.season.startAt)));

/* ---------------------------------------------------------------- money */
export const byId = (s, id) => s.season.players.find((p) => p.id === id);
export const you = (s) => byId(s, 'you');
export const solvable = (s, p) => p.cash >= s.config.stake;

export function table(s) {
  return s.season.players.filter((p) => p.cash >= s.config.stake);
}

export function leaderboard(s) {
  return [...s.season.players].sort((a, b) =>
    b.cash - a.cash || b.wins - a.wins || b.backgammons - a.backgammons ||
    a.name.localeCompare(b.name, 'fa'));
}

export function rankOf(s, id = 'you') {
  return leaderboard(s).findIndex((p) => p.id === id) + 1;
}

export function prizeFund(s) {
  const entries = s.config.entry * s.season.players.length;
  return { entries, sponsor: s.config.sponsor, total: entries + s.config.sponsor };
}

/** پرداختِ نتیجهٔ یک بازی بین دو بازیکن (به تومان) */
export function settle(s, winnerId, loserId, { kind = 'normal', cube = 1, reason = 'برد' }) {
  const W = byId(s, winnerId), L = byId(s, loserId);
  if (!W || !L) return { amt: 0 };
  const mult = kind === 'backgammon' ? 3 : kind === 'gammon' ? 2 : 1;
  const want = s.config.stake * cube * mult;
  const amt = Math.min(want, Math.max(0, L.cash));            // همهٔ پولِ حریف، اگر کمتر بود
  L.cash -= amt; W.cash += amt;
  W.wins++; W.streak = Math.max(0, W.streak + 1); W.best = Math.max(W.best, W.streak);
  L.losses++; L.streak = Math.min(0, L.streak - 1); L.played++; W.played++;
  if (kind === 'gammon') W.gammons++;
  if (kind === 'backgammon') { W.gammons++; W.backgammons++; }
  let bonus = 0; const bonuses = [];
  for (const [n, b] of s.config.streakBonuses) {
    if (W.streak === n) { bonus += b; bonuses.push(`${n} برد پیاپی`); }
  }
  if (kind === 'gammon') { bonus += s.config.gammonBonus; bonuses.push('مرس'); }
  if (kind === 'backgammon') { bonus += s.config.backgammonBonus; bonuses.push('تختهٔ تمام‌عیار'); }
  if (bonus) { W.cash += bonus; }
  s.season.history.unshift({
    t: s.season.vNow, w: W.name, l: L.name, amt, kind, cube, bonuses, reason,
    you: winnerId === 'you' || loserId === 'you',
  });
  if (s.season.history.length > 140) s.season.history.length = 140;
  return { amt, bonus, mult };
}

/** بازی نیمه‌تمامِ پایانِ مهلت: شرط برمی‌گردد و در جریان فصل ثبت می‌شود */
export function voidGame(s, aId, bId, amt, why) {
  const A = byId(s, aId), B = byId(s, bId);
  if (A) A.cash += amt / 2;
  if (B) B.cash += amt / 2;
  s.season.cancelled++;
  s.season.history.unshift({
    t: s.season.vNow, w: '—', l: '—', amt: 0, kind: 'void', cube: 1, bonuses: [],
    reason: why, you: aId === 'you' || bId === 'you',
  });
}

/* --------------------------------------------------- شبیه‌سازی میزهای بقیه */
export function simulateBotGames(s, count) {
  const bots = s.season.players.filter((p) => p.bot && p.cash >= s.config.stake);
  let played = 0;
  for (let k = 0; k < count && bots.length > 1; k++) {
    const a = pick(bots);
    let b = pick(bots);
    let guard = 0;
    while (b === a && guard++ < 8) b = pick(bots);
    if (a === b) continue;
    const r = playFullGame(a.skill, b.skill);
    if (!r) continue;
    settle(s, r.winner === 0 ? a.id : b.id, r.winner === 0 ? b.id : a.id, { kind: r.kind, cube: r.cube });
    played++;
  }
  return played;
}

/** یک دست کاملِ تخته بین دو ربات (برای جدول زنده) */
export function playFullGame(skillA = 'fast', skillB = 'fast', maxTurns = 200) {
  const st = newGame();
  let turn = SIDE_WHITE, cube = 1, cubeOwner = -1, passes = 0;
  for (let i = 0; i < maxTurns; i++) {
    const { dice } = rollDice();
    void skillA; void skillB;
    const { seq } = quickTurn(st, turn, dice, 'fast');
    if (!seq.length) passes++; else passes = 0;
    // کعب دبل: وقتی اختلاف زیاد است و کعب دست حریف نیست
    if (passes < 3 && cube < 16 && Math.random() < 0.06 && st.off[0] + st.off[1] > 6) {
      const other = 1 - turn;
      if (cubeOwner !== other && shouldAccept(st, other, 'medium')) { cube *= 2; cubeOwner = other; }
      else if (cubeOwner === turn) { return { winner: other, kind: 'normal', cube }; }
    }
    const r = gameResult(st);
    if (r) return { winner: r.winner, kind: r.kind, cube, turns: i };
  }
  // بازی‌های خیلی کش‌دار را با پیپ تمام می‌کنیم
  const dist = (sd) => {
    let p = st.bar[sd] * 25;
    for (let j = 0; j < 24; j++) {
      const c = sd === SIDE_WHITE ? Math.max(0, st.pts[j]) : Math.max(0, -st.pts[j]);
      p += c * (sd === SIDE_WHITE ? j + 1 : 24 - j);
    }
    return p - st.off[sd] * 20;
  };
  const w = dist(SIDE_WHITE) <= dist(SIDE_BLACK) ? SIDE_WHITE : SIDE_BLACK;
  return { winner: w, kind: 'normal', cube, turns: maxTurns };
}

/* --------------------------------------------------------------- پایان فصل */
export function closeSeason(s) {
  if (s.season.closed) return s.season.payouts;
  const lb = leaderboard(s);
  const top = lb.slice(0, 3).map((p, i) => ({
    id: p.id, name: p.name, avatar: p.avatar, rank: i + 1, cash: p.cash,
    prize: s.config.prizes[i] || 0,
  }));
  for (const r of top) {
    const p = byId(s, r.id);
    if (p) p.prize = r.prize;
    if (r.id === 'you' && r.prize) {
      s.wallet += r.prize;
      s.season.ledger ||= [];
      s.season.ledger.unshift({ t: s.season.vNow, label: `جایزهٔ نفر ${['اول', 'دوم', 'سوم'][r.rank - 1]}`, amt: r.prize });
      s.stats.bonus = (s.stats.bonus || 0) + r.prize;
    }
  }
  s.season.closed = true;
  s.season.payouts = { top, at: s.season.vNow, entries: s.season.players.length };
  s.archive.unshift({
    id: s.season.id, at: s.season.vNow,
    champion: lb[0]?.name, championCash: lb[0]?.cash,
    yourRank: rankOf(s), yourCash: you(s)?.cash || 0,
    yourPrize: lb[0] && lb[0].id === 'you' ? s.config.prizes[0] : (lb[1]?.id === 'you' ? s.config.prizes[1] : lb[2]?.id === 'you' ? s.config.prizes[2] : 0),
  });
  if (s.archive.length > 20) s.archive.length = 20;
  return s.season.payouts;
}

/* --------------------------------------------------------------- ثبت‌نام */
export function payEntry(s) {
  if (s.wallet < s.config.entry) return { ok: false, why: 'کیف پول کافی نیست' };
  s.wallet -= s.config.entry;
  s.season.registered = true;
  return { ok: true, fee: s.config.entry };
}

export function topUp(s, amt) {
  s.wallet += amt;
  return { ok: true, amt };
}
