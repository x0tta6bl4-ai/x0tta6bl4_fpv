// Fig: штурманский стол (гл. 19). На столе лежит карта с сеткой 1 см, рекой, лесом и холмом; булавки А и Б
// отмечают отрезок, его длину на карте задаёт ползунок, масштаб — переключатель. Справа — роза ветров
// с ветроуказателем и дроном над ней, табличка с прогнозом ветра; сзади — мачта высоты с дроном и термометр
// (−0,6 °C на каждые 100 м). Север — от зрителя (−x), восток — вправо (−y). Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, fmt, clamp, TAU, labelsAt, ellipseOnTop } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -96, y: -122, w: 192, d: 244, r: 8 };
const MAP = { x: -84, y: -16, w: 106, d: 130 }; // лист карты: вдоль x — с севера на юг, вдоль y — с запада на восток
const CMU = 9; // единиц стола в 1 см карты
const LINE_V = 0.66 * MAP.w, A_U = 14; // линия А–Б на карте (локальные координаты листа)
const ROSE = [50, -72], ROSE_R = 30;
const SOCK = [14, -104];
const SIGN = { x: 74, y: 30, w: 4, d: 42, z0: 10, h: 24 };
const MAST = [-58, -80], BOARD = { x: -70, y: -88, w: 3, d: 6 };
const THERMO = [-46, -106];
const HZ = (h) => 10 + h * 0.072; // высота 0–1000 м → высота на мачте
const GROUND_T = 3;

export const SCALES = [[25000, "1:25 000"], [50000, "1:50 000"], [100000, "1:100 000"]];
export const WINDS = [["N", "северный"], ["S", "южный"], ["W", "западный"], ["E", "восточный"]];
const WIND_NAME = Object.fromEntries(WINDS);
const SIDE_NAME = { N: "север", S: "юг", W: "запад", E: "восток" };
const LETTER = { N: "С", S: "Ю", W: "З", E: "В" };
const OPP = { N: "S", S: "N", W: "E", E: "W" };
const DIR = { N: [-1, 0], S: [1, 0], W: [0, 1], E: [0, -1] }; // куда смотрит сторона света в мире стола

export function navModel(s) {
  const sc = Number(s.sc), cm = Number(s.cm);
  const mPerCm = sc / 100;
  const meters = cm * mPerCm;
  const T = GROUND_T - (0.6 * Number(s.h)) / 100;
  const to = OPP[s.wind];
  return { sc, cm, mPerCm, meters, T, to, right: s.guess ? s.guess === to : null };
}
const dist = (m) => (m >= 1000 ? `${fmt(m / 1000, 2)} км` : `${fmt(m)} м`);
const temp = (T) => `${T > 0.04 ? "+" : ""}${fmt(Math.abs(T) < 0.05 ? 0 : T, 1)} °C`;

