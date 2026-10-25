/**
 * تختهٔ پولی — کنترلر میز: تاس، حرکت، کعب دبل، ساعت هر حرکت، تسویهٔ نقدی
 * و تعویض تخته در هر دست (تم تازه با هر بازی).
 */
import {
  newGame, clone, applyMove, sequences, gameResult, rollDice, describeMove, canBearOff,
  SIDE_WHITE, SIDE_BLACK,
} from './engine.js';
import { chooseMoves, shouldDouble, shouldAccept, evaluate } from './ai.js';
import { THEMES } from './themes.js';
import { settle, you, byId } from './tournament.js';

const OFF_KEY = 'off';

export class Table {
  constructor(app) {
    this.app = app;
    this.view = app.view;
    this.st = newGame();
    this.turn = SIDE_WHITE;
    this.raw = [];            // دو تاس نمایشی
    this.pool = [];           // تاس‌های قابل بازی (۴ تا هنگام دوبل)
    this.rem = [];            // ترتیب‌های هنوز ممکن
    this.chosen = [];
    this.selFrom = null;
    this.phase = 'idle';     // idle | ready | rolling | you | opp | double | over
    this.cube = 1;
    this.cubeOwner = -1;
    this.offer = null;
    this.deadline = 0;
    this.oppId = null;
    this.themeIdx = Math.floor(Math.random() * THEMES.length);
    this.round = 0;
    this.pair = false;
    this.undoStack = [];
    this.result = null;
    this.view.onPoint = (idx) => this.onPoint(idx);
    this.view.onRoll = () => { if (this.phase === 'ready' && this.turn === SIDE_WHITE) this.roll(); };
    this.view.onCube = () => this.askDouble();
  }

  get s() { return this.app.state; }
  get cfg() { return this.s.config; }
  get practice() { return !!this.cfg.practice; }
  get pot() { return this.cfg.stake * this.cube; }
  get busy() { return this.phase === 'rolling' || this.phase === 'opp' || this.phase === 'double'; }
  /** مهلت یک‌روزه باز است؟ (در حالت دوستانه همیشه باز) */
  get dayOpen() { return this.practice || this.app.phase() === 'play'; }
  dayClosed() {
    this.app.toast('مهلت یک‌روزه تمام شد — جدول بسته شد. یک فصل تازه بساز.', 'bad', 4800);
    return false;
  }
  get tempo() { return this.app?.cfg?.tempo ?? 1; }
  /** ریتم: همهٔ تأخیرها و انیمیشن‌ها را کش می‌دهد (برای تماشای آرام یا بازی تند) */
  T(ms) { this.view.tempo = this.tempo; return Math.max(8, ms * this.tempo); }

  theme() { return THEMES[this.themeIdx]; }

  /* --------------------------------------------------------------- دست تازه */
  newRound(oppId) {
    if (!this.dayOpen && !this.practice) { this.app.dayOverModal(); return this; }
    this.round++;
    if (this.cfg.theme === 'auto') this.themeIdx = (this.themeIdx + 1) % THEMES.length;
    else this.themeIdx = Math.max(0, THEMES.findIndex((t) => t.id === this.cfg.theme));
    const theme = this.theme();
    this.app.applyTheme(theme);
    if (this.round > 1) this.app.swapBoard(theme);   // هر دست، یک تختهٔ تازه

    this.st = newGame();
    this.turn = Math.random() < 0.5 ? SIDE_WHITE : SIDE_BLACK;
    this.cube = 1; this.cubeOwner = -1; this.offer = null; this.result = null;
    this.raw = []; this.pool = []; this.rem = []; this.chosen = []; this.selFrom = null;
    this.undoStack = [];
    this.oppId = oppId || this.oppId || this.app.opponentChoice();
    this.view.setTheme(theme);
    this.view.setGame(this.st);
    this.view.setCube(this.cube, -1);
    this.view.setDice([], -1);
    this.view.setHints({ sources: new Set(), targets: new Map(), selected: null, lastMove: null, noMove: 0, bearOff: false });
    const opp = byId(this.s, this.oppId);
    this.app.log(`دست ${this.round} · تختهٔ ${theme.name} ${theme.sub} · حریف: ${opp?.name || '—'}`, 'sys');
    this.app.render();
    if (this.turn === SIDE_WHITE) { this.phase = 'ready'; this.app.setMoveClock(0, 1); }
    else { this.phase = 'opp'; this.scheduleBot(900); }
    return this;
  }

