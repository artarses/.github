/**
 * تختهٔ پولی — رندر تخته روی canvas با نقش‌های ایرانیِ procedurally
 * ---------------------------------------------------------------
 * • چیدمان ۴ ربع استاندارد، وسط (bar)، سینی خروج، کعب دبل و تاس‌ها
 * • زمینه (چوب/نقش/نور) یک‌بار روی canvas پنهان کشیده و کش می‌شود
 * • مهره‌ها، تاس‌ها و هایلایت‌ها هر فریم؛ حرکت‌ها با انیمیشن پرواز
 */
import { POINTS, SIDE_WHITE, SIDE_BLACK, countAt } from './engine.js';

const LW = 1080, LH = 620;              // ابعاد منطقی بوم
const RAIL = 30;
const OFF_W = 52;                        // سینی خروج در سمت راست
const BAR_W = 56;
const FIELD = { x0: RAIL, x1: LW - RAIL - OFF_W };
FIELD.w = FIELD.x1 - FIELD.x0;
FIELD.cx = (FIELD.x0 + FIELD.x1) / 2;
FIELD.y0 = RAIL; FIELD.y1 = LH - RAIL;
FIELD.h = FIELD.y1 - FIELD.y0;
FIELD.my = (FIELD.y0 + FIELD.y1) / 2;
const HALF_W = (FIELD.w - BAR_W) / 2;
const COL = HALF_W / 6;
const DEPTH = 232;
const CR = 30;                           // شعاع مهره

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** مختصات فیزیکی هر تی (idx 0..23) */
export function pointGeom(idx) {
  let col, top;
  if (idx < 6) { col = 5 - idx; top = false; }
  else if (idx < 12) { col = 11 - idx; top = false; }
  else if (idx < 18) { col = idx - 12; top = true; }
  else { col = idx - 18; top = true; }
  const left = idx >= 6 && idx < 18;
  const x = left ? FIELD.x0 + col * COL + COL / 2 : FIELD.cx + BAR_W / 2 + col * COL + COL / 2;
  return { x, base: top ? FIELD.y0 : FIELD.y1, top, dir: top ? 1 : -1, half: left ? 'L' : 'R' };
}