export const meta = {
  id: "navdesk",
  title: "Штурманский стол",
  hint: "Масштаб, отрезок, ветер и высота — справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Красная линия на карте — отрезок А–Б; плашка у линии — его длина на карте и на местности" },
    { mark: "raised", label: "Карта на столе, роза ветров с ветроуказателем, табличка прогноза, мачта высоты, термометр" },
    { mark: "edge", label: "Пунктир от дрона над розой — куда его сносит ветер" },
  ],
  caption: "Масштаб 1:50 000 значит: 1 см на карте = 50 000 см = 500 м на местности; 1:25 000 — 250 м, 1:100 000 — 1 км. Ветер называют по стороне, откуда он дует: южный дует с юга на север и сносит дрон на север. С высотой воздух холоднее примерно на 0,6 °C на каждые 100 м (в среднем, в ясную погоду бывает иначе).",
  aria: "Справа: масштаб карты, длина отрезка А–Б на карте, откуда дует ветер, куда снесёт дрон, высота полёта.",
  missions: [
    {
      id: "km50", look: ["map", "pins"], touch: ["sc=50000", "cm"], see: "длину отрезка А–Б на карте и подпись «на местности»",
      text: "На карте 1:50 000 отмерь ровно 1 км: двигай «Отрезок А–Б на карте»",
      check: (f, s) => Number(s.sc) === 50000 && Math.abs(f.meters - 1000) <= 40,
      predict: { q: "Карта 1:50 000. Сколько сантиметров на ней займёт 1 км?", options: ["1 см", "2 см", "5 см"], right: 1 },
      setup: { sc: 50000, cm: 3 },
    },
    {
      id: "cm25", look: ["map", "pins"], touch: ["sc=25000", "cm"], see: "подпись «на местности» у отрезка",
      text: "Переключи на 1:25 000 и поставь точки в 4 см друг от друга. Сколько это метров?",
      check: (f, s) => Number(s.sc) === 25000 && Math.abs(f.cm - 4) <= 0.05,
      predict: { q: "Карта 1:25 000. Отрезок 4 см — это сколько на местности?", options: ["250 м", "1 км", "4 км"], right: 1 },
      setup: { sc: 25000, cm: 1 },
    },
    {
      id: "wind", look: ["rose", "sign"], touch: ["guess"], see: "табличку прогноза, потом ветроуказатель и дрон над розой",
      text: "Прогноз: ветер южный. Выбери сторону, куда снесёт дрон",
      check: (f, s) => s.wind === "S" && s.guess === "N",
      feedback: (f, s) => (s.guess && s.guess !== "N" && s.wind === "S" ? (s.guess === "S" ? "Нет: южный ветер дует С юга, а не на юг. Его называют по стороне, откуда он дует." : "Нет: ветер несёт дрон по своему направлению, а не вбок. Южный — с юга на север.") : ""),
      setup: { wind: "S", guess: "" },
    },
    {
      id: "zero", look: ["mast", "thermo"], touch: ["h"], see: "термометр у мачты",
      text: "У земли +3 °C. Найди высоту, где будет 0 °C",
      check: (f) => Math.abs(f.T) < 0.05,
      predict: { q: "У земли +3 °C. На какой высоте будет 0 °C?", options: ["Около 100 м", "Около 500 м", "Около 3 км"], right: 1 },
      setup: { h: 0 },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [MAST[0], MAST[1], HZ(1000) + 12], [SOCK[0], SOCK[1], 50], [THERMO[0], THERMO[1], 76]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
// Точка листа карты (u — на восток, v — на юг, в единицах стола) → мир.
const onMap = (u, v, z = 1.4) => [MAP.x + v, MAP.y + MAP.d - u, z];

// Маленький дрон: корпус, четыре луча с моторами и дисками винтов.
export function miniDrone(S, cx, cy, z, { r = 7, lit = false } = {}) {
  S.cyl(cx, cy, r * 0.42, z - 1, 2.6, { tone: "hi", crease: "lo", lit }, { steps: 18 });
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const mx = cx + dx * r * 0.72, my = cy + dy * r * 0.72;
    S.tube([[cx, cy, z], [mx, my, z]], 0.55, { tone: "mid", maxLength: 20 });
    S.cyl(mx, my, r * 0.2, z - 0.6, 2, { tone: "hi" }, { steps: 12 });
    S.raw([mx, my, z + 1.6], `<path class="nd-prop" d="${ellipseOnTop(mx, my, r * 0.48, r * 0.48, z + 1.5, S.P, 24)}"/>`, { bias: 2 });
  }
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const M = navModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 60, y: 84, w: 22, d: 28, r: 1.5 });

  // ── Карта на подложке: сетка 1 см, река, лес и холм, линия А–Б ──
  S.group = "map";
  S.box({ x: MAP.x - 3, y: MAP.y - 3, w: MAP.w + 6, d: MAP.d + 6, r: 1.6 }, 0, 1.2, { tone: "mid" }, { steps: 3, layer: 0.3 });
  const mf = k.topMatrix([MAP.x, MAP.y + MAP.d], 1.25, P, "y");
  let m = `<rect x="0" y="0" width="${MAP.d}" height="${MAP.w}" class="nd-paper"/>`;
  for (let u = 0; u <= MAP.d + 0.01; u += CMU) m += `<path class="nd-grid" d="M${u.toFixed(1)} 0V${MAP.w}"/>`;
  for (let v = 0; v <= MAP.w + 0.01; v += CMU) m += `<path class="nd-grid" d="M0 ${v.toFixed(1)}H${MAP.d}"/>`;
  m += `<path class="nd-river" d="M0 20C18 14 30 34 52 27S84 10 ${MAP.d} 18"/>`;
  const fc = [MAP.d - 30, MAP.w - 24];
  m += `<ellipse cx="${fc[0]}" cy="${fc[1]}" rx="22" ry="13" class="nd-forest"/><ellipse cx="${fc[0]}" cy="${fc[1]}" rx="13" ry="7.5" class="nd-contour"/><ellipse cx="${fc[0]}" cy="${fc[1]}" rx="6" ry="3.4" class="nd-contour"/>`;
  m += txt(6, 14, "река", "nd-t") + txt(fc[0], fc[1] + 18, "лес и холм", "nd-t", "middle");
  m += txt(MAP.d - 3, 6.5, SCALES.find((x) => x[0] === M.sc)[1], "nd-t b", "end") + txt(MAP.d - 3, 11.5, "1 клетка = 1 см", "nd-t", "end");
  // Север вверх: стрелка в левом верхнем углу.
  m += `<path class="nd-north" d="M5 ${(MAP.w * 0.42).toFixed(1)}V${(MAP.w * 0.42 - 12).toFixed(1)}M2.6 ${(MAP.w * 0.42 - 8).toFixed(1)}L5 ${(MAP.w * 0.42 - 12).toFixed(1)}L7.4 ${(MAP.w * 0.42 - 8).toFixed(1)}"/>` + txt(5, MAP.w * 0.42 - 14, "С", "nd-t b", "middle");
  const bU = A_U + M.cm * CMU;
  m += `<path class="nd-line" d="M${A_U} ${LINE_V}H${bU.toFixed(1)}"/>`;
  const mid = (A_U + bU) / 2;
  m += `<rect x="${(mid - 19).toFixed(1)}" y="${(LINE_V + 3).toFixed(1)}" width="38" height="11.5" rx="2" class="nd-tag"/>` + txt(mid.toFixed(1), LINE_V + 7.8, `${fmt(M.cm, 1)} см на карте`, "nd-t", "middle") + txt(mid.toFixed(1), LINE_V + 12.6, `= ${dist(M.meters)}`, "nd-t b", "middle");
  S.raw([MAP.x + MAP.w / 2, MAP.y + MAP.d / 2, 1.3], `<g transform="${mf}">${m}</g>`, { layer: 0.35 });

  // ── Булавки А и Б ──
  S.group = "pins";
  for (const [u, name] of [[A_U, "А"], [bU, "Б"]]) {
    const [x, y] = onMap(u, LINE_V);
    S.tube([[x, y, 1.3], [x, y, 9]], 0.45, { tone: "mid" });
    S.solid(G.sphereOf([x, y, 10], 2, P, { steps: 16 }), { tone: "hi", className: "nd-pinhead" }, [x, y, 10], { bias: 1 });
    const p = k.iso([x, y, 14.5], P);
    S.raw([x, y, 15], txt(p[0].toFixed(1), p[1].toFixed(1), name, "nd-pin", "middle"), { bias: 2 });
  }

  // ── Роза ветров: диск со сторонами света ──
  S.group = "rose";
  S.cyl(ROSE[0], ROSE[1], ROSE_R, 0, 2.4, { tone: "hi", crease: "lo" }, { steps: 64 });
  let rose = `<path class="nd-rose" d="${ellipseOnTop(ROSE[0], ROSE[1], ROSE_R - 3, ROSE_R - 3, 2.45, P, 64)}"/>`;
  for (const side of ["N", "S", "W", "E"]) {
    const [dx, dy] = DIR[side];
    const tip = k.iso([ROSE[0] + dx * (ROSE_R - 9), ROSE[1] + dy * (ROSE_R - 9), 2.45], P), c = k.iso([ROSE[0], ROSE[1], 2.45], P);
    rose += `<path class="nd-ray" d="M${c[0].toFixed(1)} ${c[1].toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}"/>`;
    const at = [ROSE[0] + dx * (ROSE_R - 4.6), ROSE[1] + dy * (ROSE_R - 4.6)];
    const mark = state.guess === side ? (M.right ? " ok" : " bad") : "";
    if (mark) rose += `<path class="nd-mark${mark}" d="${ellipseOnTop(at[0], at[1], 3.6, 3.6, 2.5, P, 28)}"/>`;
    rose += `<g transform="${k.topMatrix(at, 2.5, P, "y")}">${txt(0, 1.5, LETTER[side], `nd-letter${mark}`, "middle")}</g>`;
  }
  S.raw([ROSE[0], ROSE[1], 2.5], rose, { bias: 1 });

  // ── Ветроуказатель: мачта, «колбаса» рисуется каждый кадр ──
  S.group = "sock";
  S.cyl(SOCK[0], SOCK[1], 3, 0, 1.4, { tone: "mid" });
  S.tube([[SOCK[0], SOCK[1], 1.4], [SOCK[0], SOCK[1], 44]], 0.7, { tone: "mid", maxLength: 30 });
  S.raw([SOCK[0], SOCK[1], 44], `<g data-part="sock"></g>`, { bias: 6 });

  // ── Дрон над розой (рисуется каждый кадр: его сносит ветер) ──
  S.group = "drone";
  S.raw([ROSE[0], ROSE[1], 60], `<g data-part="drift"></g>`, { bias: 40 });

  // ── Табличка прогноза ──
  S.group = "sign";
  for (const yy of [SIGN.y + 7, SIGN.y + SIGN.d - 7]) S.tube([[SIGN.x + 2, yy, 0], [SIGN.x + 2, yy, SIGN.z0]], 0.7, { tone: "mid" });
  S.box({ ...SIGN, r: 0.8 }, SIGN.z0, SIGN.h, { tone: "hi" }, { bevel: 0.3, ref: [SIGN.x + SIGN.w, SIGN.y + SIGN.d / 2, SIGN.z0 + SIGN.h / 2] });
  const sf = k.sideMatrix([SIGN.x + SIGN.w, SIGN.y + SIGN.d - 3], SIGN.z0 + SIGN.h - 3, P, "right");
  const sw = SIGN.d - 6;
  S.raw([SIGN.x + SIGN.w + 0.3, SIGN.y + SIGN.d / 2, SIGN.z0 + SIGN.h / 2], `<g transform="${sf}">${txt(sw / 2, 5.4, "ПРОГНОЗ", "nd-st", "middle")}${txt(sw / 2, 11.6, `ветер ${WIND_NAME[state.wind]}`, "nd-st b", "middle")}${txt(sw / 2, 16.6, "6 м/с", "nd-ss", "middle")}</g>`, { bias: 3 });

  // ── Мачта высоты: шкала 0–1000 м и дрон на каретке ──
  S.group = "mast";
  S.cyl(MAST[0], MAST[1], 7, 0, 3, { tone: "mid" }, { steps: 32 });
  S.tube([[MAST[0], MAST[1], 3], [MAST[0], MAST[1], HZ(1000) + 4]], 0.9, { tone: "mid", maxLength: 30 });
  S.box({ ...BOARD, r: 0.4 }, 3, HZ(1000) - 1, { tone: "hi" }, { steps: 2, ref: [BOARD.x + BOARD.w, BOARD.y + BOARD.d / 2, 40] });
  const bf = k.sideMatrix([BOARD.x + BOARD.w, BOARD.y + BOARD.d], HZ(1000) + 2, P, "right");
  let sc = "";
  for (let hh = 0; hh <= 1000; hh += 100) {
    const y = (1000 - hh) * 0.072 + 2;
    sc += `<path class="nd-tick" d="M0 ${y.toFixed(2)}h${hh % 500 ? 1.6 : 3}"/>`;
    if (hh % 250 === 0) sc += txt(-0.8, y + 1.3, hh === 1000 ? "1000 м" : String(hh), "nd-num", "end");
  }
  S.raw([BOARD.x + BOARD.w + 0.3, BOARD.y + BOARD.d / 2, 40], `<g transform="${bf}">${sc}</g>`, { bias: 3 });
  const hz = HZ(Number(state.h));
  S.cyl(MAST[0], MAST[1], 1.9, hz - 1.5, 3, { tone: "hi", crease: "lo" }, { steps: 16 });
  miniDrone(S, MAST[0] + 9, MAST[1], hz + 0.5, { r: 6.5, lit: Math.abs(M.T) < 0.05 });
  S.tube([[MAST[0] + 1.6, MAST[1], hz], [MAST[0] + 6, MAST[1], hz + 0.4]], 0.5, { tone: "mid" });

  // ── Термометр: стеклянная трубка, столбик по температуре на высоте дрона ──
  S.group = "thermo";
  S.box({ x: THERMO[0] - 7, y: THERMO[1] - 10, w: 14, d: 20, r: 2 }, 0, 9, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  const tf = k.sideMatrix([THERMO[0] + 7, THERMO[1] + 8], 8, P, "right");
  S.raw([THERMO[0] + 7.3, THERMO[1], 4.5], `<g transform="${tf}"><rect x="0" y="0" width="16" height="7" rx="1" class="osd-screen"/>${txt(8, 4.7, temp(M.T), "nd-tt", "middle")}</g>`, { bias: 3 });
  const lo = 12, hi = 70, frac = clamp((M.T + 4) / 8, 0, 1);
  // Жидкость: красная выше нуля, синяя ниже.
  const liq = `nd-liquid${M.T < -0.04 ? " cold" : ""}`;
  S.solid(G.sphereOf([THERMO[0], THERMO[1], lo], 3.2, P, { steps: 18 }), { tone: "hi", className: liq }, [THERMO[0], THERMO[1], lo]);
  S.cyl(THERMO[0], THERMO[1], 1.3, lo, Math.max(0.5, (hi - lo) * frac), { tone: "hi", className: liq }, { steps: 12, bias: 1 });
  S.raw([THERMO[0], THERMO[1], 40], `<path class="nd-glass" d="${k.segment([THERMO[0], THERMO[1] + 2.2, lo], [THERMO[0], THERMO[1] + 2.2, hi], P)}"/><path class="nd-glass" d="${k.segment([THERMO[0], THERMO[1] - 2.2, lo], [THERMO[0], THERMO[1] - 2.2, hi], P)}"/>`, { bias: 3 });
  // Риска 0 °C на трубке.
  const z0c = lo + (hi - lo) * 0.5;
  S.raw([THERMO[0], THERMO[1], z0c], `<path class="nd-zero" d="${k.segment([THERMO[0], THERMO[1] + 3.6, z0c], [THERMO[0], THERMO[1] - 3.6, z0c], P)}"/>`, { bias: 4 });

  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Штурманский стол: карта с сеткой и отрезком А–Б, роза ветров с ветроуказателем и дроном, табличка прогноза, мачта высоты и термометр.", body: S.svg() });
  const [ax, ay] = onMap(A_U, LINE_V), [bx, by] = onMap(bU, LINE_V);
  const labels = labelsAt(P, [
    ["Карта", [MAP.x + MAP.w * 0.3, MAP.y + MAP.d * 0.45, 1.3], `Масштаб ${SCALES.find((x) => x[0] === M.sc)[1]}: 1 см на карте = ${dist(M.mPerCm)} на местности. Одна клетка — 1 см.`],
    ["Точки А и Б", [(ax + bx) / 2, (ay + by) / 2, 10], `Отрезок ${fmt(M.cm, 1)} см на карте = ${fmt(M.cm, 1)} × ${dist(M.mPerCm)} = ${dist(M.meters)} на местности.`],
    ["Роза ветров", [ROSE[0] + ROSE_R * 0.62, ROSE[1] - ROSE_R * 0.42, 2.5], "Стороны света: С — север (от тебя), Ю — юг, З — запад (слева), В — восток (справа)."],
    ["Ветроуказатель", [SOCK[0], SOCK[1], 40], "«Колбаса» вытягивается туда, куда дует ветер, — по ней видно снос."],
    ["Дрон", [ROSE[0], ROSE[1], 18], "Висит над розой ветров. Когда задуёт ветер, его снесёт по ветру."],
    ["Прогноз", [SIGN.x + SIGN.w, SIGN.y + SIGN.d / 2, SIGN.z0 + SIGN.h], "Ветер называют по стороне, откуда он дует: южный — с юга на север."],
    ["Мачта высоты", [MAST[0], MAST[1], hz + 4], `Дрон на высоте ${fmt(Number(state.h))} м. Шкала — до 1000 м.`],
    ["Термометр", [THERMO[0], THERMO[1], 50], `На высоте дрона ${temp(M.T)}: у земли +3 °C, каждые 100 м вверх — на 0,6 °C холоднее.`],
  ]);
  return { svg, P, labels, model: M, parts: S.count() };
}