  /* --------------------------------------------------------------- تاس ریختن */
  roll() {
    if (this.phase !== 'ready' || this.turn !== SIDE_WHITE) return;
    if (!this.dayOpen) return this.dayClosed();
    this.beginRoll(SIDE_WHITE);
  }

  beginRoll(side) {
    this.app.sfx.roll();
    const { raw, dice, pair } = rollDice();
    this.raw = raw; this.pool = dice.slice(); this.pair = pair;
    this.app.render();
    this.view.setDice(raw, side);
    this.phase = 'rolling';
    this.chosen = []; this.selFrom = null; this.undoStack = [];
    setTimeout(() => this.afterRoll(), this.T(620));
  }

  afterRoll() {
    const dice = this.pool;
    const seqs = sequences(this.st, this.turn, dice);
    if (!seqs.length) {
      this.app.log(this.pair ? 'دوبلِ بی‌حرکت! تاس رد شد' : 'هیچ حرکتی ممکن نیست — تاس رد شد', 'warn');
      this.app.sfx.tap();
      this.view.setHints({ noMove: performance.now() + this.T(1000) });
      this.app.render();
      setTimeout(() => { if (this.phase === 'rolling' || this.phase === 'you' || this.phase === 'opp') this.endTurn(); }, this.T(950));
      this.phase = 'rolling';
      return;
    }
    this.rem = seqs;
    if (this.pair) this.app.log('دوبل! چهار حرکت در اختیار داری', 'good');
    if (this.turn === SIDE_BLACK) { this.botPlay(); return; }
    if (seqs.length === 1) { this.phase = 'you'; this.autoTurn(); return; }
    this.phase = 'you';
    this.setClock(this.cfg.moveClock);
    this.updateHints();
    this.app.render();
  }

  autoTurn(gap = 130) {
    const seq = this.rem[0];
    if (!seq || !seq.length) return this.endTurn();
    const mv = seq[0];
    setTimeout(() => {
      if (this.phase !== 'you') return;
      this.applyPlayerMove(mv.from, mv.to);
      if (this.phase === 'you' && this.rem.length) this.autoTurn(gap);
    }, this.T(gap));
  }

  botPlay() {
    const opp = byId(this.s, this.oppId);
    const skill = opp?.skill === 'easy' ? 'medium' : (opp?.skill || this.cfg.ai || 'hard');
    const best = chooseMoves(this.st, SIDE_BLACK, this.pool, skill);
    const seq = best?.seq || [];
    let delay = 60;
    for (const mv of seq) {
      const evs = applyMove(this.st, SIDE_BLACK, mv);
      this.view.animate(this.flights(evs, delay));
      if (evs.some((e) => e.hit)) this.app.sfx.hit(); else this.app.sfx.tap();
      this.app.log(`حریف: ${describeMove(mv, SIDE_BLACK)}`, 'opp');
      delay += 250 * this.tempo;
    }
    this.app.render();
    setTimeout(() => { if (this.phase === 'opp') this.endTurn(); }, this.T(Math.max(420, delay + 140)));
    this.phase = 'opp';
  }

  /* --------------------------------------------------------------- انتخاب حرکت */
  firsts() {
    const map = new Map();
    for (const seq of this.rem) {
      const m = seq[0];
      if (m) map.set(this.moveKey(m.from, m.to), m);
    }
    return map;
  }
  moveKey(from, to) { return `${from}>${to === null ? OFF_KEY : to}`; }

