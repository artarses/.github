/**
 * تختهٔ پولی — هر «دست» با یک تختهٔ ایرانیِ تازه آغاز می‌شود.
 * هر تم هم رنگ‌وبوی تخته (چوب، نمد، تی‌ها، مهره‌ها، تاس) را عوض می‌کند و هم
 * پالت کل رابط کاربری را (با متغیرهای CSS) — یعنی با هر دست، کل سالن عوض می‌شود.
 */
export const THEMES = [
  {
    id: 'yazdi', name: 'یزدی', sub: 'داراب‌کده', pattern: 'girih',
    wood: { base: '#3b2416', light: '#63401f', dark: '#1c1007', grain: '#7a4f28' },
    felt: ['#2b1b10', '#160d07'],
    rail: { base: '#291709', inlay: '#d09b3a', motif: '#8c5c26' },
    point: { a: '#0e6a60', b: '#c78d2b', edge: '#f0cd78' },
    checker: {
      w: { face: '#f6ead0', mid: '#dcc597', edge: '#8e7340', ring: '#fffaef' },
      b: { face: '#39281a', mid: '#1e1206', edge: '#ac7d33', ring: '#e6c37c' },
    },
    dice: { body: '#f8f1e0', pip: '#7c1f1c', edge: '#c9b189' },
    cube: { body: '#120d08', face: '#ead9ae', pip: '#b5281f' },
    ui: { bg0: '#0a0604', bg1: '#1d1209', panel: 'rgba(41,25,14,.74)', line: 'rgba(208,155,58,.26)', accent: '#e2ae41', accent2: '#3fc9b6', ink: '#f7ecd6', sub: '#c6ac8b', ok: '#69d69f', bad: '#ff7d6b' },
    glow: '#ffcf6a', hit: '#ff5b45', hint: '#41e0c4',
    note: 'خشت و گل و صدای تاس در قهوه‌خانهٔ امیرچقماق',
  },
  {
    id: 'esfahani', name: 'اصفهانی', sub: 'نقش جهان', pattern: 'kashi',
    wood: { base: '#123049', light: '#1d4a6c', dark: '#081a2b', grain: '#2a6489' },
    felt: ['#0d2c44', '#061725'],
    rail: { base: '#0a2236', inlay: '#e6c26b', motif: '#2f7fa5' },
    point: { a: '#1c9bb5', b: '#e0b24a', edge: '#ffe6a6' },
    checker: {
      w: { face: '#eaf6ff', mid: '#b9d9ea', edge: '#4d7f97', ring: '#ffffff' },
      b: { face: '#123a58', mid: '#071f32', edge: '#3ea0c4', ring: '#9fe4f7' },
    },
    dice: { body: '#f2fbff', pip: '#0f4a66', edge: '#a8cede' },
    cube: { body: '#061b28', face: '#d9ecf6', pip: '#e0b24a' },
    ui: { bg0: '#04101b', bg1: '#0b2739', panel: 'rgba(10,38,56,.76)', line: 'rgba(230,194,107,.24)', accent: '#e8c46e', accent2: '#37c7e0', ink: '#e9f6ff', sub: '#9dc0d6', ok: '#5fd7b0', bad: '#ff8272' },
    glow: '#7fe6ff', hit: '#ff6a52', hint: '#8affd6',
    note: 'فیروزه و لاجورد، هفت‌رنگِ کاشی‌کاری صفوی',
  },
  {
    id: 'tabari', name: 'تبری', sub: 'جنگل ابر', pattern: 'kilim',
    wood: { base: '#2c3a22', light: '#465c33', dark: '#141c0e', grain: '#5c7742' },
    felt: ['#1e2c17', '#0d1408'],
    rail: { base: '#33261a', inlay: '#c98b3c', motif: '#7b8f4e' },
    point: { a: '#b5651d', b: '#e0c469', edge: '#ffe9b0' },
    checker: {
      w: { face: '#f4ecd6', mid: '#d8c9a2', edge: '#7d6b41', ring: '#fffdf2' },
      b: { face: '#2f4a2a', mid: '#16260f', edge: '#a9752f', ring: '#dcc07f' },
    },
    dice: { body: '#f5efdd', pip: '#8d3a13', edge: '#b6ab84' },
    cube: { body: '#1a2413', face: '#e8ddb8', pip: '#b5651d' },
    ui: { bg0: '#0a1107', bg1: '#16260f', panel: 'rgba(24,44,20,.76)', line: 'rgba(201,139,60,.24)', accent: '#d9a441', accent2: '#7ad06a', ink: '#f1f5e2', sub: '#b3c09a', ok: '#78dc92', bad: '#ff8a6a' },
    glow: '#c9f07a', hit: '#ff6b3d', hint: '#9dff8a',
    note: 'باران، چوب تر و قالی کیلیمِ گلیم‌بافِ لاریج',
  },
  {
    id: 'qajari', name: 'قاجاری', sub: 'گلستان', pattern: 'shamsa',
    wood: { base: '#4d1b2c', light: '#7a2f45', dark: '#2a0d17', grain: '#99415c' },
    felt: ['#3d1524', '#1d0810'],
    rail: { base: '#2c0e1a', inlay: '#eac470', motif: '#c96a86' },
    point: { a: '#c94a6a', b: '#e8bf5e', edge: '#ffeab4' },
    checker: {
      w: { face: '#fff4e2', mid: '#eed6b2', edge: '#b48c45', ring: '#fffdf6' },
      b: { face: '#7b2340', mid: '#3d0d1e', edge: '#dfae58', ring: '#f6d79a' },
    },
    dice: { body: '#fdf3e3', pip: '#8e1f3a', edge: '#d9b781' },
    cube: { body: '#2b0d18', face: '#f2dcae', pip: '#c94a6a' },
    ui: { bg0: '#160610', bg1: '#33101f', panel: 'rgba(58,16,32,.76)', line: 'rgba(234,196,112,.26)', accent: '#eec877', accent2: '#e2607f', ink: '#fdeee0', sub: '#d3a9a0', ok: '#7ad9a4', bad: '#ff7d8a' },
    glow: '#ffd98a', hit: '#ff4d6d', hint: '#ffb3c8',
    note: 'نگارگری قاجاری، طلاکاری و شمسهٔ تالار آیینه',
  },
  {
    id: 'khorasani', name: 'خراسانی', sub: 'سفرانه', pattern: 'herati',
    wood: { base: '#4a2e14', light: '#7a4c1e', dark: '#241505', grain: '#98652b' },
    felt: ['#33200e', '#180c04'],
    rail: { base: '#241405', inlay: '#f0b429', motif: '#a3362a' },
    point: { a: '#b83227', b: '#f0b429', edge: '#ffe08a' },
    checker: {
      w: { face: '#fdf2d8', mid: '#e6cf9c', edge: '#a3813a', ring: '#fffbec' },
      b: { face: '#4a2b12', mid: '#221203', edge: '#d99b2c', ring: '#f2c66a' },
    },
    dice: { body: '#fbeed2', pip: '#a3362a', edge: '#c69f57' },
    cube: { body: '#1d0f03', face: '#f4dfa8', pip: '#f0b429' },
    ui: { bg0: '#0e0803', bg1: '#241405', panel: 'rgba(44,25,8,.76)', line: 'rgba(240,180,41,.24)', accent: '#f2bb3c', accent2: '#e05a3a', ink: '#fbf0d8', sub: '#cfae7e', ok: '#84d78f', bad: '#ff8163' },
    glow: '#ffd15c', hit: '#ff5533', hint: '#ffd15c',
    note: 'زعفران و زرشک، تختهٔ گردوییِ مشهد',
  },
  {
    id: 'shirazi', name: 'شیرازی', sub: 'ارگ کریم‌خان', pattern: 'kufi',
    wood: { base: '#7b6a4f', light: '#a29070', dark: '#4a3e2b', grain: '#bda985' },
    felt: ['#cbbfa4', '#9d9179'],
    rail: { base: '#e4dcc7', inlay: '#2e6b52', motif: '#1f4f6b' },
    point: { a: '#2e6b52', b: '#1f4f6b', edge: '#f4f1e4' },
    checker: {
      w: { face: '#fdfbf2', mid: '#e2dbc6', edge: '#8a8067', ring: '#ffffff' },
      b: { face: '#24503f', mid: '#0f2a20', edge: '#5f9d81', ring: '#a8d9bf' },
    },
    dice: { body: '#fffdf5', pip: '#2e6b52', edge: '#b8ac8d' },
    cube: { body: '#f0ebda', face: '#2e6b52', pip: '#e4dcc7' },
    ui: { bg0: '#161a18', bg1: '#28322c', panel: 'rgba(34,46,40,.78)', line: 'rgba(200,220,190,.2)', accent: '#dfe7c9', accent2: '#59c6a0', ink: '#f4f7ee', sub: '#b3c3b6', ok: '#78dca2', bad: '#ff8b7a' },
    glow: '#d7f5c8', hit: '#ff6b52', hint: '#8fe8c4',
    note: 'سنگ و آجر کوفی، باغ‌های شیراز و ارگ وکیل',
  },
  {
    id: 'yalda', name: 'یلدا', sub: 'شب چله', pattern: 'stars',
    wood: { base: '#171a34', light: '#2b2f5c', dark: '#0a0b1c', grain: '#3d4380' },
    felt: ['#12142c', '#070713'],
    rail: { base: '#0e0f22', inlay: '#b9c4ff', motif: '#8c1b2e' },
    point: { a: '#8c1b2e', b: '#3a4188', edge: '#cfd8ff' },
    checker: {
      w: { face: '#f3f4ff', mid: '#c9cdf0', edge: '#6d72a8', ring: '#ffffff' },
      b: { face: '#5e1020', mid: '#2c0510', edge: '#b9c4ff', ring: '#e9ecff' },
    },
    dice: { body: '#eef0ff', pip: '#8c1b2e', edge: '#8a90c8' },
    cube: { body: '#0b0c1c', face: '#dfe3ff', pip: '#a72440' },
    ui: { bg0: '#05050f', bg1: '#12142c', panel: 'rgba(16,18,44,.8)', line: 'rgba(185,196,255,.2)', accent: '#c3ccff', accent2: '#e0567a', ink: '#eef0ff', sub: '#9aa1cd', ok: '#78d9c0', bad: '#ff7f9c' },
    glow: '#b7c4ff', hit: '#ff4d6a', hint: '#9fd8ff',
    note: 'انار، هندوانه و طولانی‌ترین شب سال زیر ستاره‌ها',
  },
  {
    id: 'hamadani', name: 'همدانی', sub: 'فیروزه‌کوب', pattern: 'copper',
    wood: { base: '#2f4043', light: '#4a6266', dark: '#182325', grain: '#6b8a8d' },
    felt: ['#1c3a3c', '#0b1a1c'],
    rail: { base: '#16292b', inlay: '#9fb8bd', motif: '#2fa0a5' },
    point: { a: '#2fa0a5', b: '#a8c0c4', edge: '#e6f6f8' },
    checker: {
      w: { face: '#eefaf9', mid: '#c4dcda', edge: '#7d9a98', ring: '#ffffff' },
      b: { face: '#173c3e', mid: '#07201f', edge: '#7fd4d6', ring: '#b9f0ef' },
    },
    dice: { body: '#f4fdfc', pip: '#155e60', edge: '#a6c3c4' },
    cube: { body: '#0d1f20', face: '#cfe9e8', pip: '#2fa0a5' },
    ui: { bg0: '#060f10', bg1: '#12282a', panel: 'rgba(16,44,46,.78)', line: 'rgba(159,184,189,.24)', accent: '#8fe4e2', accent2: '#d8b25f', ink: '#e7f7f6', sub: '#93b4b3', ok: '#6fe0b2', bad: '#ff8a7a' },
    glow: '#a5f0ee', hit: '#ff6a4d', hint: '#8ff0d8',
    note: 'مس کوبیده و فیروزهٔ عیان، تختهٔ سیمرغ هگمتانه',
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const themeIndex = (id) => Math.max(0, THEMES.findIndex((t) => t.id === id));

/** اعمال پالت تم روی متغیرهای CSS کل صفحه */
export function applyThemeVars(t) {
  const r = document.documentElement.style;
  const map = {
    '--bg0': t.ui.bg0, '--bg1': t.ui.bg1, '--panel': t.ui.panel, '--line': t.ui.line,
    '--accent': t.ui.accent, '--accent2': t.ui.accent2, '--ink': t.ui.ink, '--sub': t.ui.sub,
    '--ok': t.ui.ok, '--bad': t.ui.bad, '--glow': t.glow, '--hit': t.hit, '--hint': t.hint,
    '--wood': t.wood.base, '--pointA': t.point.a, '--pointB': t.point.b,
  };
  for (const [k, v] of Object.entries(map)) r.setProperty(k, v);
}
