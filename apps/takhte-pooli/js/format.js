/** ابزارهای قالب‌بندی فارسی: رقم، تومان، تاریخ جلالی، شمارش معکوس */

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export const fa = (n) => nf.format(Math.round(n));
export const fa1 = (n) => nf2.format(n);

export const toman = (n) => `${fa(Math.abs(Math.round(n)))} تومان`;
export const tomanSigned = (n) => (n >= 0 ? `+${fa(n)}` : `−${fa(-n)}`);
export const shortToman = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${fa1(a / 1e6)} میلیون`;
  if (a >= 1e3) return `${fa(Math.round(a / 1e3))} هزار`;
  return fa(a);
};

const DT = {};
const fmtDate = (opts) => {
  const k = JSON.stringify(opts);
  if (!DT[k]) DT[k] = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { calendar: 'persian', ...opts });
  return DT[k];
};

export const jalaliDate = (ms) => fmtDate({ year: 'numeric', month: 'long', day: 'numeric' }).format(ms);
export const jalaliShort = (ms) => fmtDate({ month: 'long', day: 'numeric' }).format(ms);
export const jalaliTime = (ms) => fmtDate({ hour: '2-digit', minute: '2-digit' }).format(ms);
export const jalaliFull = (ms) =>
  fmtDate({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(ms);

const pad = (n) => String(n).padStart(2, '0');

/** «۰۷:۴۲:۱۳» */
export function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** «۷ ساعت و ۴۲ دقیقه و ۱۳ ثانیه» */
export function humanDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const parts = [];
  if (d) parts.push(`${fa(d)} روز`);
  if (h) parts.push(`${fa(h)} ساعت`);
  if (m && !d) parts.push(`${fa(m)} دقیقه`);
  if (!d && !h && !m) parts.push(`${fa(s)} ثانیه`);
  return parts.join(' و ') || 'چند لحظه';
}

export const pluralFa = (n, one, many) => (n === 1 ? one : many);
export const pct = (v) => `${fa(Math.round(v * 100))}٪`;
