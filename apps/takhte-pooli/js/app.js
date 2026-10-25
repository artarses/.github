/**
 * تختهٔ پولی ۵۰٬۰۰۰ — نقطهٔ ورود رابط کاربری
 * فصلِ یک‌روزه، میزِ پول، جدول زنده، تخته‌های چرخشی و همهٔ سیم‌کشی‌ها.
 */
import {
  loadState, saveState, defaultState, freshSeason, RULES, phaseOf, remainingMs, regRemainingMs,
  dayProgress, leaderboard, rankOf, you, byId, prizeFund, tickClock, simulateBotGames, closeSeason,
  payEntry, topUp, table as solventTable, voidGame,
} from './tournament.js';
import { THEMES, applyThemeVars, themeById } from './themes.js';
import { BoardView } from './board.js';
import { Table } from './table.js';
import { sfx as SFX, setSound } from './sound.js';
import * as F from './format.js';
import { countAt, SIDE_WHITE, SIDE_BLACK, POINTS } from './engine.js';
import { shouldAccept } from './ai.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SILENT = new Proxy({}, { get: () => () => {} });
export const PATTERN_FA = {
  girih: 'گره‌چینی', kashi: 'کاشی هفت‌رنگ', kilim: 'کیلی‌باف', shamsa: 'شمسهٔ طراّحی',
  herati: 'هرتی', kufi: 'آجرکوفی', stars: 'شبِ ستاره', copper: 'مس‌کوبی',
};
/** نوشتن در DOM فقط وقتی HTML عوض شده — تا حلقهٔ ۲۶۰ms، لیست‌ها را از زیر دست در نیاورد */
function put(el, html) {
  if (!el) return false;
  if (el._h === html) return false;
  el._h = html;
  el.innerHTML = html;
  return true;
}
const taunts = [
  ['تاسِ تو بوی بازار می‌دهد 🎲', 'خنده‌ات سرِ بازیِ تمام‌شده است'],
  ['خانه‌ات را حصار می‌کنم 🧱', 'اول مهره‌هایت را خانه کن'],
  ['دبل را می‌پذیری یا می‌گریزی؟', 'کعب دستِ شجاع است'],
  ['امشب پول میز جابه‌جا می‌شود 💰', 'قبول؛ ولی اشک نوحت را نمی‌خرم'],
];

class App {
  constructor() {
    this.state = loadState();
    this.el = {
      board: $('board'), boardWrap: $('boardWrap'), veil: $('boardVeil'), veilTheme: $('veilTheme'),
      log: $('log'), feed: $('feed'), feedFull: $('feedFull'), chat: $('chat'), quickChat: $('quickChat'),
      oppCard: $('oppCard'), stakeCard: $('stakeCard'), bonusCard: $('bonusCard'), advFill: $('advFill'),
      advTxt: $('advTxt'), strip: $('gameStrip'), themeName: $('themeName'), themeSub: $('themeSub'),
      roundMeta: $('roundMeta'), modeMeta: $('modeMeta'), turnFlag: $('turnFlag'), moveClock: $('moveClock'),
      clockTxt: $('clockTxt'), dayClock: $('dayClock'), phasePill: $('phasePill'), walletTxt: $('walletTxt'),
      rankTxt: $('rankTxt'), cashTxt: $('cashTxt'), toasts: $('toasts'), modal: $('modal'), sheet: $('modalSheet'),
      lb: $('lb'), podium: $('podium'), potCard: $('potCard'), prizeHint: $('prizeHint'), onlySolvent: $('onlySolvent'),
      statsGrid: $('statsGrid'), walletGrid: $('walletGrid'), guideBody: $('guideBody'),
      regBanner: $('regBanner'), regTitle: $('regTitle'), regSub: $('regSub'), footSeason: $('footSeason'), footSpeed: $('footSpeed'),
    };
    this.view = new BoardView(this.el.board);
    this.table = new Table(this);
    this.tab = 'table';
    this.logs = [];
    this.simAcc = 0;
    this.cashSnap = new Map();
    this.trail = [];
    this.lastSave = Date.now();
    this.autoNext = true;
    this._nextTimer = null;
    this._seen = 0;
    this.bind();
    const t = this.table.theme();
    this.applyTheme(t);
    this.view.setTheme(t);
    if (this.s.nick && this.s.nick !== 'شما') byId(this.s, 'you').name = this.s.nick;
    this.table.newRound(this.opponentChoice());
    this.renderAll();
    this.loop();
    this.say('پیشکسوت', 'ورودی را یک هفته پیش دادی؛ امشب پولِ بازار جابه‌جا می‌شود. بزن بر سرِ میز.');
  }

  /* ------------------------------------------------------------ ابزار UI */
  get sfx() { return this.state.config.sound ? SFX : SILENT; }
  get cfg() { return this.state.config; }
  get s() { return this.state; }
  logLen() { return this.logs.length; }
  rank() { return rankOf(this.s); }
  rem0() { return this.table.phase === 'you' && this.table.rem.length > 1; }
  phase() { return phaseOf(this.s); }

  dayOverModal() {
    this.openModal(`
      <h2>مهلت یک‌روزه تمام شد</h2>
      <p class="sub">جدول بسته شد و جوایز پرداخته شد. برای بازیِ تازه باید فصل تازه‌ای باز شود — ورودی ${F.toman(this.cfg.entry)} یک هفته قبل از شروع گرفته می‌شود.</p>
      <div class="actions">
        <button class="btn gold" id="domNew">فصل تازه بساز</button>
        <button class="btn" id="domLb">جدول نهایی</button>
      </div>`);
    $('domNew')?.addEventListener('click', () => this.newSeasonModal('live'));
    $('domLb')?.addEventListener('click', () => { this.closeModal(); this.show('board'); this.renderLeaderboard(true); });
  }

  log(msg, kind = 'sys') {
    this.logs.unshift({ msg, kind, t: this.s.season.vNow });
    if (this.logs.length > 90) this.logs.length = 90;
    const html = this.logs.map((l) =>
      `<li class="${l.kind}"><i style="opacity:.55;font-size:10px">${F.jalaliTime(l.t)}</i> ${esc(l.msg)}</li>`).join('');
    this.el.log.innerHTML = html;
  }