export class BoardView {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.theme = null;
    this.st = null;
    this.side = SIDE_WHITE;
    this.dice = [[3, 4], 0];            // [raw dice, side rolling]
    this.diceAnim = null;
    this.cube = { value: 1, owner: -1 };
    this.anims = [];
    this.hints = { sources: new Set(), targets: new Map(), selected: null, noMove: 0, bearOff: false };
    this.flash = [];
    this.scale = 1;
    this.t0 = performance.now();
    this.bg = document.createElement('canvas');
    this.needsBg = true;
    this.hover = -2;
    this.tempo = 1;              // ضریب ریتم انیمیشن‌ها (۱ = آهنگِ واقعی)
    this.onPoint = null; this.onRoll = null; this.onCube = null; this.onHover = null;
    this._bindPointer();
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    const box = this.c.parentElement.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = Math.max(320, box.width);
    const h = w * (LH / LW);
    this.c.style.height = `${h}px`;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.scale = (w * dpr) / LW;
    this.needsBg = true;
    this.render();
  }

  setTheme(t) { this.theme = t; this.needsBg = true; }
  setGame(st) { this.st = st; }
  setCube(v, owner) { this.cube = { value: v, owner }; }
  setDice(raw, side = -1) {
    this.dice = [raw, side];
    this.diceAnim = { t0: performance.now(), dur: side < 0 ? 0 : 620 * this.tempo };
  }
  setHints(h) { this.hints = { ...this.hints, ...h }; }
  flashPoint(idx, color = null, dur = 420) {
    if (typeof idx !== 'number' || idx < 0) return;
    this.flash.push({ idx, t0: performance.now(), dur: dur * this.tempo, color });
  }

  /**
   * @param {Array<{side:number,from:number,to:(number|null),kind:string,delay?:number,dur?:number}>} list
   */
  animate(list) {
    const t = performance.now();
    for (const a of list) {
      const o = { t0: t, ...a };
      o.delay = (a.delay || 0) * this.tempo;
      o.dur = (a.dur || 300) * this.tempo;
      this.anims.push(o);
    }
  }
  get busy() { return this.anims.length > 0; }

  // ---------------------------------------------------------------- pointer
  _toLogical(ev) {
    const r = this.c.getBoundingClientRect();
    const dpr = this.c.width / r.width;
    return { x: (ev.clientX - r.left) * dpr / this.scale, y: (ev.clientY - r.top) * dpr / this.scale };
  }

  hitAt(p) {
    if (!p) return null;
    const { x, y } = p;
    // کعب دبل
    if (x > FIELD.x1 + 2 && Math.abs(y - FIELD.my) < 30) return { kind: 'cube' };
    if (x > FIELD.x1) {                                    // سینی خروج
      return { kind: 'off', top: y < FIELD.my };
    }
    if (Math.abs(x - FIELD.cx) < BAR_W / 2) {
      return { kind: 'bar', top: y < FIELD.my };
    }
    if (this.dice[0] && this.dice[0].length) {
      const s = y > FIELD.my ? SIDE_WHITE : SIDE_BLACK;
      if (this.dice[1] === s && Math.abs(x - (s === SIDE_WHITE ? FIELD.cx + 168 : FIELD.cx - 168)) < 120) {
        return { kind: 'dice', side: s };
      }
    }
    for (let i = 0; i < POINTS; i++) {
      const g = pointGeom(i);
      if (Math.abs(x - g.x) > COL / 2) continue;
      const from = g.base, to = g.base + g.dir * DEPTH;
      const lo = Math.min(from, to), hi = Math.max(from, to);
      if (y >= lo - 6 && y <= hi + 12) return { kind: 'point', idx: i, inside: g.dir > 0 ? y <= to + 60 : y >= to - 60 };
    }
    return null;
  }

  _bindPointer() {
    const move = (ev) => {
      const h = this.hitAt(this._toLogical(ev));
      const idx = h && h.kind === 'point' ? h.idx : -2;
      if (idx !== this.hover) { this.hover = idx; this.onHover && this.onHover(h); }
      this.c.style.cursor = h && (h.kind === 'point' || h.kind === 'dice' || h.kind === 'cube') ? 'pointer' : 'default';
    };
    this.c.addEventListener('pointermove', move);
    this.c.addEventListener('pointerdown', (ev) => {
      const h = this.hitAt(this._toLogical(ev));
      if (!h) return;
      if (h.kind === 'point') this.onPoint && this.onPoint(h.idx);
      else if (h.kind === 'bar') this.onPoint && this.onPoint(-1);
      else if (h.kind === 'off' && !h.top) this.onPoint && this.onPoint(null);   // خارج کردن
      else if (h.kind === 'dice') this.onRoll && this.onRoll(h);
      else if (h.kind === 'cube') this.onCube && this.onCube();
    });
  }

  // ---------------------------------------------------------------- bg cache
  _drawBg() {
    const t = this.theme;
    const c = this.bg;
    c.width = this.c.width; c.height = this.c.height;
    const x = c.getContext('2d');
    x.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const lin = x.createLinearGradient(0, 0, LW, LH);
    lin.addColorStop(0, t.wood.light); lin.addColorStop(0.5, t.wood.base); lin.addColorStop(1, t.wood.dark);
    x.fillStyle = lin; x.fillRect(0, 0, LW, LH);

    // ریل‌ها و نقش حاشیه
    x.save();
    x.beginPath(); x.rect(0, 0, LW, LH);
    x.rect(RAIL, RAIL, FIELD.w, FIELD.h); x.clip('evenodd');
    x.fillStyle = t.rail.base; x.fillRect(0, 0, LW, LH);
    this._railMotif(x);
    // خطوط طلایی
    x.strokeStyle = t.rail.inlay; x.globalAlpha = 0.85; x.lineWidth = 1.6;
    x.strokeRect(RAIL - 5.5, RAIL - 5.5, FIELD.w + 11, FIELD.h + 11);
    x.globalAlpha = 0.35; x.lineWidth = 1;
    x.strokeRect(RAIL - 11.5, RAIL - 11.5, FIELD.w + 23, FIELD.h + 23);
    x.globalAlpha = 1;
    x.restore();

    // بوم (نمد)
    x.save();
    x.beginPath(); x.rect(FIELD.x0, FIELD.y0, FIELD.w, FIELD.h); x.clip();
    const f = x.createLinearGradient(FIELD.x0, FIELD.y0, FIELD.x1, FIELD.y1);
    f.addColorStop(0, t.felt[0]); f.addColorStop(1, t.felt[1]);
    x.fillStyle = f; x.fillRect(FIELD.x0, FIELD.y0, FIELD.w, FIELD.h);
    this._fieldMotif(x);
    x.restore();

    // وسط تخته
    x.save();
    x.beginPath(); x.rect(FIELD.cx - BAR_W / 2, FIELD.y0, BAR_W, FIELD.h); x.clip();
    const bg2 = x.createLinearGradient(FIELD.cx - BAR_W / 2, 0, FIELD.cx + BAR_W / 2, 0);
    bg2.addColorStop(0, t.wood.dark); bg2.addColorStop(0.45, t.wood.base); bg2.addColorStop(1, t.wood.dark);
    x.fillStyle = bg2; x.fillRect(FIELD.cx - BAR_W / 2, FIELD.y0, BAR_W, FIELD.h);
    x.restore();
    x.strokeStyle = t.rail.inlay; x.globalAlpha = 0.5; x.lineWidth = 1.2;
    x.strokeRect(FIELD.cx - BAR_W / 2 + 0.5, FIELD.y0 + 0.5, BAR_W - 1, FIELD.h - 1);
    x.globalAlpha = 1;

    // تی‌ها
    for (let i = 0; i < POINTS; i++) this._point(x, i);

    // سینی خروج
    this._offTray(x, false); this._offTray(x, true);
    // خط‌های وسط خانه‌ها (سایهٔ داخلی)
    const v = x.createRadialGradient(LW / 2, LH / 2, LH * 0.25, LW / 2, LH / 2, LH * 0.92);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = v; x.fillRect(0, 0, LW, LH);
    // نام تخته روی ریلِ چپ (عمودی) و نشانِ بازار در وسطِ ریل بالا
    x.save();
    x.fillStyle = t.rail.inlay;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.globalAlpha = 0.8;
    x.font = '800 14px Vazirmatn, Tahoma, sans-serif';
    x.fillText(`تختهٔ ${t.name} · ${t.sub}`, LW / 2, RAIL / 2 + 1);
    x.globalAlpha = 0.45;
    x.font = '500 11px Vazirmatn, Tahoma, sans-serif';
    x.translate(RAIL / 2 + 1, LH / 2); x.rotate(-Math.PI / 2);
    x.fillText(t.note || '', 0, 0);
    x.restore();
    this.needsBg = false;
  }

  _railMotif(x) {
    const t = this.theme, ink = t.rail.motif, gold = t.rail.inlay;
    x.save();
    x.lineWidth = 1.1;
    const bands = [[0, 0, LW, RAIL], [0, LH - RAIL, LW, RAIL], [0, 0, RAIL, LH], [LW - RAIL, 0, RAIL, LH]];
    for (const [bx, by, bw, bh] of bands) {
      x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
      x.globalAlpha = 0.55; x.strokeStyle = ink; x.fillStyle = ink;
      const horiz = bw > bh;
      switch (t.pattern) {
        case 'girih': this._pGirih(x, bx, by, bw, bh, horiz, gold); break;
        case 'kashi': this._pKashi(x, bx, by, bw, bh, horiz, gold); break;
        case 'kilim': this._pKilim(x, bx, by, bw, bh, horiz, gold); break;
        case 'shamsa': this._pShamsa(x, bx, by, bw, bh, horiz, gold); break;
        case 'herati': this._pHerati(x, bx, by, bw, bh, horiz, gold); break;
        case 'kufi': this._pKufi(x, bx, by, bw, bh, horiz, gold); break;
        case 'stars': this._pStars(x, bx, by, bw, bh, horiz, gold); break;
        default: this._pCopper(x, bx, by, bw, bh, horiz, gold);
      }
      x.restore();
    }
    x.restore();
  }

  _pGirih(x, bx, by, bw, bh, horiz, gold) {
    const s = 34;
    for (let i = -1; i * s < (horiz ? bw : bh) + s; i++) {
      const cx = horiz ? bx + i * s + s / 2 : bx + s / 2;
      const cy = horiz ? by + s / 2 : by + i * s + s / 2;
      x.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (Math.PI * 2 * k) / 16 + Math.PI / 16;
        const r = k % 2 ? s * 0.26 : s * 0.5;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.stroke();
      x.save(); x.globalAlpha = 0.28; x.strokeStyle = gold; x.beginPath();
      x.arc(cx, cy, s * 0.16, 0, Math.PI * 2); x.stroke(); x.restore();
    }
  }
  _pKashi(x, bx, by, bw, bh, horiz, gold) {
    const s = 22;
    const n = Math.ceil((horiz ? bw : bh) / s) + 1, m = Math.ceil((horiz ? bh : bw) / s) + 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const px = horiz ? bx + i * s : bx + j * s, py = horiz ? by + j * s : by + i * s;
      x.globalAlpha = (i + j) % 2 ? 0.3 : 0.12;
      x.fillRect(px + 1.5, py + 1.5, s - 3, s - 3);
      x.globalAlpha = 0.22; x.strokeStyle = gold;
      x.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    }
    x.globalAlpha = 1;
  }
  _pKilim(x, bx, by, bw, bh, horiz, gold) {
    const s = 26;
    const n = Math.ceil((horiz ? bw : bh) / s) + 1;
    for (let i = 0; i < n; i++) {
      const cx = horiz ? bx + i * s + s / 2 : bx + s / 2;
      const cy = horiz ? by + s / 2 : by + i * s + s / 2;
      x.beginPath();
      x.moveTo(cx, cy - 9); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 9); x.lineTo(cx - 9, cy); x.closePath();
      x.globalAlpha = 0.42; x.fill();
      x.globalAlpha = 0.6; x.strokeStyle = gold; x.beginPath();
      x.moveTo(cx - 9, cy - 9); x.lineTo(cx + 9, cy + 9); x.moveTo(cx + 9, cy - 9); x.lineTo(cx - 9, cy + 9);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  _pShamsa(x, bx, by, bw, bh, horiz, gold) {
    const s = 30;
    const n = Math.ceil((horiz ? bw : bh) / s) + 1;
    for (let i = 0; i < n; i++) {
      const cx = horiz ? bx + i * s + s / 2 : bx + s / 2;
      const cy = horiz ? by + s / 2 : by + i * s + s / 2;
      for (let k = 0; k < 12; k++) {
        const a = (Math.PI * 2 * k) / 12;
        x.beginPath();
        x.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 5.5, 2.4, a, 0, Math.PI * 2);
        x.globalAlpha = 0.3; x.fill();
      }
      x.globalAlpha = 0.7; x.strokeStyle = gold;
      x.beginPath(); x.arc(cx, cy, 3.4, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = 1;
  }
  _pHerati(x, bx, by, bw, bh, horiz, gold) {
    const s = 24;
    const n = Math.ceil((horiz ? bw : bh) / s) + 1;
    for (let i = 0; i < n; i++) {
      const cx = horiz ? bx + i * s + s / 2 : bx + s / 2;
      const cy = horiz ? by + s / 2 : by + i * s + s / 2;
      x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
      x.globalAlpha = 0.4;
      x.beginPath(); x.ellipse(0, -3, 4, 7.5, 0, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 0.55; x.strokeStyle = gold; x.lineWidth = 0.9;
      x.beginPath(); x.rect(-6, -6, 12, 12); x.stroke();
      x.restore();
    }
    x.globalAlpha = 1;
  }
  _pKufi(x, bx, by, bw, bh, horiz, gold) {
    const w = 26, h = 13;
    const cols = Math.ceil((horiz ? bw : bh) / w) + 1, rows = Math.ceil((horiz ? bh : bw) / h) + 1;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const off = (j % 2) * w / 2;
      const px = horiz ? bx + i * w + off : bx + j * w + off;
      const py = horiz ? by + j * h : by + i * h + off;
      x.globalAlpha = ((i + j) % 3) ? 0.18 : 0.34;
      if (horiz) x.fillRect(px, py, w - 2, h - 2); else x.fillRect(px, py, h - 2, w - 2);
    }
    x.globalAlpha = 0.3; x.strokeStyle = gold; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(bx, by + h * 1.5); x.lineTo(bx + bw, by + h * 1.5); x.stroke();
    x.globalAlpha = 1;
  }
  _pStars(x, bx, by, bw, bh, horiz, gold) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.round(((horiz ? bw : bh) * (horiz ? bh : bw)) / 260);
    for (let i = 0; i < n; i++) {
      const px = bx + rnd() * bw, py = by + rnd() * bh;
      const r = 0.6 + rnd() * 2.2;
      x.globalAlpha = 0.15 + rnd() * 0.5;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      if (r > 2.2) {
        x.globalAlpha = 0.4; x.strokeStyle = gold; x.lineWidth = 0.6;
        x.beginPath(); x.moveTo(px - r * 2.4, py); x.lineTo(px + r * 2.4, py);
        x.moveTo(px, py - r * 2.4); x.lineTo(px, py + r * 2.4); x.stroke();
      }
    }
    x.globalAlpha = 1;
  }
  _pCopper(x, bx, by, bw, bh, horiz, gold) {
    const s = 20;
    const n = Math.ceil((horiz ? bw : bh) / s) + 2, m = Math.ceil((horiz ? bh : bw) / s) + 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const px = horiz ? bx + i * s + (j % 2) * s / 2 : bx + j * s + (i % 2) * s / 2;
      const py = horiz ? by + j * s : by + i * s + (j % 2) * s / 2;
      x.globalAlpha = 0.22;
      x.beginPath(); x.ellipse(px, py, s * 0.42, s * 0.3, 0, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 0.25; x.strokeStyle = gold; x.lineWidth = 0.7;
      x.beginPath(); x.arc(px, py - 1.5, s * 0.2, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    }
    x.globalAlpha = 1;
  }

  _fieldMotif(x) {
    const t = this.theme;
    x.save();
    x.globalAlpha = 0.085;
    x.strokeStyle = t.rail.inlay; x.fillStyle = t.rail.inlay; x.lineWidth = 1.5;
    // شمسهٔ مرکزی محو
    const cx = FIELD.cx, cy = FIELD.my;
    for (let k = 0; k < 24; k++) {
      const a = (Math.PI * 2 * k) / 24;
      x.beginPath();
      x.ellipse(cx + Math.cos(a) * 92, cy + Math.sin(a) * 62, 46, 16, a, 0, Math.PI * 2);
      x.stroke();
    }
    x.beginPath(); x.arc(cx, cy, 150, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 0.04;
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.rect(FIELD.x0 + 30 + i * 40, FIELD.y0 + 24 + i * 26, FIELD.w - 60 - i * 80, FIELD.h - 48 - i * 52);
      x.stroke();
    }
    // دانه‌دانه (noise)
    x.globalAlpha = 0.035;
    let seed = 991;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1500; i++) x.fillRect(FIELD.x0 + rnd() * FIELD.w, FIELD.y0 + rnd() * FIELD.h, 1.4, 1.4);
    x.restore();
  }

  _point(x, i) {
    const t = this.theme, g = pointGeom(i);
    const A = t.point.a, B = t.point.b;
    const fill = i % 2 ? A : B;
    const tipY = g.base + g.dir * DEPTH;
    x.save();
    x.beginPath();
    x.moveTo(g.x - COL / 2 + 2, g.base);
    x.lineTo(g.x + COL / 2 - 2, g.base);
    x.lineTo(g.x, tipY);
    x.closePath();
    const grad = x.createLinearGradient(g.x, g.base, g.x, tipY);
    grad.addColorStop(0, fill);
    grad.addColorStop(0.65, shade(fill, -0.22));
    grad.addColorStop(1, shade(fill, -0.5));
    x.fillStyle = grad; x.globalAlpha = 0.95; x.fill();
    x.globalAlpha = 1;
    // تیغهٔ روشن برای القای گودی
    x.beginPath();
    x.moveTo(g.x - COL / 2 + 2, g.base); x.lineTo(g.x, tipY);
    x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 2; x.stroke();
    x.beginPath();
    x.moveTo(g.x + COL / 2 - 2, g.base); x.lineTo(g.x, tipY);
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2.4; x.stroke();
    // لبهٔ طلایی
    x.beginPath();
    x.moveTo(g.x - COL / 2 + 2, g.base); x.lineTo(g.x + COL / 2 - 2, g.base); x.lineTo(g.x, tipY); x.closePath();
    x.strokeStyle = t.point.edge; x.globalAlpha = 0.4; x.lineWidth = 1.1; x.stroke();
    x.globalAlpha = 1;
    // شمارهٔ تی روی ریل (۱ تا ۲۴ در جهت حرکتِ بازیکنِ پایین) — با حاشیه تا روی چوبِ روشن هم خوانا بماند
    x.globalAlpha = 0.92;
    x.font = '800 12px Vazirmatn, Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.55)';
    x.strokeText(toFa(i + 1), g.x, g.top ? RAIL / 2 + 1 : LH - RAIL / 2 - 1);
    x.fillStyle = t.point.edge;
    x.fillText(toFa(i + 1), g.x, g.top ? RAIL / 2 + 1 : LH - RAIL / 2 - 1);
    x.restore();
  }

  _offTray(x, top) {
    const t = this.theme;
    const bx = FIELD.x1 + 2, bw = OFF_W - 6;
    const by = top ? FIELD.y0 : FIELD.my + 2;
    const bh = FIELD.h / 2 - 4;
    x.save();
    x.beginPath(); x.roundRect(bx, by, bw, bh, 6);
    const g = x.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, t.wood.dark); g.addColorStop(1, t.wood.base);
    x.fillStyle = g; x.fill();
    x.strokeStyle = t.rail.inlay; x.globalAlpha = 0.4; x.lineWidth = 1.2; x.stroke();
    x.restore();
  }

  // ---------------------------------------------------------------- pieces
  _checker(x, cx, cy, r, side, opts = {}) {
    const t = this.theme;
    const pal = side === SIDE_WHITE ? t.checker.w : t.checker.b;
    const sq = 0.92;
    x.save();
    if (!opts.noShadow) {
      x.beginPath(); x.ellipse(cx + 2, cy + r * 0.42, r * 0.98, r * 0.42, 0, 0, Math.PI * 2);
      x.fillStyle = 'rgba(0,0,0,.42)'; x.fill();
    }
    x.beginPath(); x.ellipse(cx, cy, r, r * sq, 0, 0, Math.PI * 2);
    const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.5, r * 0.15, cx, cy, r * 1.25);
    g.addColorStop(0, pal.ring); g.addColorStop(0.35, pal.face); g.addColorStop(0.85, pal.mid); g.addColorStop(1, pal.edge);
    x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(1, r * 0.09); x.strokeStyle = pal.edge; x.stroke();
    // نقش روی مهره
    x.beginPath(); x.ellipse(cx, cy, r * 0.62, r * 0.62 * sq, 0, 0, Math.PI * 2);
    x.strokeStyle = pal.ring; x.globalAlpha = 0.55; x.lineWidth = Math.max(0.8, r * 0.07); x.stroke();
    x.globalAlpha = 0.9;
    x.beginPath(); x.ellipse(cx, cy, r * 0.2, r * 0.2 * sq, 0, 0, Math.PI * 2);
    x.fillStyle = pal.ring; x.globalAlpha = 0.35; x.fill();
    if (opts.ring) {
      x.globalAlpha = 1;
      x.beginPath(); x.ellipse(cx, cy, r * 1.16, r * 1.16 * sq, 0, 0, Math.PI * 2);
      x.strokeStyle = opts.ring; x.lineWidth = 2.4; x.setLineDash([5, 4]); x.stroke(); x.setLineDash([]);
    }
    x.restore();
  }

  _die(x, cx, cy, s, val, angle = 0, alpha = 1) {
    const t = this.theme;
    x.save();
    x.globalAlpha = alpha;
    x.translate(cx, cy); x.rotate(angle);
    x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
    const g = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, shade(t.dice.body, 0.12)); g.addColorStop(1, shade(t.dice.body, -0.2));
    x.fillStyle = g; x.fill();
    x.strokeStyle = t.dice.edge; x.lineWidth = 1.4; x.stroke();
    const p = s * 0.26;
    const dots = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    }[val] || [];
    x.fillStyle = t.dice.pip;
    for (const [dx, dy] of dots) {
      x.beginPath(); x.arc(dx * p, dy * p, s * 0.075, 0, Math.PI * 2); x.fill();
    }
    x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s * 0.34, [s * 0.22, s * 0.22, 0, 0]);
    x.fillStyle = 'rgba(255,255,255,.3)'; x.fill();
    x.restore();
  }

  _cube(x, cx, cy, s) {
    const t = this.theme;
    x.save();
    x.translate(cx, cy); x.rotate(-0.06);
    x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s, 7);
    const g = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, shade(t.cube.body, 0.4)); g.addColorStop(1, t.cube.body);
    x.fillStyle = g; x.fill();
    x.strokeStyle = t.cube.face; x.globalAlpha = 0.8; x.lineWidth = 1.6; x.stroke();
    x.globalAlpha = 1;
    x.fillStyle = t.cube.face;
    x.font = `800 ${Math.round(s * 0.52)}px Vazirmatn, Tahoma, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(toFa(this.cube.value), 0, 1);
    if (this.cube.owner >= 0) {
      x.beginPath(); x.arc(0, s * 0.44, 3.4, 0, Math.PI * 2);
      x.fillStyle = this.cube.owner === SIDE_WHITE ? t.checker.w.face : t.checker.b.edge;
      x.fill();
    }
    x.restore();
  }

  // ---------------------------------------------------------------- stacks
  _slotPos(idx, slot, total) {
    const g = pointGeom(idx);
    const span = Math.min(CR * 2.28, (DEPTH - CR * 2 - 6) / Math.max(1, total - 1));
    const d = Math.min(CR, COL * 0.44, 30);
    const first = g.base + g.dir * (d + 3);
    return { x: g.x, y: first + g.dir * span * slot, r: d };
  }

  _pointStack(x, idx, side, count) {
    const g = pointGeom(idx);
    const d = Math.min(CR, COL * 0.44, 30);
    const span = Math.min(d * 2.28, Math.max(6, (DEPTH - d * 2 - 6) / Math.max(1, count - 1)));
    const first = g.base + g.dir * (d + 3);
    for (let s = 0; s < count; s++) {
      const cy = first + g.dir * span * s;
      this._checker(x, g.x, cy, d, side, { noShadow: s > 2 });
    }
    return { x: g.x, y: first + g.dir * span * Math.max(0, count - 1), r: d };
  }

  // ---------------------------------------------------------------- render
  render() {
    const x = this.ctx, t = this.theme;
    if (!t || !this.st) return;
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (this.needsBg) this._drawBg();
    x.drawImage(this.bg, 0, 0);
    x.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const now = performance.now();
    const anims = this.anims.filter((a) => (now - a.t0 - a.delay) / a.dur < 1.02);
    this.anims = anims;

    // مهره‌هایی که هنوز در هوا هستند: مقصدشان را خالی نگه می‌داریم
    const hide = new Map();
    for (const a of this.anims) {
      const key = a.to === -1 ? `bar:${a.side}` : a.to === null || a.to === undefined
        ? `off:${a.side}` : `pt:${a.to}:${a.side}`;
      hide.set(key, (hide.get(key) || 0) + 1);
    }

    // مهره‌ها روی تی‌ها
    for (let i = 0; i < POINTS; i++) {
      const wC = countAt(this.st, i, SIDE_WHITE), bC = countAt(this.st, i, SIDE_BLACK);
      const wH = hide.get(`pt:${i}:${SIDE_WHITE}`) || 0, bH = hide.get(`pt:${i}:${SIDE_BLACK}`) || 0;
      if (wC - wH > 0) this._pointStack(x, i, SIDE_WHITE, wC - wH);
      if (bC - bH > 0) this._pointStack(x, i, SIDE_BLACK, bC - bH);
    }

    // مهره‌های وسط
    for (const side of [SIDE_WHITE, SIDE_BLACK]) {
      let n = this.st.bar[side] - (hide.get(`bar:${side}`) || 0);
      if (n > 0) {
        const cols = n > 4 ? 2 : 1;
        const d = cols === 2 ? 12 : 14;
        for (let i = 0; i < n; i++) {
          const col = cols === 2 ? i % 2 : 0;
          const row = Math.floor(i / cols);
          const cx = FIELD.cx + (col - (cols - 1) / 2) * (d * 2 + 2);
          const cy = side === SIDE_WHITE ? FIELD.my + 16 + row * (d * 1.5) : FIELD.my - 16 - row * (d * 1.5);
          this._checker(x, cx, cy, d, side, { noShadow: i > 1 });
        }
      }
    }

    // سینی خروج
    for (const side of [SIDE_WHITE, SIDE_BLACK]) {
      let n = this.st.off[side] - (hide.get(`off:${side}`) || 0);
      if (n <= 0) continue;
      const top = side === SIDE_BLACK;
      const bx = FIELD.x1 + OFF_W / 2;
      const bh = FIELD.h / 2 - 10;
      const step = Math.min(13, bh / Math.max(1, n));
      for (let i = 0; i < n; i++) {
        const cy = top ? FIELD.y1 - FIELD.h / 2 + 8 + i * step : FIELD.my + 8 + i * step;
        x.save();
        x.beginPath(); x.roundRect(bx - 15, cy, 30, Math.max(4, step - 2), 2.5);
        x.fillStyle = side === SIDE_WHITE ? t.checker.w.face : t.checker.b.face;
        x.globalAlpha = 0.9; x.fill();
        x.strokeStyle = side === SIDE_WHITE ? t.checker.w.edge : t.checker.b.edge;
        x.globalAlpha = 0.6; x.lineWidth = 0.8; x.stroke();
        x.restore();
      }
    }

    // هایلایت‌ها
    this._drawHints(x, now);
    // انیمیشن حرکت‌ها
    for (const a of this.anims) {
      const p = clamp01((now - a.t0 - a.delay) / a.dur);
      const e = easeInOut(p);
      const from = this._posOf(a.side, a.from, 'from');
      const to = this._posOf(a.side, a.to, 'to');
      if (!from || !to) continue;
      const arc = a.kind === 'hit' ? 66 : a.kind === 'off' ? 40 : 26;
      const cxp = (from.x + to.x) / 2, cyp = (from.y + to.y) / 2 - arc;
      const bx1 = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cxp + e * e * to.x;
      const by1 = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cyp + e * e * to.y;
      const r = Math.max(to.r, 14) * (1 + 0.12 * Math.sin(Math.PI * p));
      x.save();
      x.globalAlpha = 0.22;
      x.beginPath(); x.ellipse(bx1, by1 + 16, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
      x.fillStyle = '#000'; x.fill();
      x.restore();
      this._checker(x, bx1, by1, r, a.side, { noShadow: true });
    }
    // فلاش‌ها
    this.flash = this.flash.filter((f) => (now - f.t0) / f.dur < 1);
    for (const f of this.flash) {
      const p = (now - f.t0) / f.dur;
      const g = pointGeom(f.idx);
      x.save();
      x.globalAlpha = (1 - p) * 0.75;
      x.beginPath();
      x.moveTo(g.x - COL / 2 + 2, g.base); x.lineTo(g.x + COL / 2 - 2, g.base);
      x.lineTo(g.x, g.base + g.dir * DEPTH); x.closePath();
      x.fillStyle = f.color || t.glow; x.fill();
      x.restore();
    }

    // کعب دبل
    this._cube(x, LW - OFF_W / 2 - 1, FIELD.my, 34);
    // تاس‌ها
    this._drawDice(x, now);

    // برق سرّاح روی چوب
    const sweep = ((now - this.t0) / 9000) % 1;
    x.save();
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = 0.05;
    const sw = x.createLinearGradient(-LW + sweep * LW * 3, 0, sweep * LW * 3, LH);
    sw.addColorStop(0, 'rgba(255,255,255,0)');
    sw.addColorStop(0.5, 'rgba(255,255,255,1)');
    sw.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sw; x.fillRect(0, 0, LW, LH);
    x.restore();
  }

  _posOf(side, idx, role) {
    const st = this.st;
    if (idx === -1) {                                  // وسط
      const n = Math.max(1, st.bar[side]);
      const cols = n > 4 ? 2 : 1;
      return {
        x: FIELD.cx + ((n % cols) - (cols - 1) / 2) * 30,
        y: side === SIDE_WHITE ? FIELD.my + 16 : FIELD.my - 16, r: 16,
      };
    }
    if (idx === null || idx === undefined) {             // خارج از بازی
      const top = side === SIDE_BLACK;
      const n = Math.max(1, st.off[side]);
      return { x: FIELD.x1 + OFF_W / 2, y: top ? FIELD.y1 - FIELD.h / 2 + 8 + n * 8 : FIELD.my + 8 + n * 8, r: 14 };
    }
    const g = pointGeom(idx);
    const total = countAt(st, idx, side);
    const slot = role === 'from' ? Math.max(0, total) : Math.max(0, total - 1);
    return { ...this._slotPos(idx, slot, Math.max(1, total)), r: Math.min(CR, COL * 0.44, 30) };
  }

  _drawDice(x, now) {
    const t = this.theme;
    const [raw, active] = this.dice;
    if (!raw || !raw.length) return;
    let p = 1;
    if (this.diceAnim) {
      p = clamp01((now - this.diceAnim.t0) / (this.diceAnim.dur || 1));
      if (p >= 1) this.diceAnim = null;
    }
    const sets = active >= 0 ? [active] : [SIDE_WHITE];
    for (const side of sets) {
      const dy = side === SIDE_WHITE ? FIELD.my + 22 : FIELD.my - 22;
      const dx = side === SIDE_WHITE ? FIELD.cx + 168 : FIELD.cx - 168;
      raw.forEach((v, i) => {
        const off = (i - (raw.length - 1) / 2) * 46;
        const bounce = 1 - Math.abs(Math.sin(p * Math.PI * (2 + i * 0.4))) * (1 - p);
        const cx = dx + off + (p < 1 ? (Math.random() - 0.5) * 8 : 0);
        const cy = dy - bounce * 40;
        const ang = (1 - p) * (6 + i * 3) + (p < 1 ? 0 : (i ? 0.09 : -0.07));
        this._die(x, cx, cy, 42, v, ang, active === side || active < 0 ? 1 : 0.45);
      });
    }
    void t;
  }

  _drawHints(x, now) {
    const t = this.theme, h = this.hints;
    const pulse = 0.55 + 0.45 * Math.sin((now - this.t0) / 260);
    if (h.noMove && now < h.noMove) {
      x.save();
      x.globalAlpha = 0.5 * pulse;
      x.fillStyle = t.hit;
      x.font = '800 30px Vazirmatn, Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('هیچ حرکتی ممکن نیست — تاس رد شد', LW / 2, FIELD.my);
      x.restore();
    }
    for (const idx of h.sources || []) {
      const g = pointGeom(idx);
      x.save();
      x.globalAlpha = 0.28 + 0.22 * pulse;
      x.beginPath();
      x.moveTo(g.x - COL / 2 + 2, g.base); x.lineTo(g.x + COL / 2 - 2, g.base);
      x.lineTo(g.x, g.base + g.dir * DEPTH); x.closePath();
      x.fillStyle = t.hint; x.fill();
      x.restore();
    }
    for (const [idx, info] of h.targets || []) {
      if (idx < 0) continue;
      const g = pointGeom(idx);
      const cy = g.base + g.dir * (DEPTH - 26);
      x.save();
      x.globalAlpha = 0.9;
      x.beginPath(); x.arc(g.x, cy, 12 + 3 * pulse, 0, Math.PI * 2);
      x.strokeStyle = t.hint; x.lineWidth = 2.4; x.setLineDash([4, 4]); x.stroke();
      x.beginPath(); x.arc(g.x, cy, 5, 0, Math.PI * 2); x.fillStyle = t.hint; x.fill();
      if (info && info.die) {
        x.setLineDash([]);
        x.fillStyle = t.hint; x.globalAlpha = 0.16;
        x.beginPath(); x.roundRect(g.x - 15, cy + g.dir * 20, 30, 20, 6); x.fill();
        x.globalAlpha = 1; x.fillStyle = t.point.edge;
        x.font = '700 13px Vazirmatn, Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(toFa(info.die), g.x, cy + g.dir * 20 + 10.5);
      }
      x.restore();
    }
    if (h.bearOff) {
      x.save(); x.globalAlpha = 0.28 + 0.3 * pulse;
      x.fillStyle = t.hint;
      x.beginPath(); x.roundRect(FIELD.x1 + 2, FIELD.my + 2, OFF_W - 6, FIELD.h / 2 - 4, 6); x.fill();
      x.globalAlpha = 1; x.fillStyle = t.point.edge;
      x.font = '800 13px Vazirmatn, Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.save(); x.translate(FIELD.x1 + OFF_W / 2, FIELD.my + FIELD.h / 4); x.rotate(Math.PI / 2);
      x.fillText('خارج کن', 0, 0); x.restore(); x.restore();
    }
    if (h.selected === -1) {
      x.save(); x.globalAlpha = 0.8;
      x.strokeStyle = t.glow; x.lineWidth = 2;
      x.strokeRect(FIELD.cx - BAR_W / 2 + 3, FIELD.my, BAR_W - 6, FIELD.h / 2 - 6);
      x.restore();
    } else if (typeof h.selected === 'number') {
      const p = this._posOf(SIDE_WHITE, h.selected, 'from');
      x.save(); x.globalAlpha = 0.85;
      x.beginPath(); x.ellipse(p.x, p.y, p.r * 1.3, p.r * 1.2, 0, 0, Math.PI * 2);
      x.strokeStyle = t.glow; x.lineWidth = 2.6; x.stroke();
      x.restore();
    }
    // فلش راهنمای حرکت آخر حریف
    if (h.lastMove) {
      for (const m of h.lastMove) {
        const a = this._posOf(m.side, m.from, 'to'), b = this._posOf(m.side, m.to, 'to');
        if (!a || !b) continue;
        x.save();
        x.globalAlpha = 0.35 * pulse; x.strokeStyle = t.glow; x.lineWidth = 3;
        x.setLineDash([7, 6]);
        x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, b.x, b.y); x.stroke();
        x.restore();
      }
    }
  }
}

export const BOARD = { LW, LH, DEPTH, COL, FIELD, BAR_W, OFF_W };

/* ------------------------------------------------------------- utilities */
function toFa(n) { return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]); }

/** روشن/تیره کردن رنگ hex */
export function shade(hex, amt) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** شمارهٔ تی برای نمایش (۱..۲۴ در امتداد حرکت سفید) */
export const pointNumber = (idx) => idx + 1;