  onPoint(idx) {
    if (this.phase !== 'you') return;
    const map = this.firsts();
    const sources = new Set([...map.values()].map((m) => m.from));
    const targetsHere = [...map.values()].filter((m) => (m.to === null ? idx === null : m.to === idx));

    // ۱) اگر مقصد مشخص است و منبعی انتخاب شده باشد → اجرا
    if (this.selFrom !== null) {
      const mv = map.get(this.moveKey(this.selFrom, idx));
      if (mv) { const from = this.selFrom; this.selFrom = null; this.applyPlayerMove(from, idx); return; }
    }
    // ۲) کلیک روی منبع خودی → انتخاب
    if (sources.has(idx)) {
      this.selFrom = idx;
      this.app.sfx.tap();
      this.updateHints();
      this.app.render();
      return;
    }
    // ۳) مقصدِ یکتا → بی‌درنگ اجرا شود
    if (targetsHere.length) {
      const uniq = new Set(targetsHere.map((m) => m.from));
      if (uniq.size === 1) { this.applyPlayerMove([...uniq][0], idx); return; }
    }
    // ۴) کلیک روی سینی خروج، وقتی خروج مجاز است
    if (idx === null && canBearOff(this.st, SIDE_WHITE)) {
      const off = [...map.values()].find((m) => m.to === null);
      if (off) { this.applyPlayerMove(off.from, null); return; }
    }
    this.selFrom = null;
    this.updateHints();
    this.app.render();
  }

  /** دکمهٔ «خارج کردن» در پنل کناری */
  bearOffBest() {
    if (this.phase !== 'you') return;
    const mv = [...this.firsts().values()].find((m) => m.to === null);
    if (!mv) { this.app.toast('الان چیزی برای خارج کردن نیست', 'warn'); return; }
    this.applyPlayerMove(mv.from, null);
  }

  /** دکمهٔ «بهترین حرکت» */
  playBest() {
    if (this.phase !== 'you') return;
    const best = chooseMoves(this.st, SIDE_WHITE, this.leftDice(), 'hard');
    const mv = best?.seq?.[0];
    if (!mv) return;
    this.applyPlayerMove(mv.from, mv.to);
  }

  leftDice() {
    const seq = this.rem[0] || [];
    return seq.map((m) => m.die);
  }

  applyPlayerMove(from, to) {
    const idx = [];
    this.rem.forEach((seq, i) => {
      const m = seq[0];
      if (m && m.from === from && String(m.to) === String(to)) idx.push(i);
    });
    if (!idx.length) return false;
    const mv = this.rem[idx[0]][0];
    this.undoStack.push({ st: clone(this.st), rem: this.rem.map((s) => s.slice()) });
    const evs = applyMove(this.st, SIDE_WHITE, mv);
    this.chosen.push(mv);
    this.rem = idx.map((i) => this.rem[i].slice(1)).filter((s) => s.length > 0);
    this.selFrom = null;
    this.view.animate(this.flights(evs, 0));
    if (evs.some((e) => e.hit)) { this.app.sfx.hit(); this.app.onHit(); }
    else if (mv.to === null) this.app.sfx.enter();
    else this.app.sfx.tap();
    this.app.log(`شما: ${describeMove(mv, SIDE_WHITE)}${evs.some((e) => e.madePoint) ? ' — تی بسته شد' : ''}`, 'you');
    const done = !this.rem.length;
    if (done) this.endTurn();
    else { this.updateHints(); this.app.render(); }
    return true;
  }

  undo() {
    if (this.phase !== 'you') return;
    const u = this.undoStack.pop();
    if (!u) { this.app.toast('چیزی برای برگشتن نیست', 'warn'); return; }
    const mv = this.chosen.pop();
    this.st = u.st; this.rem = u.rem; this.selFrom = null;
    this.view.animate([]);
    this.view.setGame(this.st);
    this.updateHints(); this.app.render();
    if (mv) this.app.log(`«${describeMove(mv, SIDE_WHITE)}» برگشت`, 'sys');
  }

  hint() {
    if (this.phase !== 'you' || !this.rem.length) return;
    const best = chooseMoves(this.st, SIDE_WHITE, this.leftDice(), 'hard');
    const m = best?.seq?.[0];
    if (!m) return;
    this.view.flashPoint(m.from, this.theme().hint, 700);
    if (m.to !== null) this.view.flashPoint(m.to, this.theme().glow, 760);
    this.app.toast(`استاد: ${describeMove(m, SIDE_WHITE)}`, 'info');
  }