// camTo — скрытое: к чему подъехать камере на телефоне (ставит смена условия, см. sets).
export const defaults = { sc: 50000, cm: 3, wind: "S", guess: "", h: 0, camTo: "" };
export const controls = [
  { id: "sc", label: "Масштаб карты", type: "seg", options: SCALES, num: true, rebuild: true, sets: { camTo: "map" } },
  { id: "cm", label: "Отрезок А–Б на карте", type: "range", min: 0.5, max: 10, step: 0.1, fmt: (v) => `${fmt(v, 1)} см`, rebuild: true, sets: { camTo: "map" } },
  { id: "wind", label: "Прогноз: откуда дует ветер", type: "seg", options: WINDS, rebuild: true, resets: ["guess"], sets: { camTo: "rose" } },
  { id: "guess", label: "Куда снесёт дрон?", type: "seg", options: [["", "—"], ["N", "на север"], ["S", "на юг"], ["W", "на запад"], ["E", "на восток"]], rebuild: true, sets: { camTo: "rose" } },
  { id: "h", label: "Высота полёта", type: "range", min: 0, max: 1000, step: 10, fmt: (v) => `${v} м`, rebuild: true, sets: { camTo: "mast" } },
];
export const tour = [
  { at: 0, set: { sc: 50000, cm: 2 } },
  { at: 3, set: { sc: 25000, cm: 4 } },
  { at: 6, set: { guess: "N" } },
  { at: 9, set: { h: 500 } },
];