  toast(msg, kind = 'info', ms = 3600) {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.innerHTML = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 380); }, ms);
  }

  say(who, text, isYou = false) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${esc(isYou ? this.s.nick : who)}</b> ${esc(text)}`;
    this.el.chat.prepend(li);
    while (this.el.chat.children.length > 7) this.el.chat.lastChild.remove();
    if (!isYou) return;
    const bot = byId(this.s, this.table.oppId);
    if (bot && Math.random() < 0.85) {
      setTimeout(() => this.say(bot.name, pick(taunts[Math.floor(Math.random() * taunts.length)])[1]), 900 + Math.random() * 900);
    }
  }

  applyTheme(t) { applyThemeVars(t); document.body.dataset.theme = t.id; }

  swapBoard(t) {
    const w = this.el.boardWrap;
    w.classList.remove('swap'); void w.offsetWidth; w.classList.add('swap');
    this.el.veil.classList.add('on');
    this.el.veilTheme.textContent = `تختهٔ ${t.name} — ${t.sub}`;
    this.sfx.drum();
    clearTimeout(this._vt);
    this._vt = setTimeout(() => this.el.veil.classList.remove('on'), 620);
  }

  /* ------------------------------------------------------------- سیم‌کشی */
  bind() {
    $$('.tab').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.tab)));
    $('rollBtn').addEventListener('click', () => this.table.roll());
    $('doubleBtn').addEventListener('click', () => this.table.askDouble());
    $('bearBtn').addEventListener('click', () => this.table.bearOffBest());
    $('bestBtn').addEventListener('click', () => this.table.playBest());
    $('undoBtn').addEventListener('click', () => this.table.undo());
    $('hintBtn').addEventListener('click', () => this.table.hint());
    $('resignBtn').addEventListener('click', () => this.confirmResign());
    $('swapBtn').addEventListener('click', () => { this.cfg.theme = 'auto'; this.table.newRound(); this.toast('تخته عوض شد 🎴', 'info'); });
    $('clearLog').addEventListener('click', () => { this.logs = []; this.el.log.innerHTML = ''; });
    $('soundBtn').addEventListener('click', (e) => this.toggleSound(e.currentTarget));
    $('speedBtn').addEventListener('click', () => this.cycleSpeed());
    $('jumpBtn').addEventListener('click', () => this.jumpToEnd());
    $('resetBtn').addEventListener('click', () => this.newSeasonModal());
    $('walletPill').addEventListener('click', () => this.show('wallet'));
    $('rankPill').addEventListener('click', () => this.show('board'));
    $('regBtn').addEventListener('click', () => {
      if (this._bannerMode === 'new') { this.newSeasonModal('live'); return; }
      if (this._bannerMode === 'late') {
        this.cfg.practice = true;
        this.el.regBanner.hidden = true;
        this.toast('حالت دوستانه روشن شد — پولی جابه‌جا نمی‌شود', 'warn');
        this.table.newRound(this.opponentChoice());
        return;
      }
      this.doRegister();
    });
    $('regLater').addEventListener('click', () => { this.el.regBanner.style.display = 'none'; });
    this.el.onlySolvent.addEventListener('change', () => this.renderLeaderboard(true));
    $('quickChat').innerHTML = taunts.map((t, i) => `<button data-i="${i}">${esc(t[0])}</button>`).join('');
    $$('#quickChat button').forEach((b) => b.addEventListener('click', () => {
      this.say('', taunts[+b.dataset.i][0], true); this.sfx.tap();
    }));

    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!this.modalIdle() && e.key !== 'Escape') return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { e.preventDefault(); this.table.phase === 'over' ? this.nextRound() : this.table.roll(); }
      else if (k === 'd') this.table.askDouble();
      else if (k === 'u') this.table.undo();
      else if (k === 'h') this.table.hint();
      else if (k === 'b') this.table.playBest();
      else if (k === 'r') this.confirmResign();
      else if (k === 'm') this.toggleSound($('soundBtn'));
      else if (k === 'escape') this.closeModal();
      else if (k === '1') this.show('table'); else if (k === '2') this.show('board');
      else if (k === '3') this.show('stats'); else if (k === '4') this.show('wallet'); else if (k === '5') this.show('guide');
    });
    window.addEventListener('beforeunload', () => saveState(this.s));
  }

  modalIdle() { return this.el.modal.hidden; }

  toggleSound(btn) {
    this.cfg.sound = !this.cfg.sound;
    setSound(this.cfg.sound);
    btn.textContent = this.cfg.sound ? '🔊' : '🔇';
    btn.classList.toggle('off', !this.cfg.sound);
    if (this.cfg.sound) this.sfx.clack();
    this.save();
  }

  cycleSpeed() {
    const speeds = [1, 10, 60, 600, 3600];
    const cur = this.s.season.speed || 1;
    const next = speeds[(speeds.indexOf(cur) + 1) % speeds.length] || 1;
    this.s.season.speed = next;
    this.el.footSpeed.textContent = `${F.fa(next)}×`;
    this.toast(next === 1 ? 'ساعت مسابقه روی زمان واقعی' : `ساعت مسابقه ${F.fa(next)} برابر تند رفت — برای دیدن پایان روز`, 'info');
    this.save();
  }

  jumpToEnd() {
    this.s.season.vNow = this.s.season.endAt + 1000;
    this.toast('مهلت یک‌روزه به پایان رسید — جدول را ببندم و جوایز را بدهم؟', 'warn', 6000);
    this.checkPhase(true);
    this.renderAll();
  }

  opponentChoice() {
    const t = solventTable(this.s).filter((p) => p.id !== 'you');
    if (!t.length) return null;
    const me = you(this.s);
    t.sort((a, b) => Math.abs(a.cash - (me?.cash || 0)) - Math.abs(b.cash - (me?.cash || 0)));
    return t[Math.floor(Math.random() * Math.min(5, t.length))]?.id || t[0].id;
  }

  onHit() { this.stats({ hits: 1 }); }

  setMoveClock(left, total) {
    const box = this.el.moveClock;
    if (!box) return;
    const fill = box.querySelector('i'), txt = box.querySelector('span');
    if (!left) {
      fill.style.width = '0%';
      txt.textContent = this.table.phase === 'ready' ? 'تاس بریز' : this.table.phase === 'you' ? 'حرکت کن' : '';
      box.classList.remove('low');
      return;
    }
    const r = Math.max(0, Math.min(1, left / (total || 1)));
    fill.style.width = `${r * 100}%`;
    txt.textContent = `${F.fa1(left / 1000)} ثانیه برای حرکت`;
    box.classList.toggle('low', left < 6000);
  }
  stats(patch) { Object.entries(patch).forEach(([k, v]) => { this.s.stats[k] = (this.s.stats[k] || 0) + v; }); }

  /* --------------------------------------------------------------- چرخهٔ بازی */
  onRoundOver(res) {
    this.trail.push({ t: this.s.season.vNow, cash: you(this.s)?.cash || 0, tag: res.youWon ? 1 : -1 });
    if (this.trail.length > 90) this.trail.shift();
    this.renderAll();
    this.save();
    this.showResult(res);
  }

  nextRound() {
    this.closeModal();
    if (phaseOf(this.s) !== 'play') { this.toast('مهلت مسابقه تمام شده — یک فصل تازه بساز', 'warn'); return; }
    const me = you(this.s);
    if (!me) return;
    if (me.cash < this.cfg.stake && !this.cfg.practice) {
      this.toast(`پول میزت کمتر از شرط (${F.toman(this.cfg.stake)}) است — شارژ کن یا دوستانه بازی کن`, 'bad', 6000);
      this.show('wallet');
      return;
    }
    this.table.newRound(this.opponentChoice());
    this.renderAll();
  }

  showResult(res) {
    const me = you(this.s);
    const kindName = res.resign ? (res.youWon ? 'واگذاری حریف' : 'تسلیم تو')
      : res.kind === 'backgammon' ? 'تخته! 🎯' : res.kind === 'gammon' ? 'مرس 🎲' : 'برد ساده';
    const amt = res.amt || 0;
    const html = `
      <h2>${res.youWon ? 'پول‌ها به جیب تو 🪙' : 'حریف پول برد'}</h2>
      <p class="sub">${esc(kindName)} · حریف: <b>${esc(res.opponent)}</b> · کعب ${F.fa(res.cube)}</p>
      <div class="result-grid">
        <div class="chip ${amt >= 0 ? 'good' : 'bad'}"><s>جابه‌جایی پول میز</s><b>${amt >= 0 ? '+' : '−'}${F.fa(Math.abs(amt))}</b></div>
        <div class="chip gold"><s>پاداش</s><b>${res.bonus ? '+' + F.fa(res.bonus) : '—'}</b></div>
        <div class="chip"><s>پول میز تو</s><b>${F.fa(me?.cash || 0)}</b></div>
        <div class="chip ${res.rank <= 3 ? 'good' : ''}"><s>جایگاه فعلی</s><b>${F.fa(res.rank)} / ${F.fa(this.s.season.players.length)}</b></div>
      </div>
      ${res.rank <= 3 ? `<p class="sub" style="margin:6px 0 0">🏆 در سه نفر اولی — جایزهٔ نقدی پایان روز برای تو در راه است.</p>` : ''}
      <div class="actions">
        <button class="btn gold" id="mNext">دست بعدی</button>
        <button class="btn" id="mOpp">حریف را عوض کن</button>
        <button class="btn ghost" id="mLb">جدول زنده</button>
      </div>`;
    this.openModal(html, { sticky: true });
    $('mNext').addEventListener('click', () => { clearTimeout(this._nextTimer); this.nextRound(); });
    $('mOpp').addEventListener('click', () => { this.closeModal(); this.pickOpponent(); });
    $('mLb').addEventListener('click', () => { this.closeModal(); this.show('board'); });
    clearTimeout(this._nextTimer);
    if (this.autoNext && phaseOf(this.s) === 'play' && (me?.cash || 0) >= this.cfg.stake) {
      let n = 9;
      const tick = () => {
        const b = $('mNext');
        if (!b || !this.autoNext) return;
        if (--n <= 0) { this.nextRound(); return; }
        b.textContent = `دست بعدی (${F.fa(n)})`;
        this._nextTimer = setTimeout(tick, 1000);
      };
      this._nextTimer = setTimeout(tick, 1200);
    }
  }

  confirmResign() {
    if (this.table.phase === 'over' || this.table.phase === 'idle') return;
    const pot = this.table.pot;
    this.openModal(`
      <h2>تسلیم می‌شوی؟</h2>
      <p class="sub">با تسلیم، <b>${F.toman(pot)}</b> از پول میزت به حریف می‌رسد و کعب هم می‌سوزد.</p>
      <div class="actions"><button class="btn danger" id="yesR">بله، تسلیم</button><button class="btn ghost" id="noR">ادامهٔ بازی</button></div>`);
    $('yesR').addEventListener('click', () => { this.closeModal(); this.table.resign(); });
    $('noR').addEventListener('click', () => this.closeModal());
  }

  onDoubleOffer(offer) {
    const pot = this.cfg.stake * offer.value;
    let left = 30;
    this.openModal(`
      <h2>حریف کعب را بالا برد ⚡</h2>
      <p class="sub">شرط هر بازی می‌شود <b>${F.toman(pot)}</b> (کعب ${F.fa(offer.value)}). رد کردن یعنی واگذاری بازی.</p>
      <div class="actions"><button class="btn gold" id="okD">می‌پذیرم</button><button class="btn ghost" id="noD">پس می‌زنم (واگذاری)</button></div>
      <p class="sub" style="margin:10px 0 0" id="ddCnt"></p>`,
      { sticky: true, kind: 'double' });
    $('okD').addEventListener('click', () => this.answer(offer, true));
    $('noD').addEventListener('click', () => this.answer(offer, false));
    clearInterval(this._dblT);
    this._dblT = setInterval(() => {
      const el = $('ddCnt');
      if (!el || this.table.phase !== 'double') { clearInterval(this._dblT); return; }
      el.innerHTML = `⏳ <b>${F.fa(left)}</b> ثانیه — اگر پاسخ ندهی، بر پایهٔ موقعیت تصمیم می‌گیرم.`;
      if (left-- <= 0) {
        clearInterval(this._dblT);
        const accept = shouldAccept(this.table.st, SIDE_WHITE, this.cfg.ai || 'hard');
        this.log('پاسخی ندادی؛ کفهٔ بازی را سنجیدم', 'warn');
        this.toast(accept ? 'دبل پذیرفته شد (تصمیم خودکار)' : 'دبل رد شد (تصمیم خودکار)', accept ? 'warn' : 'bad');
        this.answer(offer, accept);
      }
    }, 1000);
  }

  answer(offer, accept) {
    clearInterval(this._dblT);
    this.table.answerDouble(accept);
  }

  closeDoubleModal() {
    clearInterval(this._dblT);
    if (this.el.modal.dataset.k === 'double') this.closeModal();
  }

  openModal(html, { sticky = false, kind = '' } = {}) {
    clearTimeout(this._nextTimer);
    this.el.sheet.innerHTML = html;
    this.el.modal.dataset.k = kind;
    this.el.modal.hidden = false;
    this.el.modal.onclick = (e) => { if (e.target === this.el.modal && !sticky) this.closeModal(); };
  }
  closeModal() { this.el.modal.hidden = true; this.el.modal.dataset.k = ''; }

  /* --------------------------------------------------------------- فصل/ثبت‌نام */
  doRegister() {
    const r = payEntry(this.s);
    if (!r.ok) { this.toast(`کیف پول کافی نیست — ${r.why}`, 'bad'); this.show('wallet'); return; }
    this.s.season.ledger = this.s.season.ledger || [];
    this.s.season.ledger.unshift({ t: this.s.season.vNow, label: 'ورودی فصل — میز ۱۶ نفره', amt: -r.fee });
    this.sfx.coin();
    this.toast(`ورودی ${F.toman(r.fee)} پرداخت شد ✓ حالا پول میزت جابه‌جا می‌شود`, 'good', 5200);
    this.el.regBanner.hidden = true;
    this.renderAll(); this.save();
  }

  newSeasonModal(mode = 'live') {
    const season = freshSeason({ ...RULES, ...this.cfg }, mode);
    if (mode === 'reg') {
      season.registered = false;              // ورودی هنوز پرداخت نشده
      season.ledger = [];
    } else {
      if (this.s.wallet >= RULES.entry) {
        this.s.wallet -= RULES.entry;          // ورودیِ یک‌هفته‌پیش، از کیف پول
      } else {
        season.registered = false;
        this.toast(`برای ورودِ پولی به ${F.toman(RULES.entry)} نیاز داری — کیف پول را شارژ کن`, 'bad', 5200);
      }
    }
    this.s.season = season;
    this.logs = [];
    this.trail = [];
    this.cashSnap = new Map();
    this.table.newRound(this.opponentChoice());
    this.closeModal();
    this.renderAll(); this.save();
    this.toast(
      mode === 'reg'
        ? `پنجرهٔ ثبت‌نام باز است — ${F.toman(RULES.entry)} ورودی بده تا سرِ میز بنشینی`
        : 'فصل تازه شروع شد — ۲۴ ساعت وقت داری پول جابه‌جا کنی',
      'good', 5200);
  }

  checkPhase(force = false) {
    const ph = phaseOf(this.s);
    if ((ph === 'closed' || force && ph === 'play') && !this.s.season.closed) {
      if (force) this.s.season.vNow = this.s.season.endAt + 1;
      if (this.table.phase !== 'over' && this.table.phase !== 'idle') {
        // بازی نیمه‌تمام بی‌نتیجه است: چیزی از کسی گرفته نمی‌شود
        voidGame(this.s, 'you', this.table.oppId, 0, 'پایان مهلت، وسطِ بازی');
        this.table.phase = 'over';
        this.log('مهلت تمام شد — بازی نیمه‌تمام بی‌نتیجه ماند', 'warn');
      }
      const pay = closeSeason(this.s);
      this.save();
      this.ceremony(pay);
    }
  }

  ceremony(pay) {
    if (!pay) return;
    this.sfx.fanfare();
    this.confetti(pay.top.some((t) => t.id === 'you') ? 150 : 60);
    const rows = pay.top.map((t) => `
      <div class="rank-row ${t.rank === 1 ? 'r1' : ''}">
        <span>${['🥇', '🥈', '🥉'][t.rank - 1]}</span>
        <b>${esc(t.name)}${t.id === 'you' ? ' (تو)' : ''}</b>
        <span style="color:var(--sub)">${F.fa(t.rank)}ام · پول میز ${F.fa(t.cash)}</span>
        <span class="p">${F.toman(t.prize)}</span>
      </div>`).join('');
    this.openModal(`
      <div class="ceremony">
        <div class="big">پایان مهلت یک‌روزه</div>
        <p class="sub">سه نفر با بیشترین پولِ میز، جایزهٔ نقدی می‌برند. بقیهٔ پول‌ها سرِ میز می‌ماند.</p>
        ${rows}
        <div class="actions">
          <button class="btn gold" id="csNew">فصل تازه بساز</button>
          <button class="btn" id="csLb">جدول نهایی</button>
        </div>
      </div>`, { sticky: true, kind: 'ceremony' });
    $('csNew').addEventListener('click', () => this.newSeasonModal('live'));
    $('csLb').addEventListener('click', () => { this.closeModal(); this.show('board'); this.renderLeaderboard(true); });
  }

  confetti(n = 90) {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#ffd77a', '#ff6b57', '#41e0c4', '#fff3d6', '#a78bfa'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.style.cssText = `left:${Math.random() * 100}%;top:${-12 - Math.random() * 30}%;background:${cols[i % cols.length]};
        animation-duration:${2.2 + Math.random() * 2.6}s;animation-delay:${Math.random() * 1.2}s;
        transform:rotate(${Math.random() * 360}deg);border-radius:${Math.random() > .5 ? '2px' : '50%'}`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6200);
  }

  /* --------------------------------------------------------------- صحنه‌ها */
  show(tab) {
    this.tab = tab;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `sc-${tab}`));
    if (tab === 'board') this.renderLeaderboard(true);
    if (tab === 'stats') this.renderStats();
    if (tab === 'wallet') this.renderWallet();
    if (tab === 'guide') this.renderGuide();
    this.view._resize();
  }

  /* --------------------------------------------------------------- رندر */
  render() { this.renderAll(); }

  renderAll() {
    const ph = phaseOf(this.s);
    const rem = remainingMs(this.s);
    const me = you(this.s);
    const lb = leaderboard(this.s);
    const myRank = lb.findIndex((p) => p.id === 'you') + 1;
    const theme = this.table.theme();

    // HUD
    const phaseTxt = { play: 'مسابقه در جریان', reg: 'پنجرهٔ ثبت‌نام', closed: 'روز بسته شد', soon: 'در انتظار' }[ph];
    this.el.phasePill.dataset.p = ph;
    this.el.phasePill.querySelector('b').textContent = phaseTxt;
    this.el.clockTxt.textContent = ph === 'closed' ? 'پایان' : F.clock(rem);
    this.el.dayClock.classList.toggle('danger', rem < 60 * 60 * 1000 && ph === 'play');
    this.el.dayClock.querySelector('.prg').style.strokeDashoffset = String(1 - dayProgress(this.s));
    this.el.walletTxt.textContent = F.toman(this.s.wallet);
    this.el.rankTxt.textContent = `${F.fa(myRank)}م`;
    this.el.cashTxt.textContent = F.shortToman(me?.cash || 0);
    this.el.footSeason.textContent = `فصل ${this.s.season.id} · ${F.jalaliDate(this.s.season.startAt)} · ${F.fa(this.s.season.players.length)} بازیکن`;
    this.el.footSpeed.textContent = `${F.fa(this.s.season.speed || 1)}×`;

    // بنر: ثبت‌نام / بسته‌شدنِ ثبت‌نام / پایانِ روز
    const bn = this.el.regBanner;
    let mode = null;
    if (ph === 'reg' && !this.s.season.registered) {
      mode = 'reg';
      this.el.regTitle.textContent = 'پنجرهٔ ثبت‌نام باز است';
      this.el.regSub.textContent = `${F.toman(this.cfg.entry)} ورودی — تا شروع مسابقه ${F.humanDuration(regRemainingMs(this.s))} وقت داری؛ بعد از آن فقط بازیکن‌های ثبت‌نام‌شده سرِ میز می‌نشینند.`;
      $('regBtn').textContent = 'پرداخت ورودی و ورود به فصل';
    } else if (ph === 'play' && !this.s.season.registered) {
      mode = 'late';
      this.el.regTitle.textContent = 'ثبت‌نام بسته شد';
      this.el.regSub.textContent = 'ورودی باید یک هفته پیش داده می‌شد؛ فعلاً فقط بازی دوستانه (بدون پول) می‌توانی بازی کنی.';
      $('regBtn').textContent = 'حالت دوستانه';
    } else if (ph === 'closed') {
      mode = 'new';
      this.el.regTitle.textContent = 'روز بسته شد — جوایز پرداخته شد';
      this.el.regSub.textContent = `نفر اول: ${esc(this.s.season.payouts?.top[0]?.name || '—')} با ${F.fa(this.s.season.payouts?.top[0]?.cash || 0)} تومان پول میز. برای دوباره بازی کردن، فصل تازه باز کن.`;
      $('regBtn').textContent = 'فصل تازه بساز';
    }
    this._bannerMode = mode;
    bn.hidden = !mode;
    bn.style.display = mode ? '' : 'none';
    $('regLater').style.display = mode === 'reg' ? '' : 'none';

    // سرِ تخته
    this.el.themeName.textContent = `تختهٔ ${theme.name}`;
    this.el.themeSub.textContent = `${theme.sub} · ${PATTERN_FA[theme.pattern] || theme.pattern}`;
    this.el.roundMeta.textContent = `دست ${F.fa(this.table.round)}${this.table.pair ? ' · دوبل' : ''}`;
    this.el.modeMeta.textContent = this.cfg.practice ? 'دوستانه (بدون پول)' : `هر بازی ${F.shortToman(this.cfg.stake)} تومان`;

    // پرچم نوبت
    const tp = this.table.phase;
    const flag = this.el.turnFlag;
    flag.className = 'board-flag' + (tp === 'opp' || tp === 'rolling' ? ' wait' : '');
    flag.textContent = {
      ready: 'نوبت شما · تاس بریز', rolling: 'تاس می‌چرخد…', you: 'حرکتت را انتخاب کن',
      opp: 'حریف در حال فکر کردن…', double: 'پیشنهاد دبل', over: 'دست تمام شد', idle: '',
    }[tp] || '';
    if (tp === 'you') flag.classList.add('you');
    const disabled = {
      rollBtn: tp !== 'ready',
      doubleBtn: tp !== 'ready' || !!this.cfg.practice,
      bearBtn: tp !== 'you' || !this.table.summary().home,
      bestBtn: tp !== 'you',
      undoBtn: tp !== 'you' || !this.table.undoStack.length,
      hintBtn: tp !== 'you' || !this.rem0(),
      resignBtn: !['you', 'ready', 'opp', 'double'].includes(tp),
      swapBtn: tp === 'rolling',
    };
    for (const [id, on] of Object.entries(disabled)) {
      const b = $(id);
      if (b) b.disabled = !!on;
    }

    this.renderOpp();
    this.renderStake();
    this.renderBonus();
    this.renderStrip();
    this.renderFeed();
    this.renderAdv();
    if (this.tab === 'board') this.renderLeaderboard();
    if (this.tab === 'stats') this.renderStats();
  }

  renderAdv() {
    const a = this.table.advantage();
    const f = this.el.advFill;
    const w = Math.abs(a) * 50;
    f.style.width = `${w}%`;
    f.style.insetInlineStart = a >= 0 ? '50%' : `${50 - w}%`;
    f.style.background = a >= 0 ? 'linear-gradient(90deg, var(--ok), var(--accent))' : 'linear-gradient(90deg, var(--bad), #ffb03a)';
    this.el.advTxt.textContent = Math.abs(a) < 0.06 ? 'کفه‌ها برابر' :
      `${a > 0 ? 'تو جلویی' : 'حریف جلویی'} · ${F.fa(Math.abs(a) * 100)}٪`;
  }

  renderOpp() {
    const o = byId(this.s, this.table.oppId);
    const me = you(this.s);
    if (!o) {
      put(this.el.oppCard, `<h4>حریف</h4><div class="notice">در فصل هیچ بازیکنِ سربلندی نمانده — همه تسطیح شده‌اند. یک فصل تازه بساز یا پول میزت را شارژ کن.</div>
        <div class="rowbtns"><button class="btn gold block" id="forceNew">فصل تازه</button></div>`);
      $('forceNew')?.addEventListener('click', () => this.newSeasonModal('live'));
      return;
    }

    const busy = this.table.phase !== 'over' && this.table.phase !== 'ready';
    const oppHtml = `
      <h4>سرِ این میز</h4>
      <div class="opp-head">
        <span class="ava">${o.avatar}</span>
        <span class="nm"><b>${esc(o.name)}</b><span>${skillName(o.skill)} · ${F.fa(o.wins)} برد / ${F.fa(o.losses)} باخت</span></span>
      </div>
      <div style="margin-top:9px">
        <div class="kv"><span>پول میز حریف</span><b class="${o.cash < me.cash ? 'ok' : 'bad'}">${F.toman(o.cash)}</b></div>
        <div class="kv"><span>پول میز تو</span><b class="gold">${F.toman(me.cash)}</b></div>
        <div class="kv"><span>رشتهٔ برد</span><b>${me.streak > 0 ? '🔥 ' + F.fa(me.streak) : '—'}</b></div>
        <div class="kv"><span>سابقهٔ شما دو نفر</span><b>${F.fa(this.s.stats.wins)}–${F.fa(this.s.stats.losses)}</b></div>
      </div>
      <div class="rowbtns">
        <button class="btn ${busy ? 'ghost' : 'gold'}" id="nextR" ${busy ? 'disabled' : ''}>دست بعدی</button>
        <button class="btn" id="pickOpp">میز را عوض کن</button>
      </div>
      <select class="sel" id="oppSel">
        ${solventTable(this.s).filter((p) => p.id !== 'you').map((p) =>
          `<option value="${p.id}" ${p.id === o.id ? 'selected' : ''}>${esc(p.name)} · ${F.shortToman(p.cash)}</option>`).join('')}
      </select>
    <label class="sw" style="margin-top:8px;display:flex"><input type="checkbox" id="autoN" ${this.autoNext ? 'checked' : ''}> دست بعدی خودکار</label>`;
    if (!put(this.el.oppCard, oppHtml)) return;
    $('nextR')?.addEventListener('click', () => this.nextRound());
    $('pickOpp')?.addEventListener('click', () => { if (!busy) this.pickOpponent(); });
    $('oppSel')?.addEventListener('change', (e) => {
      if (this.table.phase === 'over' || this.table.phase === 'ready') {
        this.table.oppId = e.target.value;
        this.table.newRound(e.target.value);
        this.toast('حریف تازه، تختهٔ تازه', 'good');
      } else { this.toast('وسطِ بازی نمی‌شود حریف را عوض کرد', 'warn'); this.renderOpp(); }
    });
    $('autoN')?.addEventListener('change', (e) => { this.autoNext = e.target.checked; });
  }

  pickOpponent() {
    const list = solventTable(this.s).filter((p) => p.id !== 'you');
    this.openModal(`
      <h2>میز را عوض کن</h2>
      <p class="sub">هر انتخاب، یک حریف تازه و یک تختهٔ تازه می‌آورد.</p>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${list.map((p) => `<button class="btn" data-op="${esc(p.id)}" style="justify-content:space-between;display:flex">
            <span>${p.avatar} ${esc(p.name)}</span><span style="color:var(--sub)">${skillName(p.skill)} · ${F.shortToman(p.cash)} تومان</span></button>`).join('')}
      </div>
      <div class="actions"><button class="btn ghost" id="closePick">بستن</button></div>`);
    $$('#modalSheet [data-op]').forEach((b) => b.addEventListener('click', () => {
      this.closeModal();
      this.table.oppId = b.dataset.op;
      this.table.newRound(b.dataset.op);
      this.renderAll();
    }));
    $('closePick')?.addEventListener('click', () => this.closeModal());
  }

  renderStake() {
    const t = this.table;
    const st = this.cfg.stake;
    put(this.el.stakeCard, `
      <h4>پولِ روی میز</h4>
      <div class="kv"><span>ورودی فصل (یک هفته پیش)</span><b>${F.toman(this.cfg.entry)}</b></div>
      <div class="kv"><span>شرط هر بازی</span><b>${F.toman(st)}</b></div>
      <div class="kv"><span>کعب دبل</span><b class="gold">×${F.fa(t.cube)}</b></div>
      <div class="kv"><span>روی میزِ الان</span><b>${F.toman(st * t.cube)}</b></div>
      <div style="margin-top:8px" class="bonus-list">
        <div class="bonus-item"><span class="ic">🎲</span> برد ساده <b>${F.shortToman(st * t.cube)}</b></div>
        <div class="bonus-item"><span class="ic">🐎</span> مرس (گمِین) <b>${F.shortToman(st * t.cube * 2)}</b></div>
        <div class="bonus-item"><span class="ic">🎯</span> تخته <b>${F.shortToman(st * t.cube * 3)}</b></div>
      </div>`);
  }

  renderBonus() {
    const me = you(this.s);
    const next = this.cfg.streakBonuses.find(([n]) => me.streak < n);
    const pf = prizeFund(this.s);
    put(this.el.bonusCard, `
      <h4>پاداش‌ها و جایزه</h4>
      <div class="bonus-list">
        ${this.cfg.streakBonuses.map(([n, b]) => `<div class="bonus-item ${me.streak >= n ? 'done' : ''}">
            <span class="ic">${me.streak >= n ? '✓' : n}</span> ${F.fa(n)} برد پیاپی <b>${F.shortToman(b)}</b></div>`).join('')}
        <div class="bonus-item"><span class="ic">🐎</span> هر مرس <b>${F.shortToman(this.cfg.gammonBonus)}</b></div>
        <div class="bonus-item"><span class="ic">🎯</span> هر تخته <b>${F.shortToman(this.cfg.backgammonBonus)}</b></div>
      </div>
      <div class="kv" style="margin-top:9px"><span>پاداش بعدی</span><b>${next ? `${F.fa(next[0] - me.streak)} برد دیگر` : '✓ همه گرفته شد'}</b></div>
      <div class="kv"><span>صندوق جوایز روز</span><b class="gold">${F.shortToman(pf.total)}</b></div>`);
  }

  renderStrip() {
    const me = you(this.s);
    const lb = leaderboard(this.s);
    const gap = me.cash - (lb[2]?.cash || 0);
    const t = this.table.summary();
    put(this.el.strip, [
      ['پول میز تو', F.fa(me.cash), 'gold'],
      ['رتبهٔ فعلی', `${F.fa(this.rank())}م`, me.cash > 0 ? 'good' : 'bad'],
      ['اختلاف با نفر سوم', (gap >= 0 ? '+' : '−') + F.fa(Math.abs(gap)), gap >= 0 ? 'good' : 'bad'],
      ['کعب', `×${F.fa(t.cube)}`, ''],
      ['حرکت‌های مانده', F.fa(t.remaining), ''],
      ['مهره‌های روی وسط', `${F.fa(this.table.st.bar[SIDE_WHITE])} / ${F.fa(this.table.st.bar[SIDE_BLACK])}`, this.table.st.bar[SIDE_BLACK] ? 'good' : ''],
      ['خارج‌شده‌ها', `${F.fa(this.table.st.off[SIDE_WHITE])} / ${F.fa(this.table.st.off[SIDE_BLACK])}`, ''],
      ['بردهای امروز', F.fa(me.wins), me.wins ? 'good' : ''],
      ['باخت‌های امروز', F.fa(me.losses), me.losses ? 'bad' : ''],
    ].map(([k, v, cls]) => `<div class="chip ${cls}"><s>${k}</s><b>${v}</b></div>`).join(''));
  }

  renderFeed() {
    const h = this.s.season.history.slice(0, 14);
    const row = (x) => {
      const cls = x.kind === 'void' ? 'v' : (x.you ? (x.w === 'شما' || x.w === this.s.nick ? 'p' : 'n') : 'v');
      return `<li><b>${esc(x.w)}</b> ⟵ ${esc(x.l)} <i style="opacity:.6">${x.kind === 'backgammon' ? 'تخته' : x.kind === 'gammon' ? 'مرس' : x.kind === 'void' ? 'بی‌نتیجه' : 'برد'}</i>
        <em class="${cls}">${x.amt ? (cls === 'n' ? '−' : '+') + F.fa(x.amt) : '—'}</em></li>`;
    };
    put(this.el.feed, h.slice(0, 8).map(row).join('') || '<li>هنوز نتیجه‌ای ثبت نشده — تاس را بریز.</li>');
    put(this.el.feedFull, h.map(row).join('') || '<li>خالی</li>');
  }

  /* --------------------------------------------------------------- جدول زنده */
  renderLeaderboard(force = false) {
    if (!force && this.tab !== 'board') return;
    const only = this.el.onlySolvent?.checked;
    const lb = leaderboard(this.s);
    const max = Math.max(...lb.map((p) => p.cash), 1);
    const rows = lb.filter((p) => !only || p.cash >= this.cfg.stake);
    put(this.el.lb, rows.map((p) => {
      const prev = this.cashSnap.get(p.id);
      const d = prev === undefined ? 0 : p.cash - prev;
      const rk = lb.indexOf(p) + 1;
      return `<div class="lbr ${p.id === 'you' ? 'me' : ''} ${rk <= 3 ? 'top' + rk : ''} ${p.cash < this.cfg.stake ? 'bust' : ''} ${d > 0 ? 'flash-up' : d < 0 ? 'flash-dn' : ''}" data-id="${p.id}">
        <div class="rk">${F.fa(rk)}</div>
        <div class="who"><span style="font-size:16px">${p.avatar}</span>
          <b>${esc(p.name)}</b>${p.id === 'you' ? '<span class="tag you">تو</span>' : ''}
          ${p.streak >= 3 ? `<span class="tag">🔥${F.fa(p.streak)}</span>` : ''}
          ${p.cash < this.cfg.stake ? '<span class="tag">تسطیح</span>' : ''}</div>
        <div class="wl">${F.fa(p.wins)}ب / ${F.fa(p.losses)}ب · مرس ${F.fa(p.gammons)}</div>
        <div class="bar"><i style="width:${(p.cash / max) * 100}%"></i></div>
        <div class="cash">${F.fa(p.cash)}</div>
        <div class="dl ${d > 0 ? 'p' : d < 0 ? 'n' : ''}">${d ? (d > 0 ? '+' : '−') + F.fa(Math.abs(d)) : '·'}</div>
      </div>`;
    }).join(''));
    lb.forEach((p) => this.cashSnap.set(p.id, p.cash));
    const top = lb.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    put(this.el.podium, top.map((p, i) => `
      <div class="pd p${i + 1} ${p.id === 'you' ? 'you' : ''}" style="--c:${p.color}">
        <div class="medal">${medals[i]}</div>
        <div class="nm">${esc(p.name)}${p.id === 'you' ? ' · تو' : ''}</div>
        <div class="cash">${F.fa(p.cash)}</div>
        <div class="prz">جایزه: ${F.toman(this.cfg.prizes[i])}</div>
      </div>`).join(''));
    this.el.prizeHint.textContent = `با پایان مهلت، جایزه بر اساس همین جدول پرداخت می‌شود: ${this.cfg.prizes.map((p) => F.shortToman(p)).join(' / ')} تومان`;
    const pf = prizeFund(this.s);
    put(this.el.potCard, `
      <div class="kv"><span>ورودی ${F.fa(this.s.season.players.length)} نفر</span><b>${F.toman(pf.entries)}</b></div>
      <div class="kv"><span>حمایت بازار</span><b>${F.toman(pf.sponsor)}</b></div>
      <div class="kv"><span>مجموع صندوق</span><b class="gold">${F.toman(pf.total)}</b></div>
      <div class="kv"><span>نفر اول</span><b>${F.toman(this.cfg.prizes[0])}</b></div>
      <div class="kv"><span>نفر دوم</span><b>${F.toman(this.cfg.prizes[1])}</b></div>
      <div class="kv"><span>نفر سوم</span><b>${F.toman(this.cfg.prizes[2])}</b></div>
      <p class="notice" style="margin-top:10px">با تمام شدن ۲۴ ساعت، هر سه جایزه به <b>کیف پول</b> نفرات واریز می‌شود و بقیه از دورِ پول خارج می‌مانند.</p>`);
  }

  /* --------------------------------------------------------------- آمار */
  renderStats() {
    if (this.tab !== 'stats') return;
    const s = this.s.stats, me = you(this.s);
    const played = s.games;
    const wr = played ? (s.wins / played) * 100 : 0;
    put(this.el.statsGrid, `
      <div class="card"><h4>رکورد من در فصل</h4>
        <div class="statbig">${F.fa(s.wins)}–${F.fa(s.losses)}<s>${F.fa(played)} بازی · ${F.fa1(wr)}٪ برد</s></div>
        <div style="margin-top:10px">
          <div class="kv"><span>مرس (گمِین)</span><b>${F.fa(s.gammons)}</b></div>
          <div class="kv"><span>تخته</span><b>${F.fa(s.backgammons)}</b></div>
          <div class="kv"><span>مهره‌های زده‌شده</span><b>${F.fa(s.hits)}</b></div>
          <div class="kv"><span>بلندترین رشته</span><b class="gold">${F.fa(s.maxStreak)}</b></div>
        </div></div>
      <div class="card"><h4>پول میز</h4>
        <div class="statbig" style="color:var(--accent)">${F.fa(me.cash)}<s>تومان روی میز</s></div>
        <canvas id="trail" width="420" height="120" style="width:100%;height:120px;margin-top:10px"></canvas>
        <div class="kv"><span>جابه‌جایی خالص بازی‌ها</span><b class="${s.net >= 0 ? 'ok' : 'bad'}">${F.tomanSigned(s.net)}</b></div>
        <div class="kv"><span>پاداش‌های گرفته</span><b>${F.toman(s.bonus || 0)}</b></div>
      </div>
      <div class="card"><h4>جایگاه</h4>
        <div class="statbig">${F.fa(this.rank())}<s>از ${F.fa(this.s.season.players.length)} بازیکن</s></div>
        <div style="margin-top:10px">${leaderboard(this.s).slice(0, 6).map((p, i) => `
          <div class="kv"><span>${['🥇', '🥈', '🥉'][i] || `${F.fa(i + 1)}م`} ${esc(p.name)}</span><b>${F.fa(p.cash)}</b></div>`).join('')}</div>
      </div>
      <div class="card"><h4>بازی‌های این میز</h4>
        <div class="kv"><span>تعداد دست‌ها</span><b>${F.fa(this.table.round)}</b></div>
        <div class="kv"><span>تخته‌های عوض‌شده</span><b>${F.fa(this.table.round)} (هر دست یک تخته)</b></div>
        <div class="kv"><span>قربانیِ دبل</span><b>${F.fa(s.forced || 0)}</b></div>
        <div class="kv"><span>نیمه‌تمام مانده</span><b>${F.fa(this.s.season.cancelled || 0)}</b></div>
        <p class="notice" style="margin-top:10px">آمار در همین مرورگر نگه داشته می‌شود (localStorage). با «فصل تازه» صفر می‌شود.</p>
      </div>`);
    this.renderTrail();
  }

  renderTrail() { this.sparkline($('trail')); }

  sparkline(cv) {
    if (!cv) return;
    const x = cv.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
    x.scale(dpr, dpr);
    const w = cv.clientWidth, h = cv.clientHeight;
    const t = this.trail.slice(-60);
    x.clearRect(0, 0, w, h);
    if (t.length < 2) {
      x.fillStyle = 'rgba(255,255,255,.3)'; x.font = '12px Vazirmatn, Tahoma';
      x.textAlign = 'center'; x.fillText('بعد از چند بازی، نمودارِ پول میزت این‌جا کشیده می‌شود', w / 2, h / 2);
      return;
    }
    const vals = t.map((p) => p.cash);
    const min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 1;
    const y = (v) => h - 8 - ((v - (min - pad)) / ((max + pad) - (min - pad))) * (h - 16);
    const xs = (i) => (i / (t.length - 1)) * (w - 8) + 4;
    x.beginPath(); x.moveTo(xs(0), y(vals[0]));
    vals.forEach((v, i) => x.lineTo(xs(i), y(v)));
    x.lineTo(xs(vals.length - 1), h); x.lineTo(xs(0), h); x.closePath();
    const g = x.createLinearGradient(0, 0, 0, h);
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e2ae41';
    g.addColorStop(0, acc + '88'); g.addColorStop(1, acc + '00');
    x.fillStyle = g; x.fill();
    x.beginPath(); vals.forEach((v, i) => i ? x.lineTo(xs(i), y(v)) : x.moveTo(xs(i), y(v)));
    x.strokeStyle = acc; x.lineWidth = 2; x.stroke();
    vals.forEach((v, i) => {
      if (i !== vals.length - 1) return;
      x.beginPath(); x.arc(xs(i), y(v), 3.5, 0, Math.PI * 2); x.fillStyle = acc; x.fill();
    });
  }

  /* --------------------------------------------------------------- کیف پول */
  renderWallet() {
    if (this.tab !== 'wallet') return;
    const me = you(this.s);
    const led = (this.s.season.ledger || []).slice(0, 24);
    const topUpBtns = [100_000, 500_000, 2_000_000].map((a) =>
      `<button class="btn" data-top="${a}">+${F.shortToman(a)}</button>`).join('');
    const walletSig = `
      <div class="card"><h4>کیف پول تو</h4>
        <div class="statbig" style="color:var(--accent)">${F.fa(this.s.wallet)}<s>تومان — موجودی قابل شارژ (نمایشی)</s></div>
        <div class="kv"><span>پول میز (سرمایهٔ رقیبانِ روز)</span><b>${F.fa(me.cash)}</b></div>
        <div class="kv"><span>ورودی فصل</span><b class="${this.s.season.registered ? 'ok' : 'bad'}">${this.s.season.registered ? '✓ پرداخت شد' : 'پرداخت‌نشده'}</b></div>
        <div class="kv"><span>شرط هر بازی</span><b>${F.toman(this.cfg.stake)}</b></div>
        <h5 style="margin:14px 0 6px;font-size:12.5px">شارژ نمایشی کیف پول</h5>
        <div class="rowbtns">${topUpBtns}</div>
      </div>
      <div class="card"><h4>دفترِ پول</h4>
        <ul class="ledger">${led.map((e) => `<li><i>${F.jalaliShort(e.t)} ${F.jalaliTime(e.t)}</i> ${esc(e.label)}
          <em class="${e.amt >= 0 ? 'p' : 'n'}">${F.tomanSigned(e.amt)}</em></li>`).join('') || '<li>خالی</li>'}</ul>
      </div>
      <div class="card"><h4>جایزه‌ها و فصل‌های گذشته</h4>
        ${(this.s.archive || []).length ? this.s.archive.map((a) => `<div class="rank-row">
            <span>${a.yourPrize ? '💵' : '📜'}</span><b>${esc(a.champion)}</b>
            <span style="color:var(--sub)">قهرمان · جایگاه تو ${F.fa(a.yourRank)}م با ${F.fa(a.yourCash)} تومان</span>
            ${a.yourPrize ? `<span class="p">${F.toman(a.yourPrize)}</span>` : ''}</div>`).join('')
          : '<p class="notice">هنوز فصلی بسته نشده. مهلت یک‌روزه که تمام شود، سه نفرِ بالای جدول ${F.shortToman(this.cfg.prizes[0])} / ${F.shortToman(this.cfg.prizes[1])} / ${F.shortToman(this.cfg.prizes[2])} تومان می‌گیرند.</p>'}
      </div>
      <div class="card"><h4>تنظیمات سالن</h4>
        <label class="sw" style="display:flex;margin-bottom:8px"><input type="checkbox" id="practice" ${this.cfg.practice ? 'checked' : ''}> بازی دوستانه (بدون جابه‌جایی پول)</label>
        <label class="sw" style="display:flex;margin-bottom:8px"><input type="checkbox" id="sound2" ${this.cfg.sound ? 'checked' : ''}> صدا</label>
        <label class="sw" style="display:flex;margin-bottom:8px"><input type="checkbox" id="autoN2" ${this.autoNext ? 'checked' : ''}> دست بعدی خودکار</label>
        <h5 style="margin:12px 0 6px;font-size:12.5px">ریتم انیمیشن تخته</h5>
        <select class="sel" id="tempoSel">${[[0.45, 'رعد — بدون توقف'], [0.7, 'تند'], [1, 'معمولی'], [1.6, 'خامه‌ای (برای تماشا)']].map(([v, l]) =>
          `<option value="${v}" ${Math.abs((this.cfg.tempo ?? 1) - v) < 0.01 ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <h5 style="margin:12px 0 6px;font-size:12.5px">سطح حریف</h5>
        <select class="sel" id="aiSel">${['easy', 'medium', 'hard', 'master'].map((v) =>
          `<option value="${v}" ${this.cfg.ai === v ? 'selected' : ''}>${skillName(v)}</option>`).join('')}</select>
        <h5 style="margin:12px 0 6px;font-size:12.5px">نام روی میز</h5>
        <input class="sel" id="nick" value="${esc(this.s.nick)}" maxlength="18" placeholder="مثلاً: آرش بازار">
        <h5 style="margin:12px 0 6px;font-size:12.5px">تخته‌ها</h5>
        <div class="themebox" id="themeBox">
          <button data-th="auto" class="${this.cfg.theme === 'auto' ? 'on' : ''}"><div class="sw3" style="background:linear-gradient(120deg,#e2ae41,#3fc9b6,#1d1209)"></div>چرخشی (هر دست یکی)</div>
          ${THEMES.map((t) => `<button data-th="${t.id}" class="${this.cfg.theme === t.id ? 'on' : ''}">
            <div class="sw3" style="background:linear-gradient(120deg,${t.point.a},${t.point.b},${t.felt[0]})"></div>${t.name}</button>`).join('')}
        </div>
        <div class="rowbtns" style="margin-top:12px">
          <button class="btn" id="seasonReg">فصل با پنجرهٔ ثبت‌نام</button>
          <button class="btn" id="seasonLast">فصل در ساعت آخر</button>
          <button class="btn danger" id="wipe">پاک کردن همه‌چیز</button>
        </div>
        <p class="notice" style="margin-top:12px"><b>یادآوری مهم:</b> این یک بازیِ نمایشی برای تمرین تخته نرد است.
          هیچ تومان واقعی پرداخت یا دریافت نمی‌شود و هیچ درگاه پرداختی وجود ندارد. شرط‌بندی با پول واقعی در ایران
          غیرقانونی است؛ اگر برای کسی این برنامه را با پول واقعی می‌سازی، اول قوانین محلی را بررسی کن.</p>
      </div>`;
    if (put(this.el.walletGrid, walletSig)) this.bindWallet();
  }

  bindWallet() {
    $$('#walletGrid [data-top]').forEach((b) => b.addEventListener('click', () => {
      const a = +b.dataset.top;
      topUp(this.s, a);
      this.s.season.ledger = this.s.season.ledger || [];
      this.s.season.ledger.unshift({ t: this.s.season.vNow, label: 'شارژ نمایشی کیف پول', amt: a });
      this.sfx.coin(); this.toast(`${F.toman(a)} به کیف پول اضافه شد (نمایشی)`, 'money'); this.renderWallet(); this.renderAll(); this.save();
    }));
    $('practice')?.addEventListener('change', (e) => { this.cfg.practice = e.target.checked; this.toast(e.target.checked ? 'حالت دوستانه: پول جابه‌جا نمی‌شود' : 'حالت پولی فعال شد', 'warn'); this.renderAll(); this.save(); });
    $('sound2')?.addEventListener('change', () => this.toggleSound($('soundBtn')));
    $('autoN2')?.addEventListener('change', (e) => { this.autoNext = e.target.checked; this.renderOpp(); });
    $('aiSel')?.addEventListener('change', (e) => { this.cfg.ai = e.target.value; this.save(); this.toast('سطح حریف عوض شد', 'info'); });
    $('tempoSel')?.addEventListener('change', (e) => {
      this.cfg.tempo = +e.target.value;
      this.view.tempo = this.cfg.tempo;
      this.save();
      this.toast(`ریتم: ${e.target.selectedOptions[0]?.textContent || ''}`, 'info');
    });
    $('nick')?.addEventListener('input', (e) => { this.s.nick = e.target.value || 'شما'; byId(this.s, 'you').name = this.s.nick; this.save(); });
    $$('#themeBox button').forEach((b) => b.addEventListener('click', () => {
      this.cfg.theme = b.dataset.th;
      $$('#themeBox button').forEach((x) => x.classList.toggle('on', x === b));
      this.table.newRound(this.table.oppId);
      this.save();
    }));
    $('seasonReg')?.addEventListener('click', () => this.newSeasonModal('reg'));
    $('seasonLast')?.addEventListener('click', () => this.lastHour());
    $('wipe')?.addEventListener('click', () => {
      localStorage.removeItem('takhte-pooli:v1');
      this.state = defaultState(); this.save(); this.toast('همه‌چیز پاک شد — صفحه تازه می‌شود', 'warn');
      setTimeout(() => location.reload(), 800);
    });
  }

  lastHour() {
    const s = this.s.season;
    s.startAt = s.vNow - RULES.dayMs + 60 * 60 * 1000;
    s.endAt = s.vNow + 60 * 60 * 1000;
    s.closed = false; s.payouts = null; s.speed = 600;
    this.toast('ساعت آخر: یک ساعت وقت مانده با سرعت ۶۰۰ برابر — پایان روز را ببین', 'warn', 6000);
    this.renderAll(); this.save();
  }

  /* --------------------------------------------------------------- قوانین */
  renderGuide() {
    if (this.tab !== 'guide') return;
    const c = this.cfg;
    put(this.el.guideBody, `
      <div class="card"><h3>تختهٔ پولی چیست؟</h3>
        <p>تختهٔ نردِ ایرانی با اقتصادِ بازار: <b>${F.toman(c.entry)}</b> ورودی که <b>یک هفته پیش</b> از تو گرفته می‌شود،
        و بعد یک روزِ تمام (۲۴ ساعت) سرِ میز می‌نشینی؛ هر بازی <b>${F.toman(c.stake)}</b>. پول از جیبِ باختنی‌ها
        به جیبِ بردنی‌ها می‌رود. وقتی مهلت تمام شود، سه نفری که بیشترین پول را دارند می‌مانند.</p>
        <h5>جایزهٔ نقدی پایان روز</h5>
        <table><tr><th>جایگاه</th><th>جایزه</th><th>شرط</th></tr>
          <tr><td>🥇 نفر اول</td><td><b>${F.toman(c.prizes[0])}</b></td><td>بیشترین پولِ میز</td></tr>
          <tr><td>🥈 نفر دوم</td><td><b>${F.toman(c.prizes[1])}</b></td><td>دومین پولِ میز</td></tr>
          <tr><td>🥉 نفر سوم</td><td><b>${F.toman(c.prizes[2])}</b></td><td>سومین پولِ میز</td></tr></table>
        <p style="margin-top:8px">اگر مهلت تمام شود و بازی‌ات نیمه‌تمام باشد، آن دست بی‌نتیجه می‌ماند و شرط به صاحبش برمی‌گردد.</p>
      </div>
      <div class="card"><h3>قوانین میز (اضافه‌های من)</h3>
        <ul>
          <li><b>چرخش تخته:</b> هر دست یک تختهٔ تازه — ${THEMES.map((t) => t.name).join('، ')}. با هر تخته، رنگ و نقشِ کل سالن هم عوض می‌شود.</li>
          <li><b>کعب دبل:</b> پیش از تاس ریختن می‌توانی کعب را بالا ببری؛ حریف یا می‌پذیرد یا تسلیم می‌شود و شرطِ فعلی را می‌دهد.</li>
          <li><b>مرس ×۲ و تخته ×۳:</b> اگر حریف هیچ مهره‌ای بیرون نبرده باشد، شرط دو برابر؛ اگر مهره‌اش در خانهٔ تو یا روی وسط مانده باشد، سه برابر.</li>
          <li><b>ساعت حرکت:</b> برای هر حرکت ${F.fa(c.moveClock / 1000)} ثانیه وقت داری؛ تمام شود، بهترین حرکت خودکار بازی می‌شود تا روز کش نیاید.</li>
          <li><b>پاداش رشته:</b> ${c.streakBonuses.map(([n, b]) => `${F.fa(n)} برد پیاپی → ${F.shortToman(b)}`).join(' · ')}</li>
          <li><b>پاداش بُردِ تمیز:</b> مرس ${F.shortToman(c.gammonBonus)} و تخته ${F.shortToman(c.backgammonBonus)} تومان — برای اینکه «تخته کردن» ارزش داشته باشد.</li>
          <li><b>تسطیح:</b> اگر پول میزت از ${F.shortToman(c.stake)} کمتر شود، سرِ میزِ پولی نمی‌توانی بنشینی؛ شارژ کن یا دوستانه بازی کن.</li>
          <li><b>تساوی در جدول:</b> اول پول، بعد برد بیشتر، بعد تختهٔ بیشتر، و در آخر یک تاسِ قرعه.</li>
        </ul></div>
      <div class="card"><h3>چطور بازی کنم؟</h3>
        <ol>
          <li>روی <b>تاس‌ها</b> یا دکمهٔ «تاس بریز» بزن (کلید فاصله).</li>
          <li>اول روی مهره‌ای که می‌خواهی حرکت دهی کلیک کن؛ تی‌های مقصد با حلقهٔ نورانی علامت می‌خورند. کلیک روی مقصد = حرکت.</li>
          <li>اگر یک حرکتِ اجباری باشد، خودکار بازی می‌شود. اگر هیچ حرکتی ممکن نباشد، تاس رد می‌شود.</li>
          <li>برای خروجِ مهره از خانه، روی سینی طلایی سمتِ راست کلیک کن یا دکمهٔ «خارج کردن» را بزن.</li>
          <li>روی <b>کعب</b> وسطِ میز کلیک کن تا دبل پیشنهاد دهی. رد کردنِ دبلِ حریف = واگذاری بازی.</li>
          <li>«نظر استاد» بهترین حرکت را نشان می‌دهد، «بازگشت» حرکت آخر این نوبت را برمی‌گرداند.</li>
        </ol>
        <h5>کلیدهای میان‌بر</h5>
        <table><tr><th>کلید</th><th>کار</th></tr>
          <tr><td>Space</td><td>تاس / دست بعدی</td></tr><tr><td>D</td><td>کعب دبل</td></tr>
          <tr><td>B</td><td>بهترین حرکت</td></tr><tr><td>U</td><td>بازگشت</td></tr>
          <tr><td>H</td><td>نظر استاد</td></tr><tr><td>R</td><td>تسلیم</td></tr>
          <tr><td>M</td><td>صدا</td></tr><tr><td>۱…۵</td><td>رفتن به صحنه‌ها</td></tr></table>
      </div>
      <div class="card"><h3>سرعت زمان و تست پایان روز</h3>
        <p>مهلت یک‌روزه روی ساعت واقعی است. در نوارِ پایین «سرعت زمان» را روی ۶۰× یا ۶۰۰× بگذار تا یک روز را در چند دقیقه ببینی،
        یا «پرش به پایان مهلت» را بزن تا جدول بسته شود و جوایز پرداخته شود. در این مدتِ فشرده، بازیکن‌های دیگر هم
        واقعاً با هم بازی می‌کنند و پول‌ها جابه‌جا می‌شود — جدول زنده را ببین.</p>
        <h5>شبیه‌سازی بقیهٔ میزها</h5>
        <p>هر ~${F.fa(c.simEveryMs / 1000)} ثانیه از ساعت مسابقه، میزهای ربات‌ها یک دست بازی می‌کنند (با همان قوانینِ بالا)،
        نتیجه در «جریان فصل» می‌آید و پول جابه‌جا می‌شود.</p></div>
      <div class="card"><h3>حریم خصوصی و صداقت</h3>
        <p>هیچ داده‌ای به جایی فرستاده نمی‌شود: کیف پول، جدول و آمار فقط در حافظهٔ همین مرورگر (localStorage) است.
        پول‌ها نمایشی‌اند و هیچ درگاه پرداختی در کار نیست. شرط‌بندی با پول واقعی در ایران غیرقانونی است —
        این نسخه برای تمرینِ تخته، آموزشِ احتمال و هیجانِ رقابت ساخته شده.</p>
        <p class="notice">تخته‌ها، نقش‌ها (گره‌چینی، کاشی، کیلیِم، شمسه، هرتی، کوفی‌بافی، شب یلدا، فیروزه‌کوبی)
        همه به‌صورت ریاضی روی canvas کشیده می‌شوند؛ هیچ تصویر خارجی استفاده نشده.</p></div>`);
  }

  /* --------------------------------------------------------------- چرخهٔ حیات */
  loop() {
    let last = performance.now();
    let wall = Date.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(400, now - last);
      last = now;
      this.view.render();
      this.table.tickClock(now);
      // ساعت مجازی فصل
      const real = Math.min(60_000, Date.now() - wall);
      wall = Date.now();
      const before = this.s.season.vNow;
      tickClock(this.s, real);
      const dV = this.s.season.vNow - before;
      // شبیه‌سازی میزهای بقیه
      this.simAcc += dV;
      let games = 0;
      while (this.simAcc >= this.cfg.simEveryMs && games < this.cfg.maxGamesPerTick) {
        this.simAcc -= this.cfg.simEveryMs;
        if (phaseOf(this.s) === 'play') {
          const n = simulateBotGames(this.s, 2);
          if (n) games++;
        }
      }
      if (this.simAcc > this.cfg.simEveryMs * 20) this.simAcc = 0;   // عقب‌ماندگیِ طولانی را جبران نکن
      // پاداش رشته در آمار
      const me = you(this.s);
      if (me.streak > (this.s.stats.maxStreak || 0)) this.s.stats.maxStreak = me.streak;
      this._ui = (this._ui || 0) + dt;
      if (this._ui > 260) { this._ui = 0; this.renderAll(); this.checkPhase(); }
      if (Date.now() - this.lastSave > 4000) { this.lastSave = Date.now(); saveState(this.s); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  save() { saveState(this.s); }
}

/* ------------------------------------------------------------- کمکی‌ها */
function skillName(v) {
  return { easy: 'تازه‌کارِ قهوه‌خانه', medium: 'بازاریِ دست‌به‌آچار', hard: 'استادِ محله', master: 'افسانهٔ بازار' }[v] || v;
}
function countOn(st, side) {
  let n = 0;
  for (let i = 0; i < POINTS; i++) n += countAt(st, i, side);
  return n + st.bar[side] + st.off[side];
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

/** نقطهٔ شروع — نمونهٔ App یک‌بار ساخته و صادر می‌شود (برای آزمون‌ها هم قابل دسترسی است) */
export let app = null;

function boot() {
  if (typeof document === 'undefined' || !document.getElementById('board')) return;
  try {
    app = new App();
  } catch (err) {
    // هر خطایی در راه‌اندازی باید دیده شود، نه اینکه صفحه سفید بماند
    console.error('[تختهٔ پولی] خطای راه‌اندازی:', err);
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:99;padding:14px 16px;border-radius:14px;' +
      'background:#2a1207;color:#ffdcb0;border:1px solid #ffb03a;font:600 13px Vazirmatn,Tahoma,sans-serif';
    box.textContent = 'بازی بالا نیامد: ' + (err && err.message ? err.message : err);
    document.body.appendChild(box);
    return;
  }
  window.app = app;             // برای کنجکاوها و دیباگ
  document.body.classList.remove('boot');
  if (!app.cfg.sound) $('soundBtn').classList.add('off');
  // اولین تعامل، قفل صدا را باز می‌کند
  const unlock = () => { setSound(app.cfg.sound); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock, { once: true });
  const seenKey = 'takhte-pooli:seen';
  if (!localStorage.getItem(seenKey)) {
    localStorage.setItem(seenKey, '1');
    app.openModal(`
      <h2>۵۰٬۰۰۰ تومان ورودی، ۲۴ ساعت زمان</h2>
      <p class="sub">فصلِ پولیِ تختهٔ نرد شروع شده: ورودی را یک هفته پیش داده‌ای، حالا هر بازی
        ${F.toman(app.cfg.stake)} است و پول‌ها باید جابه‌جا شود تا سه نفرِ آخر با بیشترین پول بمانند.
        پایان روز: ${F.toman(app.cfg.prizes[0])} به اول، ${F.toman(app.cfg.prizes[1])} به دوم، ${F.toman(app.cfg.prizes[2])} به سوم.</p>
      <div class="result-grid">
        <div class="chip gold"><s>ورودی پرداختی</s><b>${F.fa(app.cfg.entry)}</b></div>
        <div class="chip"><s>بازیکن‌های فصل</s><b>${F.fa(app.s.season.players.length)}</b></div>
        <div class="chip good"><s>پول میز آغازین تو</s><b>${F.fa(app.s.season.players[0].cash)}</b></div>
        <div class="chip bad"><s>مهلت باقی‌مانده</s><b>۲۴:۰۰:۰۰</b></div>
      </div>
      <p class="sub" style="margin-top:10px">نکته: همه‌چیز نمایشی است و پول واقعی رد و بدل نمی‌شود.
        برای دیدنِ پایان روز، «سرعت زمان» را از نوارِ پایین زیاد کن.</p>
      <div class="actions"><button class="btn gold" id="goBtn">بزن بریم 🎲</button><button class="btn ghost" id="rulesBtn">قوانین کامل</button></div>`);
    $('goBtn').addEventListener('click', () => { app.closeModal(); app.sfx.clack(); });
    $('rulesBtn').addEventListener('click', () => { app.closeModal(); app.show('guide'); });
  }
}
boot();