  /** هایلایت تی‌های منبع و مقصد روی بوم */
  updateHints() {
    const ms = [...this.firsts().values()];
    const sources = new Set(ms.map((m) => m.from));
    const targets = new Map();
    for (const m of ms) {
      if (this.selFrom !== null && m.from !== this.selFrom) continue;
      targets.set(m.to === null ? -99 : m.to, { die: m.die, hit: m.hit });
    }
    this.view.setGame(this.st);
    this.view.setHints({
      sources, targets, selected: this.selFrom,
      bearOff: ms.some((m) => m.to === null),
    });
  }

  /* --------------------------------------------------------------- کعب دبل */
  askDouble() {
    if (!this.dayOpen) return this.dayClosed();
    if (this.practice) { this.app.toast('در بازی دوستانه کعب دبل وجود ندارد', 'warn'); return; }
    if (this.phase !== 'ready' || this.turn !== SIDE_WHITE) { this.app.toast('فقط پیش از تاس ریختن می‌توانی دبل کنی', 'warn'); return; }
    if (this.cube >= 64 || this.cubeOwner === SIDE_BLACK) { this.app.toast('کعب الان در اختیار حریف است', 'warn'); return; }
    const skill = byId(this.s, this.oppId)?.skill || 'hard';
    if (!shouldAccept(this.st, SIDE_BLACK, skill)) {
      this.app.log('دبل را پیشنهاد دادی؛ حریف نپذیرفت و بازی را واگذار کرد', 'good');
      this.view.setCube(this.cube, SIDE_WHITE);
      this.finish(SIDE_WHITE, { kind: 'normal', resign: true });
      return;
    }
    this.cube *= 2; this.cubeOwner = SIDE_WHITE;
    this.view.setCube(this.cube, SIDE_WHITE);
    this.app.sfx.point();
    this.app.log(`دبل پذیرفته شد — کعب ${this.cube}، شرط ${this.pot.toLocaleString('fa-IR')} تومان`, 'good');
    this.beginRoll(SIDE_WHITE);
  }

  botMayDouble() {
    if (this.practice || this.cube >= 64 || this.cubeOwner === SIDE_WHITE) return false;
    const skill = byId(this.s, this.oppId)?.skill || this.cfg.ai;
    return shouldDouble(this.st, SIDE_BLACK, this.cube, skill);
  }

  botOfferDouble() {
    this.offer = { by: SIDE_BLACK, to: SIDE_WHITE, value: this.cube * 2 };
    this.phase = 'double';
    this.app.onDoubleOffer(this.offer);
  }

  answerDouble(accept) {
    const o = this.offer; this.offer = null;
    this.app.closeDoubleModal();
    if (!o) return;
    if (accept) {
      this.cube = o.value; this.cubeOwner = SIDE_BLACK;
      this.view.setCube(this.cube, SIDE_BLACK);
      this.app.sfx.point();
      this.app.log(`دبل حریف را پذیرفتی — کعب ${this.cube}`, 'warn');
      this.phase = 'opp';
      this.beginRoll(SIDE_BLACK);
    } else {
      this.app.log('دبل را پس زدی؛ بازی را واگذار کردی', 'bad');
      this.finish(SIDE_BLACK, { kind: 'normal', resign: true });
    }
  }

  resign() {
    if (this.phase === 'over' || this.phase === 'idle') return;
    this.app.log('تسلیم شدی — شرط به حریف رسید', 'bad');
    this.finish(SIDE_BLACK, { kind: 'normal', resign: true });
  }

  scheduleBot(ms) {
    clearTimeout(this._bt);
    this._bt = setTimeout(() => {
      if (this.phase !== 'opp') return;
      if (this.botMayDouble() && Math.random() < 0.55) { this.botOfferDouble(); return; }
      this.phase = 'ready';
      this.beginRoll(SIDE_BLACK);
    }, this.T(ms));
  }

  /* --------------------------------------------------------------- پایان نوبت */
  endTurn() {
    this.setClock(0);
    const r = gameResult(this.st);
    if (r) { this.finish(r.winner, { kind: r.kind }); return; }
    this.view.setDice([], -1);
    this.selFrom = null;
    this.view.setHints({ sources: new Set(), targets: new Map(), selected: null, lastMove: null });
    this.turn = 1 - this.turn;
    this.rem = []; this.pool = []; this.raw = [];
    this.app.render();
    if (this.turn === SIDE_WHITE) { this.phase = 'ready'; this.app.setMoveClock(0, 1); }
    else { this.phase = 'opp'; this.scheduleBot(620); }
  }