export function controller(root, built, state) {
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const sockEl = q("sock"), driftEl = q("drift");
  const sim = { t: 0 };
  // Камера на телефоне: условие только что сменили (стенд пересобран) — 6 с показываем крупно то,
  // что от него меняется (карту, розу ветров, мачту с термометром), потом снова всю сцену.
  // Пока тянешь ползунок, каждая смена пересобирает стенд и продлевает показ.
  const cam = state.camTo ? { to: state.camTo, t0: typeof performance === "object" ? performance.now() : 0 } : null;
  state.camTo = "";
  let M = built.model;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      M = navModel(st);
      // Ветер «включается», когда ответ выбран: до этого колбаса висит, дрон ровно висит над розой —
      // направление нужно понять по прогнозу, а не подсмотреть.
      const blowing = !!st.guess;
      const [wx, wy] = DIR[M.to];
      const flap = blowing && !calm ? Math.sin(sim.t * 8) * 1 : 0;
      const pts = [0, 1, 2, 3].map((j) => (blowing ? [SOCK[0] + wx * (1.5 + j * 6), SOCK[1] + wy * (1.5 + j * 6) + (j ? flap * (j / 3) * 1.6 : 0), 43 - j * 0.8] : [SOCK[0] + 1.2, SOCK[1] + 1.2, 42 - j * 5.2]));
      let sock = "";
      for (let j = 0; j < 3; j++) sock += `<path class="pf-sock${j % 2 ? " w" : ""}" style="stroke-width:${(5 - j * 1.1).toFixed(1)}" d="${k.segment(pts[j], pts[j + 1], P)}"/>`;
      sockEl.innerHTML = sock;
      // Дрон: висит в центре, по ветру — уплывает к краю розы и возвращается.
      const ph = blowing ? (calm ? 0.7 : (sim.t * 0.32) % 1) : 0;
      const off = ph * (ROSE_R + 6);
      const cx = ROSE[0] + wx * off, cy = ROSE[1] + wy * off, cz = 18 + (calm ? 0 : Math.sin(sim.t * 2.2) * 0.6);
      const S2 = scene(P);
      if (blowing && off > 2) {
        const a = k.iso([ROSE[0], ROSE[1], 3], P), b = k.iso([cx, cy, 3], P);
        S2.raw(-1e6, `<path class="nd-trail" d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}"/>`, { layer: 0 });
      }
      S2.raw(-9e5, `<path class="nd-shadow" d="${ellipseOnTop(cx, cy, 6, 6, 2.6, P, 28)}"/>`, { layer: 0 });
      miniDrone(S2, cx, cy, cz, { r: 8 });
      driftEl.innerHTML = S2.svg();
      return true;
    },
    follow() {
      if (!cam || performance.now() - cam.t0 > 6000) return null;
      if (cam.to === "map") {
        const [ax, ay] = onMap(A_U, LINE_V), [bx, by] = onMap(A_U + M.cm * CMU, LINE_V);
        const a = k.iso([ax, ay, 1], P), b = k.iso([bx, by, 1], P);
        const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 8, clamp(W / (span + 260), 1.5, 2.2)];
      }
      if (cam.to === "rose") {
        const c = k.iso([ROSE[0], ROSE[1], 10], P);
        return [c[0], c[1], 2];
      }
      if (cam.to === "mast") {
        const c = k.iso([(MAST[0] + THERMO[0]) / 2, (MAST[1] + THERMO[1]) / 2, HZ(Number(state.h)) * 0.6 + 14], P);
        return [c[0], c[1], 1.8];
      }
      return null;
    },
    facts() {
      return { meters: M.meters, cm: M.cm, T: M.T, right: M.right };
    },
    readout() {
      const sc = SCALES.find((x) => x[0] === M.sc)[1];
      const g = !state.guess ? "куда снесёт?" : M.right ? `✓ снесёт на ${SIDE_NAME[M.to]}` : `✗ не на ${SIDE_NAME[state.guess]}`;
      return `${sc} · ${fmt(M.cm, 1)} см = ${dist(M.meters)} · ветер ${WIND_NAME[state.wind]} · ${g} · ${fmt(Number(state.h))} м: ${temp(M.T)}`;
    },
    explain(chip) {
      const c = chip.replace(/^[✗✓]\s*/, "");
      if (/^1:/.test(c)) return `1 см на карте = ${fmt(M.sc)} см = ${dist(M.mPerCm)} на местности.`;
      if (/ см = /.test(c)) return `${fmt(M.cm, 1)} см × ${dist(M.mPerCm)} = ${dist(M.meters)}.`;
      if (/^ветер/.test(c)) return "Ветер называют по стороне, ОТКУДА он дует.";
      if (/снесёт|куда снесёт|^не на/.test(c)) return `Ветер ${WIND_NAME[state.wind]} дует с ${{ N: "севера", S: "юга", W: "запада", E: "востока" }[state.wind]} — дрон сносит на ${SIDE_NAME[M.to]}.`;
      if (/ м: /.test(c)) return `${GROUND_T} − 0,6 × ${fmt(Number(state.h) / 100, 1)} = ${temp(M.T)}. Каждые 100 м вверх — на 0,6 °C холоднее.`;
      return "";
    },
    metrics() {
      return [
        ["1 см на карте", dist(M.mPerCm), `1:${fmt(M.sc)}`],
        ["Отрезок на местности", `${fmt(M.cm, 1)} см × ${dist(M.mPerCm)} = ${dist(M.meters)}`, ""],
        ["Ветер → снос", `${WIND_NAME[state.wind]} → на ${SIDE_NAME[M.to]}`, state.guess ? (M.right ? "угадал" : "мимо") : ""],
        ["Температура на высоте", `${GROUND_T} − 0,6 × ${fmt(Number(state.h) / 100, 1)} = ${temp(M.T)}`, ""],
      ];
    },
    note() {
      const map = `<b>Масштаб 1:${fmt(M.sc)}:</b> 1 см = ${dist(M.mPerCm)}, значит ${fmt(M.cm, 1)} см на карте — это <b>${dist(M.meters)}</b>.`;
      const wind = !state.guess ? ` <b>Прогноз: ветер ${WIND_NAME[state.wind]}.</b> Куда снесёт дрон? Выбери ответ — ветер задует.` : M.right ? ` <b>Верно:</b> ветер ${WIND_NAME[state.wind]} дует ОТ ${{ N: "севера", S: "юга", W: "запада", E: "востока" }[state.wind]}, дрон уносит на ${SIDE_NAME[M.to]}.` : ` <b>Не туда:</b> ветер называют по стороне, откуда он дует. ${WIND_NAME[state.wind][0].toUpperCase()}${WIND_NAME[state.wind].slice(1)} сносит на ${SIDE_NAME[M.to]}.`;
      const t = ` <b>На ${fmt(Number(state.h))} м:</b> ${GROUND_T} − 0,6 × ${fmt(Number(state.h) / 100, 1)} = ${temp(M.T)}.${M.T < -0.04 ? " Ниже нуля: батарея отдаёт меньше, возможно обледенение." : ""}`;
      return map + wind + t;
    },
  };
}