  /** پرواز مهره‌ها روی بوم */
  flights(evs, delay = 0) {
    const out = [];
    evs.forEach((e, i) => {
      out.push({
        side: e.side, from: e.from, to: e.to,
        kind: e.borne ? 'off' : e.entered ? 'enter' : 'move',
        delay: delay + i * 250, dur: 300,
      });
      if (e.hit) out.push({ side: e.hitSide, from: e.to, to: -1, kind: 'hit', delay: delay + i * 250 + 130, dur: 280 });
    });
    return out;
  }

  /* --------------------------------------------------------------- تسویه */
  finish(winnerSide, { kind = 'normal', resign = false } = {}) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.setClock(0);
    this.result = { kind, cube: this.cube, resign, winnerSide };
    const youWon = winnerSide === SIDE_WHITE;
    const oppId = this.oppId;
    const res = { kind, cube: this.cube, resign, youWon, opponent: byId(this.s, oppId)?.name || 'حریف' };
    if (this.practice) {
      res.amt = 0; res.bonus = 0;
      this.app.log(`بازی دوستانه تمام شد — ${youWon ? 'برد' : 'باخت'}`, youWon ? 'good' : 'bad');
    } else {
      const r = settle(this.s, youWon ? 'you' : oppId, youWon ? oppId : 'you', {
        kind: resign ? 'normal' : kind, cube: this.cube, reason: resign ? 'تسلیم/رد دبل' : 'پایان بازی',
      });
      res.amt = (youWon ? 1 : -1) * r.amt;
      res.bonus = r.bonus || 0;
    }
    this.app.stats({
      games: 1, wins: youWon ? 1 : 0, losses: youWon ? 0 : 1,
      gammons: kind === 'gammon' || kind === 'backgammon' ? 1 : 0,
      backgammons: kind === 'backgammon' ? 1 : 0,
      net: res.amt || 0, bonus: res.bonus || 0, forced: resign ? 1 : 0,
      hands: 1,
    });
    this.app.sfx[youWon ? 'win' : 'lose']();
    this.app.setMoveClock(0, 1);
    res.rank = this.app.rank();
    res.cash = you(this.s)?.cash || 0;
    res.stake = this.cfg.stake * this.cube * (kind === 'backgammon' ? 3 : kind === 'gammon' ? 2 : 1);
    this.app.onRoundOver(res);
  }

  /* --------------------------------------------------------------- ساعت حرکت */
  setClock(ms) { this.deadline = ms ? performance.now() + ms : 0; }

  tickClock(now) {
    if (this.phase !== 'you' || !this.deadline) return;
    const left = this.deadline - now;
    const secs = Math.ceil(left / 1000);
    if (secs !== this._lastSec) {
      this._lastSec = secs;
      if (left < 5100 && left > 0) this.app.sfx.tick();
    }
    this.app.setMoveClock(Math.max(0, left), this.cfg.moveClock);
    if (left > 0) return;
    this.deadline = 0;
    this.app.log('زمان حرکت تمام شد — حرکت خودکار', 'warn');
    this.app.sfx.alarm();
    let guard = 0;
    while (this.phase === 'you' && this.rem.length && guard++ < 6) {
      const best = chooseMoves(this.st, SIDE_WHITE, this.leftDice(), this.cfg.ai || 'hard');
      const mv = best?.seq?.[0];
      if (!mv || !this.applyPlayerMove(mv.from, mv.to)) break;
    }
    if (this.phase === 'you') this.endTurn();
  }

  /** برتری تقریبی برای نوار «کفهٔ بازی» */
  advantage() {
    const e = evaluate(this.st, SIDE_WHITE) - evaluate(this.st, SIDE_BLACK);
    return Math.max(-1, Math.min(1, e / 160));
  }

  /** خلاصهٔ وضعیت برای پنل کناری */
  summary() {
    const home = canBearOff(this.st, SIDE_WHITE);
    return {
      turn: this.turn, phase: this.phase, cube: this.cube, pot: this.pot,
      remaining: this.rem[0]?.length || 0, home, theme: this.theme(),
      round: this.round, opponent: this.oppId, adv: this.advantage(),
    };
  }
}
